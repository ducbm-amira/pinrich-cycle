---
name: design-screen
description: "Quy trình design-first một màn UI từ Claude Design tới code React. Tạo bản đầu (nội bộ) → confirm khách (loop) → đóng băng version → bàn giao code. Dùng khi user nói 'làm lại màn X', 'thiết kế lại màn/trang X', 'design lại màn X', 'làm màn X mới trên Claude Design', 'redesign màn X', hoặc hỏi quy trình design→migrate. KHÔNG trigger khi: user gửi link design bundle có sẵn (dùng apply-design-handoff), port thẳng trang Vue→React không qua Claude Design (dùng sdd-port-page), fix bug trang đã có (dùng bug-fix)."
disable-model-invocation: false
---

Trả lời bằng tiếng Việt. **Tone: CONCISE** — verify nguồn thật, hỏi xác nhận khi mơ hồ, KHÔNG đoán. Enforce thứ tự pha + qua cổng mới đi tiếp.

# Design-Screen — quy trình design-first (Claude Design → migrate UI React)

Mục tiêu: đưa MỘT màn từ ý tưởng → mockup Claude Design → khách duyệt → đóng băng → code React (`estimate-client-sdd`), không rework, không lệch source-of-truth.

> **Nguyên tắc 2 nguồn (PHẢI tách vai):** Claude Design = nguồn **HÌNH HÀI** (visual/DS). `estimate` (Vue) = nguồn **DATA & LOGIC** (API, field, flow, edge-state). Backend logic ở `estimate-sdd`. KHÔNG bê style Vue cũ qua.

> **Thao tác Claude Design bằng MCP** — có `mcp__claude_design__*`: **list/read/create/write/render** project Claude Design bằng tool, KHÔNG cần thao tác tay. Ghi: `get_claude_design_prompt` → `finalize_plan` (khai path) → `write_files` (inline `data`) → trả `preview_urls`. Đọc lại: `list_projects`/`list_files`/`read_file`/`get_conversation`. ⚠️ Tool **deferred** — ToolSearch `select:mcp__claude_design__...` để load trước; **ĐỪNG khẳng định "không điều khiển được Claude Design"**. Chi tiết [[claude-design-mcp]].

> **⚠️ Hai bẫy đã vấp:**
> 1. **Prototype Claude Design = JS-driven** (card/detail/filter sinh bằng JS lúc load). Khi re-import vào Claude Design hoặc publish làm preview, nội dung JS-sinh **có thể trống** nếu chỉ đọc HTML tĩnh → cần render-rồi-bake DOM thành HTML tĩnh. Verify bằng render headless (`google-chrome --headless --screenshot`).
> 2. **Audit design ↔ legacy trước khi chốt** — chạy multi-agent (Workflow fan-out) so từng khu vực design ↔ app legacy để bắt **tính năng app có mà design đánh rơi** (vd filter adaptive, autocomplete). Dễ sót nếu chỉ nhìn design.

---

## Pha 0 — Scope + xác định điểm vào (DỪNG hỏi nếu mơ hồ)

1. Màn nào? (詳細 / 査定書 / 売却相談 / 情報編集 × マンション / 戸建 / 土地) loại BĐS nào?
2. **Đang ở pha nào?** — hỏi (AskUserQuestion) nếu không rõ:
   - Chưa có design → **Pha A**
   - Có bản nháp, đang sửa với khách → **Pha B**
   - Khách vừa OK → **Pha C** (đóng băng)
   - Đã đóng băng, cần code → **Pha D** (bàn giao `apply-design-handoff`)
   - Đã code rồi, design vừa đổi → **Pha E** (sync)
3. Tóm tắt 2–3 dòng: màn, loại, pha bắt đầu.

---

## Pha A — Tạo bản design ĐẦU TIÊN (nội bộ, khách CHƯA thấy)

**A1. Gom nguyên liệu:** screenshot UI cũ Vue (PC & SP) · mô tả nghiệp vụ (để làm gì, ai dùng, vị trí trong flow) · data mẫu thật (không Lorem) · danh sách section + thứ tự.

**A2. Đưa nguồn vào Claude Design** (nó KHÔNG tự quét repo): mount `_ds/` read-only cho DS nền; paste screenshot/code cho từng màn. ⚠️ Mở **ĐÚNG project PinRich Consumer Design** — KHÔNG tạo project mới.

