---
description: AI-assisted manual QA workflow. AI vận hành toàn bộ (đọc PR, generate test plan, chạy Playwright headed, sinh báo cáo), tester chỉ xem browser, confirm intent, làm tay vài TC khi script kẹt. Dành cho manual QA biết business + biết command docker cơ bản, KHÔNG đọc code. Mục tiêu test cái Jest unit/integration test KHÔNG biết — real API, data persistence, UX, multi-user, error feedback. KHÔNG đề xuất thêm Jest test. Dùng khi user nói "qa verify", "verify giúp tôi", "verify PR", "verify fix này", "kiểm tra fix chạy đúng chưa", "QA fix này", "test thử trên app", "confirm fix works". KHÔNG trigger cho viết unit test mới, debugging, hay giải thích code.
disable-model-invocation: false
---

# QA Verify (cho Tester/QA)

Mục tiêu: chứng minh một thay đổi **thật sự chạy đúng trên app thật**, không phải chỉ "code trông có vẻ đúng" hay "unit test pass".

**Công cụ chính**: Playwright headed — browser tự động mở, tester nhìn thấy trực tiếp từng bước.

Đầu vào thường là: 1 branch, 1 PR, hoặc 1 Trello card mô tả thay đổi.

---

## ⚠️ Giới hạn scope: qa-verify KHÔNG verify "khớp design"

qa-verify kiểm **chức năng + bắt cái HỎNG** (vỡ layout, overflow, console error, API 500 — qua Bug Sentinels). Nó **KHÔNG so với design** (màu/khung/bề rộng/vị trí-scale-số so với design/heading scale/tấm bọc). Sentinels chỉ thấy "hỏng", không thấy "khác design" → **đừng báo PASS rồi tưởng giống design**.

→ Fix theo **design bundle / port UI** thì design-fidelity phải verify ở **P6 verify-against-design của skill `sdd-port-page`** (render design ↔ render code, nhìn ảnh + `uat-toolkit`). Nếu task có file design/Figma → **route sang đó**, đừng giả vờ sentinels cover. (Bài học: trang owner pass chức năng nhưng lệch design — header xám, không bọc tấm trắng, giá thiếu phẩy — qa-verify không bắt được.)

> **NGOẠI LỆ — format value JP sai CHUẨN là domain bug, IN scope.** Phân biệt: "số đặt sai vị trí/scale so với design" = design (→ P6). Nhưng "giá `29880万` thiếu phẩy, 面積 thiếu ㎡, ngày sai chuẩn JP, `toLocaleString` mất locale" = **sai chuẩn nghiệp vụ bất kể design vẽ gì** — đây là oracle "Standards", qa-verify PHẢI bắt. Có máy bắt sẵn: `jp_domain_check` của `uat-toolkit` (xem Phase 4 + Phase 5). Đừng đẩy cái này sang P6 rồi để lọt (đúng lớp `pin-numbers-ja-jp` cứ tái diễn).

---

## Nguyên tắc cốt lõi: QA verify KHÔNG phải viết thêm automated test

**Jest unit/integration test đã cover logic code rồi.** QA verify là layer khác hoàn toàn — test những thứ automated test không bao giờ biết được:

| Automated test (Jest unit/integration) biết | QA verify trên app thật biết |
|--------------------------------------|------------------------------|
| Code path đúng không? | Backend thực sự trả 200 không? |
| Payload gửi đúng format không? | Data có persist vào DB không? |
| UI render đúng component không? | User nhìn thấy gì? Có bị lệch/flash/crash? |
| Mock API trả đúng thì UI đúng không? | API thật + DB thật + UI thật kết hợp đúng không? |
| Logic 1 user, 1 flow | 2 user đồng thời, race condition, draft sync |
| Happy path có pass không? | Khi fail, user thấy error message gì? |

**Sai lầm phổ biến:** Đọc diff xong đề xuất thêm Jest test → đó là việc của dev, không phải QA verify.

---

## 3 nguyên tắc vàng (vi phạm là verify vô nghĩa)

> **1. KHÔNG mock chính tầng mình đang verify.**
> Nếu thay đổi ở backend (virtual column, query, router) mà bạn mock luôn API response → fix **không hề được chạy**. Mock chỉ được phép ở tầng NẰM NGOÀI thứ đang verify.

> **2. Phải chọn KỊCH BẢN PHÂN BIỆT.**
> Chọn input mà code đã-fix và code chưa-fix cho ra kết quả **KHÁC NHAU**. Nếu test pass trên cả code cũ lẫn code mới → nó verify số 0. Luôn có ít nhất 1 ca "nếu chưa fix thì FAIL".

> **3. Suy nghĩ như tester nhiều năm kinh nghiệm.**
> Automated test (Jest) cover cái dev đã nghĩ đến. Tester giỏi test cái dev CHƯA nghĩ đến: timing, concurrent user, error UX, data persistence, edge case từ thực tế production. Đặt câu hỏi "nếu user làm khác một chút thì sao?"

---

## File phụ trợ

