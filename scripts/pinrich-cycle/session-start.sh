#!/usr/bin/env bash
# pinrich-cycle SessionStart hook.
# Bơm state các cycle Pinrich đang chạy vào context mỗi phiên (additionalContext),
# để state không bao giờ "thiu" — không phụ thuộc model nhớ gọi /pinrich-cycle.
# Quiet by design: không có cycle / ngoài cây Projects => không in gì.
set -euo pipefail

STATE_DIR="$HOME/.claude/pinrich-cycle"

# cwd lấy từ payload stdin của hook, fallback $PWD
payload="$(cat 2>/dev/null || true)"
cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null || true)"
[ -z "$cwd" ] && cwd="$PWD"

# Gate: chỉ chạy trong cây ~/Projects (nơi 4 repo Pinrich sống)
case "$cwd" in
  *"/Projects"*) ;;
  *) exit 0 ;;
esac

shopt -s nullglob
files=("$STATE_DIR"/state-*.md)
[ ${#files[@]} -eq 0 ] && exit 0

field() { grep -m1 "^- $2:" "$1" 2>/dev/null | sed "s/^- $2:[[:space:]]*//"; }

active=""
for f in "${files[@]}"; do
  step="$(field "$f" step)"
  [ "$step" = "DONE" ] && continue
  repo="$(field "$f" repo)"; task="$(field "$f" task)"
  nexta="$(field "$f" next_action)"; track="$(field "$f" track)"; iter="$(field "$f" iteration)"
  active+="- [${repo:-?}] ${task:-?} — track=${track:-?}, step=${step:-?}, vòng QA ${iter:-1}; next: ${nexta:-?}"$'\n'
done

[ -z "$active" ] && exit 0

# Regen dashboard mỗi phiên để giao diện luôn tươi (live-sync nhẹ).
# node/script có thể vắng → tuyệt đối không làm chết hook.
dash_link=""
if command -v node >/dev/null 2>&1 && [ -f "$STATE_DIR/dashboard.mjs" ]; then
  if node "$STATE_DIR/dashboard.mjs" >/dev/null 2>&1; then
    dash_link="🚦 Dashboard tươi: file://$STATE_DIR/dashboard.html (mở xem bảng tín hiệu cycle)"$'\n'
  fi
fi

msg="⏳ Có Pinrich cycle đang chạy (state: $STATE_DIR/state-<repo>.md). Chạy /pinrich-cycle status để tiếp; LUÔN reconcile với git trước khi tin state:
${active}${dash_link}"

jq -n --arg ctx "$msg" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx}}'
