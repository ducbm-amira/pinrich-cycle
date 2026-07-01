---
name: pinrich-cycle
description: "Orchestrator mỏng + cửa trước cho skill Pinrich. Giữ state qua các phiên, route 1 lần vào trục build-trang hoặc fix-bug, gọi tuần tự các skill con (pinrich → db → design/sdd-port-page/bug-fix → review-code → qa-verify) và ÉP vòng lặp QA fail → quay lại fix. CŨNG là cửa hỏi-đáp 'dùng skill nào': khi user phân vân không biết chọn skill ('tôi muốn ...', 'làm X thì dùng gì', 'nên dùng skill nào', 'có skill nào để ...') → chỉ đúng skill. Dùng khi user nói 'pinrich cycle', 'vào cycle', 'bắt đầu task', 'chạy quy trình', 'tôi đang ở đâu', 'tiếp tục cycle', hoặc phân vân chọn skill. KHÔNG trigger khi user đã gọi đích danh 1 skill lẻ."
argument-hint: "[start <task> | status | next | verify | dashboard | budget | qa-pass | qa-fail <lý do> | done | reset | <câu hỏi 'dùng skill nào'> | để trống = status]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, AskUserQuestion
disable-model-invocation: false
---

Trả lời bằng tiếng Việt.

# Mục đích

Skill này **không làm việc thay** các skill con — nó là **sổ theo dõi trạng thái + người gác cổng**. Nó:

1. Đảm bảo **context sẵn sàng** trước khi vào việc — load `pinrich` *hoặc* quyết định bỏ qua có chủ đích cho fix nhỏ.
2. Route **đúng 1 lần** vào 1 trong 2 trục.
3. Nhớ bạn đang ở phase nào (qua state file → sống sót khi đổi phiên / context reset).
4. Gọi skill con đúng thứ tự bằng tool `Skill`.
5. **Ép vòng lặp**: `qa-verify` FAIL → quay lại trục fix, tăng iteration; chỉ `done` khi QA PASS.
6. Gác cổng: không cho qua bước commit/QA nếu chưa `review-code`.

> Nguyên tắc vàng: skill này KHÔNG tự đọc code, tự fix, tự QA. Mọi việc thật do skill con làm. Nó chỉ điều phối + ghi state.

---

# State file — KEY THEO REPO

Một cycle / repo (vì bạn làm xuyên 4 repo song song). File:

`~/.claude/pinrich-cycle/state-<repo>.md` — vd `state-estimate-sdd.md`, `state-pinrich-satei.md`.

`<repo>` là 1 trong: `estimate`, `estimate-sdd`, `estimate-client-sdd`, `pinrich-satei`. Khi chưa biết repo (lúc `start`), dùng tạm `state-pending.md` rồi đổi tên ngay khi route xác định repo.

Lần đầu: `mkdir -p ~/.claude/pinrich-cycle`. Format mỗi file:

```markdown
# Pinrich Cycle State

- task: <mô tả ngắn task hiện tại>
- track: build | bug | (chưa route)
- repo: <estimate | estimate-sdd | estimate-client-sdd | pinrich-satei | chưa rõ>
- branch: <tên nhánh hoặc ->
- step: INIT | ROUTE | GAPAUDIT | DESIGN | BUILD | BUGFIX | REVIEW | QA | DONE
- build_kind: port | design | handoff | -   (chỉ khi track=build)
- screens: <danh sách màn nếu task nhiều màn, vd "list, map, detail" | -> (1 màn / không áp dụng)
- current_screen: <màn đang làm trong đợt này | -> (khi task nhiều màn, làm lần lượt)
- gap_gate: pending | answered | n-a   (pending = đã đẻ QA, đang CHỜ leader/khách trả lời → KHÔNG được sang BUILD)
- iteration: <số vòng QA, bắt đầu 1>
- context_ready: yes | no
- qa_result: - | pass | fail
- cost_budget_usd: <số USD, tùy chọn — trần chi phí token; bỏ trống = không trần>
- next_action: <1 câu cụ thể: bước/lệnh nên chạy tiếp ngay>
- notes: <ghi chú ngắn, vd link task, propertyId test, PR số>
- updated: <YYYY-MM-DD>
```

