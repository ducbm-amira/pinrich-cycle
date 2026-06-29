# QA Verify Patterns — Pinrich

Knowledge base các pattern Pinrich-specific tích lũy từ session QA verify trước. Mục đích: lần verify sau không phải nghĩ lại từ đầu, không miss case đã biết là dễ sai.

## Quy tắc sử dụng

- **Trước Phase 2** (chọn kịch bản): scan file này, lọc các pattern có `Trigger` khớp với scope đang verify → đưa vào bảng kịch bản Phase 2.
- **Stale check ở Phase 2**: trong số entry đã lọc, nếu `Last verified` > **6 tháng** so với hôm nay → đánh dấu "stale, reconfirm trước khi áp dụng". Stale entry vẫn dùng được nhưng cần test 1 ca xác nhận pattern còn đúng trước khi tin.
- **Reconfirm trong session**: khi pattern stale (hoặc bất kỳ) được test và xác nhận còn đúng → cập nhật `Last verified` về ngày hôm nay.
- **Sau Phase 5** (báo cáo): nếu phát hiện bug hoặc edge case **chưa có** ở đây → append entry mới theo format dưới (gồm `Last verified` = ngày hôm nay).
- **Litmus test trước khi append**: tự hỏi *"Pattern này sẽ trigger ít nhất 1 lần nữa trong 3 tháng tới không?"* — nếu không → KHÔNG append, chỉ ghi note trong báo cáo session.
- **Khi gặp entry không còn đúng** (code refactor, rule đổi, schema thay đổi): update hoặc xóa entry ngay trong session. Memory sai còn tệ hơn không có memory.
- **Audit trigger (chống grow lộn xộn)**: trước khi append, check:
  - `grep -c '^## ' patterns.md` (số entry) > 20 **HOẶC**
  - `git log -1 --format=%cr -- patterns.md` > 3 tháng

  → Đề nghị tester pair-audit để **xóa entry outdated trước khi thêm mới**. Skill KHÔNG tự xóa entry mà không hỏi tester (memory thuộc về team, không tự ý drop).
- **KHÔNG append**: case quá specific 1 task, không tái dùng; thứ đã có trong CLAUDE.md hoặc MEMORY.md (cite reference thay vì copy); pattern fail litmus test 3 tháng.

## Format mỗi entry

```
## <Tên pattern>
**Trigger**: khi nào áp dụng (file/model/feature/keyword)
**Last verified**: YYYY-MM-DD (ngày tester cuối cùng confirm pattern còn đúng)
**Risk**: cái gì hay sai
**Test case**: case cụ thể phải verify
**Reference**: link memory / file / commit
```

---

> **Knowledge base này đang TRỐNG cho Pinrich.** Các pattern FMI cũ đã được gỡ vì không áp dụng cho codebase này. Append entry mới khi phát hiện pattern Pinrich-specific đáng tái dùng.
>
> Gợi ý các trục dễ sinh pattern ở Pinrich (tham khảo memory `/pinrich`):
> - **SP/PC split** (`conditionalComponent()`) — sửa 1 variant quên variant kia.
> - **Pinrich/Baitori brand** (`isBaitoriDomain()`) — view render khác nhau theo domain.
> - **share/ coupling** — entity dùng chung FE+BE, sửa 1 phía ảnh hưởng phía kia.
> - **Tích hợp ngoài** — Rakucore / Salesforce / PriceHubble / LINE / SES sync có độ trễ, webhook, retry.
> - **`url_share_user`** = bảng Client (không phải `clients`); route dưới `/deal/`.
