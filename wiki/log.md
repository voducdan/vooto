# Log

Append-only record of operations on this wiki.

---

## [2026-05-23] ingest | IELTS Academic Vocabulary (Rachel Mitchell, 2018)

**Source**: `raw/IELTS-Academic-Vocabulary-Rachel-Mitchell.pdf` (335 pages)

**Operation**: Full extraction. Parsed every `Word [POS] (definition)` entry from the source's 24 topic sections and Letter AÃÂ¢ÃÂÃÂW alphabetical section.

**Outputs**:
- 24 topic pages: [[education]], [[work]], [[health]], [[free-time]], [[media]], [[books-and-films]], [[urbanisation]], [[environment]], [[buildings]], [[time]], [[travel]], [[music]], [[food]], [[technology]], [[friends]], [[towns-and-cities]], [[family]], [[law]], [[business]], [[money]], [[personality]], [[description]], [[liking-and-disliking]], [[ielts-writing]]
- 21 alphabetical pages: [[letter-a]], [[letter-b]], [[letter-c]], [[letter-d]], [[letter-e]], [[letter-f]], [[letter-g]], [[letter-h]], [[letter-i]], [[letter-k]], [[letter-l]], [[letter-m]], [[letter-n]], [[letter-o]], [[letter-p]], [[letter-r]], [[letter-s]], [[letter-t]], [[letter-u]], [[letter-v]], [[letter-w]]
- 1 source page: [[source-rachel-mitchell-2018]]
- 1 cross-cutting page: [[collocations]]
- 1 index: [[index]]

**Stats**: 1770 entries extracted. Verbatim definitions and example sentences preserved. Multi-word terms flagged as collocations.

**Parser notes**:
- Section boundaries detected by header text on each page
- PDF artifacts (Arabic-script highlight residue, stray parens) filtered
- Nested-paren definitions handled via depth tracking
- Letter sections J, Q, X, Y, Z absent from the source ÃÂ¢ÃÂÃÂ not generated

---

## [2026-05-23] ingest | en_US IPA dictionary + wiki-wide annotation

**Source**: `raw/en_US.txt` (125,927 wordÃÂ¢ÃÂÃÂIPA entries, US English)

**Operation**: Tokenised every `### Headword *[POS]*` line across the wiki, looked each token up in the IPA dictionary (hyphen-split and `'s`-strip as fallbacks), and appended ` ÃÂ¢ÃÂÃÂ /ipa/ /ipa/ ...` inline after the POS marker. First listed pronunciation only.

**Outputs**:
- 1 new source page: [[source-en-us-ipa]]
- 43 wiki pages updated in place (all topic, letter, and collocations pages)
- [[index]] updated to list both sources and note IPA coverage

**Stats**: 2,627 / 2,627 headings annotated. 24 distinct tokens unresolved (marked `/?/`) ÃÂ¢ÃÂÃÂ British spellings, abbreviations (sth/sb), and compound nouns missing from the US dictionary.

**Parser notes**:
- Idempotent: lines already carrying a `/ÃÂ¢ÃÂÃÂ¦/` tail are skipped on re-runs
- Headword extraction tolerates `(To) prefix` parens, trailing colons, and bare collocation-page headings without a POS marker
- Alternative pronunciations in the source were dropped for compactness; the raw file still has them

---

## [2026-05-23] ingest | Oxford 3000 PDF as priority IPA source

**Source**: `raw/3000.pdf` (Effortless English Oxford 3000 compilation, 120 pages, 3,396 numbered rows)

**Operation**: Parsed the PDF into a 3,088-entry wordÃÂ¢ÃÂÃÂIPA map (normalised the PDF's stress-marker glyph substitutions: `ÃÂÃÂ´ÃÂ¢ÃÂÃÂÃÂÃÂ`, `ÃÂÃÂ¸ÃÂ¢ÃÂÃÂÃÂÃÂ`, `'ÃÂ¢ÃÂÃÂÃÂÃÂ`, `ÃÂ¢ÃÂÃÂ«ÃÂ¢ÃÂÃÂÃÂÃÂ`, `ÃÂÃÂ·/ÃÂÃÂ³ÃÂ¢ÃÂÃÂÃÂÃÂ`, `ÃÂÃÂ±ÃÂ¢ÃÂÃÂÃÂÃÂ`). Rebuilt the wiki annotation script to look up Oxford 3000 first and fall back to `en_US.txt` only when a word is absent. Stripped pre-existing IPA tails from every heading and re-annotated from scratch.

**Outputs**:
- 1 new source page: [[source-oxford-3000]]
- 1,679 headings updated with new IPA (the remainder kept their en_US values because the word isn't in Oxford 3000)
- [[index]] updated to list Oxford 3000 as the priority source

**Stats**: Token-lookup breakdown ÃÂ¢ÃÂÃÂ 2,698 from Oxford 3000, 3,287 from en_US fallback, 70 from hyphen-split, 44 unknown (25 distinct tokens ÃÂ¢ÃÂÃÂ British spellings, *sth*/*sb*, compound nouns).

**Parser notes**:
- Used field-based parsing with column-order trust: in each row `[word, POS, IPA, meaning]`, the field after the POS token is treated as IPA when it has no spaces and no Vietnamese diacritics
- Handled multi-line rows where the headword and POS/IPA span separate lines
- Rejected source typos where the IPA column repeats the word verbatim (e.g. *yet ÃÂ¢ÃÂÃÂ yet*) ÃÂ¢ÃÂÃÂ those fall through to en_US

## [2026-07-16] newword | heterogeneous

Added [[letter-h]] entry "heterogeneous" via /newword (source: oxford).

## [2026-07-16] newword | exploit

Added [[letter-e]] entry "exploit" via /newword (source: oxford).

## [2026-07-16] newword | alleviate

Added [[letter-a]] entry "alleviate" via /newword (source: oxford).
