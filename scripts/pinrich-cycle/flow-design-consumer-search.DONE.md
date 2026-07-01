# State — Luồng DESIGN-ITERATE: redesign trang search consumer (legacy-aligned)

> Luồng này CHẠY NGOÀI pinrich-cycle (cố ý — xem memory consumer-search-redesign + design-gap-audit-skill).
> Đo tiến độ theo "version design khách đã duyệt", KHÔNG theo git repo. Đây là lần chạy #1-2 của design-iterate.
> Cập nhật: 2026-06-25 — ✅ DONE (user xác nhận xong)

task: Redesign trang tìm BĐS consumer theo design khách, khớp tính năng legacy → gửi khách feedback
flow_type: design-iterate (gap-audit → redesign Claude Design → gửi khách → feedback loop → freeze → (sau này) port code)

## Nguồn
- legacy (source-of-truth tính năng): ~/Projects/estimate/src (Vue)
- base_clone: ~/Downloads/consumer_search_edited  (đã chốt dùng bản edited, KHÔNG phải gốc trắng — tái dùng adaptive filter/variants)
- working_copy: ~/Downloads/consumer_search_v3  (sửa ở đây rồi push)
- design_project_id: 2cdff516-e5de-438e-9ce2-37f312d97515  (Claude Design "consumer_search v3 (legacy-aligned)")
- đối chiếu cũ giữ nguyên: ceeb906a-130f-48d2-956d-5d4292c16a1a (v2 edited)
- specs chi tiết per-màn: /tmp/.../scratchpad/spec_{search,list,map,detail,forms}.md (file:line)
- artifacts: Audit=01357928-2399-4f47-9852-557e8423603b · QA=9f8ea6f0-2843-49e2-832b-86158c4a9dad · ChangeSpec=cc183d3f-81b1-42cf-9fb5-dc7b5bc91e2c

## Màn (screens)
- list   ✅ push (gỡ ◀▶/1N/階/estimate/詳細条件 · gate こだわり cho マンション · bù autocomplete+検索+値下げ+empty/loading · 竣工年 chỉ マンション · giá ĐEN)
- map    ✅ push (marker màu theo loại + chấm 査定 · single-layer + legend · autocomplete 2 ô search · card đồng bộ list · giá ĐEN)
- detail ✅ push (gỡ 月々目安/試算/công thức/book-card/Google map · +モゲ CTA+MFS · +情報修正提案 · giá ĐEN · 様 GIỮ pending)
- 質問フォーム      ⏳ CHƯA
- 見学予約フォーム  ⏳ CHƯA   ← current_screen

## ⚠️ SCOPE THU HẸP (2026-06-24)
USER CHỈ LÀM TRANG **MAP**. list/detail/2 form → NGƯỜI KHÁC làm cùng (collab).
- list ✅ + detail ✅ đã sửa sẵn → GIỮ LẠI làm điểm xuất phát cho người khác (không revert/xóa).
- 2 form → KHÔNG làm (người khác).
- Map: user "còn muốn chỉnh" → đang chờ user nêu điểm cần sửa thêm.

current_screen: MAP — đang QA (artifact 9af077f5)

## 🟢 LEADER CHỐT (2026-06-24): map BEHAVIOR = giữ nguyên LEGACY
→ Mọi câu ⚙️ behavior + ✅ trong QA map auto theo legacy (KHỎI hỏi khách). Redesign map = CHỈ reskin VISUAL (câu 🎨).
- Hệ quả khi implement: Q7 quick-card-trước (2 bước), Q10 mở tab mới, Q12 single-layer, Q17 掲載種類 luôn-hiện, Q20 toggle kiểu legacy (1 chiều/tab mới/khoá khi chưa chọn địa điểm), Q25/Q26 khôi phục màn lỗi + báo no-data lớp.
- CHỜ leader: Q27 (bố cục 2 cột vs full-map+toggle) — ranh giới visual/behavior, chưa auto-chốt.
- Data đã verify (Q8): ga+徒歩 + giá cũ (regPrice/price_drop) CÓ SẴN, không cần sửa API; ảnh 間取り図 chưa chắc.
- Q3 (ghim 査定) = N/A (chỉ luồng định giá).

## Gate & version
frozen_version: CHƯA (non-negotiable: freeze version TRƯỚC khi port code)
feedback_round: 0  (chưa gửi bản v3 cho khách)
customer_gate: pending

## Đang treo chờ người
- 様 (tên khách header mọi trang): user đưa LEADER hỏi khách → giữ nguyên tới khi có đáp
- #3 format tiền (万円 vs 円 đầy đủ ở khối 価格/費用/ローン detail): để KHÁCH feedback luôn, chưa convert

## Nợ cleanup (gom làm 1 lượt sau khi xong 2 form)
- detail: link-hóa 学校/駅/路線 · gộp 近隣の駅 collapse+badge · AD費用+disclaimer 初期費用 · xác nhận ẩn-khi-成約
- dead-code: estimateCount/refreshFilterDot/cardSlide (list) · book-card+周辺 ẩn-chưa-xóa (detail)

## ⚠️ Sửa khi IMPLEMENT map (đang ở giai đoạn QA, chưa sửa HTML)
- **Ghim → 1 màu XÁM (leader chốt Q1 = theo design)**, BỎ tô màu theo loại 売出/成約/賃貸. ⚠️ Bản v3 fork đang tô màu ghim theo loại → ĐỔI VỀ XÁM. Kéo theo: bỏ chú thích màu ghim (Q4). Không cần highlight ghim "đang chọn" (design không có; biết qua thẻ xem nhanh Q7).
- Bản v3 map trên Claude Design (2cdff516) còn **chấm 査定 thừa** (fork thêm lúc trước) → GỠ. Lý do: ghim 査定 chỉ render khi store có sateiTarget.position = luồng định giá, KHÔNG có ở search consumer (GmapResult.vue:31-40,180-192). QA map Q3 = N/A.
- Working copy local `~/Downloads/consumer_search_v3` ĐÃ BỊ XÓA → khi quay lại sửa phải KÉO LẠI file từ project 2cdff516 (DesignSync get_file cap 256KB/file mà file ~280KB → cân nhắc cách kéo đủ; hoặc dựng lại từ edited + re-apply).
- Scope hiện tại: user CHỈ làm map; đang QA map (artifact 9af077f5) trước khi sửa.

## next_action
DONE (2026-06-25) — user xác nhận luồng đã xong. Nếu quay lại port code: freeze version khách-duyệt trước, kéo lại working copy từ project 2cdff516 (working_copy local đã xóa).

## Ghi chú lần chạy (cho rule-of-three)
- Run #1 (consumer_search): PIVOT giữa chừng — đổi base gốc→edited; quyết định #1(値下がり)/#2(掲載種類 single)/様/#3 xê dịch. → chưa ổn định, CHƯA đủ điều kiện wire vào cycle.