| File | Khi nào dùng |
|---|---|
| `bug-heuristics.md` | **Phase 2 + 4 + 5 — bộ não tìm bug.** Oracle FEW HICCUPPS (nhận ra bug), SFDIPOT (phủ kịch bản), ma trận data + error/timing. **Đọc khi mục tiêu là bắt nhiều bug nhất.** |
| `patterns.md` | Phase 2 đọc lọc theo Trigger; Phase 5 append entry mới. Quy tắc chi tiết ở đầu file đó. |
| `playwright-recipe.md` | Phase 4 lấy code block (bootstrap, preflight, helpers, templates, **section 8 Bug Sentinels — mandatory**). |
| `test-plan-template.md` | Phase 2 tham chiếu format manual TC. |
| `<project>/.qa-verify/fixtures.md` | Phase 1+3 đọc accounts/IDs đã pre-fill; đề xuất append khi có data mới đáng tái dùng. |

---

## Phase 1 — Hiểu thay đổi gì

**Đối tượng tester**: manual QA biết business + biết app, nhưng KHÔNG đọc code/diff/PR. Output Phase 1 phải plain-Vietnamese.

**0. ĐỌC `fixtures.md` TRƯỚC** — `<project>/.qa-verify/fixtures.md` đã có account/client tester pre-fill. Tin file này, KHÔNG re-detect. Nếu thiếu → hỏi rồi đề xuất append.

**1. Claude đọc** (tester không cần đọc):
- Branch: `git diff --stat develop...HEAD` + `git log develop..HEAD --oneline`
- PR: `gh pr view <number> --json title,body,files`
- Trello: hỏi tester paste nội dung card.

**2. Claude PHẢI present plain-Vietnamese summary 2-4 dòng TRƯỚC khi vào tech detail.** Format:

> **"Branch này [LÀM GÌ — business term]. Hiển thị/áp dụng ở [TRANG NÀO]. [Ai] thấy [gì khác trước]?**
>
> Bạn có quen feature này không, có muốn điều chỉnh hiểu của tôi không?"

Ví dụ:
> "Branch này backfill `client_histories` sang Rakucore và đồng bộ qua `rakucore_synced_at` — sau khi client mới được tạo, lịch sử của họ tự đẩy sang CRM Rakucore. Thấy được ở trang chi tiết Client và log đồng bộ. Trước fix lịch sử cũ không lên Rakucore, sau fix có. Bạn có quen feature này không?"

→ Tester confirm hiểu đúng intent **rồi** mới sang Phase 2. Đây là cách tester không-đọc-code vẫn validate hướng verify.

**3. Sau khi tester confirm**, Claude phân loại tầng (internal, không cần tester đọc):
- API/Model/Query (`api/models/**`, `api/routers/**`) → real API
- UI logic + display → Playwright
- Cả hai → e2e

**4. Grep consumer, xác định scope lan tới đâu, map task → fixture entries.**

## Phase 2 — Chọn kịch bản → **DỪNG chờ tester duyệt**

**Output Phase 2 là một bộ TEST PLAN MANUAL viết cho người non-tech** (tester không biết code, không hiểu test tự động, không quan tâm API). Mỗi test case phải đọc xong là click theo được ngay, không cần hỏi lại.

### 4 góc nhìn để sinh kịch bản

1. **End-to-end thật** — flow đầy đủ trên real API + DB; data persist; multi-user/session
2. **UX & visual** — user thấy gì ở từng bước; loading/toast/error; giá trị khớp data; có giật/lệch không
3. **Error path** — bug cũ user thấy gì; sau fix user thấy gì khi thành công; network chậm/timeout/retry
4. **Regression** — flow cũ còn chạy đúng không; "nếu user làm khác một chút" có ảnh hưởng

> **Chụp + NHÌN từng STATE, so nhất quán:** với trang có nhiều state (loading / error / not-found / loaded), chụp ảnh **mỗi state** rồi nhìn — chúng có **nhảy / khác chrome** nhau không (vd topbar full-width lúc loading rồi co lại lúc loaded). Đây là cách rẻ bắt bug state-jump bằng năng lực chụp sẵn có. (KHÔNG so với design — đó là P6; ở đây chỉ so các state VỚI NHAU cho nhất quán.)

### Phủ rộng bằng heuristic — đọc `bug-heuristics.md` (BẮT BUỘC khi mục tiêu là bắt nhiều bug)

4 góc nhìn trên là khung tối thiểu. Để KHÔNG bỏ sót cả một loại bug, chạy thêm các heuristic trong `bug-heuristics.md`:

- **SFDIPOT (Phần B)** — liệt kê mọi MẶT bị ảnh hưởng (Structure/Function/Data/Interfaces/Platform/Operations/Time). Mỗi mặt chưa có case → sinh thêm.
- **Ma trận data (Phần C)** — với mỗi field/list/upload đụng tới: thử rỗng/1/nhiều/cực nhiều, boundary, ký tự đặc biệt, **tiếng Nhật 全角/半角 + 漢字 hiếm**, null, trạng thái stale. Đây là mỏ bug lớn nhất.
- **Error & Timing (Phần D)** — ép API 500/403, mạng chậm, offline, race 2 user, double-click, token hết hạn, back/refresh giữa flow.
- **Oracle (Phần A)** — mỗi kịch bản gắn oracle nó kiểm (History/Image/Claims/Product/Standards…) để biết "đậu/rớt theo tiêu chí gì", không chỉ "expected khớp".

> Quy tắc: ưu tiên kịch bản **lệch oracle** (vd giá trị ở list ≠ detail, định dạng ngày không theo chuẩn Nhật, console đỏ khi thao tác) — đó là chỗ tester giỏi tìm ra cái dev chưa nghĩ tới. Token không phải ràng buộc → sinh DƯ còn hơn sót, lọc lại ở bước trần ~40 TC.

