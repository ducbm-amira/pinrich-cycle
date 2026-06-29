# Manual Test Plan Template — QA Verify

Đây là format chuẩn cho Phase 2 output. Viết cho **người non-tech** (tester không cần biết code, API, hay test tự động).

## Structure tổng

```markdown
# Kịch bản Manual Test — <Tên feature/fix>

**Mục đích**: <1-2 dòng — fix/feature này để làm gì, người dùng thấy thay đổi gì>

**Chuẩn bị trước khi test (nhờ dev/QA lead setup)**:
- <Account cần có: đại lý A, client test… kèm điều kiện>
- <Data fixture cần có: ví dụ client X đã sync Rakucore, client Y chưa sync>
- <Variant cần test: SP/PC, Pinrich/Baitori>
- <Bất kỳ flag/setting nào cần bật trước>

---

## A. UI — <subtopic>

### TC-A01: <Title>
**Steps:**
1. <Bước click-được>
2. <Bước click-được>

**Expected:**
- <Kỳ vọng đo được>

### TC-A02: ...

---

## B. UI — Tooltip & Style nhất quán

### TC-B01: ...

---

## C. Functional — <subtopic>

### TC-C01: ...

---

## D. Validation — <subtopic>

### TC-D01: ...

---

## E. Edge case

### TC-E01: ...

---

## F. Multi-screen interaction

### TC-F01: ...

---

## G. Bonus UX (recommend, không bắt buộc)

### TC-G01: ...

---

## Tổng kết cho tester

**Pass criteria tổng**:
- Tất cả test case A, B, C, D, F → **PASS** bắt buộc
- Edge case E → PASS hoặc có ghi chú rõ
- Bonus G → recommend, không phải bắt buộc

**Khi gặp FAIL**, ghi lại:
- Số TC
- Bước thứ mấy fail
- Screenshot
- Browser + screen size đang dùng
```

---

## Quy tắc viết test case

### Ngôn ngữ click-được — dùng / không dùng

| ✅ Dùng | ❌ Không dùng |
|---------|---------------|
| "Login đại lý A" | "Authenticate as agent A user" |
| "Vào menu Khách hàng → chi tiết Client" | "Navigate to /deal/clients route" |
| "Bấm nút **Lưu**" | "Trigger save action" |
| "Hover chuột vào badge, giữ 1 giây" | "Dispatch mouseenter event" |
| "Reload trang (F5)" | "Force page refresh" |
| "Ctrl+F tìm chữ 'Đã đồng bộ'" | "Search DOM for synced string" |
| "Bên cạnh tên client có nhãn **Đã sync** màu xanh" | "rakucore_synced_at != null trong response" |
| "Hiện tooltip nhỏ với chữ 'Đã đồng bộ Rakucore'" | "Tooltip component renders với i18n key" |

### Expected phải đo được

| ✅ Đo được | ❌ Mơ hồ |
|------------|----------|
| "Có nhãn 'Đã sync' bên cạnh tên client" | "Hiển thị đúng" |
| "Không thấy chữ 'Chưa đồng bộ' trên trang" | "Phần cũ đã bỏ" |
| "Sau reload, nhãn vẫn còn" | "Persistent OK" |
| "Tooltip hiện chữ 'Đã đồng bộ Rakucore' đầy đủ, không cắt" | "Tooltip work" |
| "Bản SP (mobile) cũng thấy nhãn ở đúng vị trí" | "SP/PC đúng" |

### Mỗi case 1 mục đích

❌ Sai: "TC: Nhãn hiển thị + tooltip + persistence sau reload + bản SP"
✅ Đúng: 4 case riêng — A01 hiển thị, B01 tooltip, E01 persistence, F04 SP/PC

### Chuẩn bị dữ liệu = chuẩn bị account + chuẩn bị fixture

Đặt ở **đầu test plan**, KHÔNG để tester đoán. Mỗi entry phải cụ thể:

- ❌ "Có 1 client đã sync" → tester không biết tìm đâu
- ✅ "Đại lý A có ít nhất 2 client: Client X (đã sync Rakucore — `rakucore_synced_at` != null), Client Y (chưa sync)"

### Categories — chọn nhóm nào?

| Nhóm | Khi nào có case |
|------|-----------------|
| **A. UI** | Khi thay đổi thêm/xóa/sửa element UI ở nhiều vị trí — cần verify từng vị trí |
| **B. Tooltip & Style** | Khi có tooltip, style consistent qua nhiều page, badge/label mới |
| **C. Functional** | Khi logic phân biệt: ai có / ai không có, trigger đúng điều kiện |
| **D. Validation** | Khi thay đổi label/badge cũ → bỏ → verify cũ không còn |
| **E. Edge case** | Data rỗng, data nhiều, data đổi trạng thái, persistence, từ `patterns.md` |
| **F. Multi-screen** | Khi feature lan >1 trang, hoặc SP/PC, Pinrich/Baitori, multi-tab |
| **G. Bonus UX** | Responsive, accessibility, layout edge — recommend |

Nhóm rỗng → bỏ luôn, không cần header trống.

### Số lượng case tham khảo

- Fix nhỏ (1-2 file): 5-10 case
- Feature trung (3-10 file): 15-25 case
- Feature lớn (>10 file, nhiều trang): 25-40 case

Không quá 50 case — tester làm không nổi 1 buổi.
