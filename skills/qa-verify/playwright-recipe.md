# Playwright Recipe — Pinrich QA Verify

File này chứa toàn bộ recipe Playwright cho QA verify. SKILL.md chỉ link tới đây — Claude **đọc file này khi cần generate script Phase 4**, không phải mọi session.

> ## ⚠️ BẮT BUỘC ĐỌC — auth/infra trong recipe gốc là của project FMI, PHẢI adapt cho Pinrich
>
> Các section **1 (pre-flight)** và **2 (login/apiRequest/openBrowser)** được viết cho hạ tầng FMI (Caddy reverse-proxy `https://localhost:8330`, auth bằng **cookie `portal=vendor/merchant/admin`**). **Pinrich KHÁC hoàn toàn** — đừng paste nguyên si:
> - **Frontend**: vite dev, URL `http://pinrich.local:3000/deal` (`SUB_DIRECTORY = "deal"`), KHÔNG có Caddy:8330.
> - **Auth**: **AWS Cognito** (endpoint `/auth/login`, server set token) — KHÔNG có cookie `portal`. Phải lấy login flow thật từ `server/src/app/controllers/Auth/` rồi viết lại `login()`.
> - **Role/variant**: Pinrich không có vendor/grower/merchant. Phân biệt theo **SP/PC** (mobile/desktop) và **Pinrich/Baitori** (`isBaitoriDomain()`).
> - **Health/preflight**: thay check Caddy `/api/_health:8330` bằng ping `http://pinrich.local:3000/deal` + container `pinrich-server` healthy.
>
> Còn các section **0 (bootstrap runtime), 5 (gotcha Playwright), 6 (selector helpers), 7 (observability)** là generic — dùng được, chỉ thay selector/URL cụ thể.

## Section index — Read theo nhu cầu (tiết kiệm token)

Thay vì Read cả file (~825 lines), dùng `Read --offset N --limit M` cho đúng section cần. **Trước khi tin số line, verify**: `grep -nE '^## ' playwright-recipe.md` (edit file → line numbers shift).

| Section | Mục đích |
|---------|----------|
| 0. Shared Playwright runtime | NODE_PATH trỏ tới shared install. **Mandatory** — không cài lại mỗi task. |
| 1. Pre-flight check | Verify docker + frontend up; detect docker compose. **Mandatory.** ⚠ adapt cho Pinrich (xem banner). |
| 2. Common helpers | `apiRequest` / `login` / `openBrowser` / `setupPage` / `keepOpen`. **Mandatory.** ⚠ login = Cognito, adapt. |
| 3. Structure: single-user verify | 1 user, 1 variant — case phổ biến nhất. |
| 4. Structure: multi-user / concurrency | 2+ user, cross-variant, race condition, draft sync. |
| 5. Gotcha playwright-specific | Mock response field bắt buộc, SP/PC + Pinrich/Baitori view. **Mandatory đọc khi viết script.** |
| 6. Selector helpers đã test | `rowBadgeStatus` / `countVisible` / `openAndType` + smoke rule. **Mandatory cho list/badge verify.** |
| 7. Observability — narration cho tester xem live | Banner mô tả bước + highlight element + toast PASS/FAIL + slowMo. **Dùng khi tester ngồi xem browser.** |
| 8. Bug Sentinels | `attachSentinels()` (console/pageerror/requestfailed/HTTP 4xx-5xx) + `checkLayout()`. **MANDATORY mọi script — máy dò bug ngầm.** |

Line numbers dịch khi edit file → dùng `grep -nE '^## ' playwright-recipe.md` để tra số dòng chính xác trước khi Read offset.

**Combo thường dùng:**
- Script single-user (list/badge) → Read sections 0 + 1 + 2 + 3 + 5 + 6 + 7 + **8**
- Script concurrency → Read sections 0 + 1 + 2 + 4 + 5 + 7 + **8**
- **Section 8 luôn nằm trong mọi combo** — không có ngoại lệ.

---

## 0. Shared Playwright runtime — tự bootstrap nếu thiếu

`playwright` package được cài 1 lần ở `~/.claude/skills/qa-verify/runtime/node_modules/`. Chromium browser cache ở `~/.cache/ms-playwright/` (shared toàn system).

**Mỗi script verify BẮT BUỘC bắt đầu bằng `ensurePlaywrightRuntime()`** — tự check; nếu chưa có → cài; nếu có rồi → bỏ qua. Đặt TRƯỚC `require('playwright')`:

```js
// === SHARED RUNTIME BOOTSTRAP (paste nguyên block này lên đầu mỗi verify script) ===
const path = require('path')
const os = require('os')
const fs = require('fs')
const {execSync} = require('child_process')

function ensurePlaywrightRuntime() {
    const runtimeDir = path.join(os.homedir(), '.claude/skills/qa-verify/runtime')
    const playwrightPkg = path.join(runtimeDir, 'node_modules/playwright/package.json')
    const browserDir = path.join(os.homedir(), '.cache/ms-playwright')

    const needInstall = !fs.existsSync(playwrightPkg)
    const needBrowser = !fs.existsSync(browserDir) ||
        fs.readdirSync(browserDir).filter(d => d.startsWith('chromium-')).length === 0

    if (needInstall) {
        console.log('⏳ Cài Playwright lần đầu (~30s, chỉ chạy 1 lần)...')
        fs.mkdirSync(runtimeDir, {recursive: true})
        if (!fs.existsSync(path.join(runtimeDir, 'package.json'))) {
            execSync('npm init -y', {cwd: runtimeDir, stdio: 'inherit'})
        }
        execSync('npm install playwright', {cwd: runtimeDir, stdio: 'inherit'})
    }
    if (needBrowser) {
        console.log('⏳ Tải trình duyệt Chromium lần đầu (~150MB, chỉ chạy 1 lần)...')
        execSync('npx playwright install chromium', {cwd: runtimeDir, stdio: 'inherit'})
    }
    if (!needInstall && !needBrowser) {
        console.log('✓ Môi trường sẵn sàng')
    }

    // Add shared node_modules to module resolution
    module.paths.unshift(path.join(runtimeDir, 'node_modules'))
}
ensurePlaywrightRuntime()

// Giờ mới require playwright (sau khi đã thêm path)
const {chromium} = require('playwright')
// === END BOOTSTRAP ===
```

