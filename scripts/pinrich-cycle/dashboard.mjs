#!/usr/bin/env node
/**
 * dashboard.mjs — giao diện cho /pinrich-cycle (bưng ý "sidebar/dashboard" của AIDLC
 * về hệ file-based của bạn). Đọc mọi state-<repo>.md + artifacts-<repo>.json,
 * vẽ một "bảng tín hiệu": mỗi cycle = 1 tuyến, mỗi bước = 1 ga, ga hiện tại sáng,
 * QA fail = đèn đỏ. Tự chạy verify-artifacts để hiện đèn drift.
 *
 * Dùng:
 *   node dashboard.mjs                       # đọc ~/.claude/pinrich-cycle, ghi dashboard.html
 *   node dashboard.mjs --dir <path>          # đọc state ở thư mục khác (demo/test)
 *   node dashboard.mjs --out <file.html>     # đổi nơi ghi
 *   node dashboard.mjs --fragment            # in body-only ra stdout (cho Artifact)
 *
 * Read-only với code repo. Mở dashboard.html bằng trình duyệt.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();

function parseArgs(argv) {
  const o = { dir: path.join(HOME, '.claude', 'pinrich-cycle'), out: undefined, fragment: false, serve: false, port: 4123 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') o.dir = path.resolve(argv[++i]);
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--fragment') o.fragment = true;
    else if (a === '--serve') o.serve = true;
    else if (a === '--port') o.port = parseInt(argv[++i], 10) || 4123;
  }
  if (!o.out) o.out = path.join(o.dir, 'dashboard.html');
  return o;
}
const args = parseArgs(process.argv.slice(2));

// ── Đọc + parse state file ──────────────────────────────────────────
function parseState(text) {
  const s = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*([a-z_]+):\s*(.*)$/i);
    if (m) s[m[1].trim()] = m[2].trim();
  }
  return s;
}

function loadCycles(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /^state-.*\.md$/.test(f));
  } catch { /* dir trống */ }
  return files.map((f) => {
    const repo = f.replace(/^state-/, '').replace(/\.md$/, '');
    const st = parseState(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { repo, ...st, drift: driftStatus(dir, repo), budget: budgetStatus(repo, st.cost_budget_usd) };
  });
}

// ── Chạy budget.mjs để biết cost + trần ─────────────────────────────
function budgetStatus(repo, limit) {
  try {
    const a = ['--json'];
    if (limit) a.push('--limit', String(limit));
    const out = execFileSync('node', [path.join(__dir, 'budget.mjs'), repo, ...a], { encoding: 'utf8' });
    return JSON.parse(out);
  } catch (e) {
    const so = e.stdout ? String(e.stdout) : '';
    try { return JSON.parse(so); } catch { return null; } // chưa có transcript
  }
}

// ── Chạy verify-artifacts để biết đèn drift ─────────────────────────
function driftStatus(dir, repo) {
  const manifest = path.join(dir, `artifacts-${repo}.json`);
  if (!fs.existsSync(manifest)) return { state: 'na' };
  try {
    const out = execFileSync('node', [path.join(__dir, 'verify-artifacts.mjs'), '--file', manifest, '--json'], {
      encoding: 'utf8',
    });
    const r = JSON.parse(out);
    return { state: r.ok ? 'clear' : 'drift', drift: r.drift };
  } catch (e) {
    // exit 1 (drift) vẫn ném — bắt stdout từ error
    const so = e.stdout ? String(e.stdout) : '';
    try {
      const r = JSON.parse(so);
      return { state: r.ok ? 'clear' : 'drift', drift: r.drift };
    } catch {
      return { state: 'na' };
    }
  }
}

// ── Ga theo trục ────────────────────────────────────────────────────
const TRACK_BUILD = ['INIT', 'ROUTE', 'DESIGN', 'BUILD', 'REVIEW', 'QA', 'DONE'];
const TRACK_BUG = ['INIT', 'ROUTE', 'BUGFIX', 'REVIEW', 'QA', 'DONE'];

