---
name: review-code
description: Pre-commit / pre-PR code review cho Pinrich (3 repo). Tự nhận repo + load đúng CONVENTIONS.md, review theo thứ tự correctness→security→traps→perf→quality, chỉ flag có bằng chứng, không lặp lại cái lint đã bắt. Dùng khi user nói "review giúp tôi đi", "review đi", "check code giúp tôi", "review code", "check before commit", "sắp commit", "kết thúc PR". KHÔNG trigger cho debugging, viết test, hay giải thích code. Verify chạy thật trên app → dùng /pinrich-suite:qa-verify, không phải skill này.
disable-model-invocation: false
---

# Review Code — Pinrich (3 repo)

Trả lời bằng tiếng Việt. Review **diff**, không review cả branch.

## Nguyên tắc (đọc trước — đây là cái phân biệt review tốt vs liệt kê)

1. **Lint/Prettier đã lo phần máy móc → KHÔNG review lại nó.** `semi`, indent, import order, `no-console`, `prefer-const`, format... đã bị `lint-staged` chặn lúc commit. Bê mấy cái này vào report = nhiễu, che mất vấn đề thật. Chỉ nhắc nếu nghi lint KHÔNG chạy.
2. **Thứ tự ưu tiên: Correctness → Security → Project traps → Performance → Quality.** Bug logic + lỗ hổng quan trọng hơn readability. Soát theo thứ tự này, đừng sa đà readability trước.
3. **Chỉ flag khi có BẰNG CHỨNG trong diff.** Không suy đoán, không nit cho có. Mỗi finding phải chỉ được `file:line` + tại sao sai + cách fix cụ thể. Không chắc → đặt câu hỏi (Question), đừng khẳng định Bug.
4. **Verify chạy-thật KHÔNG phải việc của skill này.** Đây là static review. Muốn chứng minh fix chạy đúng trên app thật (API/DB/UX/multi-user) → bàn giao sang `/pinrich-suite:qa-verify`. Đừng tự generate Playwright ở đây.

---

## Step 0 — Scope + nhận repo (BẮT BUỘC làm trước)

```bash
git diff develop...HEAD --stat        # phạm vi: file nào, bao nhiêu dòng
git log develop..HEAD --oneline       # ý đồ commit
git diff develop...HEAD               # nội dung review (nếu lớn → đọc theo file)
```

Từ đường dẫn file, xác định **repo + stack + file convention** (mỗi repo luật KHÁC nhau):

| Dấu hiệu path | Repo | Stack | Convention + bẫy |
|---|---|---|---|
| `src/`, `server/`, `share/`, `management/`, `lambda/`, `v2/` trong `~/Projects/estimate` | **estimate** (legacy, prod) | Vue 3 + Express + Bookshelf + Bull | `estimate/CONVENTIONS.md` |
| `~/Projects/estimate-sdd/src/modules/...` | **estimate-sdd** (pinrich-api) | NestJS + Drizzle, Onion + CQRS | `estimate-sdd/CONVENTIONS.md` |
| `~/Projects/estimate-client-sdd/src/...` | **estimate-client-sdd** | Next.js 16 + React 19 + Jotai | `estimate-client-sdd/CONVENTIONS.md` |
| `~/Projects/pinrich-satei` (remote `nestjs-ssr`), có `server/` + `client/` | **pinrich-satei** | NestJS SSR + Vue 3 + Vite (TypeORM) | CHƯA có `CONVENTIONS.md` → xem nhánh fallback dưới. Traps chung an toàn: SSR (server `server/` vs client `client/` — code chạy 2 môi trường, đừng dùng API browser-only ở server render); TypeORM (relation lazy/eager → N+1; entity/migration đổi → soát call-sites + đồng bộ migration); Vue 3 client (reactivity, lifecycle/cleanup, props/emit). |

**Đọc đúng `CONVENTIONS.md` của repo đó** trước khi review — đừng áp luật legacy lên SDD và ngược lại. Diff đụng nhiều repo → review từng repo theo luật riêng.

