// Minimal Telegram Bot API client for the webhook.

export interface MessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: unknown;
  language?: string;
  custom_emoji_id?: string;
}

export interface TgMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  entities?: MessageEntity[];
}

export interface CallbackQuery {
  id: string;
  data?: string;
  message?: TgMessage;
}

export interface Update {
  update_id: number;
  callback_query?: CallbackQuery;
  message?: TgMessage;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

const API = "https://api.telegram.org";

async function call(token: string, method: string, body: unknown): Promise<unknown> {
  const r = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) throw new Error(`${method} failed: ${data.description ?? "unknown"}`);
  return data.result;
}

export async function answerCallback(token: string, callbackId: string, text = ""): Promise<void> {
  await call(token, "answerCallbackQuery", { callback_query_id: callbackId, text });
}

// Counts UTF-16 code units (Telegram offsets are in UTF-16, same as JS string length).
function utf16Length(s: string): number {
  return s.length;
}

// Append a "✅ <rating> — next in <next_in>" footer to the original message text,
// preserving the original message's MessageEntity formatting.
export async function editMessageAppendFooter(
  token: string,
  chatId: number,
  messageId: number,
  originalText: string,
  originalEntities: MessageEntity[] | undefined,
  rating: string,
  nextIn: string,
): Promise<void> {
  const prefix = "\n\n✅ ";
  const between = " — next in ";
  const footerText = `${prefix}${rating}${between}${nextIn}`;
  const newText = originalText + footerText;

  const baseLen = utf16Length(originalText);
  const ratingOffset = baseLen + utf16Length(prefix);

  const footerEntities: MessageEntity[] = [
    { type: "bold", offset: ratingOffset, length: utf16Length(rating) },
  ];
  const entities = [...(originalEntities ?? []), ...footerEntities];

  await call(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: newText,
    entities,
    disable_web_page_preview: true,
  });
}

// Send an HTML message, optionally with an inline keyboard. Returns message_id.
export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<number> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  const res = (await call(token, "sendMessage", body)) as { message_id: number };
  return res.message_id;
}

// Append a plain-text footer to a message, preserving its formatting entities and
// dropping the inline keyboard (editMessageText without reply_markup removes it).
export async function editMessageWithFooter(
  token: string,
  chatId: number,
  messageId: number,
  originalText: string,
  originalEntities: MessageEntity[] | undefined,
  footer: string,
): Promise<void> {
  await call(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: originalText + footer,
    entities: originalEntities ?? [],
    disable_web_page_preview: true,
  });
}

// Remove inline keyboard (used as a fallback when we can't edit text — e.g. text-less media).
export async function clearReplyMarkup(token: string, chatId: number, messageId: number): Promise<void> {
  await call(token, "editMessageReplyMarkup", { chat_id: chatId, message_id: messageId });
}
