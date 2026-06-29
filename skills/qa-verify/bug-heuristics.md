# Bug Heuristics — qa-verify (bộ não tìm bug)

> Mục tiêu file này: **phát hiện nhiều bug nhất + chính xác**. Không phải để chạy nhanh hay tiết kiệm.
> Dùng ở **Phase 2** (sinh kịch bản phủ rộng) và **Phase 4–5** (nhận ra cái gì mới là bug).
> Đây là heuristic — gợi ý có thể sai, nhưng giúp *nhận ra* vấn đề mình sẽ bỏ qua nếu chỉ test happy path.

---

## Phần A — ORACLE: "Làm sao biết đây là BUG?" (FEW HICCUPPS)

Bug = **một sự bất nhất (inconsistency)** giữa thứ ta quan sát và một thứ ta tin là đúng. Mỗi chữ dưới đây là 1 "nguồn đúng" để đối chiếu. Khi verify, với mỗi màn/hành vi, lướt qua 9 oracle này — chỗ nào lệch là nghi vấn bug.

| Oracle | Câu hỏi đối chiếu | Ví dụ bug Pinrich |
|--------|-------------------|-------------------|
| **H — History** (nhất quán với chính nó trước đây) | Hành vi/giá trị này có khác bản trước/lần trước không? Trước fix vs sau fix? | Sau deploy, badge SM biến mất ở client cũ; sort đảo thứ tự so với hôm qua |
| **I — Image** (nhất quán với thương hiệu/hình ảnh) | Có gì làm Pinrich/Baitori trông kém chuyên nghiệp? lỗi chính tả, text lẫn ngôn ngữ, vỡ layout, ảnh bể | Tiếng Nhật lẫn tiếng Anh chưa dịch; logo Baitori hiện ở domain Pinrich |
| **C — Comparable products** (nhất quán với sản phẩm tương đương) | Tính năng tương tự ở chỗ khác trong app làm thế nào? trang khác cùng pattern hành xử khác à? | Form A validate email, form B cùng loại lại không; export PL trang này khác trang kia |
| **C — Claims** (nhất quán với điều đã tuyên bố) | Spec/PR/Trello/tooltip/help nói gì? Có đúng như nó hứa không? | PR ghi "đồng bộ realtime" nhưng phải reload mới thấy; tooltip ghi "tối đa 10" mà cho nhập 11 |
| **U — User expectations** (nhất quán với kỳ vọng người dùng) | Đại lý/khách kỳ vọng gì? Có gây bất ngờ khó chịu không? mất data, click không phản hồi, không có loading | Bấm Save không có feedback → user bấm 2 lần → tạo 2 record |
| **P — Product** (nhất quán nội bộ) | Trong cùng app có 2 chỗ mâu thuẫn nhau không? cùng 1 con số 2 nơi khác nhau? | Tổng ở list ≠ tổng ở detail; count badge ≠ số dòng thật |
| **P — Purpose** (phục vụ đúng mục đích) | Tính năng có thật sự giải quyết được việc business cần? hay đúng kỹ thuật nhưng vô dụng thực tế? | Filter chạy đúng nhưng chậm 10s nên đại lý không ai dùng |
| **S — Statutes/Standards** (chuẩn, luật, quy ước) | Có vi phạm chuẩn web/format/đơn vị/định dạng Nhật? ngày 和暦, tiền ¥, 全角/半角, mã bưu điện 〒 | Ngày hiển thị MM/DD thay vì kiểu Nhật; tiền không có dấu phẩy hàng nghìn |
| **F — Familiarity** (giống bug đã từng gặp) | Có giống pattern bug cũ trong `patterns.md` không? lỗi kinh điển: off-by-one, N+1, race, timezone | Xem `patterns.md` — đối chiếu trigger |

> **Quy tắc vàng oracle:** một kết quả "đúng theo TC" vẫn có thể là bug nếu nó **lệch với bất kỳ oracle nào khác**. Đừng dừng ở "expected khớp" — soi cả 9 hướng. Đây là cách tester giỏi tìm ra cái dev chưa nghĩ tới.

---

## Phần B — COVERAGE: "Đã test đủ MẶT chưa?" (SFDIPOT)

Dùng khi sinh kịch bản Phase 2 để không bỏ sót cả một loại. Với thay đổi đang verify, hỏi từng mặt:

