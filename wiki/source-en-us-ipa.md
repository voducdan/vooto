# Source: en_US IPA Dictionary

**Summary**: A US English word→IPA pronunciation list (125,927 entries) used to annotate every headword in this wiki with its International Phonetic Alphabet transcription.

**Sources**: `raw/en_US.txt`

**Last updated**: 2026-05-23

---

## Format

Plain text, one word per line, tab-separated:

```
word<TAB>/IPA/[, /alternative IPA/, ...]
```

Examples:

```
aardvark    /ˈɑɹdˌvɑɹk/
a           /ˈeɪ/, /ə/
crossroads  /ˈkɹɔsˌɹoʊdz/
```

Most entries have a single pronunciation; common function words list several (citation form first, weak/reduced form second).

## How it was used

A one-off script split each wiki entry heading on whitespace, looked up every token (lowercased, hyphen-split as fallback, `'s` possessive stripped), and appended ` — /ipa1/ /ipa2/ ...` to the heading line. Only the first listed pronunciation is used per word, for compactness.

Coverage: 2,627 / 2,627 headings touched. 24 distinct tokens fell outside the dictionary and are marked `/?/` — these are British spellings (*postgraduate*, *idolise*, *ageing*, *subsidise*, *organise*…), informal abbreviations (*sth*, *sb*), and compound nouns absent from the source list (*cinemagoer*, *shopaholic*, *funfair*, *sandcastle*, *skillset*, *ringtone*).

## Caveats

- US English only — pronunciations skew General American.
- Per-word IPA, not phrase IPA. Function words in collocations show their **stressed citation form** (e.g. *a* → `/ˈeɪ/`), not the schwa they typically take inside a phrase (`/ə/`). Read each `/…/` as the dictionary form of the word in isolation.
- Stress marks (`ˈ`, `ˌ`) and length are preserved verbatim from the source.
- Alternative pronunciations were dropped during annotation; the original list still has them.

## Related pages

- [[index]]
- [[log]]
- [[source-rachel-mitchell-2018]]