Hành vi:
- **Run lần đầu trên máy**: tự cài playwright (~30s) + chromium (~150MB), tiếp tục chạy.
- **Run các lần sau**: in `✓ Môi trường sẵn sàng` và chạy ngay.
- **Runtime bị xóa/corrupt**: tự re-install ở lần chạy kế.

Lợi: 1 file script chạy được trên máy mới (CI, container, dev mới) mà không cần README dạy cài thủ công.

---

## 1. Pre-flight check (chạy ngay đầu script)

Fail sớm với message actionable nếu env chưa sẵn sàng.

### === PINRICH === Pre-flight (DÙNG CÁI NÀY)

Pinrich = Vite dev server `http://pinrich.local:3000`, SUB_DIRECTORY=`deal` → app ở `http://pinrich.local:3000/deal`. KHÔNG có Caddy:8330, KHÔNG có cookie `portal`. Preflight chỉ cần: (1) vite :3000 sống, (2) API develop sống.

```js
const {execSync} = require('child_process')

const PINRICH_FE = 'http://pinrich.local:3000'          // vite dev
const PINRICH_APP = `${PINRICH_FE}/deal`                 // SUB_DIRECTORY = "deal"
// API develop: xác nhận base URL thật từ .env FE (VITE_API_*) khi chạy lần đầu.
// TODO: thay PINRICH_API bằng base URL API develop thật (vd https://<develop-api-host>).
const PINRICH_API = process.env.PINRICH_API || ''

function httpCode(url) {
    return execSync(
        `curl -k -s -o /dev/null -w "%{http_code}" "${url}"`,
        {encoding: 'utf-8', timeout: 5000},
    ).trim()
}

function preflightCheckPinrich() {
    // ⚠️ CẢNH BÁO: cookie `portal=vendor/merchant` của FMI KHÔNG áp dụng cho Pinrich.
    //    Pinrich auth = AWS Cognito (token), KHÔNG set cookie portal. Đừng addCookies portal.

    // 1. Vite dev :3000 reachable?
    try {
        const code = httpCode(PINRICH_APP)
        if (!code.startsWith('2') && !code.startsWith('3')) {
            throw new Error(`Vite trả ${code} tại ${PINRICH_APP}, có vẻ chưa sẵn sàng.`)
        }
    } catch (e) {
        throw new Error(
            `Frontend Vite không reachable tại ${PINRICH_FE}. ` +
            `Khởi động dev server (npm run dev) + kiểm tra /etc/hosts có pinrich.local → 127.0.0.1. ` +
            `Lỗi gốc: ${e.message}`,
        )
    }

    // 2. API develop sống? (chỉ check nếu đã set base URL thật)
    if (PINRICH_API) {
        try {
            const code = httpCode(PINRICH_API)
            if (!code.startsWith('2') && !code.startsWith('3') && code !== '401' && code !== '404') {
                throw new Error(`API trả ${code} tại ${PINRICH_API}, có vẻ chưa sẵn sàng.`)
            }
        } catch (e) {
            throw new Error(`API develop không reachable tại ${PINRICH_API}. Lỗi gốc: ${e.message}`)
        }
    } else {
        console.warn('⚠️ Chưa set PINRICH_API → bỏ qua check API. Set base URL API develop để check đầy đủ.')
    }

    console.log(`✓ Pinrich frontend đang chạy (${PINRICH_APP})`)
    return {appUrl: PINRICH_APP, apiUrl: PINRICH_API}
}
```

---

### Tham khảo (project khác — FMI — KHÔNG dùng cho Pinrich)

> Code dưới đây là của project **FMI** (Caddy `https://localhost:8330`, container `api`). **KHÔNG paste vào script Pinrich.** Để lại làm tham khảo cấu trúc thôi.

```js
const {execSync} = require('child_process')

function preflightCheck() {
    // 1. Detect docker compose command (new vs legacy)
    let dockerCompose
    try {
        execSync('docker compose version', {stdio: 'ignore'})
        dockerCompose = 'docker compose'
    } catch {
        try {
            execSync('docker-compose version', {stdio: 'ignore'})
            dockerCompose = 'docker-compose'
        } catch {
            throw new Error('Không tìm thấy docker compose / docker-compose. Cài Docker trước.')
        }
    }

    // 2. Check api container running
    const psOut = execSync(`${dockerCompose} ps --status running --services`, {encoding: 'utf-8'})
    if (!psOut.split('\n').includes('api')) {
        throw new Error(`API container chưa chạy. Khởi động: ${dockerCompose} up -d api caddy`)
    }

    // 3. Check Caddy reachable trên port 8330
    try {
        const code = execSync(
            'curl -k -s -o /dev/null -w "%{http_code}" https://localhost:8330/api/_health',
            {encoding: 'utf-8', timeout: 5000},
        ).trim()
        if (!code.startsWith('2') && !code.startsWith('3') && code !== '404') {
            throw new Error(`Caddy trả ${code}, có vẻ chưa sẵn sàng.`)
        }
    } catch (e) {
        throw new Error(`Caddy không reachable tại localhost:8330. Check: ${dockerCompose} ps caddy. Lỗi gốc: ${e.message}`)
    }

    console.log(`✓ Docker + Caddy đang chạy (dùng \`${dockerCompose}\`)`)
    return {dockerCompose}
}
```

---

## 2. Common helpers

### === PINRICH === login() + openBrowser (DÙNG CÁI NÀY)

Pinrich auth = **AWS Cognito**, trang login `http://pinrich.local:3000/deal/auth/login`. Đăng nhập qua **UI thật** (điền form → submit → chờ redirect về `/deal`), KHÔNG dùng command `docker compose run ... tasks users login` (đó là FMI). Token do server set sau redirect — để browser tự giữ session, không inject localStorage thủ công.

