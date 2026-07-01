---
name: db
description: "Khám phá & query database Pinrich (RDS dev egent_data). Không argument = load context DB tổng quan. Có câu hỏi/yêu cầu = chạy query read-only và giải thích. Dùng khi user nói 'xem db', 'query db', 'cấu trúc bảng X', 'đếm/thống kê trong db', 'bảng nào liên quan tới Y'."
argument-hint: "[câu hỏi tự nhiên | tên bảng | 'schema <table>']"
allowed-tools: Read, Glob, Grep, Bash
---

Trợ lý DB cho dự án Pinrich. Trả lời bằng **tiếng Việt**.

**Đầu vào:** $ARGUMENTS

---

## 0. Chọn connection theo repo (LÀM TRƯỚC mọi query)

Pinrich = 3 repo, **2 DB instance khác nhau, cùng schema `egent_data`** (xem `~/.claude/projects/-home-grayf-Projects-estimate/memory/project_repos_layout.md`). Phải xác định đang ở repo nào trước khi query:

```bash
# Nhận diện repo theo cwd + package.json
basename "$PWD"; grep -m1 '"name"' package.json 2>/dev/null
```

| Repo / dấu hiệu | Target DB | Cách kết nối |
|---|---|---|
| **estimate** (package `estimate`) | **RDS dev** (chia sẻ, MySQL 8) | docker `mysql:8` → RDS endpoint, user `admin` |
| **estimate-sdd** (package `pinrich-api`) | **DB local container** `:43334` (dùng riêng, disposable) | qua container `db` đang chạy, user `estimate` |
| **estimate-client-sdd** (package `pinrich-account-management`) | Không có DB trực tiếp | Báo user: query phải làm ở repo `estimate-sdd`, hoặc gọi API `:8888` |

### A. Repo `estimate` → RDS dev
Đọc creds tươi từ `docker-compose.yaml` (block env `pinrich-server`), KHÔNG hardcode.
**⚠️ KHÔNG bao giờ echo/in `DB_PASSWORD` ra output/transcript** — nạp thẳng vào biến shell và dùng, không `echo "$PW"`, không grep cả block password ra màn hình:
```bash
# Nạp creds vào biến (KHÔNG in password). Có thể xem riêng HOST/USERNAME nếu cần:
grep -E "^\s*DB_(HOST|USERNAME):" docker-compose.yaml | grep -v '#'
RDS=$(grep -E "^\s*DB_HOST:" docker-compose.yaml | grep -v '#' | awk '{print $2}')
PW=$(grep -E "^\s*DB_PASSWORD:" docker-compose.yaml | grep -v '#' | awk '{print $2}')
DBQ() { docker run --rm mysql:8 mysql -h "$RDS" -u admin -p"$PW" egent_data -e "$1" 2>/dev/null; }
# Adminer (NẾU có chạy ở :8080 — không do compose repo nào định nghĩa, xem flag dưới):
#   http://localhost:8080 → System=MySQL, Server=$RDS, user=admin, DB=egent_data
```
> ⚠️ FLAG (chưa xác minh): KHÔNG repo nào (`estimate`, `estimate-sdd`, `estimate-client-sdd`) định nghĩa service `adminer` trong `docker-compose*.y*ml`. Nguồn Adminer :8080 không xác định được — có thể do user chạy tay ngoài compose. Dùng khi chắc nó đang chạy, đừng coi nó thuộc compose repo `estimate`.

### B. Repo `estimate-sdd` → DB local container (:43334)
DB chạy trong container `db` (service name compose = `pinrich-db`, container_name = `db`, image `pinrich/estimate-db:develop`), user/pass `estimate`/`estimate`. **Phải `docker compose up -d pinrich-db` trong estimate-sdd trước** (service name là `pinrich-db`, không phải `db`; kiểm tra `docker ps | grep 43334`; nếu chưa lên thì báo user start). Kết nối từ host:
```bash
DBQ() { docker run --rm --network host mysql:8 mysql -h 127.0.0.1 -P 43334 -u estimate -pestimate egent_data -e "$1" 2>/dev/null; }
# (PROCESS_DB ở :43333 — chỉ chạm khi user yêu cầu rõ)
# Schema Drizzle (nguồn sự thật v2): estimate-sdd/src/common/database/schema/schema.ts
```

---

## ⚠️ AN TOÀN — bắt buộc

- **CHỈ READ-ONLY**: `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN`, đọc `information_schema`.
- **RDS dev (repo estimate) = DB dùng chung** → TUYỆT ĐỐI KHÔNG `INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE` trừ khi user yêu cầu rõ + xác nhận lần 2. DB local `:43334` (sdd) disposable hơn nhưng vẫn hỏi trước khi ghi.
- Bảng GIS khổng lồ (`flood_vertexes` 268tr dòng, `touki_chiban` 186tr, `image_db` 82tr...) — **luôn có `LIMIT`**, đừng `SELECT *` hay `COUNT(*)` toàn bảng (dùng `table_rows` từ `information_schema` để ước lượng).

---

## 1. Hành vi theo input