### Trước khi viết test case — đọc `patterns.md`

Lọc các entry có `Trigger` khớp scope đang verify → đưa vào nhóm kịch bản tương ứng (thường rơi vào **Edge case** hoặc **Multi-screen**).

### Format BẮT BUỘC: nhóm theo CATEGORY, mỗi case có Title / Steps / Expected

Chia test case thành các nhóm sau (chỉ giữ nhóm có case thật, bỏ nhóm rỗng):

- **A. UI** — hiển thị đúng vị trí, đúng style, đúng label/i18n
- **B. UI — Tooltip & Style nhất quán** — hover, layout, style consistent qua các trang
- **C. Functional** — logic chính: ai có / ai không có, badge/feature trigger đúng điều kiện
- **D. Validation** — đảm bảo phiên bản cũ đã bỏ, không còn artefact cũ, label đã đổi đúng
- **E. Edge case** — data rỗng, data nhiều, data đổi trạng thái, persistence sau reload
- **F. Multi-screen interaction** — luồng dùng thực tế qua nhiều trang, cross-vendor, multi-tab, logout/login
- **G. Bonus UX** — responsive, tooltip không cắt, không che thông tin khác (recommend, không bắt buộc)

**Mỗi test case BẮT BUỘC dạng:**

```markdown
### TC-<NHÓM><số>: <Title ngắn gọn mô tả case>
**Steps:**
1. <Bước 1, ngôn ngữ click-được-ngay: "Login vendor A", "Vào menu Settings → Destinations", "Bấm Save", "Reload trang (F5)">
2. <Bước 2>
3. <Bước 3>

**Expected:**
- <Kỳ vọng cụ thể, không mơ hồ. Tên field/badge/text phải đúng như UI thật>
- <Có thể nhiều dòng nếu nhiều assertion>
```

### Quy tắc viết cho người non-tech

- **Ngôn ngữ click-được**: "Login vendor A", "Vào menu X → Y", "Bấm Save", "Hover chuột giữ 1 giây", "Reload (F5)". KHÔNG dùng "trigger event", "intercept API", "check console", "verify payload".
- **Tên cụ thể**: tên menu/button/badge/label phải khớp UI thật (vd: "Destinations" chứ không phải "trang đích"). Nếu i18n có nhiều ngôn ngữ → ghi chú dùng EN.
- **Expected đo được**: "Bên cạnh tên merchant X có badge SM màu xanh dương" (đo được) chứ không phải "hoạt động đúng" (mơ hồ).
- **Mỗi case 1 mục đích duy nhất** — không gộp 3 thứ vào 1 case.
- **Bao gồm chuẩn bị dữ liệu** ở đầu test plan (account, data fixture cần có trước khi test).
- **Tổng kết Pass criteria** ở cuối: nhóm nào bắt buộc PASS, nhóm nào recommend.

### Kỷ luật test case (token-free — bê từ chuẩn QA, không tốn token chạy)

1. **1 TC = 1 Expected duy nhất.** Một case có nhiều assertion độc lập → TÁCH thành nhiều TC. Lý do: khi FAIL, biết chính xác cái gì hỏng, không lẫn. (Khác với "1 case nhiều dòng expected mô tả cùng 1 trạng thái" — cái đó vẫn là 1 expected.)
2. **Traceability TC ↔ requirement.** Khi có `--spec` / `--req`: mỗi TC ghi rõ nó cover requirement/AC nào (cột `Req`). Mỗi requirement phải có ≥1 TC; requirement nào không TC nào chạm → flag thiếu coverage ngay trong test plan, không để im.
3. **Trần số lượng ~40 TC.** Nếu vượt → nhiều khả năng đang đẻ case trùng/vụn. Gộp case redundant, giữ case "có nghĩa + cover rộng". Verify là tìm bằng chứng phân biệt, không phải liệt kê cho dài.
4. **Spec mơ hồ → ghi rõ ASSUMPTION, không đoán ngầm.** Thiếu thông tin thì nêu giả định hợp lý (theo code thật + chuẩn ngành) NGAY trong test plan để tester confirm/sửa, thay vì âm thầm test theo cách mình tưởng.
5. **Chỉ test cái code thật support.** Không đẻ TC cho hành vi codebase chưa có (verify ≠ wishlist). Nếu requirement đòi thứ code chưa làm → đó là "thiếu", ghi vào coverage gap, không phải 1 TC PASS/FAIL.

### Mẫu Test Plan đầy đủ

Xem `test-plan-template.md` cạnh skill này để biết structure đầy đủ (header chuẩn bị data → nhóm A→G → tổng kết pass criteria → instructions khi fail).

### Format present cho tester: BẢNG COMPACT, không verbose markdown

Khi output cho tester đọc, dùng **bảng tóm tắt** thay vì liệt kê từng case dài dòng:

```
| TC-ID | Tên | Steps tóm tắt | Expected (1 cái) | Req | Bắt buộc |
|---|---|---|---|---|---|
| TC-C02 | Order 2 PL — đúng file riêng | Order 2 PL → download PL1 → download PL2 → so sánh | 2 file Excel khác nhau | REQ-3 | ✅ Ca phân biệt |
```

> Cột `Req` chỉ thêm khi có `--spec` / `--req`. Cuối bảng liệt kê requirement nào CHƯA có TC nào cover (coverage gap).

