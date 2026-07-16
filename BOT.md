# Vocab Bot — Setup

IELTS vocab cards land in your Telegram every 2 hours during waking hours.
You rate each card (Again / Hard / Good / Easy) and SM-2 schedules the next
review.

Two pieces:

- **GitHub Actions cron** — sends new cards 3×/day. See `bot/run.py`,
  `.github/workflows/send.yml`.
- **Cloudflare Worker webhook** — handles each rating click in real time. See
  `worker/`.

Ratings *must* go through the webhook. `getUpdates` polling does not work for
this bot: Telegram drops unanswered `callback_query` updates within minutes,
well below any reasonable cron interval.

## One-time setup

### 1. Telegram bot

1. DM `@BotFather`, run `/newbot`, save the token.
2. Send any message to the new bot, then:
   ```
   curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
   ```
   Copy the integer at `result[0].message.chat.id`.

### 2. GitHub repo

1. Create a private GitHub repo (e.g. `ielts-vocab-bot`). Do not initialize with a README.
2. Push this directory:
   ```
   cd /Users/admin/Documents/vocab
   git init
   git branch -M main
   git remote add origin git@github.com:<you>/<repo>.git
   git add .
   git commit -m "initial: bot + wiki + webhook"
   git push -u origin main
   ```
3. Add Actions secrets (Settings → Secrets and variables → Actions → New repository secret):
   - `TG_BOT_TOKEN`
   - `TG_CHAT_ID`
4. Smoke-test the cron: Actions → `vocab-bot` → Run workflow. You should receive 2 cards.

### 3. Cloudflare Worker (rating webhook)

```
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

Then create a fine-grained GitHub PAT scoped to the wiki repo only, with
**Contents: read & write**, and set the worker secrets:

```
npx wrangler secret put TG_BOT_TOKEN     # same token as the Action
npx wrangler secret put WEBHOOK_SECRET   # any random string
npx wrangler secret put GITHUB_TOKEN     # the fine-grained PAT
npx wrangler secret put TG_CHAT_ID       # optional; restricts /newword to your chat
```

Edit `worker/wrangler.toml` so `GITHUB_REPO = "<you>/<repo>"`.

Finally, point Telegram at the deployed worker URL:

```
curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://vocab-webhook.<you>.workers.dev",
    "secret_token": "<WEBHOOK_SECRET>",
    "allowed_updates": ["callback_query", "message"],
    "drop_pending_updates": true
  }'
```

> `message` is required for the `/newword` command below. If you set the webhook
> before this feature existed, re-run `setWebhook` to add it.

Verify with `getWebhookInfo` — the `url` should be your worker.

## How it runs

- Cron fires every 2 hours from 07:00 to 21:00 Vietnam time (8 runs/day).
  1. Picks up to `BATCH_SIZE` (default 2) due cards from the wiki.
  2. Sends each with rating buttons.
  3. Commits `state/` back to the repo.
- Each button press is delivered by Telegram to the Worker URL within ~hundreds of ms.
  1. Worker answers the callback (spinner dismissed).
  2. Worker reads `state/{reviews,pending}.json` from GitHub.
  3. Applies SM-2, edits the message with the rating footer.
  4. Commits the updated state files via the GitHub git tree API.

## Adding words — `/newword`

Send the bot `/newword <word>` (e.g. `/newword meticulous`) to enrich the wiki:

1. Worker looks the word up — **Oxford Learner's Dictionaries** first, falling
   back to the free `dictionaryapi.dev` JSON if Oxford is unreachable or has no
   usable entry.
2. It replies with a preview card (definition, IPA, examples) and **Add /
   Cancel** buttons. Nothing is written yet.
3. On **Add**, it commits the entry to `wiki/letter-<x>.md` (by first letter,
   creating the file if needed), appends to `wiki/log.md`, and — only for a
   brand-new letter file — adds a line to `wiki/index.md`.

The generated entry uses the exact format `bot/parser.py` expects, so the next
cron run can schedule it like any other card. A word already present in its
letter file is rejected before lookup. If `TG_CHAT_ID` is set as a worker
secret, only messages from that chat are honored.

> **Oxford note:** Oxford uses bot protection. It works from a browser but may
> return 403 to Cloudflare Workers' datacenter IPs — in that case every lookup
> silently falls back to `dictionaryapi.dev`. Check the worker logs
> (`npx wrangler tail`) to see which source served a lookup.

## Tuning

- **Cards per run** — repo variable `BATCH_SIZE` or edit `bot/run.py`.
- **Schedule** — edit the `cron:` lines in `.github/workflows/send.yml`. Times are UTC.
- **Worker code** — see `worker/`. `src/sr.ts` is a port of `bot/sr.py`; keep them in sync.

## Files

```
bot/
  parser.py    markdown → entries
  sr.py        SM-2 (Python copy)
  telegram.py  Telegram send wrapper
  run.py       cron entry point (sends only)
worker/
  src/index.ts handler + dispatch (ratings + /newword)
  src/sr.ts    SM-2 (TS port — keep in sync with bot/sr.py)
  src/telegram.ts   send + answer + edit
  src/github.ts     read + atomic commit (state + wiki files)
  src/dictionary.ts word lookup (Oxford + dictionaryapi.dev fallback)
  src/wiki.ts       WordEntry → wiki markdown + preview + commit plan
  wrangler.toml
state/
  reviews.json   per-card SR state (ef, interval, due, reps)
  pending.json   {message_id: card_key} for cards awaiting rating
.github/workflows/send.yml
```

## Local smoke test (cron side only)

```
cd /Users/admin/Documents/vocab
pip install -r requirements.txt
TG_BOT_TOKEN=... TG_CHAT_ID=... python -m bot.run
```

You should see two cards arrive. Tapping a button only does anything if the
webhook is deployed and `setWebhook` is configured.