**Fallback — repo không khớp bảng HOẶC thiếu `CONVENTIONS.md`** (vd `pinrich-satei` hiện CHƯA có file này; verify: `ls ~/Projects/pinrich-satei/CONVENTIONS.md 2>/dev/null`): vẫn review theo đúng thứ tự **correctness → security → traps → perf → quality**, nhưng convention dựa trên cái **quan sát được từ code xung quanh** (pattern file lân cận, cách module đã làm) thay vì file luật. Trong report **báo rõ "repo này chưa có `CONVENTIONS.md`"** để author biết review dựa trên convention quan sát, không phải file chuẩn.

Tóm tắt 2–3 dòng: thay đổi này **làm gì**, đụng repo/layer nào, là feature mới hay sửa cái có sẵn. Rồi mới review.

> Nếu cần hiểu sâu business/feature đang đụng → `/pinrich-suite:pinrich <keyword>` (memory map), đừng tự đoán flow.

---

## Step 1 — Correctness & logic (ưu tiên cao nhất)

- **Edge/null/empty**: input rỗng, mảng 0 phần tử, optional undefined, số 0/âm, chuỗi rỗng — code có nổ hoặc xử lý sai không?
- **Lời gọi API/hàm có khớp signature thật không** (nguồn bug AI/refactor phổ biến nhất): mở định nghĩa hàm/endpoint được gọi, đối chiếu tham số/return/shape. Đừng tin tên hàm nghe-có-vẻ-đúng.
- **Ordering**: thao tác trên list (`map/filter/sort/reduce`, query có `ORDER BY`?) — output có giữ đúng thứ tự kỳ vọng không.
- **Async/await**: promise chưa await, race, `Promise.all` nuốt lỗi, try/catch thiếu ở chỗ I/O.
- **Call sites**: hàm/DTO/entity bị sửa → grep các chỗ gọi khác, có vỡ chỗ nào không (`grep -rn "<tên>"`).
- **State cũ vs mới**: refactor có đổi behavior ngầm không (giá trị mặc định, điều kiện, off-by-one).

## Step 2 — Security

- **Injection**: SQL/query nối chuỗi bằng template literal thay vì tham số hoá (Bookshelf raw / Drizzle `sql` raw). Mọi input từ user phải parameterized.
- **XSS**: `v-html`, `dangerouslySetInnerHTML`, render HTML từ user input.
- **AuthZ**:
  - SDD: endpoint mới có guard đúng chưa — `@Public()` chỉ khi thật sự public; `@Roles`/`@RequireAnyService` đủ chặt chưa (mặc định `AuthGuard` bảo vệ).
  - Legacy: route có qua middleware auth không; check ownership (user A đọc được data user B không).
- **Secret/log**: API key/token/PII hardcode hay log ra; `console`/logger in dữ liệu nhạy cảm.
- **IDOR / mass-assignment**: nhận nguyên `req.body` đổ thẳng vào model không whitelist field.

## Step 3 — Project traps (Pinrich-specific — cái Jest + lint KHÔNG bắt)

**estimate (legacy):**
- **SP/PC split** — đụng FE? Sửa 1 variant (`conditionalComponent()`) phải check variant kia.
- **Pinrich/Baitori brands** — `isBaitoriDomain()`; cả `src/` lẫn `management/` đều split.
- **`share/` coupling** — sửa entity/util trong `share/` chạy cả FE+BE → soát ảnh hưởng 2 phía; KHÔNG tạo phụ thuộc ngược `share/`→`server/` (ADR-001).
- **`url_share_user` = Client legacy** (1 row = client × dealType). Đừng nhầm với `clients`/`follow_ups` của SDD.
- **`SUB_DIRECTORY="deal"`** — route dưới `/deal/`.

**estimate-sdd (backend mới):**
- **Onion + CQRS** — code đặt đúng layer chưa (domain→application→infrastructure→controllers)? Business logic không rò ra controller; query nặng đi read-side, không nhồi vào domain. (Diff lớn/nghi ngờ → bật `onion-architecture-reviewer` ở Step 5.)
- **Đổi DTO** ở `pinrich-api` → client phải `npm run generate-client` regen SDK, nếu không FE lệch type.
- **Bảng đụng là bảng mới hay legacy introspect** — chỉ `clients`/`follow_ups`/`follow_up_*`/`billing_*`... là do module mới ghi; đừng tưởng mọi bảng trong `schema.ts` thuộc hệ mới.
- **Colocation test** `.test.ts` cho `domain/` + `application/` có không.