**A3. Prompt → generate** — dùng template bên dưới. Mô tả theo **section + thứ tự + responsive**.

**A4. SELF-REVIEW = Cổng 1** (chỗ hay bị bỏ qua — qua cổng mới đưa khách):
- [ ] Xem **cả PC lẫn SP**
- [ ] Đủ section theo A1, không thiếu/thừa
- [ ] Đúng `CLAUDE.md`: 体言止め · giá `n,nnn 万円` · cấm emoji · không お気に入り
- [ ] Dùng token/component DS, KHÔNG tự chế style
- [ ] Data hợp lý, giống thật
- [ ] Kế thừa đúng nội dung screenshot UI cũ

**A5.** Tự sửa → lặp A3–A4 đến khi tự thấy ổn → qua Cổng 1 → Pha B.

### Template prompt (paste vào Claude Design)
```
【画面名】<màn>（PC／SP）
【目的】<mục đích>
【利用者】<ai dùng>
【フロー上の位置】<đứng đâu trong flow>
【セクション構成（上から）】1. ... 2. ... 3. ... 4. 下部 sticky CTA: 「...」
【レスポンシブ】PC: 中央寄せ最大980px / SP: 390px 端末カラム
【厳守】既存 Design System（tokens.css / components.css）使用、
        CLAUDE.md の非交渉ルール順守（体言止め・絵文字禁止・価格「n,nnn 万円」・お気に入り無し 等）
【参考】添付の旧UIスクショの内容を踏襲（見た目は新DSで作り直す）
```

---

## Pha B — Confirm với khách (vòng lặp)

`share link → khách feedback → sửa → confirm lại … → Cổng 2`
- Mỗi vòng ghi **1 dòng changelog**: ngày / khách nói gì / sửa gì.
- **Chưa khách duyệt → KHÔNG code.** Tránh rework.
- **Cổng 2:** khách xác nhận OK rõ ràng.

---

## Pha C — Đóng băng version (BẮT BUỘC — vì share-link luôn trả bản mới nhất)

Ngay khi qua Cổng 2:
1. **Export bundle** từ Claude Design (link `/h/` handoff).
2. Lưu `estimate-client-sdd/design-reference/<màn>/<YYYY-MM-DD>/` (trim fonts/screenshots nặng). *(vị trí cần team chốt)*
3. **Commit:** `design chốt: <màn> <ngày>`.
4. Ghi `design-reference/INDEX.md`: màn | ngày khách chốt | link chat | commit.

> **Cổng 3:** có snapshot đóng băng + tag. Từ đây code chỉ bám bản này, KHÔNG bám share-link.

---

## Pha D — Bàn giao code (KHÔNG tự code ở skill này)

→ Gọi **`apply-design-handoff`** với bundle đã đóng băng (Pha C). Skill đó lo fetch/map/reuse-first/wire-data/verify.
- Visual bám **bản đóng băng**; data/logic bám Vue/`estimate-sdd`.
- **Cổng 4 (acceptance):** code chạy ↔ bản đóng băng, PC & SP, đúng `CLAUDE.md` → bàn giao `/pinrich-suite:qa-verify`, `/pinrich-suite:review-code`.

---

## Pha E — Sync khi design đổi SAU khi đã code (loop bảo trì)

1. Diff **bản đóng băng cũ ↔ bản mới** → liệt kê điểm lệch.
2. Mỗi điểm: quyết **align theo design** hay **code là chủ đích mới** (cập nhật ngược design).
3. Sửa → cập nhật lại Pha C (đóng băng version mới).

---

## Checklist
- [ ] Pha 0: xác định màn + pha bắt đầu (hỏi nếu mơ hồ)
- [ ] Pha A: nguyên liệu → DS đúng project → generate → **Cổng 1 self-review PC/SP**
- [ ] Pha B: confirm khách + ghi changelog → **Cổng 2 khách OK**
- [ ] Pha C: export + lưu `design-reference/` + tag → **Cổng 3 đóng băng**
- [ ] Pha D: gọi `apply-design-handoff` → **Cổng 4 acceptance + qa-verify + review-code**
- [ ] Pha E (nếu cần): diff & reconcile khi design đổi sau code

## Quyết định cần team chốt (không tự quyết)
- Vị trí lưu `design-reference/`: trong `client-sdd` hay repo riêng?
- Đưa nguồn Vue vào Claude Design: mount repo hay paste từng màn?