> **`next_action` là bắt buộc cập nhật** mỗi lần đổi state — đây là field cho resumability (mở lại phiên là biết ngay làm gì tiếp). SessionStart hook đọc chính field này để bơm vào context.

## Artifact manifest — chống "trôi" giữa các phiên

Song song state file, mỗi cycle có một **manifest artifact**: `~/.claude/pinrich-cycle/artifacts-<repo>.json`. Đây là cách bưng `produces_contains` + drift-check của AIDLC (`verify-artifacts.mjs` đi kèm). Nó ghi: mỗi step BUILD/BUGFIX đã sinh **file nào** + file đó **bắt buộc chứa marker nào**.

```json
{
  "repo": "estimate-client-sdd",
  "root": "/home/grayf/Projects/estimate-client-sdd",
  "steps": [
    { "step": "BUILD", "agent": "sdd-port-page",
      "produces": ["app/owner/page.tsx"],
      "produces_contains": ["ja-JP", "data-testid", "useTokens"] }
  ]
}
```

- `produces` = file phải tồn tại. `produces_contains` = mỗi marker phải là substring trong ≥1 file produces của step đó.
- **Chọn marker theo bẫy đã biết** (memory): `ja-JP` (ép locale — [[pin-numbers-ja-jp]]), token/`useTokens` thay vì hardcode màu ([[design-fidelity-guard]]), `data-testid`/selector cho qa-verify bấu vào.
- Vì sao cần: skill con đánh dấu "done" rồi, nhưng đổi phiên / rebase / sửa tay có thể xoá file hoặc gutted nội dung → state vẫn "done" mà artifact đã trôi. Manifest + `verify` bắt được.

Nếu có nhiều file state đang dở → `status` không tham số liệt kê **tất cả** cycle đang chạy + repo của chúng, để bạn chọn.

Mỗi lần đổi state → đọc trước, sửa, ghi đè. Cập nhật `updated` (lấy ngày từ context, KHÔNG chạy `date` nếu đã biết).

> **Sau MỖI lần ghi state → regen dashboard** (giữ giao diện live): `node ~/.claude/pinrich-cycle/dashboard.mjs >/dev/null 2>&1 || true`. Một dòng, đừng để lỗi node chặn luồng. SessionStart hook cũng regen sẵn mỗi phiên — nên đầu phiên giao diện đã tươi.

## ⚠️ State có thể bị "thiu" — luôn reconcile trước

Đây là giới hạn thật của orchestrator mỏng: khi gọi skill con (vd `/bug-fix`), control đi vào nó **qua nhiều turn**, và **không có gì tự kéo về đây** để ghi state. Hai lớp phòng vệ:

- **SessionStart hook** (`~/.claude/pinrich-cycle/hooks/session-start.sh`, đã đăng ký global) tự bơm state cycle đang chạy + `next_action` vào context mỗi phiên → state luôn hiện ra dù không gọi skill.
- **Git-reconcile** (dưới đây) — git là trọng tài khi state lệch thực tế.

Đừng tin state file một cách mù quáng — **đối chiếu với hiện trạng git** ở mỗi lần được gọi:

1. Đọc state file.
2. Chạy nhanh trong repo tương ứng: `git -C ~/Projects/<repo> branch --show-current` + `git -C ~/Projects/<repo> log --oneline -3` + `git -C ~/Projects/<repo> status --short`.
3. Nếu hiện trạng mâu thuẫn state (vd state ghi `step=BUGFIX` nhưng đã có commit fix + working tree sạch) → **suy ra step thật**, sửa state, và nói rõ cho user "state lệch, mình đã chỉnh về <X> theo git".
4. **Ghi state ở MỖI ranh giới phase, không đợi 'xong hẳn'** — vừa rời 1 phase của skill con là cập nhật ngay.