- **Steps tóm tắt**: 1 dòng mô tả flow, không liệt kê từng bước — tester hỏi thêm nếu cần
- **Đánh dấu rõ** ca phân biệt (✅ Ca phân biệt) và case bắt buộc vs optional (⚠️ Nếu có data)
- Chuẩn bị data vẫn để bảng riêng phía trên
- Pass criteria vẫn liệt kê riêng phía dưới

### Checklist trước khi present test plan

- [ ] Mọi case có TC-ID / Tên / Steps tóm tắt / Expected / Bắt buộc
- [ ] **Mỗi TC chỉ 1 Expected độc lập** — case nhiều assertion rời rạc đã tách ra
- [ ] Bước thao tác đọc là click được, không cần kiến thức code
- [ ] Có ít nhất 1 case "phân biệt" (code cũ vs mới ra kết quả khác) — đánh dấu rõ
- [ ] **Có `--spec`/`--req`**: mỗi TC map tới requirement (cột Req); requirement không TC nào chạm đã flag coverage gap
- [ ] **Tổng TC ≤ ~40** — vượt thì gộp case trùng/vụn
- [ ] **Spec mơ hồ → assumption ghi rõ trong plan**, không đoán ngầm
- [ ] **Không có TC cho hành vi code chưa support** — thứ đó là coverage gap, không phải TC
- [ ] Có nhóm Edge case từ `patterns.md` nếu khớp trigger
- [ ] Có nhóm Multi-screen nếu thay đổi lan tới >1 trang
- [ ] Có chuẩn bị dữ liệu ở đầu — không yêu cầu tester tự đoán data cần có
- [ ] Có Pass criteria ở cuối

> **CHECKPOINT — Sau khi present test plan, DỪNG lại và hỏi tester:**
> "Test plan trên đã đủ chưa? Muốn thêm/bỏ/sửa case nào không?"
>
> Chỉ chuyển sang Phase 3 khi tester xác nhận. Không tự động chuyển sang Phase 3–4.

## Phase 3 — Chuẩn bị dữ liệu

| Thay đổi ở tầng | Được mock | KHÔNG được mock |
|-----------------|-----------|------------------|
| API/model/query | — | Phải seed DB thật, gọi API thật |
| UI logic/hiển thị | API response | Store + component phải chạy thật |
| Cả hai | không gì ở phần nối | verify e2e: DB thật → API thật → UI |

**Ưu tiên data từ `fixtures.md`** — đã pre-fill tester ở `<project>/.qa-verify/fixtures.md`. Workflow:

1. Lookup task → match entry trong fixtures (vd: "Rakucore sync" → client test + site Pinrich).
2. Chỉ data KHÔNG có trong fixtures mới cần seed/detect runtime.
3. Khi tester cung cấp data mới đáng tái dùng → đề xuất append vào fixtures.md.

**Auto-fill "Tech meta" (Claude làm, tester không đụng)**: tester chỉ điền name + email ở section "Bạn điền". Khi cần ID nội bộ (client id, site/subdomain, urlKey…) mà "Tech meta" còn trống → Claude query DB 1 lần, điền vào table Tech meta, cập nhật `Last login OK = hôm nay`. Lần sau dùng thẳng, KHÔNG query lại.

DB là **MySQL 8** (`egent_data`), chạy thẳng trên **RDS dev** (KHÔNG có MySQL container local — `pinrich-db` đã comment out). Container `pinrich-server` KHÔNG có `mysql` CLI. Query bằng image `mysql:8` (lấy creds từ `docker-compose.yaml`):
```sh
docker run --rm mysql:8 mysql -h <RDS_ENDPOINT> -u <DB_USER> -p<DB_PASSWORD> egent_data -t -e "<SQL>"
```
Hoặc xem qua **Adminer** local `localhost:8080` (System=MySQL, Server=RDS endpoint). Chi tiết: memory `project-db-rds-access`, schema `v2/docs/infra/db-schema.md`.

Ví dụ (lưu ý: bảng Client tên là `url_share_user`, KHÔNG phải `clients`):
```sql
SELECT id, client_name, email, url_key, deal_type FROM url_share_user WHERE email = 'tester@example.com';
```

### Khi cần tester chạy command — đưa COPY-PASTE-CHẠY-ĐƯỢC, không nói chung chung

Tester biết `docker compose up/down` + chạy command có sẵn, nhưng KHÔNG tự viết. Mọi command/SQL phải:
- **Đầy đủ flag + value cụ thể** (không placeholder `<xxx>` chung chung)
- **1 dòng** (không backslash continuation) cho dễ paste vào terminal
- **Comment 1 dòng phía trên** giải thích plain Vietnamese command đó để làm gì

Ví dụ ĐÚNG (cụ thể, paste là chạy — script runner của server qua `npm run script`):
```
# Sinh API key mới cho client (script có sẵn trong server/src/scripts)
docker compose run --rm pinrich-server npm run script:generate-api-key
```

Ví dụ SAI (mơ hồ, tester không biết điền gì):
```
docker compose run --rm pinrich-server npm run script -- ...   # seed data X
```

### Check DB — đưa SQL paste-chạy-được

Tester biết check DB qua Adminer (`localhost:8080`) / DBeaver. Đưa SQL đầy đủ (MySQL 8):

```sql
-- Tìm client theo email + lấy url_key (dùng cho trang owner/share)
SELECT id, client_name, email, url_key, deal_type
FROM url_share_user
WHERE email = 'tester@example.com';
```

