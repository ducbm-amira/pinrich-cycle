---
name: apply-design-handoff
description: "Áp một Claude Design handoff (claude.ai/design) vào codebase thật. Fetch bundle → đọc README + chat transcripts → map sang repo → implement bằng atom/token sẵn có → verify. Dùng khi user gửi link design (api.anthropic.com/v1/design/... hoặc claude.ai/design/p/...) hoặc nói 'áp design này', 'implement design handoff', 'fetch design file rồi làm', 'apply the designs'. KHÔNG trigger cho port trang legacy (dùng sdd-port-page), design review Figma (dùng /review), hay tạo prototype mới (generate-design)."
disable-model-invocation: false
---

Trả lời bằng tiếng Việt. **Tone: CONCISE** — verify nguồn thật, hỏi xác nhận khi mơ hồ, không đoán. Enforce thứ tự phase.

# Apply Design Handoff (Claude Design → code thật)

Mục tiêu: hiện thực hoá design từ một **handoff bundle Claude Design** vào codebase đúng — **tái dùng atom/token sẵn có**, không build trùng, không copy y nguyên cấu trúc prototype, wire data thật.

> Bài học gốc: session login-redesign (2026-06-17). Hai nguyên tắc cốt lõi: **verify nguồn design thật trước** (đừng đoán intent/cấu trúc, đọc chat transcript để lấy chốt cuối) và **kỷ luật scope** (chỉ làm phần trong scope FE, phần ngoài tách ticket riêng).

---

## Phase 0 — Scope + target repo (DỪNG hỏi nếu mơ hồ)

1. Xác định **repo đích** (estimate / estimate-sdd / estimate-client-sdd). Nếu task không nói rõ → **hỏi** (AskUserQuestion), đừng đoán.
2. Đọc `CONVENTIONS.md` của repo đó (naming, folder-per-feature, SDK, state).
3. Tóm tắt 2–3 dòng: design này áp cho màn/feature nào, repo nào.

## Phase 1 — Fetch bundle

Link có 2 dạng — phân biệt:
- **`api.anthropic.com/v1/design/h/<code>`** = handoff download (tar.gz). **curl được**:
  ```sh
  curl -sSL "https://api.anthropic.com/v1/design/h/<code>" -o /tmp/handoff.tar.gz
  mkdir -p /tmp/handoff && tar -xzf /tmp/handoff.tar.gz -C /tmp/handoff
  find /tmp/handoff -type f | sort
  ```
- **`claude.ai/design/p/<uuid>`** = share link (web, cần login) → **curl/WebFetch 403, KHÔNG fetch HTTP được**. NHƯNG đọc được bằng **MCP `mcp__claude_design__*`**: `list_projects` → tìm project → `list_files`/`read_file` lấy HTML, `get_conversation` lấy chat transcript. (ToolSearch `select:mcp__claude_design__...` để load — tool deferred.) Chỉ khi MCP không có thì mới xin user link `/h/` hoặc export tay. Xem [[claude-design-mcp]].

Bundle thường: `README.md` · `chats/chat*.md` · `project/*.html` + `colors_and_type.css` + `fonts/` + `components/*.jsx`.

## Phase 2 — Hiểu design (đọc đúng thứ tự — intent nằm ở chat)

1. **README.md trước** — nó chỉ file chính + cách đọc.
2. **chats/*.md** — transcript user ↔ design AI. **Intent thật + chốt cuối nằm ở đây**, không phải HTML. Chat dài (chat1) → grep điểm quyết định; chat ngắn → đọc hết.
3. **File HTML chính** (chat chỉ ra file cuối user iterate) → đọc top-to-bottom, **follow imports** (CSS/components/scripts).
4. Prototype là **HTML/CSS/JS demo** (hành vi giả: `setTimeout`, `window.location.href='x.html'`). **Tái tạo VISUAL**, KHÔNG copy cấu trúc nội bộ prototype. Wire data thật ở Phase 4.

## Phase 3 — Map sang repo (chống build trùng + reuse-first)

- **Check cái gì ĐÃ CÓ** — đừng build lại. (Session gốc: login SDD đã áp design từ trước → chỉ thiếu link + 2 trang mới.) Grep route/view/component hiện có khớp design.
- **Design system của handoff (`colors_and_type.css`) thường TRÙNG token repo** (cùng nguồn Figma). → Dùng `var(--token)` / atom repo, KHÔNG bê CSS prototype vào. Đối chiếu `src/styles/global.css`.
- **Reuse-first (BẮT BUỘC)**: trước khi tự viết bất kỳ UI nào → `ls src/components/{atoms,ui}` + grep hooks/util. Có `Alert`/`Input`/`Button`/`Card`/`FormControl`... thì dùng, đừng tự chế div. (Session gốc suýt tự chế alert thay vì `Alert` atom.)
- Map từng màn prototype → View/route trong repo; phần lặp giữa các màn → tách 1 shell/primitive chung.

## Phase 4 — Implement + wire data

- Recreate pixel-perfect bằng atom/token repo. Folder-per-feature đúng CONVENTIONS.
- **Thay hành vi demo bằng API thật** — nhưng xác định ĐÚNG nguồn: SDD API (SDK OpenAPI) hay legacy (`/deal/api/...`)? Hỏi/verify, đừng mặc định. (Session gốc: reset password dùng **legacy** vì SDD API chưa có endpoint.)
- **Scope discipline**: phần ngoài FE (BE đổi endpoint/mail, infra, atom app-wide) → ghi **ticket riêng**, không gộp.
- Policy/validation/text → **khớp pattern repo sẵn có** (vd password policy theo trang đăng ký), không tự chế stricter/looser nếu repo đã có chuẩn.

## Phase 5 — Verify + bàn giao

- `tsc --noEmit` sạch (override tsbuildinfo nếu permission: `--incremental false`).
- Render thật (docker dev; port phụ nếu sợ đụng service đang chạy) → screenshot từng màn đối chiếu prototype.
- Hành vi/edge → bàn giao **`/pinrich-suite:qa-verify`**. Trước commit → **`/pinrich-suite:review-code`** (đặc biệt reuse-first + a11y + DRY).
- Liệt kê rõ phần **ngoài scope / NOT-done** (BE/infra/QA tay) để user xếp ticket.

---

## Checklist
- [ ] Xác định repo đích (hỏi nếu mơ hồ) + đọc CONVENTIONS.
- [ ] Fetch `/h/` bundle (link `/p/` không tải được → xin link handoff).
- [ ] Đọc README → **chats (intent)** → HTML chính + imports.
- [ ] Check cái gì ĐÃ tồn tại trong repo (không build trùng).
- [ ] **Reuse-first**: `ls components/{atoms,ui}` trước khi tự viết UI.
- [ ] Token handoff ↔ `global.css` — dùng atom/token repo, không bê CSS prototype.
- [ ] Wire API đúng nguồn (SDD vs legacy) — verify, không mặc định.
- [ ] Phần ngoài scope → ticket riêng, không gộp PR.
- [ ] tsc sạch + render đối chiếu + bàn giao /pinrich-suite:qa-verify + /pinrich-suite:review-code.