---

# State machine

```
INIT ─► ROUTE ─┬─ build ─► [GAPAUDIT⏸] ─► [DESIGN] ─► BUILD ─┐
               │                                              ├─► REVIEW ─► QA ─► (PASS) DONE
               └─ bug ───────────────────────► BUGFIX ───────┘            │
                                                                          └─(FAIL)─► (BUGFIX) iteration++
```
GAPAUDIT có **cổng chờ ⏸**: đẻ QA xong → `gap_gate=pending` → DỪNG, không sang DESIGN/BUILD cho tới khi leader/khách trả lời (`gap_gate=answered`).

Bước → skill con tương ứng:

| Step | Hành động | Skill con gọi |
|------|-----------|---------------|
| INIT | Hiểu codebase/business *vừa đủ* cho task | `/pinrich` **chỉ khi cần** (xem dưới) |
| ROUTE | Đoán/hỏi trục + xác định repo + tách màn nếu nhiều | — (AskUserQuestion nếu mơ hồ / nhiều màn) |
| GAPAUDIT | Đối chiếu design khách ↔ app → QA cho leader (redesign trang đã có) | `/design-gap-audit` |
| DESIGN | Thiết kế / áp design màn (tùy chọn) | `/design-screen` hoặc `/apply-design-handoff` |
| BUILD | Dựng màn — theo `build_kind` | port→`/sdd-port-page` · handoff→`/apply-design-handoff` · design→`/apply-design-handoff` (design-screen Pha A–C đã đóng băng bundle, KHÔNG tự ra code) |
| BUGFIX | Fix bug / đổi behavior | `/bug-fix` |
| REVIEW | Review trước commit | `/review-code` |
| QA | Verify thật trên app | `/qa-verify` |

**Trục build linh hoạt (sửa lỗi "luôn port"):** không phải build nào cũng là port. Khi route vào build, xác định `build_kind`:
- **port** — có trang legacy cần chuyển Vue→Next. Đường: (DESIGN nếu cần thiết kế lại) → BUILD=`/sdd-port-page`.
- **design** — màn React mới *không có legacy*. ⚠️ `/design-screen` (Pha A–C) CHỈ tạo + đóng băng bundle Claude Design, **KHÔNG tự viết code**. Code ra ở bước BUILD=`/apply-design-handoff`. Chuỗi đúng: **DESIGN → BUILD(handoff) → REVIEW** — KHÔNG nhảy thẳng DESIGN→REVIEW (sẽ không có code để review). Lưu ý: design-screen Pha D thực chất tự gọi `/apply-design-handoff`; nếu bạn để design-screen chạy hết Pha D thì BUILD coi như xong, đừng gọi lại.
- **handoff** — đã có bundle design sẵn. BUILD=`/apply-design-handoff`, không cần DESIGN.

**GAPAUDIT — cổng trước khi build (chỉ khi redesign trang ĐÃ CÓ theo design khách):** nếu task là làm lại UI một trang đang chạy theo design khách (build_kind = design/handoff/port mà trang đã tồn tại ở legacy/SDD), **chèn GAPAUDIT trước DESIGN/BUILD**. Gọi `/design-gap-audit` → nó đẻ ra bảng QA (Hiện tại→Design→Cần xác nhận→Đề xuất). Set `gap_gate=pending` → **DỪNG, không tự sang BUILD**: phần lớn QA cần leader/khách chốt, code trước = nguy cơ đập lại (đập tầng filter, bịa số tiền…). Chỉ khi user xác nhận đã có câu trả lời → `gap_gate=answered` → đi tiếp. Trang **mới tinh không có legacy** thì bỏ GAPAUDIT (không có gì để đối chiếu) — đi thẳng DESIGN. Nguyên tắc khi đẻ QA: **chỗ nào phân vân là hỏi, không tự quyết** (xem memory `qa-when-in-doubt-ask`).