**estimate-client-sdd (frontend mới):**
- Server state (TanStack Query) vs client state (Jotai/form) tách đúng chưa; 1 file 1 component; business logic không rò xuống FE.
- Token 401 → redirect `/{segment}/login` còn đúng không.
- **i18n** (grounded — đừng false-flag): grep `useTranslation` trong `src/views` TRƯỚC. Nếu repo thực sự dùng i18next ở view → chuỗi mới nên theo. Thực tế hiện tại: views hardcode JP (i18next có trong deps nhưng CHƯA wire vào view) → hardcode JP là đúng pattern repo, KHÔNG flag.
- **JP number-format trap** (`[Trap]`, ref memory `pin-numbers-ja-jp`): grep diff `toLocaleString(` — thiếu `'ja-JP'` = mất locale (VN ra dấu chấm thay phẩy); và số đổ thẳng ra template/JSX không qua format (vd `{price}万円` với `price` number → thiếu phẩy ≥1000). Đây là nửa-bắt-được-tĩnh của `DOMAIN-RENT`/`DESIGN-NUMFMT-001`; nửa render thì `/pinrich-suite:qa-verify` (jp_domain_check) + `sdd-port-page` P6 lo.
- **React hooks**: `useEffect` có cleanup cho listener/interval/subscription (rò bộ nhớ) không; dep array thiếu/dư → stale state / vòng lặp vô hạn.
- **a11y** (web search 2025: chỗ FE review hay trượt): element đúng ngữ nghĩa (`button` cho action, `a` cho nav); input có label; error gắn với field (`aria-describedby`); focus/keyboard (Tab/Enter/Space) dùng được; component custom (modal/dropdown) có ARIA role/state.

## Step 4 — Performance & Quality

- **Perf**: N+1 query, loop gọi API/DB trong vòng lặp, fetch dư field, re-render không cần (React: dep array, memo; Vue: computed vs method), bundle import nặng.
- **Reuse-first (chống tự-chế lại cái repo đã có — lỗ hổng DỄ TRƯỢT nhất, lint KHÔNG bắt)**: TRƯỚC khi OK code mới hoặc flag "trùng lặp", soát primitive đã tồn tại chưa — `ls src/components/{atoms,ui}` + grep `src/hooks` + util/helper. Tự viết div/banner/format/validate mà repo đã có atom/hook = reuse-miss. (Đây đúng cái review trượt: tự chế alert thay vì dùng `Alert` atom.)
- **Chống over-engineering (mặt trái của DRY — Google eng-practices nhấn mạnh)**: chỉ tách/abstraction khi có **≥2–3 chỗ dùng thật**; đừng generic hoá cho nhu cầu tương lai chưa tồn tại (YAGNI). Abstraction dùng-1-lần = nợ, không phải DRY. Cân giữa "đủ DRY" và "đừng quá tay".
- **Quality (chỉ cái lint KHÔNG bắt)**: magic number/string lặp → named constant; hàm quá dài / nhiều trách nhiệm; trùng lặp logic có thể tách; `any` né type; code chết / TODO sót; tên biến gây hiểu nhầm; comment giải thích "tại sao" (không phải "làm gì"). **Bỏ qua** mọi thứ format/style mà Prettier/ESLint đã tự xử.

---

## Step 5 — (Optional) Fan-out subagent khi diff LỚN

Mặc định review **inline** (rẻ token). Chỉ fan-out khi diff rộng (>~10 file hoặc đụng nhiều layer SDD) — nói rõ cho user là sẽ tốn token hơn:

- `onion-architecture-reviewer` — khi đụng `estimate-sdd/src/modules/**` nhiều layer.
- `code-reviewer` (orchestrator JP, theo Spec受け入れ条件) — khi review gắn với 1 Spec SDD và muốn check Steering整合性.
- `Explore` — khi cần truy call-sites/ảnh hưởng lan rộng mà inline grep không xuể.

