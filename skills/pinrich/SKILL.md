---
name: pinrich
description: "Pinrich codebase + business context. Không argument = load context. Có keyword = tìm kiếm. 'update' = cập nhật memory."
argument-hint: "[keyword | update | để trống]"
allowed-tools: Read, Glob, Grep, Bash, Agent, Write
---

Trả lời bằng tiếng Việt.

# Mục đích

Skill giúp developer nhanh chóng hiểu **codebase + business** của Pinrich. 3 chế độ:

- `/pinrich-suite:pinrich` — Load full context từ memory files
- `/pinrich-suite:pinrich <keyword>` — Tìm kiếm business + code theo keyword
- `/pinrich-suite:pinrich update` — Scan codebase và cập nhật memory files

---

# ⚠️ Pinrich = 4 repo (đọc kỹ trước khi search)

Pinrich gồm **trio estimate (3 repo migration Strangler Fig legacy→SDD)** + **1 repo độc lập `pinrich-satei`**, tất cả trong `~/Projects/` (org `eqon-inc`). Xem `project_repos_layout.md` + `project_sdd_architecture.md` + `project_satei_map.md`.

| Repo | Là gì | Stack | Khi nào search ở đây |
|------|-------|-------|----------------------|
| **estimate** | LEGACY, đang chạy prod | Vue 3 + Express monorepo (`src/`, `server/`, `lambda/`, `management/`, `v2/`, `share/`) | Mặc định cho hầu hết business/feature cũ; mọi keyword trong bảng mục §Chế độ 2 |
| **estimate-sdd** = `pinrich-api` | Backend MỚI (SDD) | NestJS 11 + Drizzle ORM, `api/v2` @ :8888, `src/modules/` | Keyword về: nestjs, drizzle, module, follow_ups, clients (mới), billing/NP, touhon/謄本, ses-event, user-management mới, CQRS/onion, api/v2 |
| **estimate-client-sdd** = `pinrich-account-management` | Frontend MỚI (SDD) | Next.js 16 + React 19, `src/app/` (app router) | Keyword về: next.js, react, /accounts, /users (mới), /deed, openapi SDK, FE mới |
| **pinrich-satei** = `nestjs-ssr` | App định giá BĐS (査定), ĐỘC LẬP (không thuộc trio) | NestJS SSR + Vue 3 + Vite + TypeORM, :3000, `server/` + `client/` | Keyword về: satei/査定, tìm kiếm BĐS, bb-search/bb-result, apartment/house/land search, heatmap/bubble chart, REINS download, draft định giá, PN-774 |

**Routing khi search:** xác định context trước.
- Nói tới NestJS/Drizzle/module/follow_ups/billing/touhon/api v2 → đọc `project_sdd_architecture.md` rồi search trong `estimate-sdd/src/modules/`, `estimate-sdd/docs/specs/`.
- Nói tới Next.js/React/route mới (/accounts,/users,/deed)/openapi → search `estimate-client-sdd/src/{app,views,lib}`.
- Nói tới **satei / tìm kiếm-định giá BĐS / bb-search / heatmap / REINS / PN-774** → đọc `project_satei_map.md` rồi search `pinrich-satei/{server,client}`. ⚠️ satei DB + stack riêng, KHÔNG dùng OpenAPI SDK, KHÔNG phải bước SDD — đừng gộp với trio. Lưu ý "satei" cũng là term legacy trong estimate; nếu hỏi về tính năng định giá *bên trong CRM estimate* thì là repo `estimate`, còn app định giá độc lập là `pinrich-satei`.
- Nói tới **trang search / tìm kiếm BĐS / property search / 物件検索 / filter giá-diện tích-築年-媒介 / kết quả-map-detail** → có 2 hệ search BĐS RIÊNG (DB tách rời, cùng schema scraped): legacy `estimate` đọc `project_estimate_search.md` (form MultiSearch → `/properties/multi_search`); search mới `pinrich-satei` (BB/PN-774) đọc `project_satei_search_redesign.md` (`/api/search`). Xác định repo trước khi search code. ⚠️ "satei" bên trong estimate = AI査定 nội bộ (url_share_user), KHÁC app pinrich-satei. **satei = "STOCK" service** (estimate-sdd/legacy gọi `/api/search/*` qua `STOCK_URL`/`VITE_STOCK_URL`); estimate-sdd KHÔNG có module property search.
- Nói tới **port trang search sang FE SDD / client-sdd search** → đọc `project_search_port_sdd.md` (task port estimate→client-sdd, backend đích = satei `/api/search`, quyết định kiến trúc, khác biệt khi port). Dùng skill `/pinrich-suite:sdd-port-page`.
- Còn lại (business cũ, Vue, Express, share/) → repo `estimate` như cũ.
- **Nếu không rõ context** → nói rõ feature đó tồn tại ở repo nào (legacy vs SDD vs satei) và hỏi/đưa cả hai, kèm trạng thái migrate (theo bảng mapping trong `project_sdd_architecture.md`).

