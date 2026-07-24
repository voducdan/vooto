// Word lookup. Tries Oxford Learner's Dictionaries first (HTML scrape); if that
// fails or yields nothing usable, falls back to the free dictionaryapi.dev JSON.

export interface WordEntry {
  word: string;
  pos: string;
  ipa: string;
  definition: string;
  examples: string[];
  source: "oxford" | "dictionaryapi";
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_EXAMPLES = 3;

// Decode the handful of HTML entities Oxford emits, then strip tags and collapse
// whitespace. Enough for definition/example text; not a general HTML parser.
function cleanHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html: string, re: RegExp): string {
  const m = re.exec(html);
  return m ? cleanHtml(m[1]) : "";
}

export function parseOxfordHtml(html: string, word: string): WordEntry | null {
  const pos = firstMatch(html, /class="pos"[^>]*>([^<]+)</);
  // Oxford lists British then North American phonetics; take the first.
  const ipa = firstMatch(html, /class="phon"[^>]*>(\/[^<]+\/)</);
  const definition = firstMatch(html, /class="def"[^>]*>([\s\S]*?)<\/span>/);

  const examples: string[] = [];
  const exRe = /class="x"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = exRe.exec(html)) && examples.length < MAX_EXAMPLES) {
    const ex = cleanHtml(m[1]);
    if (ex) examples.push(ex);
  }

  if (!definition || examples.length === 0) return null;
  return { word, pos, ipa, definition, examples, source: "oxford" };
}

// Oxford's URL slug hyphenates multi-word phrases, e.g. "funny money" ->
// /definition/english/funny-money. Keep the original spelling for the entry.
function oxfordSlug(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, "-");
}

async function lookupOxford(word: string): Promise<WordEntry | null> {
  const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(oxfordSlug(word))}`;
  const r = await fetch(url, {
    headers: { "user-agent": BROWSER_UA, "accept-language": "en" },
  });
  if (!r.ok) throw new Error(`oxford ${r.status}`);
  const html = await r.text();
  return parseOxfordHtml(html, word);
}

interface ApiPhonetic { text?: string }
interface ApiDefinition { definition?: string; example?: string }
interface ApiMeaning { partOfSpeech?: string; definitions?: ApiDefinition[] }
interface ApiEntry { word?: string; phonetics?: ApiPhonetic[]; meanings?: ApiMeaning[] }

export function parseDictionaryApi(data: unknown, word: string): WordEntry | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const entry = data[0] as ApiEntry;
  const meaning = entry.meanings?.[0];
  const definition = meaning?.definitions?.[0]?.definition?.trim() ?? "";
  if (!definition) return null;

  const pos = meaning?.partOfSpeech?.trim() ?? "";
  const ipa = entry.phonetics?.find((p) => p.text && p.text.includes("/"))?.text?.trim() ?? "";

  const examples: string[] = [];
  for (const mn of entry.meanings ?? []) {
    for (const d of mn.definitions ?? []) {
      if (d.example) examples.push(d.example.trim());
      if (examples.length >= MAX_EXAMPLES) break;
    }
    if (examples.length >= MAX_EXAMPLES) break;
  }
  if (examples.length === 0) return null;

  return { word, pos, ipa, definition, examples, source: "dictionaryapi" };
}

async function lookupDictionaryApi(word: string): Promise<WordEntry | null> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const r = await fetch(url);
  if (!r.ok) return null; // 404 = word not found
  const data = await r.json();
  return parseDictionaryApi(data, word);
}

// Look up a word. Oxford first (as requested); on any failure or unusable result,
// fall back to dictionaryapi.dev. Returns null if neither yields a definition
// with at least one example sentence (both are required for a wiki entry).
export async function lookupWord(word: string): Promise<WordEntry | null> {
  try {
    const oxford = await lookupOxford(word);
    if (oxford) return oxford;
  } catch (e) {
    console.log(`oxford lookup failed for "${word}": ${(e as Error).message}`);
  }
  try {
    return await lookupDictionaryApi(word);
  } catch (e) {
    console.log(`dictionaryapi lookup failed for "${word}": ${(e as Error).message}`);
    return null;
  }
}