**Nhiều màn → chia từng màn, CONFIRM thứ tự với user:** nếu design khách trải nhiều màn (vd search consumer = list/map/detail/2 form), KHÔNG ôm cả cụm một nhịp. Ở ROUTE: liệt kê các màn vào `screens`, rồi **AskUserQuestion hỏi user làm màn nào trước** (đề xuất thứ tự rủi-ro-thấp-trước: form/nhỏ trước, map/nặng sau — theo lát mỏng strangler-fig). Set `current_screen`. Cycle chạy **trọn vòng (GAPAUDIT→…→QA→DONE) cho 1 màn**, xong mới hỏi màn kế. GAPAUDIT có thể fan-out theo màn cho nhanh, nhưng BUILD/REVIEW/QA bám đúng `current_screen` để mỗi màn là một lát giao được độc lập.

**`/db`** không phải 1 step — nó là công cụ ad-hoc. Gọi bất cứ lúc nào cần khám phá data (thường ở INIT hoặc khi BUILD/BUGFIX cần dò bảng), không gắn vào máy trạng thái.

**Loop QA fail:** dù trục nào, sửa lại sau QA fail đều đi qua BUGFIX (fix là fix). Nếu lỗi là build chưa xong đúng (vd port thiếu màn) thì quay lại BUILD thay vì BUGFIX — tùy bản chất lỗi, ghi rõ trong notes.

---

# Lệnh

Đọc `$ARGUMENTS`. Nếu khớp lệnh dưới → chạy lệnh. Nếu **không khớp lệnh nào** (câu hỏi tự nhiên kiểu "tôi muốn...", "làm X dùng gì", "nên dùng skill nào") → vào **chế độ hỏi-đáp** (cuối mục).

### (rỗng) hoặc `status`
1. `ls ~/.claude/pinrich-cycle/state-*.md`. Không có file nào → "Chưa có cycle nào. Dùng `/pinrich-cycle start <mô tả>`."
2. Nhiều file → liệt kê tất cả cycle đang chạy (repo, task, step) để user chọn.
3. Với cycle đang xét: **reconcile với git** (xem §State có thể bị thiu) rồi in bảng state gọn + **nêu rõ bước kế tiếp** (kèm lệnh gợi ý).

### `start <mô tả task>`
1. Nếu đã có cycle ở step ≠ DONE (bất kỳ repo nào) → cảnh báo "Đang có cycle dở: <task> @ <repo> (step <X>). Tiếp tục hay mở cycle mới?" qua AskUserQuestion. Không tự đè.
2. Ghi `state-pending.md`: `task=<mô tả>`, `step=INIT`, `iteration=1`, `context_ready=no`, còn lại trống.
3. Chạy INIT (**load context có điều kiện** — đừng mặc định nạp full):
   - Task đụng feature lạ / chưa rõ repo / chưa rõ business → gọi `/pinrich` (hoặc `/pinrich <keyword>`) rồi set `context_ready=yes`.
   - Fix nhỏ trên feature đã quen → **bỏ qua `/pinrich`** (bug-fix tự check memory ở Phase 1). Set `context_ready=yes` luôn.
   - Cần dò data → gọi `/db` (ad-hoc, không phải step).
4. Sang ROUTE.

### ROUTE (tự động sau INIT, hoặc khi step=ROUTE)
Đoán trục + xác định **repo** + (nếu build) **build_kind** từ mô tả:
- "fix", "sửa", "bug", "lỗi", "đổi behavior", "task Trello" → **bug**
- "port", "chuyển sang SDD/Next", "build lại trang ... ở FE mới" → **build**, `build_kind=port`
- "áp design", "implement handoff", có link `claude.ai/design` → **build**, `build_kind=handoff`
- "màn mới", "thiết kế màn ... (không có legacy)", "redesign" → **build**, `build_kind=design`