### ⚠️ Tầng routing THẬT (deploy) — khác tầng code

Routing ở code (file/route nào) KHÁC routing khi deploy. URL nào ra Vue/React/api-v2 do **CloudFront → ALB target group** quyết định. Khi câu hỏi là **"URL này ra app nào / sao prod khác local / sao cùng path lúc Vue lúc React / sao deploy rồi vẫn trang cũ"** → đọc `project_infra_routing.md` và **query AWS thật để kiểm chứng** (default profile đọc CloudFront/ELBv2 OK), ĐỪNG suy đoán cookie/canary/service-worker. Recipe nhanh: `curl -sI '<url>' | grep -i x-powered-by` → `Express`=Vue legacy, `Next.js`=React SDD. Bug cache stale Vue/React: xem `project_strangler_cache_gotcha.md`.

## Keyword → repo + memory (SDD)

| Keyword | Repo | Đọc memory + nơi search |
|---------|------|--------------------------|
| billing, NP, postpay, credit, invoice, suspend | estimate-sdd | server-map §billing → `src/modules/billing` |
| client mới, follow_up, follow-up, 追客, pipeline, auto-sequence | estimate-sdd | server-map §client/§follow-up → `src/modules/{client,follow-up}` |
| meeting, lịch hẹn, memo | estimate-sdd | `src/modules/meeting` |
| touhon, 謄本, 公図, chiban, 地番, kaoku, deed, touki, RPA đăng ký | estimate-sdd + client-sdd | server-map §touhon → `src/modules/touhon`; FE `views/touhon` |
| user mới, staff CRUD, settings, mail-template, Google Calendar, Cognito mới | estimate-sdd + client-sdd | server-map §user → `src/modules/user`; FE `views/{accounts,users}` |
| line mới (NestJS) | estimate-sdd | `src/modules/line` |
| schema, drizzle, bảng mới, clients/follow_ups DDL | estimate-sdd | server-map §DB → `src/common/database/schema/schema.ts` |
| auth mới, JWT, guard, @Roles, @RequireAnyService | estimate-sdd | server-map §auth → `src/common/auth` |
| next.js, react 19, jotai, route /accounts /users /deed/np | client-sdd | frontend-map → `src/{app,views,stores,hooks}` |
| openapi sdk, hey-api, generate-client, NEXT_PUBLIC_API_URL | client-sdd | frontend-map §API client → `src/lib` |
| feature flag, deedEnabled/bbEnabled/imgEnabled, subdomain white-label mới | client-sdd | frontend-map → `src/constants`, `(subdomain)` |
| onion, CQRS, ADR, phase migration, strangler (SDD), steering, spec, inception | estimate-sdd | architecture → `docs/{steering,adr,strategy,specs}` |
| db redesign, url_share_user→clients, rebuild-flows, cohort | estimate-sdd | architecture §DB redesign → `docs/specs/crm/{db-redesign,rebuild-flows}` |
| satei, 査定, bb-search, bb-result, PN-774, REINS, heatmap, draft định giá, property search độc lập | pinrich-satei | `project_satei_map.md` → `pinrich-satei/{server,client}` |
| filter giá/diện tích/築年/媒介, 値下げ率, 坪単価, BigQuery vector, 9 cột BbResult | pinrich-satei | `project_satei_search_redesign.md` → `pinrich-satei/{server,client}` |
| sale/rent/contract_apartments, master_apartments, master_id, 物件 data scraped, unit_amount, 総戸数, quan hệ bảng BĐS, FK property | estimate + pinrich-satei | `project_property_stock_data_model.md` → data model cụm bảng BĐS (hub master + listing), nghĩa+quirk unit_amount |
| login redesign, reset/create/forgot password, confirmCode, confirmToken, mail link reset, lambda forgot_password | cross-repo (client-sdd + legacy + satei) | `project_login_password_redesign.md` → reset gọi API legacy; FE mới `/reset-password` `/create-password`; Lambda migrate sang `estimate-sdd/lambdas` |
| chạy FE mới local, client-sdd dev, owner page mới, hybrid owner, NEXT_PUBLIC_DEAL_URL, sub.localhost CORS | client-sdd (+ data legacy) | `project_new_fe_owner_and_local_run.md` → recipe FE mới + backend legacy, owner hybrid |
| owner Vue React, /deal/owner ra app nào, mail owner ra Vue, router.push owner, ALB owner rule | estimate + client-sdd + deploy | `project_owner_page_vue_react_collision.md` (+ `project_infra_routing.md`) → ĐÃ FIX, full-page nav, ALB rộng hơn build |
| crm migration, client_crm_migration_requests, chuyển CRM, migration-requests, registration-requests/eligibility | estimate-sdd | server-map §client → `src/modules/client` (`submit-migration-request`, `crm-migration-request.repository.ts`) |
| inquiry, inquiries, inquiry_id (thay hankyo_id) | estimate-sdd | `src/modules/{follow-up,client}` — migration 0017/0018 |
| is_test_account, ng_reason, deferred_reason, mail attachments/deal_types template | estimate-sdd | billing (`billing_users`) / user (`mail_templates`, migration 0006-0021) |
| owner, 簡易査定, appraisal, useOwner*, owner property | client-sdd | `src/views/owner/` + `src/app/deal/(subdomain)/owner/` (product đầy đủ, không phải test) — memory `deal-owner-served-by-sdd` |
| files upload, apartment-file, house-file, S3 tmp, AWS_S3_BUCKET_TMP | pinrich-satei | `server/files/file.controller.ts` (module mới, chưa trong satei_map) |
| bulk select, chọn nhiều dòng, bulk download, BbBulkActionBar | pinrich-satei | `client/components/Search/BbResult/BbBulkActionBar.vue` + `result.vue` — ⚠️ scaffold, chưa wire BE bulk endpoint |

