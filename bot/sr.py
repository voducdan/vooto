"""SuperMemo-2 spaced repetition.

State per card:
    ef         ease factor, starts at 2.5, clamped to >= 1.3
    interval   days until next review (minutes for the relearning step)
    reps       number of consecutive successful recalls
    due        ISO-8601 UTC timestamp

Ratings:
    "again" (q=0) -> reset reps, re-show in 10 minutes
    "hard"  (q=3) -> small interval bump, EF down
    "good"  (q=4) -> SM-2 standard interval growth
    "easy"  (q=5) -> SM-2 standard * 1.3, EF up
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

RATINGS = ("again", "hard", "good", "easy")


def new_card(now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    return {
        "ef": 2.5,
        "interval": 0.0,
        "reps": 0,
        "due": now.isoformat(),
    }


def rate(card: dict, rating: str, now: datetime | None = None) -> dict:
    if rating not in RATINGS:
        raise ValueError(f"unknown rating: {rating}")
    now = now or datetime.now(timezone.utc)
    ef = float(card.get("ef", 2.5))
    interval = float(card.get("interval", 0.0))
    reps = int(card.get("reps", 0))

    if rating == "again":
        reps = 0
        interval_days = 10.0 / (60 * 24)  # 10 minutes
    else:
        if rating == "hard":
            ef = max(1.3, ef - 0.15)
            interval_days = max(1.0, interval * 1.2) if reps > 0 else 1.0
        elif rating == "good":
            if reps == 0:
                interval_days = 1.0
            elif reps == 1:
                interval_days = 6.0
            else:
                interval_days = interval * ef
        else:  # easy
            ef = ef + 0.15
            if reps == 0:
                interval_days = 1.3
            elif reps == 1:
                interval_days = 6.0 * 1.3
            else:
                interval_days = interval * ef * 1.3
        reps += 1

    due = now + timedelta(days=interval_days)
    return {
        "ef": round(ef, 3),
        "interval": round(interval_days, 4),
        "reps": reps,
        "due": due.isoformat(),
        "last_rating": rating,
        "last_reviewed": now.isoformat(),
    }


def humanize_interval(days: float) -> str:
    if days < 1 / 24:
        return f"{int(days * 24 * 60)}m"
    if days < 1:
        return f"{int(days * 24)}h"
    if days < 30:
        return f"{int(round(days))}d"
    if days < 365:
        return f"{days / 30:.1f}mo"
    return f"{days / 365:.1f}y"