Set `track`, `repo`, `build_kind`, rồi **đổi tên `state-pending.md` → `state-<repo>.md`**.

**Tách màn (nếu task nhiều màn):** nhận ra design khách trải nhiều màn → ghi `screens`, **AskUserQuestion hỏi user làm màn nào trước** (gợi ý nhỏ/rủi-ro-thấp trước, nặng/map sau), set `current_screen`. Làm trọn 1 màn rồi mới sang màn kế. 1 màn → `screens=-`.

Set `step`:
- bug → `BUGFIX`.
- build + (design/handoff/port) mà **redesign trang ĐÃ CÓ theo design khách** → `GAPAUDIT` (set `gap_gate` sẽ thành `pending` sau khi đẻ QA). Đây là mặc định mới cho redesign.
- build+port (port thuần, không bận tâm đối chiếu design — vd chỉ chuyển Vue→Next y nguyên) → `BUILD`; chỉ vào `DESIGN` khi user nói rõ muốn **thiết kế lại**.
- build+design **trang mới không có legacy** → `DESIGN` (bỏ GAPAUDIT, không có gì đối chiếu).
- build+handoff không kèm trang cũ → `BUILD`.

Mơ hồ → AskUserQuestion (Build trang / Fix bug; nếu build thì kind nào; có phải redesign trang đã có không). Route **chỉ 1 lần**.

> **handoff**: `/apply-design-handoff` chỉ `curl` được link `api.anthropic.com/v1/design/h/<code>` (dạng `/h/`). Link `claude.ai/design/p/<uuid>` (share web) **không tải tự động được** → trước khi vào BUILD, xin user đưa link `/h/`, đừng để BUILD chặn-hỏi giữa chừng.

### `next`
Reconcile state trước, rồi gọi skill con của step hiện tại (bảng trên) — **dặn skill con SKIP self-verify** (xem §Tránh trùng verify). Cập nhật state ở mỗi ranh giới phase, không đợi xong hẳn. Chuyển step:
- GAPAUDIT: gọi `/design-gap-audit` (cho `current_screen` nếu nhiều màn) → khi nó đẻ xong bảng QA, set `gap_gate=pending` và **DỪNG** — báo user "QA xong, đang chờ leader/khách trả lời; mình không code trước." KHÔNG tự sang DESIGN/BUILD. Khi user xác nhận đã có câu trả lời (hoặc gõ điều tương đương) → cập nhật scope theo chốt, set `gap_gate=answered`, rồi sang DESIGN (nếu cần thiết kế lại) hoặc BUILD.
- DESIGN xong → step=BUILD (cả design & port đều cần BUILD: design→`/apply-design-handoff`, port→`/sdd-port-page`). KHÔNG bao giờ DESIGN→REVIEW thẳng.
- BUILD/BUGFIX xong → **ghi manifest** (`artifacts-<repo>.json`): thêm/cập nhật entry cho step vừa xong với `produces` (file vừa tạo/sửa — lấy từ `git -C <root> diff --name-only` hoặc skill con báo) + `produces_contains` (marker bắt buộc theo bẫy đã biết).
  - **🔒 TRACEABILITY gate (CHỈ track=build + build_kind=port) — chạy TRƯỚC khi cho REVIEW.** Đây là auto_review validator (mô hình AIDLC): BUILD-done ≠ "compile được" mà = "phủ đủ legacy". Không chạy = coi như BUILD chưa xong.
    1. Spawn subagent `Agent(subagent_type: "port-traceability")`, đưa: file legacy nguồn (view + component-tree) + dir React (`src/views/<màn>`) + URL app đang chạy. Nó đọc full legacy → enumerate → map → ra BẢNG ✅/❌/⊘ + verdict `TRACE_CLEAN` / `TRACE_GAP n`. (Nó tự chạy `port-harness/characterize.py` cho lớp máy [B] wiring + [C] side-effect.)
    2. **`TRACE_GAP n`** → xử như build chưa xong: trình bảng ❌ cho user DUYỆT (thật / reword / ⊘ cố ý bỏ). ❌ thật → quay lại **BUILD** vá (ghi lý do vào notes, iteration nếu cần), KHÔNG sang REVIEW. Chỉ khi mọi ❌ đã giải thích (fix hoặc ⊘-có-lý-do) → mới `TRACE_CLEAN`.
       - **⊘-ledger (BẮT BUỘC — chống nag):** mỗi ❌ user duyệt là `dropped`/`reword-ok` → **append vào `<react-repo>/.port/<route>.decisions.md`** (mỗi entry: `unit` + `verdict: dropped|reword-ok` + `reason` + `date`). Lần chạy sau subagent đọc ledger này → KHÔNG flag lại cái đã duyệt. Không ghi = gate lặp lại y hệt mỗi lần → user tắt gate. Chỉ ❌ *sẽ fix* thì đừng ghi ledger (để nó còn kiểm lại sau khi vá).
    3. **`TRACE_CLEAN`** → sang REVIEW.
    - Vì sao: LLM port rớt đuôi dài (nhánh/computed/prop/emit/side-effect vô hình) âm thầm; qa-verify + mắt mù. Gate này TỰ lôi ra thay việc user đọc-map tay. Xem [[port-scan-fire-and-forget-tracking]], memory harness.
  - Rồi step=REVIEW (nhắc "Code xong. Chạy `/review-code` trước khi commit." rồi gọi `/review-code`).
  - ⚠️ Nếu `/bug-fix` chạy tới Phase 4 hỏi "commit không?" → **trả lời CHƯA**; cycle phải chèn REVIEW trước rồi mới commit.