> Cảnh báo cụ thể khi đụng code 2 repo SDD: xem §**Cảnh báo khi code 2 repo SDD** ở cuối skill.

---

# Memory Files

Skill này dựa trên memory files tại `~/.claude/projects/-home-grayf-Projects-estimate/memory/`. Luôn đọc từ memory trước, chỉ search codebase khi memory không đủ.

| File | Repo | Nội dung |
|------|------|----------|
| `project_repos_layout.md` | tất cả | **Đọc đầu tiên** — overview 4 repo (trio estimate + satei), remote, branch |
| `project_satei_map.md` | pinrich-satei | **Repo thứ 4 độc lập** — app search+định giá BĐS (査定): server modules (search/apartments/houses/charts/draft/download/slack), client Vue, DB riêng, Cognito+S3+REINS, spec PN-774 |
| `project_property_stock_data_model.md` | estimate + pinrich-satei (data BĐS) | **Data model cụm bảng BĐS scraped** — `master_apartments` hub tòa nhà ← `{sale,rent,contract}_apartments` qua `master_id` (1→N, KHÔNG FK cứng); vai trò+số dòng từng bảng; `unit_amount`=総戸数 (DISPLAY-only, không vào công thức giá) + quirk kiểu (master/rent int, sale varchar có `''`/`'-'` rác → đổi int an toàn, cleanup trước ALTER); cross-DB + BQ mirror caveat |
| `project_estimate_search.md` | estimate | **Property search legacy** (đang rebuild) — form MultiSearch, List(Pinia/multi_search)+Map(Vuex/Google Maps), backend Bookshelf/Knex PropertyFilterCondition (CTE+default-sentinel), 6 bảng no-FK, charts dead |
| `project_satei_search_redesign.md` | pinrich-satei | **Search + BB redesign PN-774** (đang rebuild) — DTO/enum/SQL từng filter, BigQuery vector, 9 bộ cột BbResult, công thức 坪単価/値下げ率, conflict cần chốt, gotchas |
| `project_search_port_sdd.md` | tất cả | **Task port search legacy→client-sdd** — backend đích = satei `/api/search` ("STOCK" service), estimate-sdd không có module search, quyết định kiến trúc + khác biệt legacy→SDD |
| `project_sdd_architecture.md` | estimate-sdd + client-sdd | Principles/ADRs, phase migration, SDD protocol, DB redesign, glossary mới, mapping legacy→mới |
| `project_sdd_server_map.md` | estimate-sdd | **Backend mới** — 10 modules NestJS + endpoints, schema ~252 bảng, auth Cognito+JWT, infra, lambdas, env |
| `project_sdd_frontend_map.md` | estimate-client-sdd | **Frontend mới** — routes/3 product, Jotai stores, hooks, OpenAPI SDK, feature flags (caveat: doc steering lệch code) |
| `project_business_code_map.md` | estimate | **Quan trọng nhất cho legacy** — 16 features map business → code xuyên suốt layers |
| `project_server_map.md` | estimate | 37 controllers, 26 services, 70+ models, 9 queues |
| `project_frontend_map.md` | estimate | Routes, views, components, SP/PC + Pinrich/Baitori split |
| `project_domain_model.md` | estimate | Entities, relationships, enums, constants |
| `project_management_lambda_v2.md` | estimate | Management app, 5 Lambda, v2 Strangler Fig strategy |
| `project_local_setup_gotchas.md` | estimate | Docker local dev: 8 lỗi thường gặp |
| `project_infra_routing.md` | tất cả (deploy) | **Routing thật**: CloudFront→ALB→target group (URL ra Vue/React/api-v2), AWS query được, recipe chẩn đoán "URL nào ai serve" |
| `project_strangler_cache_gotcha.md` | estimate + deploy | Bug "lần đầu Vue, F5 React" = legacy thiếu Cache-Control; fix no-store ở app.ts |
| `project_mail_system.md` | estimate (+ SDD follow-up) | **Hệ mail legacy** — 3 queue BullMQ (client/hankyo/sesEvent) + SES v2, warm-up 1-16, trần 4999/ngày; ⚠️ **3 cơ chế gửi mail RIÊNG** (BullMQ render JS, EJS template, Cognito CustomMessage S3-HTML); reset-pass mail = cơ chế 3, KHÔNG phải EJS. Chi tiết: `estimate/docs/mail-system.md` |
| `project_login_password_redesign.md` | cross-repo (client-sdd/satei done, legacy/baitori deferred) | **Login + reset/create password redesign** — reset gọi API LEGACY (`/auth/forgot_password`…), token `confirmCode` (Cognito, chỉ qua mail) vs `confirmToken` (AES, sinh local được); migrate Lambda forgot_password → `estimate-sdd/lambdas`; bẫy code-merged≠deployed + email-HTML phải table-based |
| `project_owner_page_access.md` | estimate (legacy) | **Owner page LEGACY** (AI査定 cho chủ nhà) — public qua subdomain custom + `?urlKey` (`deal_type=sell`), KHÔNG login đại lý; guard `isCustomDomain()`; chi tiết `estimate/docs/owner-page.md`, `owner-property-flow.md`. ⚠️ "owner" ở SDD KHÁC nghĩa |
| `project_new_fe_owner_and_local_run.md` | estimate-client-sdd (+ data legacy) | **Chạy FE mới local + owner page mới (HYBRID)** — site-settings v2 + data legacy `/deal/api/properties/owner`; 2 fix persistent cắt phụ thuộc develop; CORS chỉ `*.localhost:3000` (phải mở `sub.localhost:3000`); recipe deep-link owner property |
| `project_owner_page_vue_react_collision.md` | estimate + client-sdd + deploy | **Owner Vue→React migration** (ĐÃ FIX 2026-06-17, ALB `/deal/owner`→React) — bẫy `router.push` client-side bỏ qua ALB ra Vue cũ → mọi nav Vue→route React phải full-page nav; ALB rule rộng hơn trang React build → print/resistock 404 |
| `project_db_rds_access.md` | tất cả (DB dev) | **Truy cập DB** — KHÔNG có MySQL local, app trỏ thẳng RDS dev `egent_data` (MySQL 8); cred trong docker-compose; query qua docker/Adminer; 4 bẫy (`users.id` vs `user_id` UUID, property polymorphic, bảng `_bk/_old`, GIS khổng lồ). Schema: `v2/docs/infra/db-schema.md` |
| `local-dev-setup-gotchas.md` | estimate | **Vite HMR fix** — `ERR_CONNECTION_RESET` trên native Linux docker (hmr bind 127.0.0.1:2000 trong container); fix `server.hmr={clientPort:3000}` + `git update-index --skip-worktree`. App vẫn chạy, chỉ mất hot-reload. (bổ sung cho `project_local_setup_gotchas.md`) |
| `feedback_maintain_v2_page_map.md` | client-sdd (ràng buộc) | **Post-step bắt buộc** — port/build/đổi route client-sdd PHẢI tự cập nhật `estimate/docs/local-ui-switch.md` (Page map V1↔V2) + memory `project_new_fe_owner_and_local_run`; URL: trang port=path V1, feature mới=URL mới. Xem Chế độ 3 |

