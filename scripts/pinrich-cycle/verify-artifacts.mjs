#!/usr/bin/env node
/**
 * verify-artifacts.mjs — drift + content-marker gate cho /pinrich-cycle.
 *
 * Distill từ AIDLC (aidlc-io/aidlc): `verifyRun.ts` + `produces_contains`.
 * Ý tưởng: skill con đánh dấu step "xong" rồi, nhưng giữa các phiên ai đó
 * rebase/sửa tay có thể xoá file hoặc gutted nội dung → state vẫn ghi "done"
 * mà artifact đã trôi. Script này re-check, KHÔNG sửa gì (read-only), exit:
 *
 *   0  = sạch (mọi file tồn tại + mọi marker còn nguyên)
 *   1  = drift (thiếu file hoặc thiếu marker) — cycle phải mở lại step đó
 *   2  = manifest lỗi / không đọc được
 *
 * Manifest: ~/.claude/pinrich-cycle/artifacts-<repo>.json
 *   {
 *     "repo": "estimate-client-sdd",
 *     "root": "/home/grayf/Projects/estimate-client-sdd",
 *     "steps": [
 *       { "step": "BUILD", "agent": "sdd-port-page",
 *         "produces": ["app/owner/page.tsx"],
 *         "produces_contains": ["ja-JP", "data-testid"] }
 *     ]
 *   }
 *
 * produces           = file phải tồn tại (rel theo root, hoặc tuyệt đối).
 * produces_contains  = mỗi marker phải xuất hiện (plain substring) trong ÍT
 *                      NHẤT 1 file produces của step đó (giống gate AIDLC:
 *                      gộp nội dung các file produces làm 1 haystack).
 *
 * Dùng:
 *   node verify-artifacts.mjs <repo>          # đọc artifacts-<repo>.json
 *   node verify-artifacts.mjs --file <path>   # đọc manifest tuỳ ý
 *   node verify-artifacts.mjs <repo> --json   # output JSON cho máy đọc
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const HOME = os.homedir();
const CYCLE_DIR = path.join(HOME, '.claude', 'pinrich-cycle');

function parseArgs(argv) {
  const out = { json: false, repo: undefined, file: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--file') out.file = argv[++i];
    else if (!a.startsWith('-')) out.repo = a;
  }
  return out;
}

function die(code, msg) {
  process.stderr.write(msg + '\n');
  process.exit(code);
}

const args = parseArgs(process.argv.slice(2));
const manifestPath = args.file
  ? path.resolve(args.file)
  : args.repo
    ? path.join(CYCLE_DIR, `artifacts-${args.repo}.json`)
    : undefined;

if (!manifestPath) {
  die(2, 'Cần <repo> hoặc --file <path>. Vd: node verify-artifacts.mjs estimate-client-sdd');
}
if (!fs.existsSync(manifestPath)) {
  die(2, `Không thấy manifest: ${manifestPath}\nTạo file artifacts-<repo>.json (xem header script).`);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (err) {
  die(2, `Manifest JSON lỗi (${manifestPath}): ${err.message}`);
}

const root = manifest.root || process.cwd();
const steps = Array.isArray(manifest.steps) ? manifest.steps : [];
const abs = (rel) => (path.isAbsolute(rel) ? rel : path.join(root, rel));

const drift = [];
let checked = 0;

for (const step of steps) {
  const produces = Array.isArray(step.produces) ? step.produces : [];
  if (produces.length === 0) continue; // chưa produce gì → không có gì để trôi
  checked++;

  const missing = produces.filter((rel) => !fs.existsSync(abs(rel)));

  // Gộp nội dung mọi file produces còn tồn tại → 1 haystack (như gate AIDLC).
  const haystack = produces
    .map((rel) => {
      try {
        return fs.readFileSync(abs(rel), 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');

  const markers = Array.isArray(step.produces_contains) ? step.produces_contains : [];
  const missingMarkers = markers.filter((m) => !haystack.includes(m));

  if (missing.length > 0 || missingMarkers.length > 0) {
    drift.push({
      step: step.step ?? '?',
      agent: step.agent ?? '?',
      missing,
      missingMarkers,
    });
  }
}

const report = { manifest: manifestPath, repo: manifest.repo, ok: drift.length === 0, checked, drift };

if (args.json) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.ok ? 0 : 1);
}

// ── Báo cáo người đọc ───────────────────────────────────────────────
if (report.ok) {
  process.stdout.write(`✓ Sạch — ${checked} step có artifact, không trôi. (${manifest.repo ?? manifestPath})\n`);
  process.exit(0);
}

process.stdout.write(`✗ DRIFT — ${drift.length}/${checked} step đã trôi (${manifest.repo ?? manifestPath}):\n\n`);
for (const d of drift) {
  process.stdout.write(`  [${d.step}] ${d.agent}\n`);
  for (const f of d.missing) process.stdout.write(`    • file mất: ${f}\n`);
  for (const m of d.missingMarkers) process.stdout.write(`    • marker mất: "${m}"\n`);
  process.stdout.write('\n');
}
process.stdout.write('→ Cycle: mở lại đúng step trên (BUILD/BUGFIX), iteration++, đừng done.\n');
process.exit(1);