- REVIEW xong (sạch / đã sửa) → cho phép commit (commit + PR title **tiếng Anh** conventional) → step=QA.
- QA → gọi `/qa-verify`. KHÔNG tự quyết pass/fail — chờ user `qa-pass` / `qa-fail`.

### `verify`
Re-check artifact đã build có còn nguyên không (drift-check, read-only — KHÔNG sửa code). Chạy:

```bash
node ~/.claude/pinrich-cycle/verify-artifacts.mjs <repo>
```

- exit `0` = sạch → ok đi tiếp.
- exit `1` = **drift** (file mất / marker mất): in ra step nào trôi. Xử như QA fail — `iteration++`, quay lại đúng step (BUILD/BUGFIX), ghi lý do vào notes, **đừng `done`**.
- exit `2` = chưa có manifest → nhắc: manifest được ghi tự động ở ranh giới BUILD/BUGFIX; nếu thiếu là cycle chưa qua bước build nào.

Chạy `verify` **tự động trước `done`** (xem Gác cổng) và nên chạy lại đầu mỗi phiên cho cycle đang ở REVIEW/QA/DONE (state có thể đã thiu).

### `dashboard` [live]
Mở giao diện bảng-tín-hiệu của toàn bộ cycle (state machine + đèn qa/drift/budget + next_action).

**Tĩnh (mặc định)** — sinh 1 file rồi mở:
```bash
node ~/.claude/pinrich-cycle/dashboard.mjs && echo "Mở file://$HOME/.claude/pinrich-cycle/dashboard.html"
```
Sinh `dashboard.html` từ mọi `state-*.md` + `artifacts-*.json` (tự chạy `verify`/`budget` lấy đèn). Read-only, là ảnh chụp tĩnh — chỉ tươi khi regen.

**Live (`dashboard live`)** — server local tự reload real-time khi state đổi:
```bash
node ~/.claude/pinrich-cycle/dashboard.mjs --serve --port 4123
```
Mở `http://localhost:4123`, để tab đó — mỗi lần cycle ghi state (watch thư mục + SSE) tab tự nạp lại. Chạy nền (Ctrl-C để dừng). Dùng khi muốn theo dõi liên tục trong lúc làm.

