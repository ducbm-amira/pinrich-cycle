---
name: design-gap-audit
description: "Đối chiếu design khách đưa với app Pinrich đang chạy, đẻ ra bảng gap + danh sách câu hỏi cho leader/khách TRƯỚC khi code. Dùng khi nhận design khách để redesign/làm lại UI một trang đã có (vd trang search, owner, login...) và cần biết khách đổi/thừa/thiếu gì so với app thật. Là Phase 0 cho apply-design-handoff / design-screen / sdd-port-page. Dùng khi user nói 'đối chiếu design với app', 'design khách lệch gì', 'audit design vs legacy', 'khách đưa design rồi giờ làm gì', 'làm lại UI trang X theo design khách'. KHÔNG trigger cho tạo prototype mới, hay khi đã có bảng gap được duyệt rồi (lúc đó sang skill implement)."
disable-model-invocation: false
---

Trả lời bằng tiếng Việt. **Tone: CONCISE** — đọc nguồn thật, không đoán. Mỗi dòng gap phải có bằng chứng (file design + file/feature app).

# Design Gap Audit (design khách ↔ app thật)

**Định luật gốc:** design khách đưa **không bao giờ** map 100% đúng app. Luôn có lệch. Việc của skill này là **lôi mọi điểm lệch ra ánh sáng TRƯỚC khi code** — để leader/khách chốt bằng cách gật/lắc, chứ không phải để người code tự đoán giữa lúc đang làm (chỗ đắt nhất).

Đầu ra **KHÔNG phải code**, mà là 1 artifact: **bảng đối chiếu + danh sách câu hỏi cho leader/khách**.

> Bài học gốc: redesign trang search consumer (xem memory consumer-search-redesign) đẻ ra audit 83 mục + 14 câu QA cho leader. Skill này hệ thống hoá đúng việc đó để khỏi chế lại mỗi lần.

---

## Phase 0 — Xác định 2 nguồn

1. **Design khách** ở đâu: bundle Claude Design (`apply-design-handoff` Phase 1 để fetch), folder HTML tải về (`~/Downloads/...`), Figma, hay ảnh. Liệt kê các màn/state có trong design.
2. **Trang app thật** đang chạy: repo nào (estimate Vue legacy / estimate-client-sdd / management), route nào, file gốc. Nếu mơ hồ → **hỏi** (AskUserQuestion), đừng đoán.
3. Chốt 2 dòng: "đối chiếu design [X] với trang [Y] ở repo [Z]".

## Phase 1 — Kiểm kê tính năng app thật (feature inventory)

Đọc code trang app đang chạy → liệt kê **tính năng + state thật** nó đang có: filter, search, validate, các loại data/variants, empty/loading/error, edge case. Đây là cột "sự thật" để đối chiếu. Trang lớn (vd search ~13k LOC) → fan-out (Workflow hoặc nhiều Agent song song), mỗi agent một cụm/màn.

**CỔNG CHỐNG-GIẢ-ĐỊNH (bắt buộc):** KHÔNG mang giả định từ trí nhớ / brief cũ / lần làm trước vào audit. Mọi "design này thừa, bỏ đi" chỉ là **giả thuyết** — phải mở code app xác minh app *thật sự không có* rồi mới xếp rổ 🟡. (Bài học: từng suýt xoá nhầm cụm cost/ローン目安 vì tưởng "design tự thêm", hoá ra app có sẵn từ backend.) Tương tự, đừng tin "app có cái này" chỉ vì nhớ mang máng — grep ra file:line.

> **Claim CẤU TRÚC tác động lớn (layout 2-cột vs full-map, luồng điều hướng) = verify-before-lock.** Audit rộng/nhiều mục thì NÔNG từng mục → đọc-lướt dễ sai. Với claim quyết định kiến trúc: **đọc TẬN template/component, liệt kê HẾT con của container** (đừng dừng ở component đầu thấy được), đừng để hành vi mobile neo giả định desktop (2 component khác nhau). Đừng dùng kết quả audit rộng làm chân lý để KHOÁ quyết định — re-verify focus 1 file trước. (Bài học: Q27 "desktop không có cột list" sai vì bỏ sót `<ListProperty>` cùng cột với filter — memory `lesson-broad-audit-verify-before-lock`.)

> Bẫy Pinrich phải bắt đúng: quy tắc filter legacy (掲載種類 chi phối; 土地 không phải propertyType riêng — xem memory consumer-search-redesign), ép số `ja-JP` (xem memory pin-numbers-ja-jp), white-label consumer ≠ CRM đại lý.

