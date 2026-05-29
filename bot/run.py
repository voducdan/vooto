"""Entry point invoked by the GitHub Actions cron.

Click handling lives in the Cloudflare Worker webhook (see worker/). This
script is only responsible for sending the next batch of due cards.
"""
from __future__ import annotations

import json
import os
import random
from datetime import datetime, timezone
from html import escape
from pathlib import Path

from . import sr, telegram
from .parser import Entry, parse_wiki

BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "2"))
ROOT = Path(__file__).resolve().parent.parent
WIKI_DIR = ROOT / "wiki"
STATE_DIR = ROOT / "state"
REVIEWS_PATH = STATE_DIR / "reviews.json"
PENDING_PATH = STATE_DIR / "pending.json"


def _load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def format_card(entry: Entry) -> str:
    header = [f"<b>{escape(entry.word)}</b>"]
    if entry.pos:
        header.append(f"[{escape(entry.pos)}]")
    if entry.collocation:
        header.append("<i>collocation</i>")
    parts = [" ".join(header)]
    if entry.ipa:
        parts.append(f"<code>{escape(entry.ipa)}</code>")
    parts.append("")
    parts.append(escape(entry.definition))
    if entry.examples:
        parts.append("")
        for ex in entry.examples[:3]:
            parts.append(f"• <i>{escape(ex)}</i>")
    parts.append("")
    parts.append(f"<code>{escape(entry.source_file)}</code>")
    return "\n".join(parts)


def pick_due(
    entries: list[Entry],
    reviews: dict,
    pending: dict,
    now: datetime,
    limit: int,
) -> list[Entry]:
    """Pick up to `limit` cards. Due reviews come first in due-date order.
    Remaining slots are filled by stratified random: pick a topic at random,
    then a random new word from it. Topics are not reused within a batch.
    """
    awaiting = set(pending.values())
    due: list[tuple[str, Entry]] = []
    new_by_topic: dict[str, list[Entry]] = {}
    for entry in entries:
        if entry.key in awaiting:
            continue
        state = reviews.get(entry.key)
        if state is None:
            new_by_topic.setdefault(entry.source_file, []).append(entry)
            continue
        due_at = datetime.fromisoformat(state["due"])
        if due_at <= now:
            due.append((state["due"], entry))

    due.sort(key=lambda t: t[0])
    picked = [e for _, e in due[:limit]]

    topics = [t for t, ws in new_by_topic.items() if ws]
    random.shuffle(topics)
    for topic in topics:
        if len(picked) >= limit:
            break
        picked.append(random.choice(new_by_topic[topic]))
    return picked


def send_due_cards(token: str, chat_id: str, entries: list[Entry]) -> None:
    if not entries:
        print("nothing to send")
        return
    reviews = _load_json(REVIEWS_PATH, {})
    pending = _load_json(PENDING_PATH, {})

    now = datetime.now(timezone.utc)
    picked = pick_due(entries, reviews, pending, now, BATCH_SIZE)
    print(f"sending {len(picked)} card(s)")

    for entry in picked:
        text = format_card(entry)
        message_id = telegram.send_card(token, chat_id, text, entry.key)
        pending[str(message_id)] = entry.key
        if entry.key not in reviews:
            reviews[entry.key] = sr.new_card(now)
        print(f"  sent {entry.key} (message_id={message_id})")

    _save_json(REVIEWS_PATH, reviews)
    _save_json(PENDING_PATH, pending)


def main() -> None:
    token = telegram.env("TG_BOT_TOKEN")
    chat_id = telegram.env("TG_CHAT_ID")
    entries = parse_wiki(WIKI_DIR)
    print(f"wiki: {len(entries)} entries")
    send_due_cards(token, chat_id, entries)


if __name__ == "__main__":
    main()