### `budget`
Tính chi phí token đã tiêu cho repo (số thật, từ transcript Claude Code) và so với trần `cost_budget_usd` nếu có:

```bash
node ~/.claude/pinrich-cycle/budget.mjs <repo>
```

- exit `0` = dưới trần (hoặc chưa đặt trần) → ok.
- exit `1` = **vượt trần** → dừng đốt token: tổng kết hiện trạng, hỏi user trước khi chạy tiếp (như AIDLC `on_exceed: pause`).
- exit `2` = repo chưa có session nào.

⚠️ **Trung thực:** con số là cost của MỌI session Claude Code trong repo đó, không riêng task hiện tại. Muốn chỉ tính từ lúc start cycle → `--limit` và `--since <ISO>` (ghi mốc start vào notes lúc `start` nếu cần đo chính xác). Đặt trần: thêm `cost_budget_usd: <số>` vào state file.

### `qa-pass`
Set `qa_result=pass` (step vẫn QA, chờ chốt). Tóm tắt: task, repo, branch/PR, số iteration. Hỏi user gõ `done` để đóng cycle (hoặc còn việc gì trước khi đóng).

### `qa-fail <lý do>`
Set `qa_result=fail`, ghi `<lý do>` vào notes, `iteration++`. Chọn step quay lại theo bản chất lỗi: lỗi behavior/logic → `BUGFIX`; build chưa đúng/thiếu (port sót màn, handoff lệch) → `BUILD`. Báo "QA fail (vòng N): <lý do>. Quay lại <step>." rồi tiếp tục.

### `done`
Set `step=DONE`. In tổng kết cuối.
- **Nếu task nhiều màn (`screens` còn màn chưa làm):** đừng coi cả task xong — báo "Màn <current_screen> xong. Còn: <các màn còn lại>." rồi AskUserQuestion hỏi làm màn kế nào, set `current_screen` mới + đưa step về `GAPAUDIT` (hoặc BUILD nếu màn đó không cần đối chiếu), `iteration=1`, `qa_result=-`, `gap_gate` reset. Chỉ khi hết màn mới đóng hẳn.
- (Không xóa file — giữ để tra cứu; `reset`/`start` mới sẽ đè.)

### `reset`
Hỏi reset cycle của repo nào (nếu có nhiều) qua AskUserQuestion, xác nhận, rồi xóa đúng `state-<repo>.md` đó.

### Chế độ hỏi-đáp "dùng skill nào" (khi args không khớp lệnh nào)
User đang phân vân chọn skill. Đọc memory `pinrich-skill-cheatsheet` (bảng tình huống→skill) + đối chiếu ý định trong args, rồi:
1. **Chỉ đúng 1 skill** nên dùng (kèm 1 câu vì sao), hoặc 2 lựa chọn nếu ranh giới mờ (vd design mới vs có bundle sẵn).
2. Nếu đó là **cả một task trọn vẹn** (port/fix/build) → khuyên `/pinrich-cycle start <mô tả>` thay vì gọi skill lẻ, và hỏi có muốn start luôn không.
3. Ngắn gọn — đây là tra cứu, không phải chạy việc. KHÔNG tự gọi skill khi chưa hỏi.

---

# Tránh trùng verify — bắt buộc

Cycle **sở hữu** REVIEW (`/review-code`) + QA (`/qa-verify`) + vòng lặp fail→fix. Nhưng nhiều skill con **tự gọi** chúng ở phase cuối — chạy trong cycle sẽ **trùng** (Playwright headed 2 lần, review 2 lần):

- `/sdd-port-page` P5 (qa-verify), `/apply-design-handoff` P5 (qa-verify + review-code), `/design-screen` Cổng D (qa-verify + review-code).

→ Khi gọi các skill này, **dặn rõ**: *"đang trong /pinrich-cycle — chỉ build/port, BỎ QUA self qa-verify/review-code, cycle lo REVIEW+QA."*

