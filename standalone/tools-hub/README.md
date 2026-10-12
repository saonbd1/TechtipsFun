# Tool Hub

A single page that lists **every tool across both repos** — what it does, how to
run it, and where it lives. Built from one JSON registry, so adding a tool means
editing one file.

```bash
python3 generate_hub.py          # writes index.html
# then open index.html in a browser
```

## What it shows

- **Stats row** — optional live numbers (scheduled reels, tracked posts) when the
  hub sits next to the `article-reels/` data.
- **Tool cards** grouped by category: name, status badge, repo + path + language,
  a one-line summary, capability bullets, a copyable run command, and tags.
- **Filters** — search (matches names, summaries, capabilities and tags), plus
  category / repo / status chips with live counts.

Keyboard: `/` focuses search, `Esc` clears it.

## Files

| File | Purpose |
| --- | --- |
| `tools.json` | The registry — every tool, its capabilities, run command and tags |
| `generate_hub.py` | Reads the registry, writes `index.html` (data embedded as JSON) |
| `index.html` | Generated page |
| `hub.css` | Dark theme matching the rest of the tooling |
| `hub.js` | Rendering, search, filters, copy buttons |

`index.html` references `hub.css` and `hub.js` as siblings, so keep the four
files together (or serve the folder with `python3 -m http.server`).

## Adding or editing a tool

Append an object to `tools.json`:

```json
{
  "name": "my-tool.mjs",
  "repo": "blog",
  "path": "scripts/my-tool.mjs",
  "category": "Quality",
  "language": "Node",
  "status": "ready",
  "summary": "One line on what it does.",
  "capabilities": ["Bullet one", "Bullet two"],
  "run": "npm run my:tool",
  "tags": ["quality", "ci"],
  "docs": "README.md"
}
```

Then re-run `python3 generate_hub.py`. Categories and status chips are derived
from the data, so new values appear automatically.

### Status values

| Status | Meaning |
| --- | --- |
| `ready` | Runs locally as-is |
| `ci` | A GitHub Actions workflow |
| `manual` | Run on demand, not part of a pipeline |
| `local-gui` | Starts a local web UI |
| `needs-credentials` | Requires a token/secret in the environment |

## Live stats (optional)

```bash
python3 generate_hub.py --reels-dir ../article-reels
```

If `.reel-schedule-manifest.json` / `page-posts.json` / `sumona-posts.json` exist
there, the stats row shows scheduled-reel and tracked-post counts. Without them
the row is omitted — the page never errors on missing data.

## Notes

- The page works from `file://` with no server: data is embedded and nothing is
  fetched at runtime (no CORS surprises, unlike a `fetch()`-based refresh).
- Embedded JSON escapes `<` as `\u003c`, so a value containing `</script>`
  cannot break out of the script block.