// Nhãn tiếng Việt cho từng bước — để người không rành kỹ thuật (PM, khách) đọc hiểu.
// Tên code (INIT/BUILD…) giữ ở tooltip cho dev.
const STAGE_VI = {
  INIT: 'Chuẩn bị', ROUTE: 'Định hướng', GAPAUDIT: 'Đối chiếu',
  DESIGN: 'Thiết kế', BUILD: 'Dựng trang', BUGFIX: 'Sửa lỗi',
  REVIEW: 'Soát code', QA: 'Kiểm thử', DONE: 'Hoàn tất',
};

// Mô tả "kiểu việc" bằng lời thường thay cho track/build_kind.
function trackVi(c) {
  const t = (c.track || '').toLowerCase();
  if (t === 'bug') return 'Sửa lỗi / đổi behavior';
  if (t === 'build') {
    const k = (c.build_kind || '').toLowerCase();
    return k === 'port' ? 'Port trang (Vue → Next)'
      : k === 'design' ? 'Thiết kế màn mới'
      : k === 'handoff' ? 'Áp design có sẵn'
      : 'Dựng trang';
  }
  return 'chưa rõ';
}

function stationsFor(c) {
  const track = (c.track || '').toLowerCase();
  let stops = track === 'bug' ? [...TRACK_BUG] : [...TRACK_BUILD];
  // build mà không thiết kế lại → bỏ ga DESIGN cho gọn
  if (track !== 'bug' && (c.build_kind || '') !== 'design') {
    stops = stops.filter((s) => s !== 'DESIGN');
  }
  // Chèn ga "Đối chiếu" (GAPAUDIT) sau Định hướng nếu cycle có cổng gap-audit
  // (redesign trang đã có) — nếu thiếu, bước GAPAUDIT bị vẽ nhầm sang Chuẩn bị.
  const gg = (c.gap_gate || '').toLowerCase();
  const step = (c.step || '').toUpperCase();
  if (track !== 'bug' && (gg === 'pending' || gg === 'answered' || step === 'GAPAUDIT')) {
    const ri = stops.indexOf('ROUTE');
    if (ri >= 0 && !stops.includes('GAPAUDIT')) stops.splice(ri + 1, 0, 'GAPAUDIT');
  }
  return stops;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

// ── Render 1 cycle ──────────────────────────────────────────────────
function renderCycle(c) {
  const stops = stationsFor(c);
  const step = (c.step || 'INIT').toUpperCase();
  const curIdx = Math.max(0, stops.indexOf(step));
  const isDone = step === 'DONE';
  const qaFail = (c.qa_result || '') === 'fail';
  const qaPass = (c.qa_result || '') === 'pass';

  const nodes = stops
    .map((stop, i) => {
      let cls = 'st-future';
      if (isDone) cls = 'st-done';
      else if (i < curIdx) cls = 'st-done';
      else if (i === curIdx) cls = qaFail && stop === 'QA' ? 'st-fail' : 'st-current';
      const connector = i < stops.length - 1 ? `<span class="rail ${i < curIdx || isDone ? 'rail-done' : ''}"></span>` : '';
      return `<span class="stop ${cls}" title="${esc(stop)}"><span class="dot"></span><span class="stop-label">${esc(STAGE_VI[stop] || stop)}</span></span>${connector}`;
    })
    .join('');

  const gatePending = (c.gap_gate || '').toLowerCase() === 'pending';
  const statusCls = isDone ? 'badge-done' : qaFail ? 'badge-fail' : gatePending ? 'badge-wait' : qaPass ? 'badge-pass' : 'badge-run';
  const iterTxt = c.iteration && c.iteration !== '1' ? ` · vòng ${esc(c.iteration)}` : '';
  const statusTxt = isDone
    ? 'Hoàn tất'
    : qaFail
      ? 'Cần sửa lại'
      : gatePending
        ? '⏸ Chờ chốt'
        : `Đang ${STAGE_VI[step] || step}${iterTxt}`;

  const lamp = (label, state, txt) =>
    `<span class="lamp lamp-${state}" title="${esc(label)}"><span class="bulb"></span>${esc(txt)}</span>`;

  const qaState = qaPass ? 'pass' : qaFail ? 'fail' : 'idle';
  const qaVi = qaPass ? 'đạt' : qaFail ? 'lỗi' : 'chưa làm';
  const driftSt = c.drift?.state || 'na';
  const driftTxt = driftSt === 'clear' ? 'nguyên vẹn' : driftSt === 'drift' ? 'LỆCH' : 'chưa có';
  const driftLamp = driftSt === 'clear' ? 'pass' : driftSt === 'drift' ? 'fail' : 'idle';

  const b = c.budget;
  const budgetLine = b
    ? (b.limit_usd != null
        ? `<span class="lamp lamp-${b.ok ? 'pass' : 'fail'}"><span class="bulb"></span>$${b.spent_usd.toFixed(2)}/$${b.limit_usd.toFixed(2)}</span>`
        : `<span class="rd"><i>cost</i>$${b.spent_usd.toFixed(2)}</span>`)
    : '';

  const driftDetail =
    driftSt === 'drift' && c.drift?.drift?.length
      ? `<div class="drift-detail">${c.drift.drift
          .map(
            (d) =>
              `↯ [${esc(d.step)}] ${esc(d.agent)} — ${[...(d.missing || []).map((f) => 'mất ' + f), ...(d.missingMarkers || []).map((m) => 'thiếu "' + m + '"')].map(esc).join(', ')}`,
          )
          .join('<br>')}</div>`
      : '';

  return `
  <article class="cycle">
    <div class="cyc-head">
      <h2 class="repo">${esc(c.repo)}</h2>
      <span class="badge ${statusCls}">${statusTxt}</span>
    </div>
    <p class="task">${esc(c.task || '—')}</p>
    <div class="track">${nodes}</div>
    <div class="readout">
      <span class="rd"><i>Kiểu việc</i>${esc(trackVi(c))}</span>
      ${lamp('Kết quả kiểm thử (QA)', qaState, 'Kiểm thử: ' + qaVi)}
      ${lamp('Bản dựng có còn khớp file không (drift)', driftLamp, 'File: ' + driftTxt)}
      ${budgetLine}
      <span class="rd"><i>Nhánh</i>${esc(c.branch || '—')}</span>
      <span class="rd"><i>Cập nhật</i>${esc(c.updated || '—')}</span>
    </div>
    ${driftDetail}
    <div class="next"><span class="next-label">Việc tiếp theo</span><span class="next-text">${esc(c.next_action || 'chưa đặt')}</span></div>
  </article>`;
}

// ── Render toàn trang ───────────────────────────────────────────────
function renderInner(cycles) {
  const active = cycles.filter((c) => (c.step || '').toUpperCase() !== 'DONE');
  const css = `
  <style>
  .pc { --ground:#0E1620; --surface:#16212E; --surface-2:#1E2C3C; --text:#E6EDF3; --muted:#7A8A9A;
        --amber:#F2A93B; --green:#3FB98C; --red:#E5564B; --rail:#2C3B4D;
        font-family: ui-monospace,"SF Mono",Menlo,Consolas,monospace; color:var(--text);
        background:var(--ground); min-height:100vh; padding:clamp(20px,4vw,56px); }
  .pc * { box-sizing:border-box; }
  .pc .top { display:flex; align-items:baseline; gap:18px; flex-wrap:wrap;
        border-bottom:1px solid var(--rail); padding-bottom:18px; margin-bottom:30px; }
  .pc .brand { font-family:system-ui,sans-serif; font-weight:800; font-size:clamp(26px,4vw,40px);
        letter-spacing:-.03em; margin:0; }
  .pc .brand b { color:var(--amber); }
  .pc .sub { color:var(--muted); font-size:13px; }
  .pc .sig { display:inline-block; width:11px; height:11px; border-radius:50%; background:var(--amber);
        margin-right:9px; box-shadow:0 0 0 4px rgba(242,169,59,.18); }
  .pc .grid { display:flex; flex-direction:column; gap:18px; max-width:900px; }
  .pc .cycle { background:var(--surface); border:1px solid var(--rail); border-radius:14px;
        padding:22px clamp(18px,2.4vw,28px); }
  .pc .cyc-head { display:flex; align-items:center; gap:14px; justify-content:space-between; }
  .pc .repo { font-family:system-ui,sans-serif; font-weight:700; font-size:19px; letter-spacing:-.01em; margin:0; }
  .pc .badge { font-size:11px; font-weight:700; letter-spacing:.04em; padding:5px 11px; border-radius:999px;
        white-space:nowrap; font-family:system-ui,sans-serif; }
  .pc .badge-run  { background:rgba(242,169,59,.14); color:var(--amber); }
  .pc .badge-fail { background:rgba(229,86,75,.16); color:var(--red); }
  .pc .badge-pass { background:rgba(63,185,140,.16); color:var(--green); }
  .pc .badge-done { background:rgba(63,185,140,.16); color:var(--green); }
  .pc .badge-wait { background:rgba(120,170,235,.16); color:#86B7F2; }
  .pc .task { color:var(--muted); font-size:13px; margin:8px 0 20px; font-family:system-ui,sans-serif; line-height:1.5; }
  /* track */
  .pc .track { display:flex; align-items:flex-start; flex-wrap:wrap; gap:0; margin-bottom:22px; }
  .pc .stop { display:flex; flex-direction:column; align-items:center; gap:7px; width:68px; flex:0 0 auto; }
  .pc .dot { width:15px; height:15px; border-radius:50%; border:2px solid var(--rail); background:var(--surface-2); }
  .pc .stop-label { font-size:10px; line-height:1.25; text-align:center; color:var(--muted);
        font-family:system-ui,sans-serif; }
  .pc .rail { height:2px; flex:1 1 14px; min-width:14px; background:var(--rail); margin-top:6.5px; }
  .pc .rail-done { background:var(--green); }
  .pc .st-done .dot { background:var(--green); border-color:var(--green); }
  .pc .st-done .stop-label { color:var(--text); }
  .pc .st-current .dot { background:var(--amber); border-color:var(--amber);
        box-shadow:0 0 0 5px rgba(242,169,59,.20); animation:pulse 1.8s ease-in-out infinite; }
  .pc .st-current .stop-label { color:var(--amber); font-weight:700; }
  .pc .st-fail .dot { background:var(--red); border-color:var(--red); box-shadow:0 0 0 5px rgba(229,86,75,.22); }
  .pc .st-fail .stop-label { color:var(--red); font-weight:700; }
  @keyframes pulse { 0%,100%{box-shadow:0 0 0 5px rgba(242,169,59,.20);} 50%{box-shadow:0 0 0 9px rgba(242,169,59,.05);} }
  @media (prefers-reduced-motion: reduce){ .pc .st-current .dot{ animation:none; } }
  /* readout */
  .pc .readout { display:flex; flex-wrap:wrap; gap:8px 18px; align-items:center; font-size:12px;
        padding-top:16px; border-top:1px dashed var(--rail); font-family:system-ui,sans-serif; }
  .pc .rd i { color:var(--muted); font-style:normal; margin-right:7px; }
  .pc .lamp { display:inline-flex; align-items:center; gap:7px; }
  .pc .bulb { width:9px; height:9px; border-radius:50%; }
  .pc .lamp-pass .bulb { background:var(--green); box-shadow:0 0 7px var(--green); }
  .pc .lamp-fail .bulb { background:var(--red);   box-shadow:0 0 7px var(--red); }
  .pc .lamp-idle .bulb { background:var(--muted); opacity:.5; }
  .pc .drift-detail { margin-top:12px; font-size:11.5px; color:var(--red);
        background:rgba(229,86,75,.08); border-left:2px solid var(--red); padding:9px 12px; border-radius:0 6px 6px 0; }
  .pc .next { margin-top:16px; font-size:13px; color:var(--text); background:var(--surface-2);
        padding:11px 14px; border-radius:8px; display:flex; gap:10px; align-items:baseline;
        font-family:system-ui,sans-serif; }
  .pc .next-label { color:var(--amber); font-weight:700; font-size:11px; letter-spacing:.04em;
        white-space:nowrap; border-right:1px solid var(--rail); padding-right:10px; }
  .pc .next-text { color:var(--text); }
  .pc .empty { color:var(--muted); font-size:14px; }
  .pc .foot { color:var(--muted); font-size:11px; margin-top:30px; border-top:1px solid var(--rail); padding-top:14px; }
  </style>`;

  const body = cycles.length
    ? `<div class="grid">${cycles.map(renderCycle).join('')}</div>`
    : `<p class="empty">Chưa có cycle nào. Dùng <code>/pinrich-cycle start &lt;mô tả&gt;</code> để mở tuyến đầu tiên.</p>`;

  return `${css}
  <div class="pc">
    <header class="top">
      <h1 class="brand"><span class="sig"></span>pinrich<b>·</b>cycle</h1>
      <span class="sub">${active.length} việc đang chạy · ${cycles.length} tổng cộng — bảng theo dõi tiến độ</span>
    </header>
    ${body}
    <p class="foot">Bảng tự cập nhật theo tiến độ công việc · chỉ hiển thị, không chỉnh sửa gì.</p>
  </div>`;
}

function renderFull(inner, { live = false } = {}) {
  // Ở chế độ --serve, nhúng client SSE: server đẩy "reload" khi state đổi → tab tự nạp lại.
  const liveScript = live
    ? `<script>(function(){var es=new EventSource('/events');es.onmessage=function(){location.reload()};es.onerror=function(){es.close();setTimeout(function(){location.reload()},2000)}})();</script>`
    : '';
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>pinrich-cycle · bảng tín hiệu</title>
<style>*{margin:0;padding:0}body{background:#0E1620}</style>
</head><body>${inner}${liveScript}</body></html>`;
}

// ── Chế độ --serve: HTTP server + watch + auto-reload (real-time) ────
async function serve(port) {
  const http = await import('node:http');
  const clients = new Set();

  const server = http.createServer((req, res) => {
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('retry: 2000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    // GET / → sinh lại trang TƯƠI từ state hiện tại (mỗi request đọc lại file)
    const html = renderFull(renderInner(loadCycles(args.dir)), { live: true });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  // Watch thư mục cycle → có đổi state-*.md / artifacts-*.json thì đẩy reload (debounce).
  let timer;
  try {
    fs.watch(args.dir, (_e, fname) => {
      // Nới filter: bắt cả tên file tạm của atomic-rename (state-x.md.tmp, .state-x.md.swp)
      // và sự kiện fname rỗng (Linux inotify đôi khi không báo tên). Bỏ neo ^...$.
      if (fname && !/(state-.*\.md|artifacts-.*\.json)/.test(fname)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const res of clients) res.write('data: reload\n\n');
      }, 300);
    });
  } catch { /* dir có thể chưa tồn tại */ }

  server.listen(port, () => {
    process.stdout.write(`🚦 Dashboard LIVE: http://localhost:${port}\n   (tự reload khi state đổi · watch ${args.dir} · Ctrl-C để dừng)\n`);
  });
}

// ── Main ────────────────────────────────────────────────────────────
if (args.serve) {
  await serve(args.port);
} else {
  const cycles = loadCycles(args.dir);
  const inner = renderInner(cycles);
  if (args.fragment) {
    process.stdout.write(inner + '\n');
  } else {
    fs.writeFileSync(args.out, renderFull(inner), 'utf8');
    process.stdout.write(`✓ Dashboard: ${args.out}  (${cycles.length} cycle)\nMở: file://${args.out}\n`);
  }
}