---

# Chế độ 1: Full Context (khi `$ARGUMENTS` rỗng)

Đọc memory files và hiển thị tổng quan có cấu trúc:

1. Đọc `project_repos_layout.md` + `project_sdd_architecture.md` + `project_satei_map.md` — hiển thị **4 repo** (estimate legacy / estimate-sdd / estimate-client-sdd / pinrich-satei — app 査定/search BĐS độc lập) + trạng thái migrate Strangler Fig (Phase 0→3)
2. Đọc `project_business_code_map.md` — hiển thị bảng 16 features với code tương ứng (legacy)
3. Đọc `project_sdd_server_map.md` + `project_sdd_frontend_map.md` — hiển thị tóm tắt SDD: 10 module backend + 3 product FE (/accounts, /users, /deed)
4. Đọc `project_domain_model.md` — hiển thị entity relationships + key enums
5. Hiển thị thêm context quan trọng (gồm cả glossary term mới: touhon/謄本, chiban/地番, NP, deal_phase — xem `project_sdd_architecture.md`):

### Cảnh báo cho dev mới

- **SP/PC split**: Frontend có 2 variant cho mobile (SP) và desktop (PC) — dùng `conditionalComponent()`. Sửa 1 chỗ phải check variant kia.
- **Pinrich/Baitori brands**: 2 brand render view khác nhau — check `isBaitoriDomain()`. Cả frontend lẫn management đều có split này.
- **share/ coupling**: Code trong `share/` dùng chung FE + BE. Sửa entity → test cả hai phía.
- **SUB_DIRECTORY = "deal"**: Tất cả routes đều dưới `/deal/`. URL đúng: `pinrich.local:3000/deal`.
- **url_share_user = Client (CHỈ legacy)**: Trong repo `estimate` legacy, bảng Client chính tên `url_share_user`. ⚠️ Hệ SDD mới (`pinrich-api`) ĐÃ tách thành `clients` + `follow_ups` — đừng nhầm 2 hệ (xem `project_sdd_server_map.md`).