> **Tự seed rổ 🐛 bằng máy (đừng chỉ soi mắt):** Phase 3b vốn đã chụp app sống bằng `~/Projects/uat-toolkit/.venv`. Tận dụng: capture app bằng `extract.py` (ra JSON đúng schema, không phải screenshot trần) rồi cho qua rule-check — mọi finding `severity=error` = **ứng viên rổ 🐛 có sẵn evidence + chỉ ra design đúng hơn chỗ nào**:
> ```sh
> cd ~/Projects/uat-toolkit
> .venv/bin/python scripts/extract.py --url "<url app dev có query params>" --out tmp/audit-app.json
> .venv/bin/python scripts/jp_domain_check.py      --target tmp/audit-app.json --rules scripts/jp_domain_rules.yaml      --out tmp/audit-jp.json
> .venv/bin/python scripts/pinrich_design_check.py --target tmp/audit-app.json --rules scripts/pinrich_design_rules.yaml --out tmp/audit-design.json
> ```
> Biến bài học "đừng giữ bug chỉ vì app là sự thật" thành máy bắt: app sai chuẩn JP / phá design-rule mà design khách vẽ đúng → xếp 🐛, sửa luôn khi restyle. (Học luật mới → thêm dòng vào `*_rules.yaml`, xem meta-loop ở `sdd-port-page` P6.)

## Phase 2 — Đối chiếu → phân 4 rổ

So từng phần tử design ↔ feature inventory. Mỗi điểm lệch xếp đúng 1 rổ:

| Rổ | Nghĩa | Default đề xuất |
|---|---|---|
| 🟡 **Design thừa** | khách/AI tự thêm, app không có (đã verify ở Phase 1) | **bỏ** (hỏi khách nếu nghi là yêu cầu mới) |
| 🔴 **App có, design thiếu** | tính năng đang chạy bị quên vẽ | **giữ** (bù vào UI mới) |
| ⚪ **Design 1-state** | app CÓ xử lý nhưng design chỉ vẽ state đẹp, thiếu empty/loading/error/edge | bù state app đang có vào UI mới |
| ⚫ **Lỗ hổng cả 2 bên** | cả design lẫn app đều thiếu (vd lỗi mạng/fail load không ai xử) | nêu là product hole thật → đề xuất bù, hỏi leader |
| ⛔ **Cùng KHÔNG có** | cả 2 đều không có tính năng này | chốt **KHÔNG tự thêm** (chống phình scope) — ghi rõ để implementer khỏi vẽ thừa |
| 🐛 **App sai, design đúng hơn** | app đang có bug, design vô tình đúng (seed bằng `jp_domain_check`/`pinrich_design_check` trên app sống — xem note Phase 1) | **sửa luôn khi restyle** (đừng để default "giữ app" giữ luôn bug) |
| ⚠️ **Mâu thuẫn business** | design phá logic/data/rule thật | **BẮT BUỘC hỏi** — không tự quyết |

Mỗi dòng: mô tả ngắn · rổ · bằng chứng (design file ↔ app file:line) · **default rec** · mức tự tin (cao/vừa/thấp).

> ⛔ và 🐛 ít gặp nhưng đắt: ⛔ ngăn implementer "sáng tạo" thêm nút app không có (このエリアで再検索, zoom, favorite…); 🐛 ngăn việc giữ nguyên bug chỉ vì app là "sự thật" (vd thiếu `toLocaleString('ja-JP')`).

## Phase 3 — Output

Nếu Phase 1-2 chạy fan-out nhiều agent (mỗi màn 1 agent) → **gộp về 1 artifact duy nhất**, đừng để rải rác. Gồm:
1. **Câu hỏi cho leader/khách — ĐẶT LÊN ĐẦU** (đây là thứ mang đi họp, quan trọng nhất). Gom dòng 🟡-nghi-ngờ + ⚠️ + ⚫ thành câu gật/lắc, mỗi câu kèm đề xuất + hậu quả mỗi lựa chọn. **Sắp theo độ ưu tiên**: 🔴 CHẶN (ảnh hưởng kiến trúc/routing, chốt trước) → SCOPE (bỏ/giữ) → chi tiết.
2. **DEDUP across màn**: gap lặp ở nhiều màn (vd mô hình filter 掲載種類 xuất hiện cả list lẫn map) → gộp thành **1 câu hỏi**, ghi rõ ảnh hưởng những màn nào. Đừng bắt leader trả lời cùng 1 câu nhiều lần.
3. **Bảng gap** đầy đủ theo màn (dễ đọc, người mới hiểu được — đừng dùng từ kỹ thuật trần), color-code theo rổ.
4. **Box "lưu ý vàng"**: các phát hiện suýt làm sai (giả định bị lật ở cổng Phase 1), bug app (🐛), danh sách ⛔ "đừng tự thêm".
5. Tóm tắt 1 dòng: tổng điểm lệch, phân bổ theo rổ, bao nhiêu câu cần khách chốt.

Artifact HTML (`Artifact` tool) hợp nhất cho thứ nhiều bảng + cần share cho leader.

## Phase 3b — Lớp HÌNH cho khách (bắt buộc khi câu hỏi đi RA khách)

**Bảng + chữ là ngôn ngữ của leader/dev; khách KHÔNG hình dung được từ chữ** (bài học PM, 2026-06-25). Câu nào đẩy ra khách quyết (chủ yếu ⚠️ mâu thuẫn business + 🟡 nghi-yêu-cầu-mới + lựa chọn either/or) → **kèm cặp ảnh đối chiếu**, KHÔNG để toàn chữ.

