#!/usr/bin/env python3
"""generate_hub.py - build the Tool Hub page from tools.json.

Reads tools.json (the registry of every tool across the repos) and writes a
self-contained index.html: the data is embedded as JSON, filtering/searching
happens client-side, and nothing is fetched at runtime - so the page works
straight from file:// with no server and no CORS surprises.

Usage:
    python generate_hub.py
    python generate_hub.py --reels-dir ../article-reels   # add live reel stats
    python generate_hub.py -o hub.html
"""

import argparse
import json
import os
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_REGISTRY = os.path.join(BASE_DIR, "tools.json")
DEFAULT_OUTPUT = os.path.join(BASE_DIR, "index.html")

STATUS_LABELS = {
    "ready": "ready",
    "ci": "CI",
    "manual": "run on demand",
    "local-gui": "local GUI",
    "needs-credentials": "needs credentials",
}


def js_json(obj):
    """json.dumps that is safe to embed inside a <script> block.

    Plain json.dumps leaves '<' untouched, so a value containing '</script>'
    would close the tag early (and could execute). Escaping '<' as \\u003c is
    still valid JSON and keeps the payload inert.
    """
    return (
        json.dumps(obj, ensure_ascii=False, default=str)
        .replace("<", "\\u003c")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def load_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def live_stats(reels_dir):
    """Optional live numbers when the hub sits next to the article-reels data."""
    if not reels_dir:
        return None
    manifest = load_json(os.path.join(reels_dir, ".reel-schedule-manifest.json"))
    posts = load_json(os.path.join(reels_dir, "page-posts.json")) or {}
    sumona = load_json(os.path.join(reels_dir, "sumona-posts.json")) or {}
    if manifest is None and not posts and not sumona:
        return None

    scheduled = 0
    if isinstance(manifest, dict):
        scheduled = sum(
            1 for v in manifest.values() if isinstance(v, dict) and "scheduled_publish_time_utc" in v
        )
    total_posts = 0
    for source in (posts, sumona):
        if isinstance(source, dict):
            for value in source.values():
                if isinstance(value, dict) and isinstance(value.get("posts"), list):
                    total_posts += len(value["posts"])
                elif isinstance(value, list):
                    total_posts += len(value)
    return {"scheduled_reels": scheduled, "tracked_posts": total_posts}


def build_html(registry, stats):
    repos = registry.get("repos", [])
    tools = registry.get("tools", [])
    hub = registry.get("hub", {})
    categories = sorted({t.get("category", "Other") for t in tools})
    statuses = sorted({t.get("status", "ready") for t in tools})
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{hub.get('title', 'Tool Hub')}</title>
<link rel="stylesheet" href="hub.css">
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <div class="brand">
      <span class="brand-mark">TH</span>
      <span class="brand-text">{hub.get('title', 'Tool Hub')}</span>
    </div>
    <div class="search-wrap">
      <input id="search" type="search" placeholder="Search tools, capabilities, tags...  (press /)" autocomplete="off">
    </div>
    <div class="counts"><span id="visible-count">{len(tools)}</span> / {len(tools)} tools</div>
  </div>
  <p class="subtitle">{hub.get('subtitle', '')}</p>
</header>

<section class="stats" id="stats"></section>

<nav class="filters" id="filters">
  <div class="filter-row"><span class="filter-label">Category</span><div class="chips" data-group="category"></div></div>
  <div class="filter-row"><span class="filter-label">Repo</span><div class="chips" data-group="repo"></div></div>
  <div class="filter-row"><span class="filter-label">Status</span><div class="chips" data-group="status"></div></div>
  <button id="reset" class="reset" type="button">Reset</button>
</nav>

<main id="grid"></main>
<p id="empty" class="empty" hidden>No tool matches those filters.</p>

<footer class="footer">
  <span>{len(tools)} tools &middot; {len(repos)} repos &middot; generated {generated}</span>
  <span>Edit <code>tools.json</code> and re-run <code>python generate_hub.py</code> to update.</span>
</footer>

<script>
window.__hubData = {{
  "repos": {js_json(repos)},
  "tools": {js_json(tools)},
  "categories": {js_json(categories)},
  "statuses": {js_json(statuses)},
  "statusLabels": {js_json(STATUS_LABELS)},
  "liveStats": {js_json(stats)}
}};
</script>
<script src="hub.js"></script>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description="Build the Tool Hub page.")
    parser.add_argument("-r", "--registry", default=DEFAULT_REGISTRY)
    parser.add_argument("-o", "--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--reels-dir", default=os.path.join(os.path.dirname(BASE_DIR), "article-reels"),
                        help="folder with .reel-schedule-manifest.json / page-posts.json (optional)")
    args = parser.parse_args()

    registry = load_json(args.registry)
    if registry is None:
        raise SystemExit(f"Could not read registry: {args.registry}")

    stats = live_stats(args.reels_dir)
    html = build_html(registry, stats)
    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(html)

    tools = registry.get("tools", [])
    n_categories = len({t.get("category", "Other") for t in tools})
    print(f"[OK] Hub written: {args.output}")
    print(f"  - Tools:      {len(tools)}")
    print(f"  - Repos:      {len(registry.get('repos', []))}")
    print(f"  - Categories: {n_categories}")
    if stats:
        print(f"  - Live stats: {stats}")
    else:
        print("  - Live stats: none (no article-reels data found)")


if __name__ == "__main__":
    main()