Biến thể test: **SP/PC** (mobile/desktop viewport) × **Pinrich/Baitori** (brand domain). Truyền qua `variant` để chọn viewport; brand xác định bằng host/`isBaitoriDomain()` ở app — nếu cần test Baitori, đổi base URL host cho đúng (TODO xác nhận host Baitori khi chạy lần đầu).

```js
const {chromium} = require('playwright')

const PINRICH_APP = 'http://pinrich.local:3000/deal'
const LOGIN_URL = `${PINRICH_APP}/auth/login`

// viewport theo variant SP (mobile) / PC (desktop)
const VIEWPORTS = {
    SP: {width: 390, height: 844},   // iPhone-ish
    PC: {width: 1440, height: 900},
}

// Đăng nhập Cognito qua form login thật.
// page: Playwright Page đã mở. {email, password}: credential tester cung cấp.
async function login(page, {email, password}) {
    if (!email || !password) throw new Error('Phải truyền {email, password} tester cung cấp — không có default')

    console.log(`\n⏳ Đang đăng nhập ${email} qua ${LOGIN_URL} ...`)
    await page.goto(LOGIN_URL, {waitUntil: 'networkidle'})

    // TODO: xác nhận selector thật từ src/views/.../Login khi chạy lần đầu.
    //       Các selector dưới CHỈ LÀ PHỎNG ĐOÁN — phải mở DevTools/đọc component để chốt.
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()      // TODO confirm
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first() // TODO confirm
    const submitBtn = page.getByRole('button', {name: /ログイン|sign in|login|送信/i}).first()    // TODO confirm

    await emailInput.fill(email)
    await passwordInput.fill(password)
    await submitBtn.click()

    // Chờ redirect về app (rời khỏi /auth/login). TODO: xác nhận URL đích thật + dấu hiệu "đã login"
    //   (vd avatar/menu user) khi chạy lần đầu — Cognito có thể bounce qua hosted UI trung gian.
    await page.waitForURL(url => !url.toString().includes('/auth/login'), {timeout: 30000})
    console.log(`✓ Đăng nhập OK (redirected: ${page.url()})`)
}

// Mở browser headed cho variant SP/PC. Auth làm SAU bằng login(page, ...).
async function openBrowser(variant = 'PC') {
    const viewport = VIEWPORTS[variant] || VIEWPORTS.PC
    const browser = await chromium.launch({headless: false, args: ['--start-maximized']})
    const context = await browser.newContext({viewport, ignoreHTTPSErrors: true})
    const page = await context.newPage()
    return {browser, context, page}
}
```

Flow điển hình:
```js
const {browser, page} = await openBrowser('PC')   // hoặc 'SP'
await login(page, {email, password})
await page.goto(PINRICH_APP)                        // vào trang cần verify
// ... assertions ...
```

---

### Tham khảo (project khác — FMI — KHÔNG dùng cho Pinrich)

> Block dưới là helper của **FMI**: `apiRequest` gọi `localhost:8330`, `login()` qua cookie `portal` + command `docker compose run api python -m tasks users login`, `openBrowser/setupPage` inject `COMMAND_LINE_LOGIN_ACCESS_TOKEN` vào localStorage. **KHÔNG paste vào script Pinrich** (Pinrich không có cookie portal, không có command login đó). Để lại tham khảo cấu trúc.