Format chốt mỗi thẻ: **TRÁI = screenshot app thật đang chạy ‖ PHẢI = design khách (nguyên bản)** — **KHÔNG vẽ lại** (vẽ lại = thêm lớp diễn giải, mất sức nặng "cái đang chạy vs cái khách vẽ"); 1 dòng "👉 nhìn vào" mỗi bên; nếu là lựa chọn thì thêm **A/B + dòng effort** để khách trỏ tay. Đặt thành 1 section RIÊNG trên đầu artifact, **bảng chi tiết giữ nguyên bên dưới** (2 đối tượng, 2 ngôn ngữ — đừng trộn).

**CAP CÁI GÌ — quy tắc 3 nhóm (đừng quét sạch mọi 🎨; chỉ cap chỗ NHÌN làm đổi câu trả lời, kẻo loãng):**
1. **NÊN cap** = khác biệt hiện trong **1 KHUNG TĨNH** (icon/màu ghim, nội dung thẻ, vị trí/nhãn nút, bố cục, legend, lớp bật). Đây là sweet spot của 🎨. Cap state cụ thể: đổi param ra màu khác, bật lớp, click cụm ra dialog, viewport SP.
2. **ĐỪNG cap** = câu trạng-thái mà **cả 2 bên đều KHÔNG vẽ** (empty/loading/error/"đổi loại 0 ghim"). Chụp ra "bản đồ trống" = vô nghĩa. Câu này là "có nên THÊM thông báo không" → cần **mockup nhỏ thông báo đề xuất**, không phải ảnh của cái-không-tồn-tại.
3. **⚙️ Behavior** = chuỗi tương tác theo thời gian (click→card vs →chi tiết, tab mới vs cùng tab) → 1 ảnh tĩnh 2 bên trông y hệt, **gây hiểu sai**. Dùng **cặp before→after (2 khung)** hoặc clip, không phải 1 still. (Ngoại lệ: khi *kết quả* của behavior là visual — vd "nhiều lớp bật cùng lúc" — thì cap state kết quả được.)
Câu đã chốt rồi (vd ghim xám, bỏ tên) vẫn nên cap để khách thấy "cái sẽ MẤT", nhưng không bắt buộc mọi câu.

**Recipe chụp (đã chạy thật — xem memory design-gap-audit-skill "CÁCH CHỤP ẢNH"):**
- Playwright python: `~/Projects/uat-toolkit/.venv/bin/python`; browser lệch version → `launch(executable_path="~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome")`. Nén JPEG (Pillow) maxw~1000.
- **Legacy = chụp app DEV thật** (xin user URL dev có sẵn query params, vd `/deal/map?dataType=contract&zoom=16&latLng=...`; đổi param ra state khác: dataType→màu ghim, zoom nhỏ→cụm, `get_by_text("津波").click()`→bật lớp). **Đừng dùng localhost** (kén host pinrich.local, dev server hay 500).
- **Design = file bundle khách** `~/Downloads/.../○○.html` qua `file://`; mock xếp nhiều page → crop theo selector `:visible` (.dtop, .map-aside, .scard…).
- Nhúng artifact: **base64 data URI** (CSP chặn host ngoài), mỗi ảnh 1 CSS class `.img-NAME{aspect-ratio:W/H;background-image:url(data:...)}` để dùng lại khỏi phình.
- **Map (iframe Google Maps) cũng bị CSP Artifact chặn** → trống. Muốn map hiện trong artifact: chụp iframe → **base64 screenshot** làm nền (xoá info-box bằng PIL). Cần map **LIVE** (kéo/zoom) trong link share → đẩy bản iframe lên **Claude Design** (cho iframe), KHÔNG phải Artifact. (memory `artifact-csp-map-embed`)
- **1 cặp full-PC đã chứa ~8 câu** (ghim/badge/lớp/toggle/header/layout cùng khung) → **đừng fanout từng câu**; chỉ cần ~5-6 state-pair, batch 1 script nhanh hơn bung agent.

## Sau audit

- Leader/khách chốt xong → mới sang skill implement đúng đường:
  - design qua Claude Design bundle → **apply-design-handoff**
  - redesign-first qua Claude Design → **design-screen**
  - port thẳng Vue→SDD → **sdd-port-page**
- Bảng gap đã duyệt = scope đóng băng. Phát sinh lệch mới lúc code → quay lại bổ sung bảng, đừng tự quyết.
- **Artifact QA có 2 phần nói cùng câu** (bảng chi tiết Phase 3 + section ảnh Phase 3b). Khi leader/khách trả lời → cập nhật trạng thái câu đó ở **CẢ HAI phần**, đừng để 1 chỗ "đã chốt" còn chỗ kia "đang hỏi" (tự mâu thuẫn, đã bị bắt lỗi). Quy tắc chung: artifact có >1 chỗ nói cùng dữ kiện → đổi 1 chỗ là quét hết. (memory `qa-artifact-sync-both-sections`)

**Không làm:** không code trong skill này; không tự chốt rổ ⚠️; không bỏ qua state thiếu chỉ vì design không vẽ.