### Thuật ngữ quan trọng

| Term | Kanji | Nghĩa |
|------|-------|-------|
| Hankyo | 反響 | Lead từ portal BĐS |
| Satei | 査定 | Định giá BĐS (AI hoặc tại chỗ) |
| Tsuikyaku | 追客 | Theo đuổi khách — workflow chính |
| Baitori | 買取 | Mua lại BĐS trực tiếp |
| Baitai | 媒体 | Kênh/portal quảng cáo |
| Chintai | 賃貸 | Thuê nhà |
| Baikai Keiyaku | 媒介契約 | Hợp đồng môi giới |
| Jyusetu | 重説 | Giải thích quan trọng trước ký HĐ |
| Mato | 間取り | Layout căn hộ (1LDK, 2LDK...) |
| Owner Change | オーナーチェンジ | BĐS bán kèm người thuê |
| Souzoku | 相続 | Thừa kế — lý do bán BĐS |
| Rikon | 離婚 | Ly hôn — lý do bán BĐS |
| Houmon Satei | 訪問査定 | Định giá tại chỗ (nhân viên đến tận nơi) |

### Tích hợp bên ngoài

| Service | Mục đích |
|---------|----------|
| PriceHubble | API định giá AI — core của AI査定 |
| AWS SES | Gửi email marketing hàng ngày (max 4999/ngày) |
| AWS Cognito | Authentication đại lý |
| Google Maps | Bản đồ BĐS, geocoding, polygon (trường học, lũ lụt) |
| LINE | Chat 2 chiều với khách |
| Salesforce | Đồng bộ CRM (OAuth2) |
| Rakucore | CRM BĐS Nhật — đồng bộ khách hàng (webhook) |
| OpenAI | GPT soạn email cá nhân hóa |
| Slack | Thông báo nội bộ |
| Stripe | Billing (deprecated, không dùng nữa) |

---

# Chế độ 2: Keyword Search (khi `$ARGUMENTS` có giá trị, không phải "update")

## Bước 0: Xác định repo (BẮT BUỘC làm trước)

Đối chiếu keyword với bảng **"Keyword → repo + memory (SDD)"** ở đầu skill (§Pinrich = 4 repo).
- Match dòng SDD → đọc memory SDD tương ứng (`project_sdd_server_map.md` / `project_sdd_frontend_map.md` / `project_sdd_architecture.md`) và search trong repo `-sdd`. **Bỏ qua** bảng legacy bên dưới.
- Không match SDD → đây là feature legacy, đi tiếp Bước 1.
- Mơ hồ (feature có ở cả 2 hệ, vd auth, client, subdomain, line) → trả lời cả hai, ghi rõ legacy vs SDD + trạng thái migrate.

## Bước 1: Check memory legacy

Đọc `project_business_code_map.md` và tìm section match keyword. Nếu tìm thấy → hiển thị ngay từ memory, không cần search codebase.

Keyword mapping (legacy):

