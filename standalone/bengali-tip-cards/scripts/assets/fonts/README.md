# Bundled fonts

These fonts are used only at build/generation time by
`scripts/generate-tip-cards.mjs` (via fontconfig) so Bengali text renders on
machines with no Bengali font installed. They are not served to the browser —
the site loads Atkinson Hyperlegible from `public/fonts/`.

| File | Family | Source |
| --- | --- | --- |
| `NotoSansBengali-Regular.ttf` | Noto Sans Bengali | [notofonts.github.io](https://github.com/notofonts/notofonts.github.io/tree/main/fonts/NotoSansBengali/hinted/ttf) |
| `NotoSansBengali-Bold.ttf` | Noto Sans Bengali | same |
| `NotoSansBengali-SemiBold.ttf` | Noto Sans Bengali | same |
| `NotoSans-Regular.ttf` | Noto Sans | [notofonts.github.io](https://github.com/notofonts/notofonts.github.io/tree/main/fonts/NotoSans/hinted/ttf) |
| `NotoSans-Bold.ttf` | Noto Sans | same |

Noto Sans provides the latin/digit fallback (brand name, `SPF 30`, `@saonbd`)
because the Bengali face has no latin glyphs.

All files are licensed under the SIL Open Font License 1.1.
