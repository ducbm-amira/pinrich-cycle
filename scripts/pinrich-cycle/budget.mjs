#!/usr/bin/env node
/**
 * budget.mjs — trần chi phí token cho /pinrich-cycle.
 *
 * Distill ý `checkBudget` của AIDLC (aidlc-io/aidlc), nhưng lấy SỐ THẬT:
 * AIDLC đọc costUsd vì nó tự spawn từng step; cycle của bạn là Claude chạy
 * hội thoại, không có cost per-step. Nên ta tính cost từ token usage trong
 * transcript Claude Code của repo đó: ~/.claude/projects/-home-grayf-Projects-<repo>/*.jsonl
 *
 * LƯU Ý trung thực: con số này là cost của MỌI session Claude Code trong repo
 * đó (kể cả việc ngoài cycle), không phải cost riêng 1 task. Dùng --since
 * <ISO> để chỉ tính từ lúc cycle bắt đầu (lọc theo timestamp dòng transcript).
 *
 * Trần: đặt field `cost_budget_usd: <số>` trong state-<repo>.md (tùy chọn).
 * Verdict (giống AIDLC):
 *   ok      = dưới trần (hoặc không đặt trần)
 *   exceeded= vượt trần → cycle nên cảnh báo/treo, đừng đốt tiếp mù
 *
 * Dùng:
 *   node budget.mjs <repo>                 # tổng cost repo đó
 *   node budget.mjs <repo> --since <ISO>   # chỉ tính từ mốc thời gian
 *   node budget.mjs <repo> --limit 5.00    # trần 5 USD (override field state)
 *   node budget.mjs <repo> --json
 *   node budget.mjs --dir <projects-dir> --project <name>   # test/khác máy
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';

const HOME = os.homedir();

// Giá USD / 1 token (nguồn: skill claude-api, 2026-06). cache_read = 0.1× input;
// cache_write 5m = 1.25× input; 1h = 2× input.
const PRICING = {
  'claude-fable-5':   { in: 10e-6, out: 50e-6 },
  'claude-opus-4-8':  { in: 5e-6,  out: 25e-6 },
  'claude-opus-4-7':  { in: 5e-6,  out: 25e-6 },
  'claude-opus-4-6':  { in: 5e-6,  out: 25e-6 },
  'claude-sonnet-4-6':{ in: 3e-6,  out: 15e-6 },
  'claude-haiku-4-5': { in: 1e-6,  out: 5e-6 },
};
function priceFor(model) {
  if (!model) return PRICING['claude-opus-4-8'];
  // khớp prefix (model id có thể kèm hậu tố như [1m])
  const key = Object.keys(PRICING).find((k) => model.startsWith(k));
  return PRICING[key] || PRICING['claude-opus-4-8'];
}

function parseArgs(argv) {
  const o = { repo: undefined, since: undefined, limit: undefined, json: false, dir: undefined, project: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--since') o.since = argv[++i];
    else if (a === '--limit') o.limit = parseFloat(argv[++i]);
    else if (a === '--json') o.json = true;
    else if (a === '--dir') o.dir = path.resolve(argv[++i]);
    else if (a === '--project') o.project = argv[++i];
    else if (!a.startsWith('-')) o.repo = a;
  }
  return o;
}
const args = parseArgs(process.argv.slice(2));

const PROJECTS = args.dir || path.join(HOME, '.claude', 'projects');
const projectName = args.project || (args.repo ? `-home-grayf-Projects-${args.repo}` : undefined);
if (!projectName) {
  process.stderr.write('Cần <repo> hoặc --project. Vd: node budget.mjs pinrich-satei\n');
  process.exit(2);
}
const projectDir = path.join(PROJECTS, projectName);
if (!fs.existsSync(projectDir)) {
  process.stderr.write(`Không thấy transcript dir: ${projectDir}\n(repo chưa có session Claude Code nào?)\n`);
  process.exit(2);
}

// Trần: --limit > field cost_budget_usd trong state file
let limit = args.limit;
if (limit === undefined && args.repo) {
  const stateFile = path.join(HOME, '.claude', 'pinrich-cycle', `state-${args.repo}.md`);
  try {
    const m = fs.readFileSync(stateFile, 'utf8').match(/^\s*-\s*cost_budget_usd:\s*([\d.]+)/m);
    if (m) limit = parseFloat(m[1]);
  } catch { /* không có state file */ }
}

const sinceMs = args.since ? Date.parse(args.since) : null;

async function sumFile(file) {
  const acc = { in: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 0, out: 0, cost: 0, msgs: 0 };
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const u = o?.message?.usage;
    if (!u) continue;
    if (sinceMs && o.timestamp && Date.parse(o.timestamp) < sinceMs) continue;
    const p = priceFor(o?.message?.model);
    const inp = u.input_tokens || 0;
    const out = u.output_tokens || 0;
    const cr = u.cache_read_input_tokens || 0;
    const c5 = u.cache_creation?.ephemeral_5m_input_tokens ?? 0;
    const c1 = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    // nếu không tách được, dùng tổng cache_creation_input_tokens như 5m
    const cTotal = u.cache_creation_input_tokens || 0;
    const c5eff = (c5 || c1) ? c5 : cTotal;
    acc.in += inp; acc.out += out; acc.cacheRead += cr;
    acc.cacheCreate5m += c5eff; acc.cacheCreate1h += c1;
    acc.cost += inp * p.in + out * p.out + cr * (p.in * 0.1) + c5eff * (p.in * 1.25) + c1 * (p.in * 2);
    acc.msgs++;
  }
  return acc;
}

const files = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
const total = { in: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 0, out: 0, cost: 0, msgs: 0 };
for (const f of files) {
  const a = await sumFile(path.join(projectDir, f));
  for (const k of Object.keys(total)) total[k] += a[k];
}

const spent = total.cost;
const verdict = limit !== undefined
  ? (spent > limit ? { ok: false, exceeded: true } : { ok: true })
  : { ok: true, noLimit: true };

const report = {
  repo: args.repo || projectName,
  spent_usd: Math.round(spent * 10000) / 10000,
  limit_usd: limit ?? null,
  ...verdict,
  tokens: { input: total.in, output: total.out, cache_read: total.cacheRead, cache_write: total.cacheCreate5m + total.cacheCreate1h },
  assistant_msgs: total.msgs,
  since: args.since || null,
};

if (args.json) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(verdict.ok ? 0 : 1);
}

const fmt = (n) => '$' + n.toFixed(4);
const bar = limit ? (() => {
  const pct = Math.min(1, spent / limit);
  const w = 24, fill = Math.round(pct * w);
  return '[' + '█'.repeat(fill) + '·'.repeat(w - fill) + `] ${Math.round(pct * 100)}%`;
})() : '';

process.stdout.write(`💰 ${report.repo}: ${fmt(spent)} đã tiêu${limit ? ` / trần ${fmt(limit)} ${bar}` : ' (chưa đặt trần)'}\n`);
process.stdout.write(`   token: in ${total.in.toLocaleString('en-US')} · out ${total.out.toLocaleString('en-US')} · cache-read ${total.cacheRead.toLocaleString('en-US')} · cache-write ${(total.cacheCreate5m + total.cacheCreate1h).toLocaleString('en-US')} · ${total.msgs} lượt assistant\n`);
if (args.since) process.stdout.write(`   (từ ${args.since})\n`);
if (limit !== undefined && !verdict.ok) {
  process.stdout.write(`\n⛔ VƯỢT TRẦN — cycle nên dừng đốt token: tổng kết, hỏi user trước khi chạy tiếp.\n`);
  process.exit(1);
}
process.exit(0);