```js
const {chromium} = require('playwright')
const https = require('https')
const {exec} = require('child_process')
const {promisify} = require('util')
const execAsync = promisify(exec)

// CẢNH BÁO: disable TLS verification toàn process — chỉ dùng local (Caddy self-signed).
// KHÔNG copy pattern này vào CI / production / pipeline script.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const agent = new https.Agent({rejectUnauthorized: false})

// token: Bearer access token từ login() — BẮT BUỘC cho endpoint protected (orders, destinations...).
// Bỏ trống chỉ khi gọi public endpoint (vd /api/_sessions). Thiếu token → endpoint protected trả 401.
function apiRequest(path, method = 'GET', body = null, cookie = 'portal=vendor', token = null) {
    return new Promise((resolve, reject) => {
        const headers = {Cookie: cookie, 'Content-Type': 'application/json'}
        if (token) headers.Authorization = `Bearer ${token}`
        const req = https.request(
            {hostname: 'localhost', port: 8330, path, method, agent, headers},
            res => {
                let data = ''
                res.on('data', chunk => (data += chunk))
                res.on('end', () => {
                    // Non-JSON (HTML 500, body rỗng) không làm crash; status >=400 reject rõ ràng.
                    let parsed
                    try { parsed = data ? JSON.parse(data) : null } catch { parsed = data }
                    if (res.statusCode >= 400) {
                        const snippet = typeof parsed === 'string' ? parsed.slice(0, 200) : JSON.stringify(parsed).slice(0, 200)
                        return reject(new Error(`API ${method} ${path} → ${res.statusCode}: ${snippet}`))
                    }
                    resolve(parsed)
                })
            },
        )
        req.on('error', reject)
        if (body) req.write(JSON.stringify(body))
        req.end()
    })
}

async function login(email, portal = 'vendor', dockerCompose = 'docker compose') {
    if (!email) throw new Error('Phải truyền email tester cung cấp — không có default')
    const cookie = `portal=${portal}`

    const session = await apiRequest('/api/_sessions', 'POST', null, cookie)
    console.log(`\n⏳ Đang đăng nhập ${email} (portal: ${portal})...`)

    execAsync(`${dockerCompose} run --rm api python -m tasks users login --session-id ${session.id} --email ${email}`)
        .catch(e => {
            console.error(`\n❌ Đăng nhập tự động thất bại. Bạn chạy tay command sau trong 1 terminal khác:`)
            console.error(`    ${dockerCompose} run --rm api python -m tasks users login --session-id ${session.id} --email ${email}`)
            console.error(`(Lỗi gốc: ${e.message})`)
        })

    const deadline = Date.now() + session.timeout * 1000
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500))
        const data = await apiRequest(`/api/_sessions/${session.id}`, 'GET', null, cookie)
        if (!data.is_pending) {
            console.log(`\n✓ Đăng nhập OK: ${data.user?.email || data.user?.name}`)
            return {accessToken: data.accessToken, userInfo: data.user, portal}
        }
        process.stdout.write('.')
    }
    throw new Error('Đăng nhập quá thời gian chờ')
}

async function openBrowser(accessToken, userInfo, portal = 'vendor') {
    const browser = await chromium.launch({headless: false, args: ['--ignore-certificate-errors', '--start-maximized']})
    const context = await browser.newContext({ignoreHTTPSErrors: true, viewport: null})
    const page = await context.newPage()
    await context.addCookies([{name: 'portal', value: portal, domain: 'localhost', path: '/'}])
    await page.addInitScript(({token, user}) => {
        localStorage.setItem('COMMAND_LINE_LOGIN_ACCESS_TOKEN', token)
        localStorage.setItem('user_info', JSON.stringify(user))
        localStorage.setItem('DISABLE_TOOLBAR_MORPHING', 'true')
    }, {token: accessToken, user: userInfo})
    return {browser, page}
}

// Setup riêng cho 1 page khi dùng nhiều context trong cùng browser (xem section concurrency)
async function setupPage(context, page, portal, accessToken, userInfo) {
    await context.addCookies([{name: 'portal', value: portal, domain: 'localhost', path: '/'}])
    await page.addInitScript(({token, user}) => {
        localStorage.setItem('COMMAND_LINE_LOGIN_ACCESS_TOKEN', token)
        localStorage.setItem('user_info', JSON.stringify(user))
        localStorage.setItem('DISABLE_TOOLBAR_MORPHING', 'true')
    }, {token: accessToken, user: userInfo})
}

function keepOpen(browser) {
    return new Promise(resolve => {
        console.log('\n👀 Browser vẫn mở để bạn kiểm tra. Nhấn Ctrl+C để đóng (tự đóng sau 5 phút).')
        process.on('SIGINT', async () => { await browser.close(); resolve(); process.exit(0) })
        setTimeout(async () => { await browser.close(); resolve(); process.exit(0) }, 5 * 60 * 1000)
    })
}
```

---

## 3. Structure: single-user verify

Phổ biến nhất — 1 tester, 1 portal, vài kịch bản.

```js
const fs = require('fs')

// === Cấu hình (HỎI TESTER trước khi điền) ===
const TASK_NAME = '<tên-task>'   // VD: 'sm-badge', 'auto-confirm-qty'
const TESTER_EMAIL = '???'        // ← email tester cung cấp. KHÔNG hardcode default.
const PORTAL = 'vendor'           // ← vendor / merchant / admin (grower KHÔNG phải portal — là role trong vendor portal, dùng portal='vendor')

// Artifacts lưu trong project ở .qa-verify/<task>/ (đã gitignored qua .git/info/exclude)
const projectRoot = execSync('git rev-parse --show-toplevel', {encoding: 'utf-8'}).trim()
const TASK_DIR = `${projectRoot}/.qa-verify/${TASK_NAME}`
const SS_DIR = `${TASK_DIR}/screenshots`
fs.mkdirSync(SS_DIR, {recursive: true})

// Đảm bảo .qa-verify/ ở local exclude (idempotent)
try {
    const excludePath = `${projectRoot}/.git/info/exclude`
    const cur = fs.readFileSync(excludePath, 'utf-8')
    if (!/^\.qa-verify\//m.test(cur)) fs.appendFileSync(excludePath, '\n.qa-verify/\n')
} catch {}

async function run() {
    // 0. Pre-flight
    const {dockerCompose} = preflightCheck()

    // 1. Login (tự spawn docker-compose, không cần terminal thứ 2)
    const {accessToken, userInfo, portal} = await login(TESTER_EMAIL, PORTAL, dockerCompose)

    // 2. Browser
    const {browser, page} = await openBrowser(accessToken, userInfo, portal)

    // 3. Mock API (CHỈ mock tầng KHÔNG phải thứ đang verify)
    //
    // ⚠ Glob over-broad là footgun. Vd `**/api/orders*` catch CẢ
    //   `/api/orders/123`, `/api/orders-summary`, `/api/orders-history`.
    // ✅ Dùng RegExp khi cần chính xác.
    // 🔍 Debug glob: tạm thay route.fulfill(...) bằng route.continue() + log url.
    await page.route(/\/api\/orders\/\d+$/, route => {
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(mockData)})
    })

    // 4. Navigate + screenshot
    await page.goto('https://localhost:8330/some/page', {waitUntil: 'networkidle', timeout: 20000})
    await page.waitForTimeout(1000)  // OK cho timing screenshot; KHÔNG dùng cho logic assert
    await page.screenshot({path: `${SS_DIR}/ss-01-page.png`})

    // 5. Thao tác + assert (luôn có ca phân biệt)
    const results = {}
    results['Ca phân biệt: <kịch bản>'] =
        await page.locator('.target-selector').isVisible({timeout: 3000}).catch(() => false)
    results['Ca negative: <kịch bản>'] =
        !(await page.locator('.unexpected-selector').isVisible({timeout: 3000}).catch(() => false))
    await page.screenshot({path: `${SS_DIR}/ss-02-result.png`})

    // 6. Verdict — in plain Vietnamese
    console.log('\n' + '='.repeat(60))
    console.log('KẾT QUẢ KIỂM TRA')
    console.log('='.repeat(60))
    let allPass = true
    for (const [name, pass] of Object.entries(results)) {
        console.log(`${pass ? '✅ OK' : '❌ FAIL'}  ${name}`)
        if (!pass) allPass = false
    }
    console.log('='.repeat(60))
    console.log(allPass ? '🎉 TỔNG: PASS — toàn bộ check OK' : '⚠️  TỔNG: FAIL — có check không đạt, xem ❌ ở trên')
    console.log(`📂 Screenshot lưu ở: ${SS_DIR}`)
    console.log('='.repeat(60))

    await keepOpen(browser)
}

run().catch(e => { console.error('❌ Lỗi:', e.message); process.exit(1) })
```

