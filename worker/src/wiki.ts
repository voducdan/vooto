// Turn a looked-up WordEntry into wiki markdown and a Telegram preview, and plan
// the commit that files it under wiki/letter-<x>.md (creating that file if needed),
// appends to wiki/log.md, and — only for a brand-new letter file — updates
// wiki/index.md. The generated entry matches the format bot/parser.py expects.

import type { WordEntry } from "./dictionary";
import type { FilesMutator } from "./github";

const LOG_PATH = "wiki/log.md";
const INDEX_PATH = "wiki/index.md";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// First alphabetic character; falls back to "a" for the odd non-letter headword.
export function targetLetter(word: string): string {
  const c = word.trim().charAt(0).toLowerCase();
  return /[a-z]/.test(c) ? c : "a";
}

// Strip POS marker, collocation marker, and IPA tail from a heading to recover
// just the headword — mirrors _parse_heading in bot/parser.py.
function headingWord(raw: string): string {
  return raw
    .replace(/[—-]\s*(?:\/[^/\s]+\/\s*)+\s*$/, "")
    .replace(/\*\[[^\]]+\]\*/g, "")
    .replace(/\*\(collocation\)\*/gi, "")
    .trim();
}

export function wordExists(content: string, word: string): boolean {
  const target = slug(word);
  const re = /^###\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (slug(headingWord(m[1])) === target) return true;
  }
  return false;
}

export function buildMarkdownEntry(entry: WordEntry): string {
  let heading = `### ${capitalize(entry.word)}`;
  if (entry.pos) heading += ` *[${capitalize(entry.pos)}]*`;
  if (entry.ipa) heading += ` — ${entry.ipa}`;

  const lines = [heading, "", `**Definition**: ${entry.definition}`, ""];
  for (const ex of entry.examples) lines.push(`- ${ex}`);
  return lines.join("\n");
}

export function buildHtmlPreview(entry: WordEntry, letterFile: string): string {
  const header = [`<b>${escapeHtml(capitalize(entry.word))}</b>`];
  if (entry.pos) header.push(`[${escapeHtml(capitalize(entry.pos))}]`);
  const parts = [header.join(" ")];
  if (entry.ipa) parts.push(`<code>${escapeHtml(entry.ipa)}</code>`);
  parts.push("", escapeHtml(entry.definition), "");
  for (const ex of entry.examples) parts.push(`• <i>${escapeHtml(ex)}</i>`);
  parts.push("", `<i>source: ${escapeHtml(entry.source)} → ${escapeHtml(letterFile)}</i>`);
  return parts.join("\n");
}

function appendEntryToFile(content: string, entryMd: string): string {
  return `${content.replace(/\s+$/, "")}\n\n${entryMd}\n`;
}

function newLetterFileContent(letter: string, entryMd: string, dateIso: string): string {
  const L = letter.toUpperCase();
  return [
    `# Letter ${L} (Alphabetical Vocabulary)`,
    "",
    `**Summary**: Alphabetical vocabulary entries starting with '${L}', added via the /newword bot command.`,
    "",
    "**Sources**: Oxford Learner's Dictionaries; dictionaryapi.dev (fallback)",
    "",
    `**Last updated**: ${dateIso}`,
    "",
    "---",
    "",
    "## Entries",
    "",
    entryMd,
    "",
  ].join("\n");
}

function appendLog(content: string, entry: WordEntry, letter: string, dateIso: string): string {
  const section = [
    "",
    `## [${dateIso}] newword | ${entry.word}`,
    "",
    `Added [[letter-${letter}]] entry "${entry.word}" via /newword (source: ${entry.source}).`,
    "",
  ].join("\n");
  return `${content.replace(/\s+$/, "")}\n${section}`;
}

// Insert a "- [[letter-x]] ..." bullet into the alphabetical block, keeping it
// sorted. No-op if a bullet for this letter is already present.
function indexAddLetter(content: string, letter: string): string {
  const bullet = `- [[letter-${letter}]] — Letter ${letter.toUpperCase()} (added via /newword)`;
  const lines = content.split("\n");
  const isLetter = (l: string) => /^- \[\[letter-[a-z]\]\]/.test(l);
  const letterOf = (l: string) => l.match(/^- \[\[letter-([a-z])\]\]/)?.[1] ?? "";
  if (lines.some((l) => letterOf(l) === letter)) return content;

  const first = lines.findIndex(isLetter);
  if (first === -1) return content; // block not found; leave index untouched
  let insertAt = first;
  while (insertAt < lines.length && isLetter(lines[insertAt]) && letterOf(lines[insertAt]) < letter) {
    insertAt++;
  }
  lines.splice(insertAt, 0, bullet);
  return lines.join("\n");
}

// Plan the commit for adding `entry`. Returns the paths to read and a mutator for
// commitFiles. The mutator returns null (abort) if the word already exists — a
// last-line guard against a concurrent add between preview and confirm.
export function planAddWord(
  entry: WordEntry,
  dateIso: string,
): { paths: string[]; letterFile: string; mutate: FilesMutator } {
  const letter = targetLetter(entry.word);
  const letterPath = `wiki/letter-${letter}.md`;
  const entryMd = buildMarkdownEntry(entry);

  const mutate: FilesMutator = (files) => {
    const existing = files[letterPath];
    if (existing != null && wordExists(existing, entry.word)) return null;

    const out: Record<string, string> = {};
    const isNew = existing == null;
    out[letterPath] = isNew
      ? newLetterFileContent(letter, entryMd, dateIso)
      : appendEntryToFile(existing, entryMd);

    const log = files[LOG_PATH];
    if (log != null) out[LOG_PATH] = appendLog(log, entry, letter, dateIso);

    const index = files[INDEX_PATH];
    if (isNew && index != null) out[INDEX_PATH] = indexAddLetter(index, letter);

    return out;
  };

  return { paths: [letterPath, LOG_PATH, INDEX_PATH], letterFile: letterPath, mutate };
}
