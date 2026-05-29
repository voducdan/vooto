/// <reference types="@cloudflare/workers-types" />
import type { CallbackQuery, Update } from "./telegram";
import { answerCallback, editMessageAppendFooter } from "./telegram";
import { commitMutation } from "./github";
import type { Card, Rating } from "./sr";
import { RATINGS, humanizeInterval, newCard, rate } from "./sr";

export interface Env {
  TG_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
}

function isRating(s: string): s is Rating {
  return (RATINGS as readonly string[]).includes(s);
}

async function handleCallback(cb: CallbackQuery, env: Env, _ctx: ExecutionContext): Promise<void> {
  const data = cb.data ?? "";
  const parts = data.split(":");
  const ratingStr = parts[1] ?? "";
  const key = parts.slice(2).join(":");

  if (!data.startsWith("r:") || parts.length < 3 || !isRating(ratingStr)) {
    try { await answerCallback(env.TG_BOT_TOKEN, cb.id); } catch { /* ignore */ }
    return;
  }
  const rating: Rating = ratingStr;

  // Dismiss the spinner immediately; we'll edit the message text once committed.
  try { await answerCallback(env.TG_BOT_TOKEN, cb.id); } catch (e) {
    console.log(`answerCallback (early) skipped: ${(e as Error).message}`);
  }

  const now = new Date();
  let computed: Card | undefined;

  await commitMutation(
    env.GITHUB_TOKEN,
    env.GITHUB_REPO,
    env.GITHUB_BRANCH,
    `state: rate ${key}=${rating}`,
    (state) => {
      const prior = (state.reviews[key] as Partial<Card> | undefined) ?? newCard(now);
      const updated = rate(prior, rating, now);
      computed = updated;
      const reviews = { ...state.reviews, [key]: updated };
      const pending = { ...state.pending };
      const msg = cb.message;
      if (msg) delete pending[String(msg.message_id)];
      return { reviews, pending };
    },
  );

  const nextIn = humanizeInterval(computed!.interval);
  const msg = cb.message;
  if (msg && typeof msg.text === "string") {
    try {
      await editMessageAppendFooter(
        env.TG_BOT_TOKEN,
        msg.chat.id,
        msg.message_id,
        msg.text,
        msg.entities,
        rating,
        nextIn,
      );
    } catch (e) {
      console.log(`editMessage failed: ${(e as Error).message}`);
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    if (request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }

    let update: Update;
    try {
      update = (await request.json()) as Update;
    } catch {
      return new Response("bad json", { status: 400 });
    }

    if (update.callback_query) {
      try {
        await handleCallback(update.callback_query, env, ctx);
      } catch (e) {
        console.log(`handleCallback error: ${(e as Error).message}`);
        // Return 200 below regardless so Telegram doesn't retry-storm.
      }
    }

    return new Response("ok");
  },
};
