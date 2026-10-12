"""Tests for scripts/clean_text_to_csv.py.

Run with:  python -m unittest discover -s scripts/tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from clean_text_to_csv import (  # noqa: E402
    CITATION_RE,
    clean_text,
    extract_rows,
    strip_trash,
)

SAMPLE = """নিজেকে সুন্দর রাখার উপায়:

ত্বকের যত্ন (Skincare)

• সানস্ক্রিন ব্যবহার: বাইরে বের হওয়ার আগে এসপিএফ ৩০ যুক্ত সানস্ক্রিন লাগান। [1] (https://a.example/x), [2] (https://b.example/y)
• নিয়মিত মুখ পরিষ্কার: দিনে অন্তত দুইবার মুখ ধুয়ে নিন।

খাদ্য ও পানি (Diet & Hydration)

• পর্যাপ্ত পানি পান: প্রতিদিন ৮ গ্লাস পানি পান করুন [3](https://c.example/z)

Some English trailing note. https://d.example/leftover
"""


class StripTrashTests(unittest.TestCase):
    def test_removes_inline_citations(self):
        got = strip_trash("লাগান। [1] (https://a.example/x), [2] (https://b.example/y)")
        self.assertEqual(got, "লাগান।")

    def test_removes_citation_without_space(self):
        self.assertEqual(strip_trash("পান করুন [3](https://c.example/z)"), "পান করুন")

    def test_removes_bare_url(self):
        self.assertEqual(strip_trash("note https://d.example/leftover"), "note")

    def test_removes_zero_width_and_nbsp(self):
        # zero-width char is deleted, NBSP becomes a normal space
        self.assertEqual(strip_trash("a\u200bb\u00a0c"), "ab c")

    def test_keeps_parentheses_in_headings(self):
        self.assertEqual(strip_trash("ত্বকের যত্ন (Skincare)"), "ত্বকের যত্ন (Skincare)")

    def test_citation_re_matches_many(self):
        self.assertEqual(len(CITATION_RE.findall("[1] (http://x) [2](http://y)")), 2)


class ExtractRowsTests(unittest.TestCase):
    def setUp(self):
        self.rows = extract_rows(SAMPLE, all_lines=False, bengali_only=True)

    def test_only_bullets_are_kept(self):
        # 2 bullets under Skincare + 1 under Diet, prose is dropped
        self.assertEqual(len(self.rows), 3)

    def test_category_inherited_from_heading(self):
        self.assertEqual(self.rows[0][0], "ত্বকের যত্ন (Skincare)")
        self.assertEqual(self.rows[2][0], "খাদ্য ও পানি (Diet & Hydration)")

    def test_title_split_from_leading_phrase(self):
        self.assertEqual(self.rows[0][1], "সানস্ক্রিন ব্যবহার")
        self.assertIn("এসপিএফ", self.rows[0][2])

    def test_no_urls_or_citations_survive(self):
        blob = " ".join(c for row in self.rows for c in row)
        self.assertNotIn("http", blob)
        self.assertNotIn("[1]", blob)

    def test_all_lines_mode_adds_prose(self):
        rows = extract_rows(SAMPLE, all_lines=True, bengali_only=True)
        # 4 bullets + 4 non-bullet Bengali lines (intro + 2 headings + none else)
        self.assertGreater(len(rows), 4)


class CleanTextTests(unittest.TestCase):
    def test_no_citations_remain_and_ends_with_newline(self):
        out = clean_text(SAMPLE)
        self.assertNotIn("http", out)
        self.assertTrue(out.endswith("\n"))


if __name__ == "__main__":
    unittest.main()
