---
name: sdd-port-page
description: "Port một trang legacy (estimate, Vue 3 + Express) sang FE mới SDD (estimate-client-sdd, Next.js 16 + React 19). 7 phase: scope → hiểu legacy (+ Behavior Manifest kiểm kê cả side-effect vô hình) → preflight env → build → wire data + edge-states → characterization test (TDD từ manifest) → qa-verify (đối chiếu manifest). Dùng khi user nói 'port trang', 'port page', 'build lại trang ... ở FE mới', 'chuyển trang ... sang SDD', 'migrate trang ... sang Next'. KHÔNG trigger cho fix bug trang đã có (dùng bug-fix), QA thuần (dùng qa-verify), hay tạo trang mới không có legacy."
disable-model-invocation: false
---

Trả lời bằng tiếng Việt. **Tone mặc định: CONCISE** — trả lời thẳng, hỏi xác nhận khi mơ hồ chứ không giải thích dài. Enforce 7 phase theo thứ tự, không skip.

# Port Page (legacy → SDD FE)

Mục tiêu: dựng lại một trang đang chạy ở legacy `estimate` (Vue 3) trên FE mới `estimate-client-sdd` (Next.js), **đúng data thật + đúng logic dẫn xuất**, không build thừa và không fallback mock ở prod.

> **Nguyên tắc xương sống (vì sao có Behavior Manifest):** port hay sót — và sót cái VÔ HÌNH (tracking fire-and-forget rớt → bug count prod owner; access line stub null → lọt tới khách). Cả qa-verify lẫn đối-chiếu-design đều MÙ với hành vi không-render-ra-UI vì **không có oracle "legacy thật sự làm gì"**. Fix gốc: P1 đẻ ra **Legacy Behavior Manifest** — kiểm kê MỌI hành vi (nhìn thấy + vô hình), mỗi mục kèm **observable** (DOM / network call / DB write) để verify được. Manifest = (a) checklist chống-sót, (b) oracle cho QA, (c) spec cho characterization test (P4.5). KHÔNG có manifest = KHÔNG được sang P3.

Input đặc thù môi trường: đọc memory **`owner-page-test-links`** trước — nó chứa tri thức hard-won về docker/CORS/subdomain/API develop + field gotchas (đã trả giá bằng nhiều lượt mò). Format số JP xem memory **`pin-numbers-ja-jp`**.

---

## P0 — Source-of-truth + scope (HỎI NGAY, trước khi đọc code)

Trước khi làm bất cứ gì, chốt 2 thứ với user (tránh build thừa rồi bỏ — như vụ biểu đồ giá):

1. **Design bundle hay match legacy?**
   - *Match legacy*: copy hành vi + layout từ trang Vue cũ 1-1.
   - *Design bundle*: có Figma/design mới → bám design, legacy chỉ dùng để lấy data flow.
2. **Loại/màn nào cụ thể?** Trang nào, route nào, có bao nhiêu biến thể (SP/PC, loại BĐS apartment/house/土地, brand Pinrich/Baitori)? Liệt kê rõ cái LÀM và cái KHÔNG làm.

→ Dùng `AskUserQuestion` nếu mơ hồ. Không tự đoán scope.

**Output P0:** 1 câu chốt scope + danh sách màn/biến thể in/out. User confirm trước khi sang P1.

> **Chế độ thứ 3 — PORT + da design** (khi leader chốt: "behavior = y hệt legacy, áp design chỗ feasible, **0 backend**, nhanh"): lọc mỗi điểm design khác legacy qua **4 cửa** → ① cần backend? ② bất-hợp-lý? ③ không-slot-được/legacy-không-có? = **giữ legacy**; còn lại = **áp design**.
> - **Tách behavior (logic tương tác) vs visual affordance (thứ NHÌN THẤY).** "behavior=legacy" KHÔNG có nghĩa lột bỏ affordance khách đã vẽ. Đừng âm thầm bỏ thứ đang thấy (số trên cluster, chip lọc nhanh, thẻ xem nhanh) — khách review qua MOCK sẽ tưởng mất tính năng (đã bị push back nhiều lần). Số trên map = **cluster count** (legacy MarkerClusterer CÓ số), đừng nhầm với same-point (không số).
> - **Legacy-thuần làm UI tệ/trống hơn** (vd mobile chỉ 1 nút Filter) → KHÔNG âm thầm áp; **FLAG tradeoff + research best-practice** (mobile filter: Airbnb/Zillow = chip phổ biến hiện + nút Filters), ghi là ngoại lệ cần leader OK.
> - **Mock là thứ KHÁCH NHÌN** → sau khi chốt, cập nhật mock khớp spec sẽ-build (đừng để mock kẹt ở design gốc đã bị quyết khác). (memory `porting-legacy-keep-visible-ui`)

