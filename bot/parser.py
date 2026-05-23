"""Parse the IELTS vocab wiki into entry dicts."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

SKIP_FILES = {"index.md", "log.md", "collocations.md"}


@dataclass
class Entry:
    key: str
    word: str
    pos: str
    collocation: bool
    definition: str
    examples: list[str]
    source_file: str


_HEADING_RE = re.compile(r"^###\s+(.+?)\s*$", re.MULTILINE)
_POS_RE = re.compile(r"\*\[([^\]]+)\]\*")
_COLLOCATION_RE = re.compile(r"\*\(collocation\)\*", re.IGNORECASE)
_DEF_RE = re.compile(r"^\*\*Definition\*\*:\s*(.+?)\s*$", re.MULTILINE)
_BULLET_RE = re.compile(r"^-\s+(.+?)\s*$", re.MULTILINE)
_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slug(s: str) -> str:
    return _SLUG_RE.sub("-", s.lower()).strip("-")


def _parse_heading(raw: str) -> tuple[str, str, bool]:
    pos_match = _POS_RE.search(raw)
    pos = pos_match.group(1).strip() if pos_match else ""
    word = _POS_RE.sub("", raw)
    word = _COLLOCATION_RE.sub("", word).strip()
    is_collocation = bool(_COLLOCATION_RE.search(raw))
    return word, pos, is_collocation


def parse_file(path: Path) -> list[Entry]:
    text = path.read_text(encoding="utf-8")
    entries: list[Entry] = []
    matches = list(_HEADING_RE.finditer(text))
    for i, m in enumerate(matches):
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end]

        if "**Definition**" not in body:
            continue

        word, pos, is_collocation = _parse_heading(m.group(1))
        if not word:
            continue

        def_match = _DEF_RE.search(body)
        definition = def_match.group(1).strip() if def_match else ""
        if not definition:
            continue

        def_end = def_match.end() if def_match else 0
        examples = [b.group(1).strip() for b in _BULLET_RE.finditer(body, def_end)]
        if not examples:
            continue

        source = path.stem
        entries.append(
            Entry(
                key=f"{source}#{_slug(word)}",
                word=word,
                pos=pos,
                collocation=is_collocation,
                definition=definition,
                examples=examples,
                source_file=path.name,
            )
        )
    return entries


def parse_wiki(wiki_dir: Path) -> list[Entry]:
    entries: list[Entry] = []
    seen: set[str] = set()
    for md in sorted(wiki_dir.glob("*.md")):
        if md.name in SKIP_FILES or md.name.startswith("source-"):
            continue
        for entry in parse_file(md):
            if entry.key in seen:
                continue
            seen.add(entry.key)
            entries.append(entry)
    return entries


if __name__ == "__main__":
    import sys

    wiki = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "wiki"
    items = parse_wiki(wiki)
    print(f"Parsed {len(items)} entries from {wiki}")
    for sample in items[:3]:
        print()
        print(f"  {sample.key}")
        print(f"    word: {sample.word}")
        print(f"    pos:  {sample.pos}{' (collocation)' if sample.collocation else ''}")
        print(f"    def:  {sample.definition[:80]}")
        print(f"    ex:   {sample.examples[0][:80]}")
