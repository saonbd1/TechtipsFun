#!/usr/bin/env python3
"""Clean a messy text file (scraped article/report) and export the useful
content to a CSV.

Typical "trash" this removes:
  * inline citation markers, e.g. ``[1] (https://example.com)`` or ``[2](url)``
  * bare URLs
  * leading bullet glyphs (``•``, ``-``, ``*``, ``●``, ``·`` ...)
  * zero-width / BOM / control characters, NBSP, repeated whitespace
  * trailing punctuation left dangling after the links were stripped

It keeps the *real* content:
  * bullet lines become one row each
  * the nearest preceding non-bullet line becomes the row's ``category``
  * an optional ``title`` is taken from the "Leading phrase:" prefix

Example
-------
    python scripts/clean_text_to_csv.py tips.txt -o beauty_tips.csv

By default only Bengali bullet lines are exported, which is exactly what you
want for the "beauty tips" example. Use ``--all-lines`` to also export
non-bullet prose, and ``--no-bengali-filter`` to keep lines in any script.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from pathlib import Path

# --- Characters / patterns that count as "trash" -------------------------

# Inline citations such as:  [1] (https://x/y), [12](http://x), [3] (<https://x>)
CITATION_RE = re.compile(
    r"""\[\s*\d+\s*\]          # [1]
        \s*                     # optional space
        \(\s*<?\s*              # opening paren (+ optional '<')
        (?:https?://|www\.)[^\s)]*   # the URL
        >?\s*\)                 # closing paren
    """,
    re.VERBOSE | re.IGNORECASE,
)

# Any leftover bare URL / markdown link target.
BARE_URL_RE = re.compile(r"(?:<|\[|\()?\s*(?:https?://|www\.)\S+", re.IGNORECASE)

# Unicode junk: BOM, zero-width, bidi marks, soft hyphen, control chars.
JUNK_CHARS_RE = re.compile(
    "[\ufeff\u200b-\u200f\u202a-\u202e\u2060-\u2064\u00ad\x00-\x08\x0b\x0c\x0e-\x1f]"
)

# Leading bullet glyphs and list numbering ("1.", "1)", "ক.", "(a)").
BULLET_RE = re.compile(r"^\s*(?:[•●○◦·▪▫‣∙*\-–—]+|\(?\d+[.)]\s*|\(?[ক-৯][.)]\s*|\*)\s*")

# Collapse runs of spaces/tabs.
WS_RE = re.compile(r"[ \t\u00a0\u2000-\u200a]+")
# More than two newlines -> two.
BLANK_LINES_RE = re.compile(r"\n{3,}")
# Dangling separators left behind once the links are gone: "। , ," etc.
TRAILING_SEP_RE = re.compile(r"[\s,;:/\-–—]+$")

BENGALI_RE = re.compile(r"[\u0980-\u09ff]")

# Splits "সানস্ক্রিন ব্যবহার: বাইরে ..." -> ("সানস্ক্রিন ব্যবহার", "বাইরে ...")
TITLE_SPLIT_RE = re.compile(r"^\s*(?P<title>[^:\u2434]{2,60}?)\s*[:\u2434]\s+(?P<body>.+)$")

# Lines that are clearly meta/boilerplate rather than a tip.
META_LINE_RE = re.compile(
    r"^\s*(?:\d+\s*$|[-=_*#~]{3,}\s*$|(?:references?|sources?|read more)\s*:?\s*$)",
    re.IGNORECASE,
)


def strip_trash(line: str) -> str:
    """Remove citations, URLs and invisible junk from a single line."""
    line = unicodedata.normalize("NFC", line)
    line = JUNK_CHARS_RE.sub("", line)
    line = CITATION_RE.sub(" ", line)
    line = BARE_URL_RE.sub(" ", line)
    # Drop empty markdown/bracket leftovers like "[]", "()", "<>" plus any
    # stray bracket left dangling next to whitespace after a link was cut.
    line = re.sub(r"\[\s*\]|\(\s*\)|<\s*>", " ", line)
    line = re.sub(r"(?:^|(?<=\s))[\[\]<>](?=\s|$)", " ", line)
    line = WS_RE.sub(" ", line)
    line = TRAILING_SEP_RE.sub("", line.strip())
    return line.strip()


def clean_text(text: str) -> str:
    """Full-document cleanup used when writing the cleaned .txt output."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [strip_trash(ln) for ln in text.split("\n")]
    out = BLANK_LINES_RE.sub("\n\n", "\n".join(lines))
    return out.strip() + "\n"


def extract_rows(text: str, *, all_lines: bool, bengali_only: bool):
    """Turn raw text into ``(category, title, tip)`` tuples."""
    rows = []
    category = ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    for raw in text.split("\n"):
        line = strip_trash(raw)
        if not line or META_LINE_RE.match(line):
            continue

        is_bullet = bool(BULLET_RE.match(raw)) or raw.lstrip()[:1] in "•●○◦·▪▫‣∙"
        if is_bullet:
            tip = strip_trash(BULLET_RE.sub("", raw, count=1))
            if bengali_only and not BENGALI_RE.search(tip):
                continue
            title, body = "", tip
            m = TITLE_SPLIT_RE.match(tip)
            if m:
                title, body = m.group("title").strip(), m.group("body").strip()
            rows.append((category, title, body))
        else:
            # A heading / intro / prose line becomes the current category.
            category = line
            if all_lines and (not bengali_only or BENGALI_RE.search(line)):
                rows.append((category, "", line))
    return rows


def write_csv(rows, out_path: Path, delimiter: str = ",") -> None:
    with out_path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.writer(fh, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(["category", "title", "tip"])
        writer.writerows(rows)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Strip citations/URLs/junk from a text file and save the "
        "remaining tips to CSV.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("input", type=Path, help="input text file (UTF-8)")
    p.add_argument("-o", "--output", type=Path, default=Path("cleaned_tips.csv"),
                   help="output CSV path (default: cleaned_tips.csv)")
    p.add_argument("--cleaned-text", type=Path, default=None,
                   help="optionally also write the fully cleaned plain text here")
    p.add_argument("--all-lines", action="store_true",
                   help="also export non-bullet prose lines as rows")
    p.add_argument("--no-bengali-filter", action="store_true",
                   help="keep bullets in any language (default: Bengali only)")
    p.add_argument("--delimiter", default=",", help="CSV delimiter (default: comma)")
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)

    try:
        text = args.input.read_text(encoding="utf-8-sig")
    except FileNotFoundError:
        print(f"error: no such file: {args.input}", file=sys.stderr)
        return 1
    except UnicodeDecodeError:
        text = args.input.read_text(encoding="utf-8", errors="replace")

    cleaned = clean_text(text)
    rows = extract_rows(text, all_lines=args.all_lines,
                        bengali_only=not args.no_bengali_filter)

    if args.cleaned_text:
        args.cleaned_text.write_text(cleaned, encoding="utf-8")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    write_csv(rows, args.output, delimiter=args.delimiter)

    print(f"kept {len(rows)} tip(s) -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