---

## 4. Structure: multi-user / concurrency verify

Dùng khi:
- "Vendor làm A → grower thấy gì?" (cross-portal data flow)
- Race condition: 2 user cùng edit 1 record
- Draft sync: tab 1 lưu, tab 2 reload có thấy không
- Permissions cross-role: cùng record, 2 portal thấy khác nhau

Dùng **2 browser context trong 1 browser** — isolated cookie + storage, vẫn nhìn được cả 2 cửa sổ.

```js
const fs = require('fs')

const TASK_NAME = 'cross-portal-<tên>'
const VENDOR_EMAIL = '???'   // ← hỏi tester
const GROWER_EMAIL = '???'   // ← hỏi tester

const projectRoot = execSync('git rev-parse --show-toplevel', {encoding: 'utf-8'}).trim()
const TASK_DIR = `${projectRoot}/.qa-verify/${TASK_NAME}`
const SS_DIR = `${TASK_DIR}/screenshots`
fs.mkdirSync(SS_DIR, {recursive: true})

async function run() {
    const {dockerCompose} = preflightCheck()

    // Login 2 user song song (Promise.all giảm thời gian chờ)
    // ⚠ grower KHÔNG phải portal riêng — là role TRONG vendor portal (phân biệt qua userInfo.grower_ids).
    //   → login grower vẫn dùng portal='vendor'. Cross-portal THẬT (khác sub-app) = vendor ↔ merchant ↔ admin.
    const [vendor, grower] = await Promise.all([
        login(VENDOR_EMAIL, 'vendor', dockerCompose),
        login(GROWER_EMAIL, 'vendor', dockerCompose),
    ])

    // 1 browser, 2 context isolated
    const browser = await chromium.launch({
        headless: false,
        args: ['--ignore-certificate-errors', '--start-maximized'],
    })

    const ctxVendor = await browser.newContext({ignoreHTTPSErrors: true, viewport: {width: 960, height: 900}})
    const pVendor = await ctxVendor.newPage()
    await setupPage(ctxVendor, pVendor, 'vendor', vendor.accessToken, vendor.userInfo)

    const ctxGrower = await browser.newContext({ignoreHTTPSErrors: true, viewport: {width: 960, height: 900}})
    const pGrower = await ctxGrower.newPage()
    // portal='vendor' vì grower sống trong vendor portal (xem chú thích ở login phía trên)
    await setupPage(ctxGrower, pGrower, 'vendor', grower.accessToken, grower.userInfo)

    const results = {}

    // === Step 1: Grower trước action — record initial state ===
    await pGrower.goto('https://localhost:8330/orders/<id>', {waitUntil: 'networkidle'})
    await pGrower.screenshot({path: `${SS_DIR}/01-grower-before.png`})
    const growerSeesBefore = await pGrower.locator('.target-badge').isVisible({timeout: 2000}).catch(() => false)
    results['Grower KHÔNG thấy badge trước khi vendor action'] = !growerSeesBefore

    // === Step 2: Vendor thực hiện action ===
    await pVendor.goto('https://localhost:8330/orders/<id>', {waitUntil: 'networkidle'})
    await pVendor.click('button.forward-to-grower')
    await pVendor.waitForResponse(r => r.url().includes('/api/orders/') && r.request().method() === 'POST')
    await pVendor.screenshot({path: `${SS_DIR}/02-vendor-after-action.png`})

    // === Step 3: Grower reload sau action — verify state đã propagate ===
    await pGrower.reload({waitUntil: 'networkidle'})
    await pGrower.waitForTimeout(1500)
    await pGrower.screenshot({path: `${SS_DIR}/03-grower-after.png`})
    const growerSeesAfter = await pGrower.locator('.target-badge').isVisible({timeout: 5000}).catch(() => false)
    results['Grower THẤY badge sau khi vendor action'] = growerSeesAfter

    // === Verdict — plain Vietnamese ===
    console.log('\n' + '='.repeat(60))
    console.log('KẾT QUẢ KIỂM TRA (cross-portal)')
    console.log('='.repeat(60))
    let allPass = true
    for (const [name, pass] of Object.entries(results)) {
        console.log(`${pass ? '✅ OK' : '❌ FAIL'}  ${name}`)
        if (!pass) allPass = false
    }
    console.log('='.repeat(60))
    console.log(allPass ? '🎉 TỔNG: PASS' : '⚠️  TỔNG: FAIL — xem ❌ ở trên')
    console.log(`📂 Screenshot: ${SS_DIR}`)
    console.log('='.repeat(60))

    await keepOpen(browser)
}

run().catch(e => { console.error('❌ Lỗi:', e.message); process.exit(1) })
```

### Lưu ý concurrency

