/// <reference types="@cloudflare/workers-types" />
import type { CallbackQuery, TgMessage, Update } from "./telegram";
import {
  answerCallback,
  editMessageAppendFooter,
  editMessageWithFooter,
  sendMessage,
} from "./telegram";
import { commitFiles, commitMutation, readRepoFile } from "./github";
import type { Card, Rating } from "./sr";
import { RATINGS, humanizeInterval, newCard, rate } from "./sr";
import { lookupWord } from "./dictionary";
import { buildHtmlPreview, planAddWord, targetLetter, wordExists } from "./wiki";

export interface Env {
  TG_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  TG_CHAT_ID?: string;
}

function isRating(s: string): s is Rating {
  return (RATINGS as readonly string[]).includes(s);
}

async function handleCallback(cb: CallbackQuery, env: Env, _ctx: ExecutionContext): Promise<void> {
  const data = cb.data ?? "";
  if (data.startsWith("nw:")) {
    await handleNewWordCallback(cb, env);
    return;
  }
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

const NEWWORD_RE = /^\/newword(?:@\w+)?(?:\s+(.+))?$/i;
const WORD_RE = /^[a-zA-Z][a-zA-Z '-]*$/;

function authorized(env: Env, chatId: number): boolean {
  return !env.TG_CHAT_ID || String(chatId) === env.TG_CHAT_ID;
}

// Handle a "/newword <word>" message: look the word up and reply with a preview
// card plus Add/Cancel buttons. Nothing is committed until the user confirms.
async function handleNewWordCommand(msg: TgMessage, env: Env): Promise<void> {
  if (!authorized(env, msg.chat.id)) return;

  const m = NEWWORD_RE.exec((msg.text ?? "").trim());
  const word = (m?.[1] ?? "").trim();
  if (!word) {
    await sendMessage(env.TG_BOT_TOKEN, msg.chat.id, "Usage: <code>/newword &lt;word&gt;</code>");
    return;
  }
  if (!WORD_RE.test(word)) {
    await sendMessage(env.TG_BOT_TOKEN, msg.chat.id, `“${word}” doesn't look like a word.`);
    return;
  }

  const letterFile = `wiki/letter-${targetLetter(word)}.md`;
  const existing = await readRepoFile(env.GITHUB_TOKEN, env.GITHUB_REPO, env.GITHUB_BRANCH, letterFile);
  if (existing && wordExists(existing, word)) {
    await sendMessage(env.TG_BOT_TOKEN, msg.chat.id, `“${word}” is already in <code>${letterFile}</code>.`);
    return;
  }

  const entry = await lookupWord(word);
  if (!entry) {
    await sendMessage(
      env.TG_BOT_TOKEN,
      msg.chat.id,
      `Couldn't find a definition with examples for “${word}”. Check the spelling and try again.`,
    );
    return;
  }

  await sendMessage(env.TG_BOT_TOKEN, msg.chat.id, buildHtmlPreview(entry, letterFile), [
    [
      { text: "✅ Add", callback_data: `nw:add:${word}` },
      { text: "❌ Cancel", callback_data: `nw:no:${word}` },
    ],
  ]);
}

// Handle the Add/Cancel buttons from a /newword preview. On Add we re-look-up the
// word (the parsed data isn't carried in callback_data) and commit it to the wiki.
async function handleNewWordCallback(cb: CallbackQuery, env: Env): Promise<void> {
  try { await answerCallback(env.TG_BOT_TOKEN, cb.id); } catch { /* ignore */ }

  const parts = (cb.data ?? "").split(":");
  const action = parts[1] ?? "";
  const word = parts.slice(2).join(":");
  const msg = cb.message;
  const canEdit = msg && typeof msg.text === "string";

  const footer = async (text: string) => {
    if (canEdit) {
      try {
        await editMessageWithFooter(env.TG_BOT_TOKEN, msg!.chat.id, msg!.message_id, msg!.text!, msg!.entities, text);
      } catch (e) {
        console.log(`editMessageWithFooter failed: ${(e as Error).message}`);
      }
    }
  };

  if (action === "no") {
    await footer("\n\n❌ Cancelled");
    return;
  }
  if (action !== "add" || !word) return;

  const entry = await lookupWord(word);
  if (!entry) {
    await footer("\n\n⚠️ Lookup failed on confirm — nothing added");
    return;
  }

  const dateIso = new Date().toISOString().slice(0, 10);
  const plan = planAddWord(entry, dateIso);
  const committed = await commitFiles(
    env.GITHUB_TOKEN,
    env.GITHUB_REPO,
    env.GITHUB_BRANCH,
    plan.paths,
    `wiki: add "${entry.word}" via /newword`,
    plan.mutate,
  );
  await footer(committed ? `\n\n✅ Added to ${plan.letterFile}` : "\n\n⚠️ Already in wiki");
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
    } else if (update.message?.text?.startsWith("/newword")) {
      try {
        await handleNewWordCommand(update.message, env);
      } catch (e) {
        console.log(`handleNewWordCommand error: ${(e as Error).message}`);
      }
    }

    return new Response("ok");
  },
};
