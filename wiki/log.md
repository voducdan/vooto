# Log

Append-only record of operations on this wiki.

---

## [2026-05-23] ingest | IELTS Academic Vocabulary (Rachel Mitchell, 2018)

**Source**: `raw/IELTS-Academic-Vocabulary-Rachel-Mitchell.pdf` (335 pages)

**Operation**: Full extraction. Parsed every `Word [POS] (definition)` entry from the source's 24 topic sections and Letter A–W alphabetical section.

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
- Letter sections J, Q, X, Y, Z absent from the source — not generated