- **Không có $ARGUMENTS** → in tóm tắt DB context (mục 2 + 3 bên dưới), KHÔNG query nặng. Hỏi user muốn đào nhóm nào.
- **Tên bảng** hoặc `schema <table>` → `DESCRIBE`/`information_schema.columns`, giải thích từng cột + cột `*_id` trỏ đi đâu (theo mục 3).
- **Câu hỏi tự nhiên** (vd "đếm follow_up theo status", "client nào nhiều deal nhất") → dịch sang SQL read-only, chạy, trình bày kết quả + SQL đã dùng.
- **"bảng nào liên quan tới X"** → tra danh sách bảng + mục domain map.

Luôn in lại câu SQL đã chạy để user kiểm chứng.

---

## 2. Tổng quan (258 bảng — 10 domain)

Sơ đồ đầy đủ (ERD Mermaid): đọc **`v2/docs/infra/db-schema.md`**. Kiến trúc AWS: `v2/docs/infra/aws-architecture.md`.

| Nhóm | Bảng chính |
|---|---|
| 🔐 Identity/RBAC | `users`, `roles`, `roles_users`, `authenticators`, `api_keys` |
| 👤 CRM | `clients`, `client_histories`, `client_meetings`, `client_locations` |
| 📞 Follow-up (追客) | `follow_ups`, `follow_up_histories`, `follow_up_owner_properties`, `follow_up_locations`, `owner_properties` |
| 📨 Lead/反響 | `hankyos`, `inquiries`, `url_share_user`, `url_share_user_property` |
| 🏠 Vật kiện (物件) | `sale_apartments`, `sale_houses`, `rent_apartments`, `rent_houses`, `contract_apartments`, `contract_houses`, `master_apartments`, `master_floorplans` |
| ⭐ Tương tác | `property_bookmarks`, `property_notes`, `property_station` |
| ✉️ Mail/Notif | `mail_histories`, `mail_templates`, `auto_mail`, `email_send_froms`, `line_messages`, `notification_*` |
| 🤖 AI | `ai_conversations`, `ai_messages`, `ai_employees`, `gpt_usage_logs`, `lc_checkpoint*` |
| ⚙️ Workflow | `workflows`, `workflow_tasks`, `flow_models`, `flow_nodes` |
| 🗺️ GIS/tham chiếu (~150 bảng, read-only) | `*_vertexes`, `touki_*`, `statistics_*`, `heatmap_*`, `bubble_*`, `master_stations/lines/addresses`, `schools` |

---

## 3. Quan hệ lõi & 4 GOTCHA (đọc kỹ trước khi join)

Quan hệ **KHÔNG enforce bằng FK** (chỉ 1 FK ở cấp DB) — đều là convention `*_id` tầng ORM.

Luồng nghiệp vụ:
```
USER(agent) ─→ CLIENTS ─→ FOLLOW_UPS(deal pipeline) ─→ vật kiện
            ─→ HANKYOS / URL_SHARE_USER ─→ FOLLOW_UPS
FOLLOW_UPS ─→ follow_up_histories / _owner_properties / _locations
           ─→ master_apartment_id → MASTER_APARTMENTS → SALE_APARTMENTS(master_id)
```
Key join: `clients.id`(uuid)=`follow_ups.client_id`, `follow_ups.inquiry_id`=`inquiries.id`, `url_share_user.hankyo_id`=`hankyos.id`, `sale_apartments.master_id`=`master_apartments.id`.

**4 GOTCHA:**
1. **Hai khái niệm user**: `users.id` là `bigint` (user RBAC/management). Nhưng `user_id` trong bảng nghiệp vụ (`clients`, `hankyos`...) là `varchar(100)` = **UUID Cognito của agent BĐS** → KHÔNG join `users.id` = `clients.user_id`.
2. **Polymorphic property**: `property_bookmarks`, `property_notes`, `owner_properties`, `follow_up_owner_properties`, `url_share_user_property` trỏ vật kiện qua cặp `(data_type, property_id)`. `data_type` quyết định bảng đích (`sale_apartments`/`sale_houses`/`rent_*`/`contract_*`).
3. **Bảng "ma"**: hậu tố `_old`, `_bk`, `_prod`, `_25_04` (snapshot tháng) là backup/staging — KHÔNG phải data live. Live: `master_apartments` (không `master_apartments_old/bk/prod`).
4. **Bảng GIS khổng lồ**: xem mục An toàn — luôn LIMIT.

**Rakucore sync**: cột `rakucore_client_id`, `rakucore_deal_id`, `rakucore_synced_at`, `sync_source` = đồng bộ 2 chiều với CRM ngoài "Rakucore".

---

## 4. Snippet hay dùng

```sql
-- Cấu trúc 1 bảng
SELECT column_name, column_type, column_key, column_comment
FROM information_schema.columns
WHERE table_schema='egent_data' AND table_name='<TABLE>' ORDER BY ordinal_position;

-- Tìm bảng theo tên
SELECT table_name, table_rows FROM information_schema.tables
WHERE table_schema='egent_data' AND table_name LIKE '%<KEYWORD>%';

-- Tìm bảng có cột tên giống nhau (truy quan hệ)
SELECT table_name FROM information_schema.columns
WHERE table_schema='egent_data' AND column_name='<COL>';
```