---

## P1 — Hiểu legacy (+ design source nếu Design bundle)

Đọc trang Vue gốc ở repo `estimate` để hiểu *thật sự* nó làm gì:

1. **View component** (`.vue`) — render gì, state nào, edge-state nào (loading / not-found / already-added…).
2. **Entity / getter / computed** — logic dẫn xuất (tính giá, format, lọc ảnh, parse field). Đây là phần dễ làm sai nhất khi port.
3. **Data flow** — store/composable nào, gọi endpoint nào, params gì.
4. **Endpoint THẬT** — URL + method + shape response (không đoán; xác nhận ở P2 bằng response thật).
5. **⚠️ Side-effect VÔ HÌNH (BẮT BUỘC — đây là chỗ port hay sót nhất).** Grep lifecycle gốc (`onMounted`/`created`/`watch`/handler) tìm MỌI lời gọi **không dùng response**: analytics/tracking (`post*Seen`, `*_action_log`, log event, ghi `client_histories`), metric, MQ, fetch fire-and-forget. Chúng không render gì → audit design + qa-verify đều mù → rớt là lộ sau vài ngày qua dashboard (vụ `ownerPageOpened` 1500→3/ngày). Grep `axios.post|fetch|\.post(` rồi lọc cái KHÔNG đọc kết quả. Bám cả ĐIỀU KIỆN gốc (vd chỉ bắn khi `!fromOwnerPage`). Xem memory `port-scan-fire-and-forget-tracking`.

**Chỉ khi Design bundle** — legacy chỉ dùng để lấy *data flow + logic dẫn xuất*, KHÔNG copy layout. Thêm:

6. **Design ground truth** — đọc `v2/docs/design/tokens.json` + `components/` + rules `pinrich/` để biết token/component chuẩn sẽ dùng.
7. **Figma** — nếu có URL design, extract bằng `/extract-ds <url>` (hoặc đọc registry `v2/docs/design/figma-sources.json` nếu đã extract). Map layout/spacing/màu theo design, không theo Vue cũ.

### Output P1 — Legacy Behavior Manifest (artifact BẮT BUỘC, không có = không sang P3)

Ghi ra file **`<sdd-repo>/.port/<route>.manifest.md`** (persist để sống qua mất-context + dùng lại khi QA). Mỗi hành vi 1 dòng bảng, **mỗi dòng PHẢI có cột Observable** — cách chứng minh nó đã đúng:

| # | Hành vi | Loại | Observable (oracle để verify) | Đã port? |
|---|---------|------|-------------------------------|----------|
| 1 | Render giá 万円 có phẩy | visible | DOM text `1,250万円` | |
| 2 | Card → /deal/property/:id | visible | click → URL khớp + query đúng | |
| 3 | Bắn `ownerPageOpened` khi mở (nếu `!fromOwnerPage`) | **invisible side-effect** | network `POST /client_action_logs/owner_page_seen` 1 lần + 1 row DB | |
| 4 | 徒歩 phút = ceil(distance/80) | derivation | giá trị tính ≡ legacy với cùng input | |
| 5 | empty/not-found state | edge-state | DOM đúng wrapper, không trắng trang | |

- **Liệt kê HẾT** — visible + invisible + derivation + edge-state. Một container đọc → liệt kê hết con (memory `lesson-broad-audit-verify-before-lock`), đừng dừng ở component đầu.
- Loại `invisible` là dòng dễ sót nhất → đánh dấu rõ để P4.5/P5 buộc verify bằng network/DB, không bằng mắt.
- *Nếu Design bundle:* kèm danh sách token/component chuẩn + nguồn design (Figma node / file đã extract).

