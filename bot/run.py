"""Entry point invoked by the GitHub Actions cron.

Flow per run:
    1. Drain any pending callback_query updates → apply SM-2 → edit messages.
    2. Pick due cards (limit BATCH_SIZE) from the wiki.
    3. Send each card with rating buttons; remember message_id → card key.
    4. Persist state.
"""
from __future__ import annotations

import json
import os
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
OFFSET_PATH = STATE_DIR / "tg_offset.txt"


def _load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _load_offset() -> int:
    if not OFFSET_PATH.exists():
        return 0
    raw = OFFSET_PATH.read_text(encoding="utf-8").strip()
    return int(raw) if raw else 0


def _save_offset(offset: int) -> None:
    OFFSET_PATH.parent.mkdir(parents=True, exist_ok=True)
    OFFSET_PATH.write_text(f"{offset}\n", encoding="utf-8")


def format_card(entry: Entry) -> str:
    tag = f"[{entry.pos}]" if entry.pos else ""
    if entry.collocation:
        tag = f"{tag} <i>collocation</i>".strip()
    parts = [f"<b>{escape(entry.word)}</b> {escape(tag)}".strip()]
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


def drain_ratings(token: str, chat_id: str, entries_by_key: dict[str, Entry]) -> None:
    offset = _load_offset()
    updates = telegram.get_updates(token, offset)
    if not updates:
        return

    reviews = _load_json(REVIEWS_PATH, {})
    pending = _load_json(PENDING_PATH, {})
    last_id = offset - 1

    for upd in updates:
        last_id = max(last_id, upd["update_id"])
        cb = upd.get("callback_query")
        if not cb:
            continue
        data = cb.get("data", "")
        if not data.startswith("r:"):
            telegram.answer_callback(token, cb["id"])
            continue
        try:
            _, rating, key = data.split(":", 2)
        except ValueError:
            telegram.answer_callback(token, cb["id"])
            continue

        msg = cb.get("message") or {}
        message_id = msg.get("message_id")

        if key not in entries_by_key:
            telegram.answer_callback(token, cb["id"], "Card not found in wiki")
            pending.pop(str(message_id), None)
            continue

        prior = reviews.get(key) or sr.new_card()
        updated = sr.rate(prior, rating)
        reviews[key] = updated

        next_in = sr.humanize_interval(updated["interval"])
        telegram.answer_callback(token, cb["id"], f"{rating} → next in {next_in}")

        if message_id is not None:
            try:
                entry = entries_by_key[key]
                footer = f"\n\n✅ <b>{escape(rating)}</b> — next in {escape(next_in)}"
                telegram.edit_message(token, chat_id, message_id, format_card(entry) + footer)
            except telegram.TelegramError:
                pass
            pending.pop(str(message_id), None)

    _save_json(REVIEWS_PATH, reviews)
    _save_json(PENDING_PATH, pending)
    _save_offset(last_id + 1)


def pick_due(
    entries: list[Entry],
    reviews: dict,
    pending: dict,
    now: datetime,
    limit: int,
) -> list[Entry]:
    awaiting = set(pending.values())  # card keys already sent, not yet rated
    due: list[tuple[str, Entry]] = []
    new_entries: list[Entry] = []
    for entry in entries:
        if entry.key in awaiting:
            continue
        state = reviews.get(entry.key)
        if state is None:
            new_entries.append(entry)
            continue
        due_at = datetime.fromisoformat(state["due"])
        if due_at <= now:
            due.append((state["due"], entry))

    due.sort(key=lambda t: t[0])
    picked = [e for _, e in due[:limit]]
    if len(picked) < limit:
        picked.extend(new_entries[: limit - len(picked)])
    return picked


def send_due_cards(token: str, chat_id: str, entries: list[Entry]) -> None:
    if not entries:
        print("nothing to send")
        return
    reviews = _load_json(REVIEWS_PATH, {})
    pending = _load_json(PENDING_PATH, {})

    now = datetime.now(timezone.utc)
    by_key = {e.key: e for e in entries}
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
    _ = by_key  # silence unused warning; by_key reserved for future re-format on edit


def main() -> None:
    token = telegram.env("TG_BOT_TOKEN")
    chat_id = telegram.env("TG_CHAT_ID")
    entries = parse_wiki(WIKI_DIR)
    print(f"wiki: {len(entries)} entries")
    entries_by_key = {e.key: e for e in entries}

    drain_ratings(token, chat_id, entries_by_key)
    send_due_cards(token, chat_id, entries)


if __name__ == "__main__":
    main()