| Keyword pattern | Section trong business_code_map |
|----------------|-------------------------------|
| hankyo, 反響, lead, portal | 1. Hankyo Auto |
| mail, email, delivery | 2. Property Mail |
| satei, 査定, định giá, ai | 3. AI Satei |
| client, khách, customer | 4. Client Management |
| property, BĐS, search, map, tìm kiếm | 5. Property Search |
| owner, bán nhà | 6. Owner Page |
| line, chat | 7. LINE Integration |
| workflow, giao dịch, deal | 8. Workflow |
| consultation, tư vấn, xem nhà | 9. Consultation |
| loan, vay, thế chấp | 10. Loan Calculator |
| sell form, đăng ký bán | 11. Sell Form |
| rakucore, sync | 12. Rakucore Sync |
| lp, landing | 13. Landing Pages |
| auth, login, cognito | 14. Auth |
| salesforce, sf | 15. Salesforce |
| site settings, subdomain, white-label | 16. Site Settings |
| management, dashboard, đại lý | Management app (trong management_lambda_v2.md) |
| lambda | Lambda functions (trong management_lambda_v2.md) |
| v2, migration, strangler | v2 architecture (trong management_lambda_v2.md) |
| setup, docker, local | Local setup (trong local_setup_gotchas.md) |
| infra, routing, alb, cloudfront, target group, deploy, url ra app nào, prod khác local, cùng path lúc vue lúc react, stale cache | Infra routing (trong infra_routing.md) + cache (strangler_cache_gotcha.md) — query AWS kiểm chứng |
| mail, email, delivery, SES, warm-up, queue, hankyo inbound, bounce, complaint, 3 cơ chế mail, template mail | 2. Property Mail + `project_mail_system.md` (estimate/docs/mail-system.md) — ⚠️ 3 cơ chế gửi mail RIÊNG |
| reset password, create password, forgot password, login redesign, confirmCode, confirmToken | `project_login_password_redesign.md` (cross-repo) — reset gọi API legacy; token Cognito vs AES |
| owner, bán nhà, urlKey, subdomain owner, AI査定 chủ nhà, mở owner local | 6. Owner Page + `project_owner_page_access.md` (legacy public subdomain+urlKey) |
| owner Vue/React, /deal/owner ra app gì, owner mail ra Vue cũ, router.push owner | `project_owner_page_vue_react_collision.md` (migration ĐÃ FIX, full-page nav) + `project_new_fe_owner_and_local_run.md` (owner hybrid local) |
| db, database, RDS, egent_data, kết nối db, query db, không có mysql local, adminer, schema bảng | `project_db_rds_access.md` — RDS dev, query qua docker, 4 bẫy; schema `v2/docs/infra/db-schema.md` |
| apartments, master_apartments, sale/rent/contract_apartments, master_id, unit_amount, 総戸数, quan hệ bảng BĐS, data scraped, 物件 schema | `project_property_stock_data_model.md` — hub master tòa nhà + listing qua master_id (no FK); unit_amount=総戸数 display-only + quirk kiểu (sale varchar/''/'-', đổi int an toàn) |
| HMR, ERR_CONNECTION_RESET, vite hmr, port 2000, hot reload không chạy | `local-dev-setup-gotchas.md` — fix `server.hmr={clientPort:3000}` |
| rakucore, sync, syncSource, rakucore_synced_at | Clients controller + services + migrations `rakucore_*` — ⚠️ KHÔNG có `controllers/Rakucore/` riêng (chống tìm nhầm) |
| stripe, billing legacy, subscription, invoice, customer | `entities/Stripe/*`, `models/Stripe.ts`, `Webhooks/stripe.ts`, `Users/customer.ts` — ⚠️ phần lớn commented, WIP/chưa enable |
| appraisal columns, 査定 columns, 再査定 (legacy) | migration `20260407 appraisal_columns` trên `url_share_user` + Owner page (#6) |
| gpt usage, ai log | `entities/GptUsageLog.ts` (bổ trợ #3 AI Satei) |
| assign company, external api example, externalAuth demo | `controllers/AssignCompany/` — ⚠️ scaffold/demo, KHÔNG phải feature thật |

## Bước 2: Nếu memory không đủ → search codebase

Dùng Grep/Glob trực tiếp (không spawn Agent trừ khi cần search sâu). Search trong repo đã xác định ở Bước 0:

**Legacy (`~/Projects/estimate/`):**
1. `share/entities/`, `server/src/app/controllers/`, `server/src/app/services/`
2. `src/views/`, `src/components/`, `management/src/`
3. `server/src/mq/`, `server/src/app/routes.js`

**SDD backend (`~/Projects/estimate-sdd/`):**
1. `src/modules/<module>/{controllers,application,domain,infrastructure}/`
2. `src/common/{auth,database/schema}/`, `docs/specs/`

**SDD frontend (`~/Projects/estimate-client-sdd/`):**
1. `src/app/` (routes), `src/views/`, `src/hooks/`, `src/stores/atoms/`, `src/lib/`

## Bước 3: Output format (3 phần theo thứ tự)

```markdown
## Pinrich Context: [keyword]

### 1. Business
- Tổng quan feature — giải thích mục tiêu business cuối cùng, không chỉ mô tả feature
- Luồng hoạt động — diagram từ trigger → kết quả cuối

### 2. Các trang liên quan
- Bảng: URL, tên trang, mô tả chức năng
- Mô tả UI layout: phần nào ở trên/dưới, user thấy gì khi vào trang
- Liên kết với features khác (feature nào gọi sang feature nào)

### 3. Code chi tiết

#### 3a. Component hierarchy
- Cây parent → child: view chứa component nào, component chứa component con nào
- Giúp dev biết sửa 1 chỗ ảnh hưởng đến đâu

#### 3b. Data flow + API endpoints  
- Component nào gọi API nào (endpoint cụ thể: GET/POST + path)
- Data lấy từ đâu, transform qua composable/store nào, rồi render ở component nào

#### 3c. Code xuyên layers — chọn bảng theo repo

**Legacy (estimate):** View / Component / Composable / Router / Entity (`share/`) / Model / Controller / Queue

**SDD backend (estimate-sdd):** Controller (DTO) / Handler (command·query) / Domain (entity·repo interface) / Infrastructure (repo impl·port·worker) / Schema (Drizzle table)

**SDD frontend (estimate-client-sdd):** Route (`app/`) / View / Hook (TanStack) / Store (Jotai atom) / SDK service (`lib/api`) / Endpoint `api/v2/...` gọi sang

| Layer | File | Vai trò |
|-------|------|---------|
| ... | ... | ... |

#### 3d. Cảnh báo khi code
- **Legacy:** SP/PC variant? Pinrich/Baitori variant? share/ coupling (sửa entity ảnh hưởng FE+BE)? urlKey/propertyId để test?
- **SDD:** đặt đúng layer Onion/CQRS? Đổi DTO BE → regen SDK FE? Bảng đụng là bảng mới hay legacy introspect? Guard `@Public/@Roles/@RequireAnyService`?
- Edge cases + data dependencies cần để test
```

---

# Chế độ 3: Update (khi `$ARGUMENTS` = "update")

Scan codebase **cả 4 repo** để cập nhật memory files:

### Legacy (`estimate/`)
1. **Check migrations mới**: `ls server/src/migrations/ | tail -10` → so sánh với domain_model.md → cập nhật entities/enums nếu có thay đổi
2. **Check controllers mới**: `ls server/src/app/controllers/` → so sánh với server_map.md → thêm controller mới
3. **Check views mới**: `ls src/views/` → so sánh với frontend_map.md → thêm view mới
4. **Check entities mới**: `ls share/entities/` → so sánh với domain_model.md → thêm entity mới
5. **Cập nhật business_code_map.md** nếu phát hiện feature mới

### SDD backend → cập nhật `project_sdd_server_map.md`
6. **Modules**: `ls ~/Projects/estimate-sdd/src/modules/` → thêm module/endpoint mới
7. **DB schema**: `ls ~/Projects/estimate-sdd/src/common/database/schema/` + grep bảng mới trong `schema.ts` → cập nhật danh sách bảng CRM/billing mới

### SDD frontend → cập nhật `project_sdd_frontend_map.md`
8. **Routes**: `find ~/Projects/estimate-client-sdd/src/app -name page.tsx` → thêm route/product mới
9. **Stores/hooks**: `ls ~/Projects/estimate-client-sdd/src/{stores/atoms,hooks}` → thêm atom/hook mới

### SDD steering → cập nhật `project_sdd_architecture.md`
10. **Specs/ADR/strategy**: `ls -R ~/Projects/estimate-sdd/docs/{specs,adr,strategy}/` → thêm spec/ADR mới + trạng thái (spec only / đã code), cập nhật phase migration & DB redesign nếu đổi

### pinrich-satei → cập nhật `project_satei_map.md` + `project_satei_search_redesign.md`
11. **Modules backend**: `ls ~/Projects/pinrich-satei/server/` (modules NestJS: search/apartments/houses/charts/draft/download/slack) → thêm module/endpoint mới
12. **Routes client**: `ls ~/Projects/pinrich-satei/client/` (routes Vue, bb-search/bb-result) → thêm route/màn mới; cập nhật `project_satei_search_redesign.md` nếu đổi filter/DTO/cột BbResult (PN-774)

### ⚠️ Post-step BẮT BUỘC khi port/build/đổi route ở client-sdd (v2)
Theo `feedback_maintain_v2_page_map.md` — mỗi khi `/pinrich-suite:sdd-port-page`, `/pinrich-suite:design-screen`, apply-design-handoff hoặc sửa route tay ở **estimate-client-sdd**, tự cập nhật (không chờ user nhắc):
- `estimate/docs/local-ui-switch.md` — section **Page map V1↔V2** (tên feature + URL V1 + URL V2 + ghi chú auth/host/param/stub)
- memory `project_new_fe_owner_and_local_run.md`
Nguyên tắc URL: trang **port thay legacy → path V2 = path V1** (chỉ khác host/port khi dev); **feature mới → URL mới**; trang chưa wire data → đánh dấu **stub**. `local-ui-switch.md` là doc untracked → `git pull` có thể revert fix tracked (vd dev-bypass `layout.tsx`), phải áp lại.

Sau khi update, báo cáo ngắn gọn: thay đổi gì, file nào đã cập nhật.

---

# Cảnh báo khi code 2 repo SDD

- **DB egent_data dùng chung**: `pinrich-api` introspect TOÀN BỘ DB legacy (~252 bảng trong `schema.ts`) — nhưng chỉ bảng CRM mới (`clients`, `follow_ups`, `follow_up_*`, `client_meetings`, `inquiries`, `billing_*`) là do module mới ghi. Đừng tưởng mọi bảng trong schema.ts đều thuộc hệ mới.
- **Clean break, không backfill**: legacy (`url_share_user`) và mới (`clients`+`follow_ups`) chạy song song; key đổi `url_key` → `follow_up_id` (UUID v7). Sửa flow mail/LINE/hankyo phải đổi key tương ứng (xem rebuild-flows).
- **Onion + CQRS**: thêm endpoint phải đặt đúng layer (domain→application→infrastructure→controllers); query nặng đi CQRS read-side, không nhồi vào domain.
- **No Shared Kernel**: 2 repo `-sdd` chỉ giao tiếp qua OpenAPI. Đổi DTO ở `pinrich-api` → regen SDK ở client (`npm run generate-client`).
- **Doc steering lệch code FE**: `frontend-principles.md` ghi Vite/React Router/orval, nhưng client thật là Next.js/hey-api/Jotai. Tin code, không tin doc đó.
- **Auth**: BE issue JWT riêng (không phải Cognito ID token); `AuthGuard` bảo vệ mặc định, public phải `@Public()`. FE lưu token localStorage, 401→redirect `/{segment}/login`.

---

# ⚠️ Map drift đã biết (kiểm 2026-06-22)

Memory map sinh ở session cũ; những điểm sau đã LỆCH so với repo thật — tin mục này trước memory file tương ứng, và sửa map khi `/pinrich-suite:pinrich update`.

**estimate (legacy):**
- `controllers/Rakucore/` **KHÔNG tồn tại** — `business_code_map` #12 ghi sai. Logic Rakucore rải ở `controllers/Clients` + services + migrations `rakucore_*` (mới nhất `20260610 rakucore_synced_at`).
- **Stripe billing** (`entities/Stripe/*`, `models/Stripe.ts`, `Webhooks/stripe.ts`, `Users/customer.ts`) thiếu trong domain_model; phần lớn **commented/WIP, chưa enable**.
- `controllers/AssignCompany/` = **scaffold demo externalAuth**, không phải feature. `controllers/NotifycationInfo/` mới (sai chính tả, chỉ có base.js).
- Entity mới chưa trong domain_model: `GptUsageLog`, `PropertyCountSummaryInfo`, `AddressConvertRule`. View mới: `SpAuthView.vue` (live), `SpFullView.vue`; `CorporateUsersView.vue` nghi dead.
- Migration `20260407 add_appraisal_columns_to_url_share_user` (Owner tự định giá) + `20260408 exclusive_area→decimal` — domain_model chưa ghi.

**estimate-sdd (backend):** 10 module khớp 100%. Drift ở schema —
- Có bộ migration Drizzle `0000..0021` (map chỉ nhắc `0001..0005` SQL thủ công). Bảng mới: `client_crm_migration_requests` (route `POST /clients/migration-requests`), `inquiries` (đã tạo, `follow_ups.hankyo_id`→`inquiry_id`). Cột mới: `billing_users.{ng_reason,deferred_reason,is_test_account,latest_unpaid_invoice_log_id}`, `mail_templates.{deal_types,attachments}`, `clients.registered_at`.
- Docs dir mới chưa nêu: `docs/{database,investigation,proposals,design,meeting-notes}`. Spec `online-appraisal` đã tách thành `online-appraisal-document.md` + `requirements/online-appraisal-book.md`.

**estimate-client-sdd (frontend):**
- Atom đổi tên: `siteSettingsAtom` → **`domainMetadataAtom`** (`DomainMetadataDto`, `stores/atoms/domain-metadata.atom.ts`).
- Service list lệch: KHÔNG còn `SiteSettingsService`; SDK thật có thêm `SettingsService, DomainMetadataService, HealthService, FollowUpService, LineWebhookService, UrlShareUsersService, MeetingService, ClientsService, …` (`src/lib/api/sdk.gen.ts`).
- **Owner = product đầy đủ** (`src/views/owner/` + 8 `useOwner*` hook + `app/deal/(subdomain)/owner/{,property}/page.tsx`), không phải "test white-label". Route group thật là `app/deal/(subdomain)/…` (segment `deal` đứng trước group).
- Trang mới: `/create-password`, `/reset-password` (product-agnostic). `/deed/np/{pending,rejected}` chỉ là **placeholder demo**, gate thật redirect `/deed/np/info`.

**pinrich-satei:**
- Module **`files`** mới (`POST /api/apartment-file`, `/api/house-file` → S3 tmp) — thiếu trong satei_map (map ghi 12 module).
- Path lệch: charts = `/api/charts/{data,location}` (số nhiều, chỉ `old-result.vue` dead gọi); draft = `/api/drafts/*` (số nhiều).
- Bulk-select không còn "chết hẳn": có `BbBulkActionBar.vue` + `selected` ref — nhưng **scaffold, chưa wire BE bulk endpoint** (table chưa có checkbox). `COMPACT_SETS` thực tế 10 entry (賃貸 mansion tách 2 type-label), logic kind×type vẫn 9.

---

# Lưu ý

- Luôn giải thích thuật ngữ tiếng Nhật kèm kanji
- Chỉ ra file path cụ thể, không nói chung chung
- Ưu tiên đọc memory trước, search codebase sau
- Luôn nhắc SP/PC + Pinrich/Baitori split khi liên quan đến frontend legacy
- Xác định repo trước khi nói về DB: legacy = `url_share_user`; SDD mới = `clients` + `follow_ups` (đừng khẳng định tuyệt đối "Client = url_share_user")