- `Promise.all([login(...)])` chạy 2 login song song, **rút thời gian 1 nửa** (mỗi login ~10-15s).
- **Window placement**: viewport `{width: 960}` để 2 cửa sổ side-by-side trên màn 1920px. Tester nhìn 2 user/variant cùng lúc.
- **Race condition thật** (2 user write song song): thay `await pVendor.click(...)` + reload bằng `Promise.all([pVendor.click(...), pGrower.click(...)])` — KHÔNG dùng `waitForTimeout` vì timing thật mới phơi bày bug.
- **Don't share state**: tránh dùng `page.evaluate` chung — mỗi context có window object riêng.

---

## 5. Gotcha playwright-specific

**Mock response phải đủ field** — khi mock 1 API mà component có bước transform/preprocess, thiếu field optional cũng có thể crash cả trang. Quy tắc: mock = clone payload thật từ Network tab, KHÔNG tự gõ object tối thiểu. (FMI cũ: `GET /api/orders/<id>` cần `{files, suggested_items, order_by}` — Pinrich có gotcha riêng tùy endpoint, capture payload thật trước.)

**SP/PC + Pinrich/Baitori view khác nhau** — cùng 1 route render component khác theo `conditionalComponent()` (SP/PC) và `isBaitoriDomain()` (brand). Trước khi assert, xác định đang ở variant nào: set viewport mobile để ép SP, hoặc mở đúng domain để ép Baitori. Verify 1 variant KHÔNG suy ra variant kia.

**Business condition** (điều kiện hiện banner/badge, workflow rule 追客…) — xem `patterns.md`, không trong recipe này.

---

## 6. Selector helpers đã test (DÙNG LẠI, không tự bịa)

**TRƯỚC khi viết selector mới**: Pinrich KHÔNG có Cypress và KHÔNG dùng `data-test`. Lấy class/text thật từ Vue template, ưu tiên `getByText`/`getByRole`:
```sh
grep -rhoE "class=\"[^\"]+\"" src/views/<trang>/ src/components/<comp>/ | sort -u
```

Helpers dưới là generic — paste thẳng (chỉ thay selector/text cho đúng template Pinrich):

```js
// Trả 'present' | 'absent' | 'not_found' — badge trong row đã scope đúng cell
async function rowBadgeStatus(page, nameCellSelector, itemName, badgeClass) {
    const cell = page.locator(nameCellSelector, {hasText: itemName}).first()
    if (await cell.count() === 0) return 'not_found'
    return (await cell.locator(badgeClass).count()) > 0 ? 'present' : 'absent'
}
// Vd: rowBadgeStatus(page, '<selector cell tên trong template>', 'Tên client', '<class badge>')

// Đếm tổng badge visible trên trang — dùng cho SMOKE check
async function countVisible(page, selector) {
    return await page.locator(`${selector}:visible`).count()
}

// Mở autocomplete trong form section ẩn (phải click "+" trước — xem patterns.md)
// trigger = nút "+" của section (vd cạnh "To"), inputScope = container chứa input sau khi mở
async function openAndType(page, triggerSelector, inputScope, text) {
    await page.locator(triggerSelector).first().click({force: true})
    await page.waitForTimeout(500)
    const input = page.locator(`${inputScope} input`).last()
    if (await input.count() === 0 || !(await input.isVisible())) return null
    await input.click()
    await input.fill(text)
    await page.waitForTimeout(1500)
    // Trả HTML của dropdown đang mở để inspect (Pinrich dùng @headlessui/vue → ưu tiên [role="listbox"])
    const dds = await page.locator('[role="listbox"]:visible, [role="menu"]:visible').all()
    let html = ''
    for (const d of dds) html += await d.innerHTML().catch(() => '')
    return html
}

// Pinrich: KHÔNG có cheatsheet selector cố định (FE chủ yếu Tailwind utility class + @headlessui/vue).
//   → ưu tiên page.getByText('<label thật>') / getByRole('button', {name: '...'})
//   → cần class: grep template src/views|src/components rồi tích lũy vào patterns.md
```

**Quy tắc smoke (bắt buộc trước khi assert thật)**:
```js
const total = await countVisible(page, BADGE_SELECTOR)          // ← class badge thật từ template Pinrich
console.log(`[smoke] ${total} badge trên trang (expect >0 nếu data đúng)`)
const known = await rowBadgeStatus(page, NAME_CELL_SELECTOR, KNOWN_PASS_NAME, BADGE_SELECTOR)
console.log(`[smoke] helper(${KNOWN_PASS_NAME}) = ${known} (expect 'present')`)
if (known !== 'present') console.warn('⚠️ Helper có thể sai selector — KIỂM TRA trước khi tin kết quả assert')
```

---

## 7. Observability — narration cho tester xem live (headed)

Khi tester ngồi nhìn browser, script chạy "câm" rất khó theo dõi: click loẹt loẹt không biết đang làm bước gì, bấm vào đâu, kết quả ra sao. Section này thêm 1 lớp **narration trực quan ON-PAGE** (overlay inject vào trang, không phụ thuộc app).

**4 thành phần:**
1. **slowMo** — `chromium.launch({headless:false, slowMo: 350})` → mọi action chậm lại ~0.35s, mắt theo kịp.
2. **Banner** — thanh cố định trên cùng: `TC-xx — BƯỚC n` + 🔹 đang làm gì + 👁️ kỳ vọng thấy gì.
3. **flash** — highlight element SẮP thao tác (viền cam + scroll vào giữa) → tester biết chỗ tiếp theo bấm/điền.
4. **resultToast** — hộp xanh/đỏ giữa màn hình sau mỗi TC: PASS/FAIL + tóm tắt số liệu.