**NGOẠI LỆ — giữ lại:** `/sdd-port-page` **P6 (verify-against-design bằng uat-toolkit)** không phải QA chức năng — nó bắt lệch design/pixel/format số mà `/qa-verify` không thấy (memory `design-fidelity-guard`). Để skill chạy P6; cycle vẫn chạy QA riêng của mình.

---

# Gác cổng (gates) — bắt buộc

- **Cổng GAPAUDIT (`gap_gate=pending`):** KHÔNG sang DESIGN/BUILD khi đang chờ trả lời QA. Phải có câu trả lời leader/khách (`gap_gate=answered`, scope đã chốt) mới đi tiếp. Code khi gate còn pending = vi phạm (nguy cơ đập lại tầng logic/số liệu).
- **Cổng TRACEABILITY (track=build + build_kind=port):** KHÔNG sang REVIEW khi subagent `port-traceability` trả `TRACE_GAP` còn ❌ chưa giải thích. BUILD-done = phủ đủ legacy, không phải compile được. ❌ thật → quay lại BUILD. (auto_review validator kiểu AIDLC — bọc `port-harness/characterize.py` + agent enumerate.)
- **Không cho sang QA nếu chưa qua REVIEW** ở iteration đó. Nếu user nhảy cóc → nhắc chạy `/review-code` trước.
- **Không `done` nếu `qa_result≠pass`.** QA chưa pass = chưa xong.
- **Trước `done` phải chạy `verify` (drift-check) và nó exit 0.** Nếu drift → treat như qa-fail, không đóng cycle. (Bưng từ AIDLC `verifyRun` — "approved" không có nghĩa artifact còn nguyên.)
- **Trần chi phí (nếu cycle đặt `cost_budget_usd`):** mỗi khi reconcile/`next`, chạy `budget <repo>`; exit 1 (vượt trần) → KHÔNG chạy thêm step tốn token, tổng kết + hỏi user (bưng `on_exceed: pause` của AIDLC). Không đặt trần thì bỏ qua.
- **Verdict cứng, không văn xuôi** (bưng từ AIDLC auto-review): mỗi gate kết ở 1 trong 3 trạng thái rõ — `pass` / `fail <lý do 1 dòng>` / `gated <chờ ai>` — và ghi thẳng vào `qa_result` + `notes`. Đừng để gate kết bằng đoạn văn mơ hồ rồi tự suy; có lý do fail cụ thể thì vòng lặp fix-lại mới deterministic.
- INIT không skip được khâu *quyết định*: phải đặt `context_ready=yes` — qua `/pinrich` khi feature lạ/chưa rõ repo, hoặc **skip có chủ đích** cho fix quen. Không để `context_ready=no` rồi nhảy thẳng BUILD/BUGFIX.

---

# Lưu ý

- Mỗi lần được gọi: **đọc state + reconcile với git trước** (state có thể thiu), hành động, **ghi state ở mỗi ranh giới phase**. Git là trọng tài khi state lệch; không dựa vào trí nhớ hội thoại.
- Khi gọi skill con, để nó tự chạy theo phase của nó; skill này chỉ chờ kết quả rồi cập nhật step. KHÔNG diễn giải lại nội dung skill con.
- Convention commit/PR: tiếng Anh, conventional — xem memory `commit-pr-english-convention`.
- Trục build mặc định đích backend = SDD; lưu ý routing 2 tầng (CloudFront+ALB) khi app mới 404/503 — xem memory `pinrich-route-2-layer-whitelist`.
- **Phân định trigger**: `bug-fix`/`sdd-port-page`/... cùng bắt cụm "fix bug"/"port trang" như cycle. Khi đang có cycle active (state ≠ DONE) và user nói "fix X"/"port Y" → coi là **tiếp tục cycle hiện tại**, route qua đây, đừng để skill con tự bung ngoài luồng.
