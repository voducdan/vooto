# vocab-webhook

Cloudflare Worker that handles Telegram rating clicks for the vocab bot.

## What it does

Telegram pushes `callback_query` updates here when the user taps Again / Hard / Good / Easy.
The worker:

1. Answers the callback (dismisses the spinner).
2. Reads `state/reviews.json` + `state/pending.json` from the GitHub repo.
3. Applies SM-2 (`src/sr.ts` — ported from `bot/sr.py`).
4. Commits both files back via the GitHub git tree API (atomic, retries on conflict).
5. Edits the original Telegram message with a `✅ rating — next in N` footer.

The GitHub Actions cron is now only responsible for *sending* new cards.

## Deploy

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

## Secrets

Set via `wrangler secret put <NAME>`:

| Name              | What                                                                                |
| ----------------- | ----------------------------------------------------------------------------------- |
| `TG_BOT_TOKEN`    | Telegram bot token (same one used by the GitHub Action).                            |
| `WEBHOOK_SECRET`  | Any random string. Telegram sends it in `X-Telegram-Bot-Api-Secret-Token` per call. |
| `GITHUB_TOKEN`    | Fine-grained PAT with **Contents: read & write** on the wiki repo only.             |

Public vars (in `wrangler.toml`):

| Name            | What                                              |
| --------------- | ------------------------------------------------- |
| `GITHUB_REPO`   | `owner/repo` (e.g. `voducdan/vooto`)              |
| `GITHUB_BRANCH` | Branch to commit state to (default `main`)        |

## Point Telegram at the worker

After `wrangler deploy` prints the worker URL (e.g. `https://vocab-webhook.<you>.workers.dev`):

```bash
curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://vocab-webhook.<you>.workers.dev",
    "secret_token": "<WEBHOOK_SECRET>",
    "allowed_updates": ["callback_query"],
    "drop_pending_updates": true
  }'
```

Verify:

```bash
curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/getWebhookInfo"
```

`url` should be your worker URL and `pending_update_count` should drop to 0 as clicks
flow through the webhook.

## Local dev

```bash
npx wrangler dev    # starts a local server
```

Use [ngrok](https://ngrok.com) or `cloudflared tunnel` to expose it to Telegram if you
want to test with real updates; otherwise POST a synthetic update payload yourself.

## Race conditions

Two clicks in flight at once both read `reviews.json` at the same parent SHA, then race
to commit. The second one's ref update fails with 422; `commitMutation` in `src/github.ts`
re-reads the latest commit and re-applies — up to 4 attempts. Same story when the
GitHub Actions cron commits in parallel.