Spawn song song nếu chạy >1. Diff nhỏ → KHÔNG spawn, tự review xong luôn.

---

## Step 6 — Report

Format: **trạng thái tổng → finding theo severity → test/handoff**. Mỗi finding 1 dòng intent-word đầu (kiểu Conventional Comments) cho author prioritize nhanh.

```markdown
## Review — <branch / tóm tắt thay đổi>

**Repo:** <estimate | estimate-sdd | estimate-client-sdd>
**Scope:** <N file, layer nào, feature gì>
**Trạng thái:** ✅ Ready to commit  /  ⚠️ Cần sửa trước

### 🔴 Bug / Critical — phải sửa trước commit
- **[Bug]** `path/file.ts:42` — <mô tả sai cái gì + hệ quả>. Fix: <cụ thể>.
- **[Security]** `...:NN` — <lỗ hổng>. Fix: <cụ thể>.

### 🟡 Issue / Warning — nên sửa
- **[Issue]** `...:NN` — <vấn đề>. Fix: ...
- **[Trap]** `...:NN` — <SP/PC chưa cover variant PC / DTO đổi chưa regen SDK / ...>.

### 🟢 Suggestion / Nit — cải thiện sau (không chặn)
- **[Suggestion]** `...:NN` — <gọn hơn / tách hàm / named constant>.

### ❓ Question — chưa chắc, hỏi author
- **[Question]** `...:NN` — <điểm nghi ngờ cần author xác nhận intent>.
```

Intent-word: `[Bug]` `[Security]` `[Trap]` `[Issue]` `[Suggestion]` `[Nit]` `[Question]`. Không có finding nhóm nào → bỏ nhóm đó (đừng để rỗng).

---

## Step 7 — Test & bàn giao

- **Jest unit/integration cần thêm** (việc của dev): với mỗi logic/exception ở Step 1–2, đề xuất test case ngắn — mô tả + input + expected. Ưu tiên ca **edge/error** mà code mới động vào, và ca **regression** nếu là sửa feature cũ.
- **Verify chạy thật trên app** (API thật + DB persist + UX + multi-user): KHÔNG làm ở đây → **bàn giao `/pinrich-suite:qa-verify`**. Một dòng gợi ý: "Muốn chứng minh fix chạy đúng trên app thật → chạy `/pinrich-suite:qa-verify` cho branch này."

---

## Checklist tự soát (tránh review dở)

- [ ] Đã `git diff develop...HEAD` — review diff, KHÔNG review cả file/branch.
- [ ] Đã nhận đúng repo + đọc `CONVENTIONS.md` của repo đó.
- [ ] KHÔNG bê lỗi format/style mà lint/prettier đã tự xử vào report.
- [ ] Mỗi finding có `file:line` + lý do + cách fix; không nit suông, không suy đoán.
- [ ] Đụng FE legacy → đã check SP/PC + Pinrich/Baitori.
- [ ] Đụng `share/` → soát cả FE+BE.
- [ ] Đụng DTO SDD → nhắc regen SDK.
- [ ] Lời gọi API/hàm đã đối chiếu signature thật, không tin tên.
- [ ] Diff nhỏ → review inline (không spawn subagent tốn token).
- [ ] **Reuse-first**: đã `ls components/{atoms,ui}` + grep hooks/util → KHÔNG tự chế lại primitive đã có.
- [ ] **Anti over-engineering**: tách/abstraction chỉ khi ≥2–3 chỗ dùng thật (YAGNI), không generic hoá cho tương lai.
- [ ] FE React/Vue → đã soát hooks cleanup + dep array, a11y (label/keyboard/aria), i18n (không hardcode chuỗi).
- [ ] **JP number-format**: grep `toLocaleString(` thiếu `'ja-JP'` + số đổ thẳng ra template không format (memory `pin-numbers-ja-jp`).
- [ ] Đã bàn giao verify-chạy-thật sang `/pinrich-suite:qa-verify`, không tự generate Playwright ở đây.