Connect DB (RDS dev — KHÔNG có MySQL container local; container `pinrich-server` không có mysql CLI):
```sh
docker run --rm mysql:8 mysql -h <RDS_ENDPOINT> -u <DB_USER> -p<DB_PASSWORD> egent_data -t -e "<SQL>"
```
> Endpoint + creds lấy từ `docker-compose.yaml` (DB_HOST/DB_USERNAME/DB_PASSWORD — chú ý chỉ lấy dòng KHÔNG bị comment). Hoặc dùng Adminer `localhost:8080`. Xem memory `project-db-rds-access`.

### Tầng API/unit (Jest) — sanity smoke nhanh

```
docker compose run --rm pinrich-server npm test -- src/path/to/file.spec.ts -t "test name"
```

## Phase 4 — Playwright headed (công cụ chính cho UI)

Claude sẽ **tự generate một script Playwright hoàn chỉnh** cho từng task verify, lưu vào `<project-root>/.qa-verify/<tên-task>/verify.js`, rồi chạy:

```
node .qa-verify/<tên-task>/verify.js
```

Browser mở ra, tester xem trực tiếp. Script tự in PASS/FAIL, chụp screenshot từng bước, giữ browser mở sau khi xong.

### KHÔNG cài lại Playwright mỗi task — script tự bootstrap

Script verify **BẮT BUỘC** paste block `ensurePlaywrightRuntime()` từ `playwright-recipe.md` section 0 lên đầu file (trước `require('playwright')`).

Hành vi block này:
- Check shared runtime ở `~/.claude/skills/qa-verify/runtime/node_modules/playwright/` và chromium ở `~/.cache/ms-playwright/`.
- **Đã có** → chỉ in `[bootstrap] OK` và chạy tiếp (vài ms).
- **Chưa có** → tự `npm install playwright` (~30s) và/hoặc `npx playwright install chromium` (~150MB) 1 lần, sau đó chạy tiếp.

Lợi: tester chạy script trên máy mới không cần đọc README hay cài tay; script self-contained.

### Test account — đọc fixtures trước, chỉ hỏi khi thiếu

1. **Đọc `fixtures.md` Accounts section** — nếu có entry khớp role + scope task, dùng email/account_id thẳng từ đó. **KHÔNG hỏi lại.**
2. **Chỉ hỏi tester khi**:
   - Fixture không có role/variant đang cần (vd: cần tài khoản Baitori mà fixtures chỉ có Pinrich)
   - Fixtures `Last verified` > 1 tháng → sanity ping login trước khi tin
3. **Hỏi xong** → đề xuất append vào fixtures.md để session sau khỏi hỏi.

KHÔNG hardcode email mặc định trong script. Verify multi-portal → script dùng concurrency template (xem `playwright-recipe.md` section 4) hoặc chạy nhiều lần với email khác nhau.

### Chọn TC nào automate vs để tester làm tay

Phase 2 generate nhiều TC; KHÔNG cố automate tất cả. Phân loại trước khi viết script:

| Loại TC | Automate? | Lý do |
|---|---|---|
| Check badge/label/text tồn tại ở đúng vị trí | ✅ Yes | Selector + text assertion đáng tin |
| Negative — element KHÔNG tồn tại | ✅ Yes | Cần verify cả 2 phía |
| Backend differential (`is_X=true` cho A, `false` cho B) | ✅ Yes (qua API) | Mạnh + nhanh |
| Tooltip hover, simple modal | ✅ Yes | Playwright handle OK |
| Persistence sau reload | ✅ Yes | Reload + re-assert |
| Multi-step UX (drag, animation, complex form) | ❌ Manual | Khó automate ổn định; tester click cuối |
| Visual style consistency qua 5+ trang | ❌ Manual | Mắt người judge tốt hơn |
| Cross-tenant / cross-portal flow phức tạp | ⚠️ Optional | Dùng concurrency template nếu cần, không thì tester làm |

**Quy tắc**: TC manual-only ghi rõ trong Phase 5 NOT-verified với note "for manual click". TC automatable ghi `TC-A03` trong screenshot/log để traceback về test plan.

### Bắt buộc trong mọi script verify

1. **Bootstrap runtime** (recipe section 0): paste block `ensurePlaywrightRuntime()` lên đầu file.
2. **Pre-flight check**: gọi `preflightCheck()` (recipe section 1). Trả về `dockerCompose` auto-detect.
2b. **Bug Sentinels** (recipe section 8 — **MANDATORY, không ngoại lệ**): gọi `attachSentinels(page, label)` NGAY sau khi tạo mỗi page, trước mọi thao tác. Cuối phiên in `sentinel.report()` + `checkLayout(page)`. Multi-user → mỗi page 1 sentinel. Đây là máy dò bug ngầm (console error / uncaught exception / API 500 / request fail / layout vỡ) — bắt được bug ngoài phạm vi TC.
3. **Login & openBrowser**: lấy email từ fixtures (hoặc tester) + portal đúng.
4. **Chọn template**:
   - 1 user, 1 portal → section 3 (single-user)
   - 2+ user / cross-portal flow / race condition → section 4 (concurrency)
