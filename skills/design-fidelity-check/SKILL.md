---
name: design-fidelity-check
description: "Đối chiếu UI dựng vs Claude Design source bằng python -m verdict, emit verdict cứng PASS/FAIL/BLOCKED (không văn xuôi). Dùng khi /pinrich-suite:pinrich-cycle vào bước FIDELITY (sau qa-verify, trước done), hoặc khi cần check 1 màn lệch design 1-1 thay vì 'na ná'. Đọc exit code 0/1/2 + report overall — KHÔNG tự đo lường lại. Dùng khi user nói 'fidelity check', 'check lệch design', 'đối chiếu UI vs design', 'chạy gate fidelity'. KHÔNG trigger cho QA chức năng (dùng qa-verify), port trang (dùng sdd-port-page), hay tạo design mới."
argument-hint: "[<repo> <current_screen> | để trống = hỏi]"
allowed-tools: Read, Bash, Glob, Grep, AskUserQuestion
disable-model-invocation: false
---

Trả lời bằng tiếng Việt.

# Design Fidelity Check (gate đo khớp UI ↔ Claude Design)

Đối chiếu UI **đã dựng** với **Claude Design source** (ground-truth), ra một verdict cứng:
`PASS` / `FAIL <bucket+lý do>` / `BLOCKED <manual-review>`. Là **gate FIDELITY** của
`/pinrich-suite:pinrich-cycle` (chạy sau `qa-verify`, trước `done`) — productized, authoritative (D-51/D-56).

---

## ⚠️ Giới hạn scope: skill này KHÔNG đo lường lại

Skill này **KHÔNG re-implement đo lường**. Toàn bộ phép đo (token / affordance / pixel /
overlay / geometry) **đã build sẵn ở Phase 1–4** trong `design-fidelity-gate`. Việc duy nhất
ở đây: **gọi `python -m verdict`** rồi **đọc exit code (0/1/2) + report `overall` (PASS/FAIL)**
và emit verdict cứng.

- KHÔNG sửa source UI (skill này KHÔNG có `Write`/`Edit` trong allowed-tools).
- KHÔNG gọi `python -m adapter` (kéo design source mới qua MCP — on-demand, ngoài scope, D-54).
- KHÔNG forward exit code của `extract.py`; chỉ tiêu thụ **verdict** 0/1/2.
- KHÔNG sửa `qa-verify` / `sdd-port-page` / `design-gap-audit` (3 shared skill off-limits).

---

## Bước 1 — Resolve screen (qua map, KHÔNG hard-code, KHÔNG raw free-text)

Đọc `design-fidelity-gate/screens/screen-id-map.yaml` (load **`yaml.safe_load` only**).
Match cycle `repo` + `current_screen` (free text) với từng entry `repo` + `current_screen`
(list alias) → resolve ra `screen`, `module`, `contract`, `has_cache`.

```bash
GATE="${PINRICH_GATE_DIR:?set PINRICH_GATE_DIR to your design-fidelity-gate checkout — see plugin README}"
PY="${PINRICH_GATE_PY:?set PINRICH_GATE_PY to the uat-toolkit venv python — see plugin README}"
# repo + current_screen do cycle truyền vào (vd: estimate-client-sdd "map")
RESOLVED=$(cd "$GATE" && "$PY" -c '
import sys, yaml
repo, cur = sys.argv[1], sys.argv[2].lower()
m = yaml.safe_load(open("screens/screen-id-map.yaml"))["map"]
for e in m:
    if e["repo"] == repo and cur in [str(a).lower() for a in e["current_screen"]]:
        c = e["contract"] or ""
        print(f"{e[\"screen\"]}\t{e[\"module\"]}\t{c}\t{str(e[\"has_cache\"]).lower()}")
        break
' "$REPO" "$CURRENT_SCREEN")
```

- **KHÔNG bao giờ truyền raw free-text vào `--screen`** (T-05-01 / Tampering): verdict có default
  `--screen=kodate-estimate`, truyền thẳng free-text sẽ **âm thầm trúng default sai màn**.
- **Không có entry khớp** → emit `BLOCKED no screen-id-map entry for repo+current_screen`
  (manual-review). KHÔNG fall-through về default `kodate-estimate`.
- Thêm screen mới = sửa **chỉ** `screen-id-map.yaml` (rules-as-data), không đụng skill.

---

## Bước 2 — Invoke verdict (subprocess trong venv gate)

Hằng số cố định:

```bash
GATE="${PINRICH_GATE_DIR:?set PINRICH_GATE_DIR to your design-fidelity-gate checkout — see plugin README}"
PY="${PINRICH_GATE_PY:?set PINRICH_GATE_PY to the uat-toolkit venv python — see plugin README}"
SCREEN=<resolved screen id>        # vd kodate-estimate
CONTRACT=<resolved contract|empty> # vd contracts/deal-map.yaml hoặc rỗng
OUT="$GATE/cache/_reports/$SCREEN.report.json"   # path cố định gate-owned (T-05-04)

cd "$GATE"
PYTHONPATH=src "$PY" -m verdict --screen "$SCREEN" \
  ${CONTRACT:+--contract "$CONTRACT"} \
  --target tests/fixtures/target_good.json \   # HOẶC bỏ --target để live-capture (D-54)
  --out "$OUT"
code=$?
```

