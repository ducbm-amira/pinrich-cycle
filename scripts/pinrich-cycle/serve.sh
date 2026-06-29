#!/usr/bin/env bash
# pinrich-cycle dashboard live server — idempotent launcher.
# Gọi bao nhiêu lần cũng chỉ giữ ĐÚNG 1 server trên PORT. Dùng:
#   serve.sh            # đảm bảo server đang chạy (không bật trùng) — mặc định
#   serve.sh status     # đang chạy không + URL
#   serve.sh stop       # dừng
#   serve.sh restart    # dừng rồi bật lại
# Auto-start: thêm dòng này vào ~/.bashrc (script tự cài giúp nếu chạy `serve.sh install`):
#   [ -x ~/.claude/pinrich-cycle/serve.sh ] && ~/.claude/pinrich-cycle/serve.sh >/dev/null 2>&1
set -uo pipefail

DIR="$HOME/.claude/pinrich-cycle"
SCRIPT="$DIR/dashboard.mjs"
PORT="${PINRICH_DASH_PORT:-4123}"
PIDFILE="$DIR/.serve.pid"
LOG="$DIR/.serve.log"
URL="http://localhost:$PORT"

is_up() {
  # 1) PID file trỏ process còn sống?
  if [ -f "$PIDFILE" ]; then
    local pid; pid="$(cat "$PIDFILE" 2>/dev/null)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then return 0; fi
  fi
  # 2) hoặc có ai đang lắng nghe trên PORT (server bật bằng cách khác)?
  if command -v curl >/dev/null 2>&1; then
    curl -s -o /dev/null -m 2 "$URL/" && return 0
  fi
  return 1
}

start() {
  if is_up; then
    echo "✓ Dashboard đã chạy sẵn: $URL"
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "✗ Không có 'node' trong PATH — không bật được." >&2; return 1
  fi
  if [ ! -f "$SCRIPT" ]; then
    echo "✗ Không thấy $SCRIPT" >&2; return 1
  fi
  # Detach hẳn để sống qua việc đóng terminal.
  nohup node "$SCRIPT" --serve --port "$PORT" >"$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  sleep 1
  if is_up; then
    echo "🚦 Dashboard LIVE: $URL  (pid $(cat "$PIDFILE"), log: $LOG)"
  else
    echo "✗ Bật thất bại — xem log: $LOG" >&2; tail -5 "$LOG" 2>/dev/null; return 1
  fi
}

stop() {
  local pid=""
  [ -f "$PIDFILE" ] && pid="$(cat "$PIDFILE" 2>/dev/null)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null; echo "đã dừng (pid $pid)"
  else
    pkill -f "dashboard.mjs --serve --port $PORT" 2>/dev/null && echo "đã dừng (pkill)" || echo "không có server nào đang chạy"
  fi
  rm -f "$PIDFILE"
}

case "${1:-start}" in
  start|"") start ;;
  stop)     stop ;;
  restart)  stop; sleep 1; start ;;
  status)
    if is_up; then echo "✓ đang chạy: $URL"; else echo "✗ không chạy"; fi ;;
  install)
    LINE='[ -x ~/.claude/pinrich-cycle/serve.sh ] && ~/.claude/pinrich-cycle/serve.sh >/dev/null 2>&1'
    if grep -qF "pinrich-cycle/serve.sh" "$HOME/.bashrc" 2>/dev/null; then
      echo "đã cài trong ~/.bashrc rồi"
    else
      printf '\n# pinrich-cycle dashboard auto-start\n%s\n' "$LINE" >> "$HOME/.bashrc"
      echo "✓ đã thêm auto-start vào ~/.bashrc (mở terminal mới là tự bật)"
    fi ;;
  *) echo "dùng: serve.sh [start|stop|restart|status|install]" >&2; exit 1 ;;
esac