5. **SELECTOR: lấy từ Vue template, KHÔNG tự bịa.** Project KHÔNG có Cypress và KHÔNG dùng `data-test` attr — selector phải dựa vào text/role (`getByText`, `getByRole`) hoặc class ổn định trong component thật. Trước khi viết, grep template để lấy đúng class/text:
   ```sh
   grep -rhoE "class=\"[^\"]+\"" src/views/<trang>/ src/components/<comp>/ | sort -u
   ```
   Ưu tiên `page.getByText(...)` / `getByRole(...)` vì FE chủ yếu là Tailwind utility class (không ổn định để bám selector). Dùng helper `rowBadgeStatus` / `openAndType` từ recipe section 6 cho list/badge. **Bottleneck Phase 4**: đừng DOM-walk mò — grep template lấy text/label thật trước.
6. **Mock pattern dùng RegExp**, không glob over-broad (`**/api/orders*` catch nhầm `/api/orders-summary`).
7. **Artifact path**: `<project>/.qa-verify/<task>/` (screenshots/, REPORT.md, verify.js). Script dùng `git rev-parse --show-toplevel` để locate root. Tự append `.qa-verify/` vào `.git/info/exclude` nếu chưa có (idempotent).
8. **SMOKE 1 case PASS đã-biết** trước khi assert toàn bộ — verify helper (locator, regex, DOM walk) đúng:
   ```js
   const smoke = await page.locator('.target-badge:visible').count()
   console.log(`[smoke] visible badges = ${smoke}`)
   const sanity = await rowBadgeStatus(page, NAME_CELL_SELECTOR, KNOWN_PASS_NAME, '.target-badge')
   console.log(`[smoke] helper(known) = ${sanity} (expect 'present')`)
   ```
   Tại sao: helper buggy → toàn bộ kết quả sai. Smoke phát hiện trong 5s thay vì cuối run thấy FAIL 7/10 case mà feature thật ra work.
9. **PIVOT sang API hoặc MANUAL FALLBACK nếu selector kẹt >2 lần**:

   Option A — pivot API (verify gián tiếp qua nguồn data):
   ```js
   const res = await apiRequest(`/api/${endpoint}?fields=...,${target_field}`, 'GET', null, cookie, token)
   // Verify field value cho ca phân biệt + negative
   ```

   Option B — chuyển TC sang **MANUAL FALLBACK** (recommended cho tester functional). Claude in ra terminal 1 card click-được-ngay cho tester làm tay:

   ```
   ⚠️ TC-A08 không tự test được — selector kẹt ở Pattern editor.

   📋 BẠN LÀM TAY GIÚP (mất 1 phút):
   1. Vào Settings → Price Patterns → Create
   2. Bấm dấu + bên cạnh chữ "To"
   3. Gõ "khoit" vào ô vừa hiện ra
   4. Trong dropdown gợi ý — có thấy badge SM bên cạnh "khoitm" không?

   ✅ Có badge SM → reply "TC-A08 PASS"
   ❌ Không có / không tìm thấy → reply "TC-A08 FAIL" + screenshot
   ```

   Sau khi nhận reply tester, Claude ghi result vào REPORT.md với method="manual".

   **Khi chọn Option A vs B**:
   - Backend fix (field, query) → Option A đủ
   - UI render fix (component, badge, modal) → Option B (tester nhìn được mới là evidence thật)

   Cả 2 option đều gắn TC đó là **PASS-WEAK** trong session verdict — chỉ PASS thuần nếu click thật qua script.

### Source code đầy đủ: `playwright-recipe.md`

Cạnh file SKILL.md này có `playwright-recipe.md` chứa code recipe đầy đủ.

**Token-efficient access**: file có **Section index** ở đầu. Dùng `Read --offset N --limit M` cho section cần. **Verify line numbers**: `grep -nE '^## ' playwright-recipe.md` trước (edit file → numbers shift).

8 sections trong recipe:

0. **Shared runtime bootstrap** — `ensurePlaywrightRuntime()` tự cài/skip. **Mandatory.**
1. **Pre-flight check** — `preflightCheck()` (docker compose detect + caddy up). **Mandatory.**
2. **Common helpers** — `apiRequest` / `login` / `openBrowser` / `setupPage` / `keepOpen`. **Mandatory.**
3. **Structure single-user** — 1 portal, case phổ biến nhất.
4. **Structure multi-user / concurrency** — 2+ browser context, cross-portal, race.
5. **Gotcha playwright-specific** — mock response field, SP/PC + Pinrich/Baitori view khác nhau. **Mandatory đọc khi viết script.**
6. **Selector helpers đã test** — `rowBadgeStatus` / `countVisible` / `openAndType` + smoke rule. **Mandatory cho list/badge verify.**
7. **Observability — narration cho tester xem live** — `banner` (mô tả bước + kỳ vọng) + `flash` (highlight element sắp click) + `resultToast` (PASS/FAIL) + slowMo. **Dùng khi tester ngồi xem browser headed.** Quy tắc: LUÔN highlight element trước khi click/fill (kể cả element xuất hiện sau action khác → `flash()` riêng) để tester không lạc.

Combo:
- Single-user verify (list/badge), tester xem live → Read sections 0 + 1 + 2 + 3 + 5 + 6 + 7
- Concurrency verify → Read sections 0 + 1 + 2 + 4 + 5 (+ 7 nếu xem live)

> Business condition (banner "Review and forward" hiện khi nào, manageable rule…) ở `patterns.md`, không trong recipe.

### Domain-format auto-check (oracle "Standards" — bắt máy, ngoài TC)

