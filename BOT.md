# Vocab Bot — Setup

A GitHub Actions cron sends IELTS vocab cards to your Telegram three times a day. You rate each card (Again / Hard / Good / Easy); SM-2 schedules the next review.

## One-time setup

1. **Create the Telegram bot.** DM `@BotFather`, run `/newbot`, save the token.
2. **Get your chat_id.** Send any message to the new bot, then:
   ```
   curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
   ```
   Copy the integer at `result[0].message.chat.id`.
3. **Create a private GitHub repo** (e.g. `ielts-vocab-bot`). Do not initialize it with a README.
4. **Push this directory:**
   ```
   cd /Users/admin/Documents/vocab
   git init
   git branch -M main
   git remote add origin git@github.com:<you>/<repo>.git
   git add .
   git commit -m "initial: bot + wiki"
   git push -u origin main
   ```
5. **Add secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
   - `TG_BOT_TOKEN` — the bot token from step 1
   - `TG_CHAT_ID` — the chat_id from step 2
6. **Test it.** Repo → Actions → `vocab-bot` → Run workflow. You should receive 2 cards in Telegram.

## How it runs

- Cron fires at 08:00, 13:00, 19:00 Vietnam time.
- Each run:
  1. Drains any button presses you made since the last run (applies SM-2, edits the message with the next-due date).
  2. Picks up to `BATCH_SIZE` (default 2) due cards from the wiki, sends them with rating buttons.
  3. Commits `state/` back to the repo so the next run sees updated SR data.

## Tuning

- **Cards per run** — set repo variable `BATCH_SIZE` or edit `bot/run.py`.
- **Schedule** — edit the `cron:` lines in `.github/workflows/send.yml`. Times are UTC; current values are 08/13/19 Vietnam (UTC+7).
- **Faster rating feedback** — ratings are only processed on the next scheduled run (≤6h delay). To process them sooner, add a separate workflow with a more frequent cron that calls `python -m bot.run` (the bot is idempotent — if no cards are due it does nothing).

## Files

```
bot/
  parser.py   markdown → entries
  sr.py       SM-2 algorithm
  telegram.py Telegram Bot API wrapper
  run.py      entry point
state/
  reviews.json   per-card SR state (ef, interval, due, reps)
  pending.json   {message_id: card_key} for cards awaiting rating
  tg_offset.txt  last seen update_id (for getUpdates)
.github/workflows/send.yml
```

## Local smoke test

```
cd /Users/admin/Documents/vocab
pip install -r requirements.txt
TG_BOT_TOKEN=... TG_CHAT_ID=... python -m bot.run
```

You should see two cards arrive. Tap a button. Re-run; the bot edits the original message with the new interval and `state/reviews.json` gets a new entry.