- **S — Structure**: các phần cấu thành — màn nào, component nào, file export, PDF, email render. Đã đụng hết các artefact bị ảnh hưởng chưa?
- **F — Function**: mọi thứ nó LÀM — mỗi nút, mỗi nhánh logic, mỗi điều kiện hiển thị. Có nhánh nào chưa kích hoạt?
- **D — Data**: mọi dữ liệu nó xử lý — rỗng / 1 / nhiều / cực nhiều / null / sai kiểu / ký tự đặc biệt / tiếng Nhật / emoji / chuỗi rất dài. (Xem ma trận Phần C.)
- **I — Interfaces**: điểm tiếp xúc — API thật, DB, queue, webhook (Rakucore/Salesforce/LINE), file upload/download, localStorage. Mỗi interface có thể fail riêng.
- **P — Platform**: môi trường — SP vs PC, Pinrich vs Baitori, browser khác (Chrome/Safari), mạng chậm/offline, màn nhỏ.
- **O — Operations**: cách dùng thực tế — đại lý vội bấm nhanh, mở nhiều tab, để tab lâu rồi quay lại, login 2 account, back/forward, refresh giữa chừng.
- **T — Time**: yếu tố thời gian — race 2 user, draft auto-save đè nhau, timeout, thứ tự async, timezone (JST vs UTC), token hết hạn giữa flow, debounce.

---

## Phần C — DATA: ma trận biến thiên input (Goldilocks + Boundaries)

Với mỗi field/list/upload mà thay đổi đụng tới, thử các biến sau (cái nào áp dụng được):

| Nhóm | Giá trị thử | Bug hay lộ ra |
|------|-------------|---------------|
| **Goldilocks** | rỗng / đúng 1 / nhiều / **cực nhiều** (1000+) | UI vỡ khi list dài; empty state thiếu; pagination; perf N+1 |
| **Boundary số** | 0 / âm / min-1 / min / max / max+1 / số thập phân | off-by-one; validation hở; tràn số tiền |
| **Boundary chuỗi** | rỗng / 1 ký tự / cực dài / chỉ khoảng trắng | overflow layout; trim sai; cắt chữ |
| **Ký tự đặc biệt** | `'"<>&` / emoji / xuống dòng / `;DROP` | XSS, escape sai, SQL, hiển thị vỡ |
| **Tiếng Nhật (QUAN TRỌNG)** | Kanji 漢字 / Hiragana / Katakana / **全角 vs 半角** / 髙﨑 (kanji hiếm) | encoding mojibake; đếm độ dài sai (byte vs char); search không khớp 全角/半角 |
| **Định dạng Nhật** | ¥ tiền có phẩy / 〒mã bưu điện / 電話 số đt / 和暦 ngày | format sai chuẩn JP (oracle Standards) |
| **Null/thiếu** | field optional bỏ trống / object thiếu key / API trả null | null access crash; "undefined" hiện trên UI |
| **Trạng thái** | record đã xóa / đã đổi trạng thái / hết hạn / bị user khác sửa | stale data; thao tác trên thứ không còn tồn tại |

---

## Phần D — ERROR & TIMING (cái Jest gần như không bao giờ test)

Ép các đường lỗi xảy ra thật (Playwright có thể giả lập — xem recipe section 5 mock + route abort):

1. **API trả lỗi**: ép 500 / 403 / 422 từ endpoint → user thấy gì? có message rõ không, hay trắng trang / spinner vĩnh viễn / nuốt im?
2. **Mạng chậm / timeout**: throttle network → double-submit? loading có không? data nửa vời?
3. **Offline / mất kết nối giữa chừng**: bấm Save lúc rớt mạng → mất data? retry? báo lỗi?
4. **Race 2 user**: A và B cùng sửa 1 record → ai thắng? mất update? draft đè?
5. **Token hết hạn giữa flow**: 401 giữa chừng → redirect login có giữ lại việc đang làm?
6. **Double-click / spam**: bấm nút submit 3 lần nhanh → tạo 3 bản ghi? disable sau click chưa?
7. **Back/refresh giữa flow**: F5 giữa wizard / back sau submit → state còn đúng?

> Mỗi đường lỗi: oracle quan trọng nhất là **U (user expectation)** — "khi hỏng, user có hiểu chuyện gì xảy ra và làm gì tiếp không?" Trắng trang/treo spinner = bug UX dù backend "đúng".

---

## Cách dùng trong workflow

- **Phase 2 (sinh kịch bản):** chạy SFDIPOT (Phần B) để liệt kê mặt cần phủ → với field/data dùng ma trận Phần C → thêm nhóm Error/Timing Phần D. Mỗi kịch bản gắn oracle nó kiểm (Phần A) để biết "đậu/rớt theo tiêu chí nào".
- **Phase 4 (quan sát):** ngoài assertion script, luôn bật **Bug Sentinels** (recipe section 8). Khi xem live, mắt soi theo 9 oracle Phần A — đặc biệt I (visual/brand), P (mâu thuẫn nội bộ), S (định dạng Nhật).
- **Phase 5 (verdict):** bug do oracle phát hiện (dù TC chính PASS) vẫn ghi vào "Bug / Issue phát hiện". Sentinel bắt được console/HTTP error → bug theo quy tắc recipe section 8.

> Nguồn heuristic: FEW HICCUPPS (James Bach & Michael Bolton), SFDIPOT (Heuristic Test Strategy Model). Đã rút gọn + bản địa hoá cho Pinrich (tiếng Nhật, BĐS, SP/PC, Pinrich/Baitori).
