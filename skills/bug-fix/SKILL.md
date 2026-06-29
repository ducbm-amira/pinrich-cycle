---
name: bug-fix
description: Quy trình fix bug hoặc thay đổi behavior. Enforce 4 phase theo thứ tự — investigate, prepare, implement, verify. Dùng khi user nói "fix bug", "sửa bug", "làm task", "triển khai task", "implement task", hoặc paste Trello/task description. KHÔNG trigger cho debugging, explaining code, hay quick refactor.
disable-model-invocation: false
---

# Bug Fix Process

## Phase 1: Investigate
Điều tra kĩ TRƯỚC KHI code. Không được skip phase này.

1. Đọc task description — hiểu WHO/WHAT/WHY
2. Check memory files cho context có sẵn về feature liên quan
3. Tìm core logic — nơi bug phát sinh, đọc code thực tế
4. Trace downstream effects:
   - Notifications/emails (AWS SES, Slack, LINE)
   - Workflow/audit trail (追客 steps, status recalculation)
   - Queues (`server/src/mq/`) — job nào tiêu thụ data này
   - Tích hợp ngoài (Salesforce, Rakucore, PriceHubble webhooks)
5. **Grep ALL call sites** của mọi function sẽ modify — list ra hết, không được miss
6. Đánh giá impact theo variant của Pinrich:
   - **SP/PC split** (mobile/desktop, `conditionalComponent()`)
   - **Pinrich/Baitori brand** (`isBaitoriDomain()`)
   - **share/ coupling** — sửa entity dùng chung FE + BE → ảnh hưởng cả hai phía
7. Save kết quả điều tra vào memory

**Output Phase 1:** Báo cáo gồm:
- Chỗ nào cần sửa (file:line)
- Chỗ nào KHÔNG bị ảnh hưởng + lý do
- Variant impact table (SP/PC, Pinrich/Baitori, share/ coupling)
- **Full test case list** — liệt kê tất cả cases (happy path, negative, edge cases, các variant) dưới dạng bảng cho tester manual test. Nếu không list được đầy đủ tức là chưa hiểu đủ scope — cần điều tra thêm trước khi code.

Hỏi user confirm trước khi sang Phase 2.

## Phase 2: Prepare
Chuẩn bị trước khi code.

1. Checkout nhánh mới từ `develop` (nhánh chính của repo, nếu chưa có)
2. **Đọc test files liên quan TRƯỚC** — xác định:
   - Test data nào đã cover scenario cần fix
   - Assertions nào cần update cho behavior mới
   - Có cần test mới không (không viết duplicate)
3. List ra cụ thể: test nào update, assertion nào đổi

**Output Phase 2:** Danh sách:
- Tests cần update assertions
- Tests mới cần viết (nếu có, kèm lý do tại sao test cũ không đủ)

## Phase 3: Implement
Sửa code + update tests.

1. Implement code changes theo danh sách từ Phase 1
2. Update existing test assertions theo Phase 2
3. Chỉ thêm test mới nếu Phase 2 xác nhận cần

## Phase 4: Verify
Chạy test và confirm.

1. Chạy tests liên quan (Jest):
   - Server: `docker compose run --rm pinrich-server npm test -- <path>`
   - Frontend / share: `docker compose run --rm pinrich-frontend npm test -- <path>` (hoặc `npx jest <path>` ở root)
2. Chạy full test file để catch regression
3. Fix nếu fail, lặp lại đến khi pass
4. Báo kết quả cho user, hỏi commit không