Sau khi script đã đưa trang về state cần kiểm (mỗi state có value JP đáng ngờ: giá/面積/間取り/駅徒歩/ngày), chạy `jp_domain_check` của `uat-toolkit` trên render thật — bắt **sai chuẩn format JP** mà mắt tester dễ lướt qua (đúng lớp `pin-numbers-ja-jp`):

```sh
cd ~/Projects/uat-toolkit            # cần .venv (xem README)
.venv/bin/python scripts/extract.py --url "<url của state vừa verify>" --out tmp/qa-<task>-<state>.json \
  --profile-dir profiles/<acct>      # hoặc --actions để replay tới state nếu cần đăng nhập/tương tác
.venv/bin/python scripts/jp_domain_check.py --target tmp/qa-<task>-<state>.json \
  --rules scripts/jp_domain_rules.yaml --out tmp/qa-<task>-<state>-jp.json
```

- Mỗi finding `severity=error` = **bug domain thật, có evidence** (value + label + rule id DOMAIN-*). Đưa vào bảng "Domain format" ở Phase 5.
- Đây KHÔNG phải so-với-design (vị trí/scale là P6) — chỉ kiểm value có đúng CHUẨN JP không. Học value-format mới sai → thêm 1 dòng vào `jp_domain_rules.yaml` (xem meta-loop ở `sdd-port-page` P6), tự có hiệu lực cả ở đây lẫn P6.
- Bỏ qua khi state không có value JP nào (vd modal xác nhận trắng). Không reach được state bằng extract → ghi NOT-verified, đừng bịa.

## Phase 5 — Báo cáo (Markdown template cố định)

Lưu vào `<project-root>/.qa-verify/<task>/REPORT.md` đúng format dưới. In toàn bộ markdown ra terminal để tester copy/paste vào PR/Trello comment được.

```markdown
# QA Verify Report — <task name>

**Date**: YYYY-MM-DD HH:MM
**Source**: <branch / PR #x / Trello card link>
**Tester role**: <đại lý (agent) / client (khách) / admin>
**Account**: <email>
**Variant**: <SP / PC> + <Pinrich / Baitori>
**Scope**: <1-2 dòng mô tả ngắn thay đổi đang verify>
**Loại fix**: <backend-only / UI-only / both>

## Kịch bản đã verify

| TC-ID | Kịch bản | Kết quả | Method | Screenshot | Note |
|-------|----------|---------|--------|------------|------|
| TC-A01a | Ca phân biệt: <mô tả> | ✅ PASS | UI click | ss-01-...png | Confirmed fix có effect |
| TC-A01b | Ca negative: <mô tả> | ✅ PASS | UI click | ss-02-...png |  |
| TC-E01 | Persistence sau reload | ✅ PASS-WEAK | API only | — | Pivot do selector kẹt — xem rule 8 |
| TC-D01 | Edge: <mô tả> | ❌ FAIL | UI click | ss-03-...png | Bug X, see below |

> **TC-ID phải match Phase 2 test plan** — tester scan được nhanh case nào pass/fail.
> **Method**: `UI click` (Playwright tương tác thật) / `API only` (pivot khi UI kẹt) / `manual` (tester click tay) / `jest` (sanity smoke).

## Sentinel — lỗi ngầm bắt được trong phiên (recipe section 8)

| Loại | Số lượng | Chi tiết | Đánh giá |
|------|----------|----------|----------|
| 🔴 pageerror (uncaught JS) | n | <message> | Bug (kể cả khi TC chính PASS) |
| 🔴 HTTP 5xx | n | `500 POST /api/...` | Bug |
| 🔴 HTTP 4xx | n | `403/422 ...` | Điều tra — đúng nghiệp vụ hay lỗ hổng? |
| 🔴 console.error | n | <text> | Phần lớn là bug — điều tra từng cái |
| 🟡 console.warning | n | <text> | Issue (deprecation/key trùng) |
| 🟡 layout (overflow/ảnh vỡ) | n | <selector> | Issue trừ khi che chức năng → Bug |

> Sạch hết → ghi "✅ Sentinel sạch". Có pageerror / 5xx → **session KHÔNG thể PASS thuần** dù mọi TC PASS — đưa xuống "Bug phát hiện".

## Domain format — sai chuẩn JP bắt được (jp_domain_check, Phase 4)

| Rule | State | Label | Value sai | Chuẩn đúng | Đánh giá |
|------|-------|-------|-----------|-----------|----------|
| DOMAIN-RENT-001 | <state> | 価格 | `29880万` | `29,880万円` | 🔴 Bug (thiếu phẩy) |

> Không chạy được (state không reach / không có value JP) → ghi "N/A — không có value JP đáng kiểm" hoặc đưa state vào NOT-verified. Finding `severity=error` ≠ rỗng → đối xử như Sentinel: **session không PASS thuần**, đưa xuống "Bug phát hiện".

## Bug / Issue phát hiện

(Nếu có. Mỗi bug: tóm tắt → step reproduce → expected vs actual → screenshot link. Không có → ghi "Không có".)

## NOT verified (kèm lý do)

(Phải liệt kê đầy đủ. Im lặng = lừa tester. Không có gì chưa verify → ghi "Không có".)

- TC-XYZ: <lý do — manual-only, data thiếu, skip theo confirm, etc.>

## Verdict

Chọn đúng 1 (verdict cho TOÀN session; TC riêng có thể PASS-WEAK trong bảng):

- [ ] **PASS** — toàn bộ kịch bản verify pass + ÍT NHẤT 1 ca phân biệt thấy được code đã-fix khác code chưa-fix. Hợp lệ cho cả 3 dạng:
  - **UI-only / both** fix: ca phân biệt click thật trên UI; thấy state cũ ≠ state mới
  - **Backend-only** fix: API call differential — endpoint trả response khác trước/sau fix (ví dụ field mới, value khác)
- [ ] **PASS-WEAK** — pass nhưng:
  - Ca phân biệt chưa reproduce được trước fix (không tách code cũ vs mới)
  - **HOẶC** có TC verify gián tiếp (API + component dùng chung) thay vì click thật ở trang cần kiểm
  - **HOẶC** suy ra bằng transitivity (cùng component verify ở trang khác)
- [ ] **FAIL** — ít nhất 1 kịch bản fail, **HOẶC** Sentinel bắt được pageerror (uncaught JS) / HTTP 5xx trong phiên (dù TC chính PASS — đó vẫn là bug thật)
- [ ] **BLOCKED** — không verify được do env / data / blocker

> **PASS-WEAK trigger tự động**: Phase 4 quy tắc 8 (pivot API) → TC đó tự động PASS-WEAK. Session verdict không thể PASS thuần khi có TC nào PASS-WEAK.
> **FAIL trigger tự động từ Sentinel**: pageerror hoặc HTTP 5xx ≠ rỗng → FAIL, kể cả khi mọi TC PASS. console.error → điều tra; nếu xác định là bug → FAIL. (Quy tắc đầy đủ: recipe section 8.)
> **FAIL trigger từ Domain format**: `jp_domain_check` có finding `severity=error` (value sai chuẩn JP) → cùng đối xử như Sentinel: session không PASS thuần, đưa thành bug.

## patterns.md updates

- [ ] Append entry mới: <tên> (line X trong patterns.md)
- [ ] Deprecated entry: <tên> (lý do)
- [ ] Audit đề xuất: patterns.md > 20 entry HOẶC > 3 tháng không touch — đề nghị tester pair-audit
- [ ] N/A: không có pattern mới đáng nhớ

## Cleanup

- [ ] `.qa-verify/<task>/` có thể xóa sau khi PR merge — artifact gắn với 1 branch/task cụ thể, không tái dùng
- [ ] Giữ lại nếu task chưa merge / cần re-verify sau fix bug đã phát hiện
```