**Worked example / acceptance path** (verified live, kodate-estimate):

| `--target` | exit | overall | verdict |
|------------|------|---------|---------|
| `tests/fixtures/target_good.json` | 0 | PASS | `PASS` |
| `tests/fixtures/target_wrong_color.json` | 0 | FAIL (advisory; TOKEN-COLOR-001 + PIXEL-DRIFT) | `FAIL <bucket+lý do>` |
| `/nonexistent.json` | 2 | — (TARGET-BLOCKED) | `BLOCKED <manual-review>` |

- **Live-capture (D-54):** bỏ `--target` → verdict capture target **sống** qua reach recipe
  (`screens/<screen>.states.yaml`), dùng design cache committed Phase-1 làm ground-truth, **không**
  MCP/adapter pull trong cycle. Hôm nay cả 2 reach recipe là `url:""`/`verified:false` → live run
  ra **exit 2 BLOCKED** → đó là kết cục advisory-first đúng (surface manual-review), nên acceptance
  path dùng static fixture `target_good.json` (PASS) / `target_wrong_color.json` (advisory FAIL).
- Report path (`$OUT`) ghi vào field `notes` của cycle; heatmap (nếu có) gate tự ghi cạnh `--out`.

---

## Bước 3 — Branch 4-way trên (exit, overall) — D-53, LOAD-BEARING

**Phải branch trên CẢ exit code LẪN report `overall`** — vì exit 0 phủ **cả advisory-PASS lẫn
advisory-FAIL**. Branch chỉ theo exit code là SAI (cấm).

```bash
case "$code" in
  2) # BLOCKED: built target uncapturable / design source missing
     # → fidelity_result=blocked, ghi manual-review note. KHÔNG BAO GIỜ fail cycle, không reopen BUILD.
     # KHÔNG đọc report file ở đây: trên exit 2 engine chỉ emit findings ra stdout, KHÔNG ghi report file (verdict/__main__.py).
     verdict="BLOCKED target-uncapturable (TARGET-BLOCKED)";;
  1) # Hard error: → CYCLE ERROR (khác BLOCKED). Không đóng cycle.
     verdict="ERROR <fidelity hard error; do not close cycle>";;
  0) overall=$("$PY" -c 'import json,sys; print(json.load(open(sys.argv[1]))["overall"])' "$OUT")
     if [ "$overall" = "PASS" ]; then
       verdict="PASS"
     else   # overall == FAIL (advisory)
       bucket=$(jq -r '[.findings[]|select(.severity=="error")][0].id // .findings[0].id' "$OUT")
       verdict="FAIL <$bucket>"
     fi;;
esac
```

| exit | overall | verdict | tác động cycle |
|------|---------|---------|----------------|
| 2 | — | `BLOCKED <manual-review>` | ghi note, **không fail**, không reopen BUILD |
| 1 | — | `ERROR` (cycle error) | **không** đóng cycle (khác BLOCKED) |
| 0 | PASS | `PASS` | tiếp tục → DONE |
| 0 | FAIL | `FAIL <bucket+lý do>` | xem advisory/enforce ở dưới |

> **exit 0 phủ cả advisory-PASS và advisory-FAIL** → cấm branch theo exit code đơn lẻ.

---

## Bước 4 — Verdict cứng 3-state (không văn xuôi)

Mirror quy ước **"Verdict cứng, không văn xuôi"** của `/pinrich-suite:pinrich-cycle`: mỗi gate kết ở **1 trong
3 trạng thái rõ**, ghi thẳng vào state — không để gate kết bằng đoạn văn mơ hồ.

Skill này kết ở đúng một trong:

- **`PASS`**
- **`FAIL <bucket + lý do 1 dòng>`**  (vd `FAIL token: TOKEN-COLOR-001 (ΔE2000 quá ngưỡng)`)
- **`BLOCKED <manual-review reason 1 dòng>`**  (vd `BLOCKED target uncapturable (TARGET-BLOCKED)`)

KHÔNG báo một đoạn văn xuôi. Có lý do fail cụ thể thì vòng fix-lại mới deterministic.

> **Advisory vs enforcing KHÔNG do skill này quyết.** Việc một `FAIL` có reopen BUILD hay không
> là quyết định của **cycle** qua field `fidelity_enforce` (Plan 02, default `no` = report-only).
> Skill này **chỉ report verdict**, không tự đóng/mở cycle.

---

## Bước 5 — Dedupe với P6 (D-51, KHÔNG sửa sdd-port-page)

`/pinrich-suite:sdd-port-page` **P6 (verify-against-design)** là partner dedupe (sdd-port-page dòng 98/110) —
**chỉ tham chiếu, KHÔNG sửa**. Trên port-track P6 đã đối chiếu design bằng cùng `uat-toolkit`.
Cycle **bỏ qua** gate FIDELITY này khi P6 đã verify **cùng màn trong cùng iteration** (dedupe theo
screen + iteration). Track design/handoff không chạy P6 → FIDELITY luôn chạy.

KHÔNG sửa `qa-verify` / `sdd-port-page` / `design-gap-audit` — gate này là skill độc lập, additive.
