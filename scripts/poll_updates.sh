#!/usr/bin/env bash
# Poll Telegram getUpdates every 10s without ACKing.
# Logs every empty response with a timestamp so we can see how
# often the queue is empty vs. when it actually has clicks.
#
# Usage:
#   TG_BOT_TOKEN=... ./scripts/poll_updates.sh
#   TG_BOT_TOKEN=... ./scripts/poll_updates.sh | tee poll.log
set -euo pipefail

: "${TG_BOT_TOKEN:?Set TG_BOT_TOKEN}"

URL="https://api.telegram.org/bot${TG_BOT_TOKEN}/getUpdates?timeout=0"

while true; do
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  body=$(curl -s --max-time 8 "$URL" || echo '{"ok":false,"result":[]}')
  ok=$(jq -r '.ok' <<<"$body")
  if [ "$ok" != "true" ]; then
    echo "$ts ERROR $(jq -c '{error_code,description}' <<<"$body")"
  else
    count=$(jq '.result | length' <<<"$body")
    if [ "$count" -eq 0 ]; then
      echo "$ts EMPTY"
    else
      summary=$(jq -c '[.result[] | {id: .update_id, type: (keys - ["update_id"] | .[0])}]' <<<"$body")
      echo "$ts COUNT=$count $summary"
    fi
  fi
  sleep 10
done