---

## Checklist tự soát

### 3 nguyên tắc vàng
- [ ] **Đề xuất thêm Jest test thay vì verify tay** → SAI. Test tự động là việc của dev, không phải QA verify.
- [ ] Mock luôn API rồi tưởng đã verify backend → SAI (vi phạm nguyên tắc 1).
- [ ] Chỉ test ca happy, pass trên cả code cũ → verify yếu (vi phạm nguyên tắc 2).
- [ ] Chỉ verify đúng 1 chỗ trong diff, bỏ qua consumer và flow liên quan.

### Bỏ sót UX / regression / loại bug
- [ ] Không hỏi đến UX: user thấy gì, error message ra sao, data có persist không.
- [ ] Quên verify regression — flow cũ còn chạy đúng không.
- [ ] Báo PASS mà không có screenshot/output làm bằng.
- [ ] **Bỏ qua `bug-heuristics.md`** → chỉ test happy path, sót cả loại bug (data variation, error path, oracle lệch).
- [ ] **Không thử biến thiên data** (rỗng/nhiều/null/tiếng Nhật 全角半角/ký tự đặc biệt) → mỏ bug lớn nhất bị bỏ.
- [ ] **Quên chạy `jp_domain_check` trên state có value JP** (giá/面積/間取り/駅徒歩/ngày) → để lọt sai-chuẩn-format (lớp `pin-numbers-ja-jp`) mà mắt tester lướt qua.
- [ ] **Không ép đường lỗi** (API 500, mạng chậm, double-click, race) → chỉ biết happy path chạy.

### Script automation
- [ ] Script chạy headless (tester không thấy gì) → sai, phải `headless: false`.
- [ ] Hardcode test account email trong script → chỉ chạy trên máy người viết.
- [ ] **Bỏ qua fixtures.md → re-detect data lặp lại** mỗi session.
- [ ] **Bỏ qua smoke 1 case PASS đã-biết** → helper bug ngầm, cuối run mới phát hiện.
- [ ] **Cố fix selector >2 lần thay vì pivot sang API verify** → tốn 5+ turn không cần thiết.
- [ ] **QUÊN gắn Bug Sentinels (recipe section 8)** → mọi console error / uncaught exception / API 500 / layout vỡ trôi qua không ai thấy. MANDATORY mọi script.
- [ ] **Sentinel bắt pageerror/5xx nhưng vẫn báo PASS** → SAI, đó là FAIL dù TC chính xanh.

### Verdict trung thực
- [ ] **Báo PASS khi có TC verify gián tiếp (pivot API)** → SAI. TC đó là PASS-WEAK, session verdict không thể PASS thuần.
- [ ] Báo PASS-WEAK cho fix backend-only mà API differential đã chứng minh → SAI. Backend differential cũng là PASS.

### Memory tích lũy
- [ ] Bỏ qua `patterns.md` ở Phase 2 → có thể miss case Pinrich-specific đã biết.
- [ ] Phát hiện bug Pinrich-specific mới mà quên append `patterns.md` → session sau làm lại từ đầu.
- [ ] Data mới đáng tái dùng nhưng quên đề xuất append vào fixtures.md → session sau hỏi lại lặp.
