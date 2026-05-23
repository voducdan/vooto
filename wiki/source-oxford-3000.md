# Source: Oxford 3000 (Effortless English compilation)

**Summary**: The 3,000 most common English words with British-style IPA and Vietnamese glosses, distributed by Effortless English Club. Used as the **priority** IPA source for this wiki; words missing here fall back to [[source-en-us-ipa]].

**Sources**: `raw/3000.pdf` (120 pages, A4)

**Last updated**: 2026-05-23

---

## Format

Each row in the PDF:

```
No.   Word         Type        Pronounce          Meaning (Vietnamese)
2     abandon      v           ə'bændən           bỏ, từ bỏ
```

3,396 numbered rows in total. After parsing the PDF and normalising encoding artifacts, **3,088 word→IPA pairs** were extracted. The remainder either had no IPA in the source (e.g. *advertising*, *Yours sincerely*) or had the source-typo case where the IPA column repeats the word verbatim (e.g. *yet → yet*) — those are dropped so the en_US fallback can supply a real transcription.

## Encoding quirks (normalised during parsing)

The PDF was typeset with several substitutions that don't render as proper IPA. The parser folds these back to canonical symbols:

| Source glyph | Meaning            | Normalised to |
|--------------|--------------------|----------------|
| `´`          | primary stress     | `ˈ`            |
| `¸`          | secondary stress   | `ˌ`            |
| `'` (ASCII)  | primary stress     | `ˈ`            |
| `∫`          | esh                | `ʃ`            |
| `η`          | velar nasal        | `ŋ`            |
| `ɳ`          | velar nasal        | `ŋ`            |
| `α`          | open back vowel    | `ɑ`            |

Length is kept as `:` (the source convention; not converted to `ː`).

## How it was used

The wiki annotation script (`/tmp/add_ipa.py`) looks each tokenised word up against three sources in order:

1. **Oxford 3000** (this file) — 3,088 entries, British style
2. **en_US dictionary** — 125,927 entries, General American
3. **Hyphen split** — both sources, joined with a space

Tokens that miss all three appear as `/?/` in the wiki (24–25 distinct tokens — British spellings, abbreviations *sth*/*sb*, and compounds not in either source).

After the priority re-annotation, ~2,700 token lookups resolved via Oxford 3000 and ~3,300 via en_US fallback.

## Caveats

- **British style.** Oxford 3000 uses RP-leaning conventions; en_US uses General American. Within a single phrase the two notations can mix — e.g. a heading where one word is Oxford-sourced and another is en_US-sourced will show British and American transcriptions side by side.
- **Source quality is uneven.** Many short words have simplified Latin-letter pseudo-IPA (e.g. *zone → /zoun/*, *able → /eibl/*). Preserved verbatim per the user's instruction to prioritise this source.
- **Stress markers normalised, length kept as `:`.** The Oxford forms use `:` for length; en_US forms have no length mark. Both are valid notations.
- **First alternative only.** Where the source lists `fɔ:,fə` (comma-separated alternatives), only the first is shown.

## Related pages

- [[index]]
- [[log]]
- [[source-en-us-ipa]] — fallback IPA source
- [[source-rachel-mitchell-2018]] — the wiki's vocabulary source