User confirm manifest đủ trước khi build (nhất là các dòng `invisible`).

---

## P2 — Preflight env (checklist từ memory `owner-page-test-links`)

Trước khi build, đảm bảo môi trường chạy được — nếu không sẽ debug nhầm vào hạ tầng:

- [ ] FE chạy docker, **host port phải là 3000** (legacy CORS chỉ whitelist `*.localhost:3000`). Chạy 3001 → CORS chặn.
- [ ] API `develop` còn sống (`https://develop.pinrich.com/...`). Endpoint cần header browser (Origin/Referer/UA) — curl trần có thể trả 500.
- [ ] URL truy cập đúng: **subdomain của agent** + `urlKey` (+ params trang cần). `https://<subdomain>.localhost:3000/<route>?...`. Cert tự ký → gõ `thisisunsafe`.
- [ ] **Test data THẬT** từ RDS dev (subdomain ở `user_settings`, owner key ở `url_share_user`). Lấy ID hợp lệ trước, đừng bịa.

→ Có thể dùng skill `db` để truy RDS lấy data thật.

**Output P2:** URL truy cập đầy đủ chạy được + 1 bộ test data thật cho mỗi biến thể trong scope.

---

## P3 — Build

1. **Map shape từ RESPONSE THẬT** — gọi endpoint (hoặc copy response từ browser), map type theo data thật chứ KHÔNG đoán từ tên field. Chú ý field gotchas đã biết (xem memory): đơn vị tiền (yen vs 万円), JSON-string cần `JSON.parse`, field null cần tự tính, timestamp number, `propertyType` thiếu loại (土地 = house + classification)…
2. **Port logic dẫn xuất chính xác** theo P1 — từng phép tính/format/lọc khớp legacy.
3. **Layout/UI:**
   - *Match legacy:* copy layout + hành vi từ trang Vue 1-1.
   - *Design bundle:* build bám **token/component chuẩn** (`v2/docs/design/`) + design Figma theo P1 — KHÔNG copy layout Vue. Dùng đúng design token (màu/spacing/typography), reuse component spec sẵn có thay vì tự chế.
   - ⚠️ **Token-diff TRƯỚC khi tin `bg-background`/`text-*`:** token của repo SDD có thể LỆCH token trong file design (ví dụ thật: `--background` design = #fff, SDD = #f4f5f7 → `bg-background` ra xám, khách blame). Diff `:root` của file design ↔ `src/styles/global.css`; token nào lệch thì **override bằng giá trị literal của design** (vd dùng `bg-card`), đừng tái dùng class theo tên token. Xem memory `pin-numbers-ja-jp` + `owner-page-test-links`.
4. **Fan-out agent cho component độc lập** — các component không phụ thuộc nhau (header, gallery, map, summary card, modals…) giao song song cho subagent; gửi nhiều `Agent` trong 1 message.

**Output P3:** Component + type + util dựng xong, map đúng response thật. *Nếu Design bundle:* bám đúng token/component chuẩn.

---

## P4 — Wire data + edge-states

1. Nối data thật vào trang (hook fetch → view).
2. **Đủ edge-state** khớp legacy: loading / not-found / already-added / về trang trước… (không bỏ sót state nào ở P1).
3. **KHÔNG fallback mock ở prod** — nếu thiếu data thì hiện đúng empty/error state, không nhét dữ liệu giả.

**Output P4:** Trang chạy với data thật, mọi edge-state hiển thị đúng.

---

## P4.5 — Characterization test từ manifest (TDD — chống sót bằng test, không bằng trí nhớ)

Biến **Behavior Manifest (P1)** thành test chạy được → mỗi dòng manifest có 1 assertion. Đây là chỗ TDD bấu vào: manifest = spec, test đỏ khi port sót, test xanh = đã port đủ. Mục tiêu KHÔNG phải coverage đẹp mà là **bắt đúng cái dễ sót**.

1. **Mọi dòng `invisible` → test BẮT BUỘC** (vì mắt không thấy). Dùng Playwright `page.waitForRequest`/route-intercept để assert call fire-and-forget bắn đúng (URL + payload + số lần + điều kiện gốc); nếu cần, query 1 row DB sau hành động (skill `db`). Đây là test ngăn lại đúng class bug `ownerPageOpened`.
2. **Derivation → unit test thuần** (giá/万円/徒歩 phút/parse field): so output với giá trị legacy ở vài input biên. Không cần app chạy.
3. **Visible/edge-state then chốt** → để P5 lo (Playwright headed), trừ cái rẻ thì assert luôn ở đây.
4. **Đặt test cạnh feature** theo convention repo SDD (`*.test.ts` / `*.spec.ts`); chạy được bằng runner sẵn có. Nếu repo CHƯA có infra test cho lớp này → đừng dựng framework mới: hạ xuống **checklist-có-observable trong manifest** và đánh dấu dòng đó `verify=manual@P5`, nói rõ là chưa tự-động-hoá (đừng im lặng).

> Nếu `/pinrich-cycle` gọi và budget hẹp: tối thiểu vẫn phải có test cho **mọi dòng `invisible`** + derivation lõi. Visible có thể dồn sang P5.

**Output P4.5:** Test cho từng dòng manifest (hoặc đánh dấu manual rõ ràng) — chạy, xanh. Dòng `invisible` KHÔNG được để manual nếu repo có cách intercept network.

---

## P4.7 — Traceability gate (coverage legacy→react — TỰ lôi chỗ sót)

Manifest (P1) bắt hành vi ta CHỦ ĐỘNG kiểm kê. Nhưng port còn rớt **âm thầm** cái đuôi dài — nhánh `v-if`/computed phụ/prop/emit/wiring ít nổi — mà lúc P1 không nghĩ tới. Bước này **điểm danh từ phía legacy** để lôi ra, thay việc "code xong rồi ngồi map tay" (đọc full legacy → check từng đoạn ra React).

Spawn subagent **`port-traceability`** (`Agent(subagent_type: "port-traceability")`), đưa: file legacy nguồn (view + component-tree, follow import) + dir React (`src/views/<màn>`) + URL app đang chạy. Nó:
- Chạy lớp MÁY: `port-harness/characterize.py --legacy-root … --react-dir … --url … --legacy-files a.vue,b.vue` → wiring prop/emit diff [B] + side-effect list [C] + feature-runtime thô [A].
- Lớp AGENT: đọc full legacy → enumerate MỌI đơn vị (feature/nhánh/computed/method/watch + prop/emit + side-effect) → map vào React theo **chiều legacy→react** → ra BẢNG `✅ported@file:line / ❌MISSING / ⊘dropped-vì-lý-do`. Tính cả REWORD (khác chữ nhưng có = ✅), không báo bừa.

**Gate:** verdict `TRACE_GAP n` → mỗi ❌ phải DUYỆT (thật / reword / ⊘ cố ý). ❌ thật → **quay lại P3/P4 vá**, chưa được coi build xong. Chỉ `TRACE_CLEAN` (mọi ❌ đã giải thích) mới sang P5. Trong `/pinrich-cycle` đây là auto_review validator chặn BUILD→REVIEW.

**Output P4.7:** Bảng truy vết + verdict `TRACE_CLEAN`. Còn ❌ thật chưa vá = CHƯA xong port.

---

## P5 — qa-verify

Verify bằng Playwright headed (nguyên tắc & recipe theo skill `qa-verify`):

> Nếu được `/pinrich-cycle` gọi: P5 chỉ smoke-check nhanh, để cycle lo `/qa-verify` + vòng lặp fail. P6 (verify-against-design) vẫn giữ vì cycle QA không bắt lệch design.

0. **Đối chiếu MANIFEST (oracle) — chạy trước happy path.** Đi từng dòng manifest: visible → verify bằng DOM/assertion; `invisible` → đã có test P4.5 xanh (hoặc verify network/DB tại đây); derivation → test P4.5. Dòng nào chưa chứng minh → đánh `NOT-verified` rõ. **Đây là cái qa-verify thiếu lâu nay: oracle "legacy làm gì".** qa-verify mù với side-effect + map/WebGL + design-fidelity (memory `qa-verify-blind-to-map-ui`) → manifest lấp đúng lỗ đó.
1. **Ca phân biệt** — chọn data làm lộ được sai/đúng (mỗi biến thể loại BĐS, mỗi edge-state). Không chỉ happy path.
2. **Assertion hình học cho layout** — khi match legacy/design, assert vị trí tương đối (vd: nút lightbox NẰM DƯỚI ảnh, gallery đúng số ảnh), không chỉ "element tồn tại".
3. **QA cả màn, không chỉ diff** — click MỌI thao tác user làm (search/chip/toggle/card→chi tiết/pin→popup), kể cả code ngoài commit của mình (memory `qa-whole-screen-and-stale-flags`).
4. **Báo NOT-verified trung thực** — cái nào script không chứng minh được thì nói rõ là chưa verify, đừng tô hồng. Nói rõ "QA chưa kiểm fidelity" nếu chưa chạy P6.
5. **Chỉ khi Design bundle — design review:** chạy `/review <figma-url>` (hoặc `/review-batch`) để check trang dựng xong so với PINRICH Design System + Practical UI. Fix vi phạm HIGH trước khi coi là xong.

**Output P5:** Báo cáo verified / not-verified **theo từng dòng manifest** + theo TC, kèm bằng chứng (screenshot/assertion/network). *Nếu Design bundle:* kèm kết quả design review (vi phạm + đã fix).

---

## P6 — Verify-against-design (BẮT BUỘC khi Design bundle)

`qa-verify` (P5) chỉ kiểm CHỨC NĂNG — KHÔNG bắt được lệch màu/width/format số/thiếu element so design (bài học khách blame trang owner: header xám vs trắng, content 860 vs 930, giá `29880` thiếu phẩy, thiếu dòng 駅徒歩). Phải đối chiếu **render thật ↔ file design** bằng toolkit `~/Projects/uat-toolkit` (đã có engine sẵn):

```bash
cd ~/Projects/uat-toolkit            # cần .venv + playwright (xem README)
# 1. Capture DESIGN (file html bundle) và TRANG CODE (render thật, dùng link data sống)
.venv/bin/python scripts/extract.py --url "file:///path/design.html"            --out tmp/page-design.json
.venv/bin/python scripts/extract.py --url "https://<sub>.localhost:3000/<route>?..." --out tmp/page-target.json
# 2. Ba lớp check đối chiếu design
.venv/bin/python scripts/structural_diff.py     --design tmp/page-design.json --target tmp/page-target.json --out tmp/struct.json
.venv/bin/python scripts/pinrich_design_check.py --target tmp/page-target.json --rules scripts/pinrich_design_rules.yaml --out tmp/design.json
.venv/bin/python scripts/jp_domain_check.py      --target tmp/page-target.json --rules scripts/jp_domain_rules.yaml      --out tmp/jp.json
```

- `structural_diff` (cây + **geometry w/h** + text): bắt **width sai, node thiếu** (vd dòng 駅徒歩 có ở design vắng ở target).
- `pinrich_design_check`: bắt **font out-of-scale, màu/surface, và `DESIGN-NUMFMT-001` (giá ≥1000万 thiếu phẩy)**. ⚠️ Rule này tune cho CRM 12px-density → **NHIỄU nặng trên màn consumer** (scale 14/18/22px hợp lệ vẫn trip ~40 finding false-positive). Trên consumer: tin **gate verdict** (dưới) + computed-style spot-check + eyeball, KHÔNG tin rule thô.
- `jp_domain_check`: format value theo label (面積/間取り/価格…).

### P6.b — Gate overlay verdict (`design-fidelity-gate`) — ƯU TIÊN khi screen có contract

`design-fidelity-gate` (`~/Projects/design-fidelity-gate`, repo `ducbm-amira/design-fidelity-gate`) đo lệch design bằng **design.json ground-truth contract** thay vì rule tĩnh → sắc hơn `pinrich_design_check` thô và **ít nhiễu trên consumer**. Check overlay: token-conformance (color/size/radius/border/font/shadow), affordance, **pixel-overlay** (per-element drift + heatmap), và **geometry/contract** (map pin/cluster order — qua `contracts/<screen>.yaml`). **TỰ LẬP từ 30-06** (vendor engine vào `src/engine/` + có `.venv` riêng — KHÔNG còn bám uat-toolkit; xem memory `design-fidelity-gate-repo`).

**Precondition (nếu không thoả → KHÔNG dừng, fall back về 3 lệnh thô trên + FLAG "gate chưa phủ"):**
1. Screen phải resolve được trong `~/Projects/design-fidelity-gate/screens/screen-id-map.yaml` (repo + current_screen → `--screen <id>`). Có sẵn: `kodate-estimate` (estimate, `has_cache:true`), `deal-map` (estimate-client-sdd `/deal/map`, `has_cache:false` → cần `--contract` + `--design`/`--target` trên đĩa). Screen MỚI chưa đăng ký → thêm 1 entry vào file này (chỉ sửa file đó, skill/CLI không hard-code screen id).
2. Có **design contract**: hoặc cache Phase-1 (`cache/<module>/<screen>/<ver>/design.json`), hoặc dựng từ bundle bằng adapter (bên dưới).
3. `.venv` riêng của gate đã cài 7 deps (`playwright pyyaml beautifulsoup4 pillow pixelmatch coloraide imagehash`) — `requirements.txt` ở gate root. Bẫy: venv Python 3.14 thiếu pip/ensurepip → cài bằng `/usr/bin/pip install --target .venv/lib/python3.14/site-packages` (memory `design-fidelity-gate-repo`). Live-capture cần thêm `playwright install chromium`.

**Chạy (3 bước, dùng venv RIÊNG của gate):**
```bash
GATE=~/Projects/design-fidelity-gate
PY="$GATE/.venv/bin/python"      # venv riêng của gate, KHÔNG phải uat-toolkit
cd "$GATE"

# (1) [chỉ khi CHƯA có cache] dựng design contract từ Claude Design bundle → cache/
PYTHONPATH=src "$PY" -m adapter --screen <screen-id> --bundle /path/to/design-bundle
#   exit 0 = contract fresh | 0+SRC-STALE = dùng cache cũ | 2 = BLOCKED (không có bundle lẫn cache)

# (2) Capture BUILT target (render SDD đang sửa) → target.json, bằng extract.py ĐÃ VENDOR
PYTHONPATH=src "$PY" src/engine/extract.py \
  --url "https://<sub>.localhost:3000/<route>?..." --out /tmp/<screen>.target.json

# (3) Verdict: design contract ↔ built target → report có bucket
PYTHONPATH=src "$PY" -m verdict --screen <screen-id> \
  --target /tmp/<screen>.target.json \
  $( [ -f contracts/<screen-id>.yaml ] && echo --contract contracts/<screen-id>.yaml ) \
  --out /tmp/<screen>.verdict.json
```

**Đọc kết quả ĐÚNG (gate cố ý advisory — đừng chỉ nhìn exit code):**
- **exit 0** = đã chạy. Verdict + per-bucket FAIL/PASS in ở stderr (`buckets: token=... pixel=... geometry=...`) và trong `--out`. **FAIL bucket là advisory → vẫn exit 0** ⇒ PHẢI mở report đọc từng bucket, đừng tưởng exit 0 = pass.
- **exit 2 = BLOCKED** (built target không capture được / thiếu design+target trên đĩa) → **KHÔNG phải pass**, phải làm screen reachable rồi chạy lại.
- **exit 1 = hard crash** (vd contract YAML hỏng) → sửa lỗi hạ tầng, khác hẳn BLOCKED.
- Pixel heatmap: `<out-dir>/pixel_heatmap.png` — mở xem chỗ lệch.

### Kỷ luật BẮT BUỘC (gốc của mọi lần "đọc design mãi không ra")
1. **NHÌN ẢNH, đừng suy từ CSS.** Render design + render trang → **mở 2 ảnh lên xem bằng mắt** (Read screenshot). `structural_diff` mù layout tổng thể (chỉ so node/text) → không thay được việc nhìn.
2. **So đúng đối tượng: render CODE ĐANG SỬA, KHÔNG phải develop/bản deploy cũ.** Chạy app local (đã có node_modules; `next dev` http nếu cert lỗi), trỏ `NEXT_PUBLIC_DEAL_URL` sang develop để có data thật.
3. **Cùng viewport + cùng scale** khi so 2 ảnh (full-page khác chiều cao → thumbnail lệch scale, đánh lừa mắt). Đo bbox để chắc.
4. **Chỉ nói "giống design" sau khi đã nhìn pixel**, không nói dựa trên số đo đơn lẻ.

### Checklist lỗi cụ thể (mỗi cái đều từng làm khách blame — phải tick hết)
- [ ] **Tấm bọc:** design có bọc cả trang trong 1 "sheet" trắng căn giữa trên nền xám không? (đừng để thân trôi trần trên nền) — dùng wrapper dùng chung kiểu `OwnerSheet`.
- [ ] **State parity:** loading / error / not-found dùng **đúng wrapper** như loaded (topbar/sheet không nhảy giữa các state).
- [ ] **Token-diff trước khi dùng class:** so `:root` design ↔ `src/styles/global.css`. `--background` SDD = #f4f5f7 (xám) ≠ design #fff → **đừng tin `bg-background`, override `bg-card`**.
- [ ] **Số/tiền:** `万円` ≥1000 có dấu phẩy? Value từ API hay là **string** → ép `Number()` trước `toLocaleString('ja-JP')` (string nuốt locale → mất phẩy).
- [ ] **Typography:** heading đúng scale design (vd 18px, đừng để 22px); body/size khớp token design (design có scale RIÊNG, khác token SDD).
- [ ] **Header/căn lề:** header (vd `査定書`) thẳng hàng với content, không văng mép trái do container rộng hơn content.
- [ ] **Element thiếu:** node có ở design mà vắng ở code? (vd dòng `駅 徒歩◯分`). Nếu thiếu do **API không trả field** → đây là việc BE, ghi task rõ, đừng coi là xong.
- [ ] **Phân biệt dev-only:** chấm/overlay lạ có thể là **Next.js dev indicator** (chỉ ở dev) — verify bằng `next build && start` trước khi gọi là bug.
- [ ] **Data thật:** urlKey/link còn sống? (API 404 "Client not found" = data bị dọn, KHÔNG phải bug code).

**Gate done:** mọi finding **severity=error** của 3 lớp thô = 0 **VÀ** (nếu gate chạy được) mọi **bucket FAIL của gate đã triage** (fix hoặc xác nhận false-positive có lý do, KHÔNG để FAIL trôi vì gate advisory) **VÀ** đã nhìn 2 ảnh + pixel_heatmap thấy khớp. Gate exit 2 (BLOCKED) hoặc exit 1 → CHƯA done. Screen chưa đăng ký gate → done theo 3 lớp thô + eyeball, nhưng **FLAG rõ "gate overlay chưa phủ screen này"**. (Token-diff ở P3 chặn gốc; P6 chặn cái render đã lọt.)

### Meta-loop: học bug format/design mới → thêm 1 dòng vào rule.yaml (ĐÒN BẨY)

`scripts/jp_domain_rules.yaml` + `scripts/pinrich_design_rules.yaml` chính là **memory ở dạng máy chạy được**. Khi bắt được một lớp bug format-JP / vi-phạm-design MỚI (chưa rule nào cover):
1. Ghi memory như thường (đầu người).
2. **Đồng thời thêm 1 dòng rule** (`id`/`pattern`(`_forbid`)/`severity`/`message`/`example_*`) vào yaml tương ứng — không cần đổi code.
3. Một dòng yaml → tự có hiệu lực ở **cả 3 nơi cùng lúc**: P6 (đây), `design-gap-audit` (seed rổ 🐛), `qa-verify` (domain-oracle Phase 4).

Đây là cách "lesson một lần, máy bắt mọi nơi" — đừng để luật chỉ nằm trong đầu rồi lần sau lại soi tay. (vd `DESIGN-NUMFMT-001` = `pin-numbers-ja-jp`; `DESIGN-TYPE/EMOJI/CHEVRON/BRAND` = `claude-design-pinrich-ds`.)

**Output P6:** kết quả 3 lớp (findings = 0 error) + ảnh bằng chứng. KHÔNG báo "done" khi còn error.

---

## Ghi chú

- Sau khi port xong & học được điều mới về data/env → cập nhật memory `owner-page-test-links` (field gotchas, test data mới).
- Context repo/route: xem skill `pinrich` (3 repo, mapping legacy↔SDD).