```js
// === OBSERVABILITY (paste sau helpers section 2) ===
// Banner cố định trên cùng: mô tả bước + kỳ vọng. pointer-events:none để KHÔNG chặn click.
async function banner(page, tc, title, detail, expect) {
    await page.evaluate(({tc, title, detail, expect}) => {
        let el = document.getElementById('__qa_banner')
        if (!el) {
            el = document.createElement('div')
            el.id = '__qa_banner'
            el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0f172a;color:#fff;' +
                'padding:10px 18px;font:14px/1.45 -apple-system,sans-serif;box-shadow:0 3px 12px rgba(0,0,0,.5);' +
                'border-bottom:3px solid #38bdf8;pointer-events:none'
            document.documentElement.appendChild(el)
        }
        el.innerHTML =
            `<div style="font-weight:700;font-size:13px;color:#38bdf8;letter-spacing:.5px">${tc} — ${title}</div>` +
            `<div style="margin-top:3px">🔹 ${detail}</div>` +
            (expect ? `<div style="margin-top:2px;color:#fbbf24">👁️ Kỳ vọng: ${expect}</div>` : '')
    }, {tc, title, detail, expect: expect || ''}).catch(() => {})
}

// Highlight element sắp thao tác (viền cam + scroll giữa). GỌI TRƯỚC MỌI click/fill.
async function flash(locator, color = '#f59e0b') {
    await locator.first().evaluate((el, color) => {
        el.scrollIntoView({block: 'center', behavior: 'smooth'})
        const old = el.style.boxShadow
        el.style.boxShadow = `0 0 0 3px ${color}, 0 0 14px ${color}`
        el.style.transition = 'box-shadow .2s'
        setTimeout(() => { el.style.boxShadow = old }, 1600)
    }, color).catch(() => {})
}

const READ = 2200   // ms — thời gian dừng cho tester đọc banner
const pause = ms => new Promise(r => setTimeout(r, ms))

// 1 bước có narration: banner → dừng đọc → highlight target (nếu truyền).
// LUÔN truyền target = locator của element sắp click/fill để tester thấy chỗ tiếp theo.
async function step(page, tc, title, detail, expect, target = null) {
    await banner(page, tc, title, detail, expect)
    await pause(READ)
    if (target) { await flash(target); await pause(900) }
}

// Toast PASS/FAIL giữa màn hình sau mỗi TC.
async function resultToast(page, ok, text) {
    await page.evaluate(({ok, text}) => {
        let el = document.getElementById('__qa_toast')
        if (!el) {
            el = document.createElement('div')
            el.id = '__qa_toast'
            el.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
                'padding:12px 22px;font:700 15px/1.4 -apple-system,sans-serif;border-radius:8px;' +
                'box-shadow:0 6px 24px rgba(0,0,0,.5);max-width:70%;pointer-events:none'
            document.documentElement.appendChild(el)
        }
        el.style.background = ok ? '#16a34a' : '#dc2626'
        el.style.color = '#fff'
        el.textContent = `${ok ? '✅ PASS' : '❌ FAIL'} — ${text}`
    }, {ok, text}).catch(() => {})
    await pause(2200)
}
// === END OBSERVABILITY ===
```

**Cách dùng trong scenario** (mỗi action bọc bằng step → highlight → click):

```js
await step(page, 'TC-C01', 'BƯỚC 1 — Xóa hết claim items',
    'Sắp bấm nút X ở dòng sản phẩm → claim amount tụt về $0.00.',
    'Claim Amount: $500 → $0.00 (gạch ngang giá cũ)',
    page.locator('.clear-btn'))         // ← target được highlight + scroll vào giữa
await page.locator('.clear-btn').first().click()
// ... assert ...
await resultToast(page, redShown && noPatch,
    `Chữ đỏ: ${redShown ? 'CÓ' : 'KHÔNG'} | Gửi request: ${noPatch ? 'KHÔNG (đúng)' : 'SAI'}`)
```

**Quy tắc bắt buộc để tester không lạc:**
- **LUÔN truyền `target` cho `step()`** trước khi click/fill — tester thấy viền cam ở chỗ sắp thao tác. Bỏ target = click "vô hình", tester mất dấu (đúng vấn đề user phản ánh).
- **Element xuất hiện SAU 1 action khác** (vd: ô Reason chỉ hiện sau khi clear item; form claim mới hiện sau khi bấm "Claim Order"): gọi `flash()` riêng ngay trước khi fill/click element đó, vì lúc `step()` đầu bước nó chưa tồn tại trong DOM.
  ```js
  const ta = page.locator('.claim_message textarea').first()
  if (await ta.count()) { await flash(ta); await pause(700); await ta.fill('...') }
  ```
- **Banner/toast bị xóa sau mỗi `page.goto()`** (navigate reload DOM) → `step()` tự re-inject ở bước kế, không sao. Nhưng đừng assert dựa trên `#__qa_banner` tồn tại qua navigation.
- **pointer-events:none** trên cả banner + toast — nếu quên, overlay z-index cao sẽ nuốt click khiến thao tác fail.
- **slowMo + READ pause** chỉ phục vụ quan sát, KHÔNG thay cho `waitForSelector`/assert logic. Vẫn `await locator.click()` (Playwright auto-wait), không rely vào pause để "chờ element".

**Khi nào bỏ qua section này:** chạy headless trong CI/cron (không ai xem) → bỏ banner/toast/slowMo cho nhanh. Chỉ bật khi tester ngồi xem live (đúng tinh thần qa-verify).

---

## 8. Bug Sentinels — máy dò bug NGẦM (MANDATORY mọi script)

> Đây là phần bắt được loại bug mà **assertion script không bao giờ nhìn tới**: app "trông vẫn chạy" nhưng console đỏ lòm, có uncaught exception, API trả 500/403 âm thầm, request fail, hoặc layout vỡ/tràn. Nghiên cứu QA: nhiều app log lỗi API thẳng ra console thay vì hiện UI → chỉ bắt được nếu mình lắng nghe console. **GẮN block này vào MỌI page ngay sau khi tạo, trước mọi thao tác.**

