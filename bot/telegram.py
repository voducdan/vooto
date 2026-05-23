"""Tiny Telegram Bot API wrapper. Only the methods we need."""
from __future__ import annotations

import os

import requests

API = "https://api.telegram.org"
TIMEOUT = 20


class TelegramError(RuntimeError):
    pass


def _call(token: str, method: str, **params) -> dict:
    url = f"{API}/bot{token}/{method}"
    r = requests.post(url, json=params, timeout=TIMEOUT)
    data = r.json()
    if not data.get("ok"):
        raise TelegramError(f"{method} failed: {data}")
    return data["result"]


def send_card(token: str, chat_id: str, text: str, card_key: str) -> int:
    """Send a vocab card with inline rating buttons. Returns message_id."""
    keyboard = {
        "inline_keyboard": [
            [
                {"text": "Again", "callback_data": f"r:again:{card_key}"},
                {"text": "Hard", "callback_data": f"r:hard:{card_key}"},
                {"text": "Good", "callback_data": f"r:good:{card_key}"},
                {"text": "Easy", "callback_data": f"r:easy:{card_key}"},
            ]
        ]
    }
    result = _call(
        token,
        "sendMessage",
        chat_id=chat_id,
        text=text,
        parse_mode="HTML",
        reply_markup=keyboard,
        disable_web_page_preview=True,
    )
    return result["message_id"]


def get_updates(token: str, offset: int) -> list[dict]:
    return _call(token, "getUpdates", offset=offset, timeout=0, allowed_updates=["callback_query"])


def answer_callback(token: str, callback_id: str, text: str = "") -> None:
    _call(token, "answerCallbackQuery", callback_query_id=callback_id, text=text)


def edit_message(token: str, chat_id: str, message_id: int, text: str) -> None:
    _call(
        token,
        "editMessageText",
        chat_id=chat_id,
        message_id=message_id,
        text=text,
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"missing env var: {name}")
    return v