```js
// === BUG SENTINELS (paste sau helpers section 2; gọi attachSentinels(page, 'tên-page') ngay sau khi có page) ===
// Lắng nghe SUỐT phiên: console.error/warning, uncaught exception, request fail, HTTP 4xx/5xx.
// Trả về object có .report() để in cuối phiên + .errors để đưa vào REPORT.md.
function attachSentinels(page, label = 'page') {
    const sink = {label, consoleErrors: [], consoleWarnings: [], pageErrors: [], requestFailed: [], httpErrors: []}

    // 1. Console: error + warning (warning hay là dấu hiệu deprecation / state sai / key trùng React/Vue)
    page.on('console', msg => {
        const t = msg.type()
        const text = msg.text()
        // Lọc noise quen thuộc (devtools, vite hmr, favicon). Thêm pattern nếu gặp noise lặp.
        if (/\[vite\]|Download the (Vue|React) Devtools|favicon/i.test(text)) return
        if (t === 'error') sink.consoleErrors.push(text)
        else if (t === 'warning') sink.consoleWarnings.push(text)
    })

    // 2. Uncaught JS exception trong trang → gần như LUÔN là bug thật
    page.on('pageerror', err => sink.pageErrors.push(err.message || String(err)))

    // 3. Request fail hẳn (network drop, CORS, DNS) — khác với HTTP error có response
    page.on('requestfailed', req => {
        const f = req.failure()
        // ignore aborted do điều hướng (user navigate giữa chừng)
        if (f && /aborted/i.test(f.errorText)) return
        sink.requestFailed.push(`${req.method()} ${req.url()} — ${f ? f.errorText : 'failed'}`)
    })

    // 4. HTTP 4xx/5xx — API trả lỗi mà UI có thể nuốt im
    page.on('response', res => {
        const s = res.status()
        const url = res.url()
        // chỉ quan tâm call API của app (điều chỉnh host/path cho Pinrich), bỏ asset tĩnh & analytics
        if (s >= 400 && /\/api\/|\/auth\//.test(url) && !/analytics|sentry|gtm|google/i.test(url)) {
            sink.httpErrors.push(`${s} ${res.request().method()} ${url}`)
        }
    })

    sink.count = () => sink.consoleErrors.length + sink.pageErrors.length + sink.requestFailed.length + sink.httpErrors.length
    sink.report = () => {
        const lines = []
        const add = (title, arr) => { if (arr.length) lines.push(`  ${title} (${arr.length}):`, ...arr.map(x => `    • ${x}`)) }
        add('🔴 console.error', sink.consoleErrors)
        add('🔴 pageerror (uncaught)', sink.pageErrors)
        add('🔴 request FAILED', sink.requestFailed)
        add('🔴 HTTP 4xx/5xx', sink.httpErrors)
        add('🟡 console.warning', sink.consoleWarnings)
        if (!lines.length) return `[sentinel ${label}] ✅ sạch — không console error / exception / API lỗi`
        return `[sentinel ${label}] ⚠️ PHÁT HIỆN:\n${lines.join('\n')}`
    }
    return sink
}

// Phát hiện layout vỡ: element tràn ngang viewport, hoặc text bị cắt (scrollWidth > clientWidth).
// Gọi sau khi trang render xong từng bước quan trọng. Trả về danh sách selector nghi vỡ.
async function checkLayout(page) {
    return await page.evaluate(() => {
        const issues = []
        const vw = document.documentElement.clientWidth
        document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) return
            // tràn ngang khỏi viewport (cho phép 2px sai số)
            if (r.right > vw + 2 || r.left < -2) {
                const id = el.id ? `#${el.id}` : (el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase())
                issues.push(`overflow-x: ${id} (right=${Math.round(r.right)} > vw=${vw})`)
            }
        })
        // ảnh vỡ
        document.querySelectorAll('img').forEach(img => {
            if (img.complete && img.naturalWidth === 0) issues.push(`broken-img: ${img.src}`)
        })
        return [...new Set(issues)].slice(0, 20)
    })
}
// === END BUG SENTINELS ===
```

**Cách dùng (BẮT BUỘC trong mọi script):**

```js
const {browser, page} = await openBrowser(accessToken, userInfo, portal)
const sentinel = attachSentinels(page, 'vendor-A')      // ← gắn NGAY, trước mọi thao tác
// ... chạy toàn bộ scenario ...

// Cuối phiên — IN ra + đưa vào verdict:
console.log('\n' + sentinel.report())
const layout = await checkLayout(page)
if (layout.length) console.log(`[layout] ⚠️ ${layout.length} nghi vấn:\n` + layout.map(x => '    • ' + x).join('\n'))
```

**Quy tắc đưa vào verdict (Phase 5):**
- `sentinel.pageErrors` hoặc `sentinel.httpErrors` (5xx) **không rỗng** → mặc định coi là **bug**, kể cả khi TC chính PASS. Một uncaught exception / API 500 âm thầm = bug thật, dù UI may mắn vẫn hiện đúng. Ghi vào "Bug / Issue phát hiện".
- `consoleErrors` → điều tra từng cái; phần lớn là bug (404 asset, prop type sai, null access). Cái nào xác định noise quen → thêm vào filter regex + ghi chú.
- `consoleWarnings` + `checkLayout` → mức Issue/Suggestion (deprecation, key trùng, overflow nhẹ) trừ khi che mất chức năng.
- **Multi-user**: mỗi context/page gắn 1 sentinel riêng (`attachSentinels(pageA,'A')`, `attachSentinels(pageB,'B')`), report cả hai.

**Vì sao mandatory:** đa số bug regression "rò rỉ" không phải ở chỗ TC nhắm tới mà ở tác dụng phụ — 1 API phụ trả 500, 1 component con throw, 1 ảnh 404, 1 deprecation thành lỗi runtime ở browser khác. Sentinel bắt hết cái đó "miễn phí" trong khi mình đang verify thứ khác → tăng số bug phát hiện mỗi phiên mà không cần viết thêm TC.
