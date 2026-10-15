#!/usr/bin/env python3
"""upload-reels-to-youtube.py — Upload reel MP4s to YouTube via Data API v3.

Stdlib only (no pip installs — safe for GitHub Actions).

Title/description come from the file name (article slug), using the same
casing rules as schedule-reels.py, e.g.:

    windows-11-wifi-keeps-disconnecting.mp4
      -> "Windows 11 Wi-Fi Keeps Disconnecting"

Uploads are RESUMABLE (chunked, 8 MiB), so 1-3 MB reels go in one chunk
but bigger files survive flaky runners. A manifest
`.youtube-upload-manifest.json` records uploaded video IDs so re-runs
never double-post (same pattern as `.reel-schedule-manifest.json`).

Auth: OAuth2 desktop refresh token. The workflow passes three secrets:
  YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN
Run scripts/get-youtube-refresh-token.py once locally to mint the
refresh token, then store the three values as repo Secrets.

Usage:
    python upload-reels-to-youtube.py --dry-run
    python upload-reels-to-youtube.py --limit 2 --privacy unlisted
    python upload-reels-to-youtube.py --playlist-id PLxxxx --schedule "+24h"

Quota note: each upload costs ~1600 quota units of the 10,000/day
default grant (~6 uploads/day). --limit defaults to 3 per run.
"""

import argparse
import json
import os
import re
import sys
import time as time_module
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = ("https://www.googleapis.com/upload/youtube/v3/videos"
              "?uploadType=resumable&part=snippet,status")
PLAYLIST_ITEMS_URL = "https://www.googleapis.com/youtube/v3/playlistItems"
CHUNK_SIZE = 8 * 1024 * 1024  # 8 MiB (multiple of 256 KiB, per API spec)
VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm"}
MANIFEST_NAME = ".youtube-upload-manifest.json"

ACRONYMS = {
    "tpm": "TPM", "oauth": "OAuth", "html": "HTML", "css": "CSS",
    "usb": "USB", "ssd": "SSD", "hdd": "HDD", "cpu": "CPU", "gpu": "GPU",
    "ram": "RAM", "bios": "BIOS", "dns": "DNS", "vpn": "VPN", "url": "URL",
    "http": "HTTP", "ai": "AI", "pc": "PC", "it": "IT", "wifi": "Wi-Fi",
}
BRANDS = {
    "linkedin": "LinkedIn", "github": "GitHub", "astro": "Astro",
    "netlify": "Netlify", "vercel": "Vercel", "ollama": "Ollama",
}
STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "nor", "for", "so", "yet",
    "of", "in", "on", "at", "to", "from", "by", "with", "vs", "via",
    "per", "as",
}


def slug_to_title(slug: str) -> str:
    slug = re.sub(r"\s*\(\d+\)\s*$", "", slug).strip()
    words = [w for w in re.split(r"[-_\s]+", slug.replace("_", "-")) if w]
    titled, n = [], len(words)
    for i, w in enumerate(words):
        lw = w.lower()
        if lw in ACRONYMS:
            titled.append(ACRONYMS[lw])
        elif lw in BRANDS:
            titled.append(BRANDS[lw])
        elif (m := re.fullmatch(r"windows(\d+)", lw)):
            titled.append(f"Windows {m.group(1)}")
        elif i == 0 or i == n - 1 or lw not in STOP_WORDS:
            titled.append(w.capitalize())
        else:
            titled.append(lw)
    return " ".join(titled)


def natural_key(name: str):
    return [int(t) if t.isdigit() else t.lower()
            for t in re.split(r"(\d+)", name)]


def list_videos(folder: str):
    vids = [os.path.join(folder, n) for n in os.listdir(folder)
            if os.path.splitext(n)[1].lower() in VIDEO_EXTENSIONS]
    vids.sort(key=lambda p: natural_key(os.path.basename(p)))
    return vids


def load_manifest(folder: str):
    path = os.path.join(folder, MANIFEST_NAME)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_manifest(folder: str, manifest):
    with open(os.path.join(folder, MANIFEST_NAME), "w",
              encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)


def http_json(url, *, method="GET", data=None, headers=None,
              timeout=120):
    req = urllib.request.Request(url, data=data, method=method,
                                 headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} {url}: {detail}") from e


def mint_access_token(client_id, client_secret, refresh_token) -> str:
    data = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
    }).encode()
    status, payload = http_json(
        TOKEN_URL, method="POST", data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    if "access_token" not in payload:
        raise RuntimeError(f"Token refresh failed: {payload}")
    return payload["access_token"]

def start_resumable_session(access_token, metadata: dict,
                            file_size: int) -> str:
    """Ask YouTube for a resumable-upload session URL (Location header)."""
    body = json.dumps(metadata).encode()
    req = urllib.request.Request(
        UPLOAD_URL, data=body, method="POST",
        headers={"Authorization": f"Bearer {access_token}",
                 "Content-Type": "application/json; charset=UTF-8",
                 "X-Upload-Content-Type": "video/mp4",
                 "X-Upload-Content-Length": str(file_size)})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            loc = resp.headers.get("Location")
            if not loc:
                raise RuntimeError("No Location header in session init")
            return loc
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} session init: {detail}") from e


def resume_offset(session_url, access_token, file_size) -> int:
    """Ask the server how many bytes it already has (for resume)."""
    req = urllib.request.Request(
        session_url, data=b"", method="PUT",
        headers={"Authorization": f"Bearer {access_token}",
                 "Content-Length": "0",
                 "Content-Range": f"bytes */{file_size}"})
    try:
        urllib.request.urlopen(req, timeout=60).close()
        return 0
    except urllib.error.HTTPError as e:
        if e.code != 308:
            raise
        m = re.search(r"bytes=0-(\d+)", e.headers.get("Range", ""))
        return int(m.group(1)) + 1 if m else 0


def upload_chunks(session_url, access_token, path, file_size,
                  retries=5):
    """PUT the file in 8 MiB chunks with retry + resume. Returns video JSON."""
    video, offset, attempt = None, 0, 0
    with open(path, "rb") as f:
        while offset < file_size:
            f.seek(offset)
            chunk = f.read(CHUNK_SIZE)
            end = offset + len(chunk) - 1
            req = urllib.request.Request(
                session_url, data=chunk, method="PUT",
                headers={"Authorization": f"Bearer {access_token}",
                         "Content-Type": "video/mp4",
                         "Content-Length": str(len(chunk)),
                         "Content-Range": f"bytes {offset}-{end}/{file_size}"})
            try:
                with urllib.request.urlopen(req, timeout=900) as resp:
                    if resp.status in (200, 201):
                        video = json.loads(resp.read().decode("utf-8"))
                        offset = file_size
                    elif resp.status == 308:
                        m = re.search(r"bytes=0-(\d+)",
                                      resp.headers.get("Range", ""))
                        offset = int(m.group(1)) + 1 if m else end + 1
                        attempt = 0
                    else:
                        raise RuntimeError(f"Unexpected status {resp.status}")
            except urllib.error.HTTPError as e:
                if e.code == 308:  # resume incomplete
                    m = re.search(r"bytes=0-(\d+)",
                                  e.headers.get("Range", ""))
                    offset = int(m.group(1)) + 1 if m else end + 1
                    attempt = 0
                    continue
                attempt += 1
                if attempt > retries:
                    detail = e.read().decode("utf-8", "replace")
                    raise RuntimeError(
                        f"Chunk upload failed after {retries} retries: "
                        f"HTTP {e.code}: {detail}") from e
                time_module.sleep(2 ** attempt)
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                attempt += 1
                if attempt > retries:
                    raise
                time_module.sleep(2 ** attempt)
                offset = resume_offset(session_url, access_token, file_size)
                attempt = 0
    if not video or "id" not in video:
        raise RuntimeError("Upload finished without a video id in response")
    return video

def add_to_playlist(access_token, video_id, playlist_id):
    body = json.dumps({"snippet": {
        "playlistId": playlist_id,
        "resourceId": {"kind": "youtube#video", "videoId": video_id}}
    }).encode()
    http_json(PLAYLIST_ITEMS_URL + "?part=snippet", method="POST",
              data=body,
              headers={"Authorization": f"Bearer {access_token}",
                       "Content-Type": "application/json"})


def parse_schedule(spec: str):
    """Parse '+24h' / '+90m' / '2026-10-20T18:00' into an aware UTC datetime."""
    if m := re.fullmatch(r"\+(\d+)([mh])", (spec or "").strip()):
        n, unit = int(m.group(1)), m.group(2)
        delta = timedelta(hours=n) if unit == "h" else timedelta(minutes=n)
        return datetime.now(timezone.utc) + delta
    dt = datetime.fromisoformat((spec or "").strip())
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def parse_args():
    p = argparse.ArgumentParser(
        description="Upload reel MP4s to YouTube (titles from file names).")
    p.add_argument("--folder",
                   default=os.path.dirname(os.path.dirname(
                       os.path.abspath(__file__))),
                   help="folder with reel videos (default: repo root; "
                        "auto-descends into --reels-dir)")
    p.add_argument("--reels-dir", default="article-reels",
                   help="subdirectory holding MP4s if --folder is repo root")
    p.add_argument("--client-id", default=os.environ.get("YT_CLIENT_ID", ""))
    p.add_argument("--client-secret",
                   default=os.environ.get("YT_CLIENT_SECRET", ""))
    p.add_argument("--refresh-token",
                   default=os.environ.get("YT_REFRESH_TOKEN", ""))
    p.add_argument("--privacy", default="public",
                   choices=["public", "unlisted", "private"])
    p.add_argument("--playlist-id",
                   default=os.environ.get("YT_PLAYLIST_ID", ""),
                   help="optional playlist to append each upload to")
    p.add_argument("--schedule",
                   help="optional '+24h' / '+90m' / ISO time for scheduled "
                        "publish (needs --privacy private|unlisted)")
    p.add_argument("--category-id", default="27",
                   help="YouTube category id (default 27 = Education)")
    p.add_argument("--hashtags", default="#Shorts",
                   help="appended to every description "
                        "(default: #Shorts; '' to disable)")
    p.add_argument("--made-for-kids", action="store_true")
    p.add_argument("--limit", type=int, default=3,
                   help="max uploads this run, quota safety "
                        "(default 3; 0 = all)")
    p.add_argument("--force", action="store_true",
                   help="re-upload even if the manifest has the file")
    p.add_argument("--dry-run", action="store_true",
                   help="print the plan, upload nothing")
    return p.parse_args()

def main() -> int:
    args = parse_args()
    folder = args.folder
    if os.path.isdir(os.path.join(folder, args.reels_dir)):
        folder = os.path.join(folder, args.reels_dir)

    publish_at = parse_schedule(args.schedule) if args.schedule else None
    if publish_at:
        if args.privacy == "public":
            print("Note: --privacy public + --schedule: publishing now, "
                  "ignoring schedule.")
            publish_at = None
        else:
            now = datetime.now(timezone.utc)
            if not (now + timedelta(minutes=10) <= publish_at
                    <= now + timedelta(days=90)):
                print(f"ERROR: schedule {publish_at.isoformat()} must be "
                      f"10 min to 90 days out.", file=sys.stderr)
                return 1

    videos = list_videos(folder)
    if not videos:
        print(f"No video files found in {folder}")
        return 1
    manifest = load_manifest(folder)

    plan = []
    for path in videos:
        name = os.path.basename(path)
        if not args.force and name in manifest:
            print(f"skip (already uploaded): {name}")
            continue
        title = slug_to_title(os.path.splitext(name)[0])
        desc = title + (f"\n{args.hashtags}" if args.hashtags else "")
        plan.append({"path": path, "title": title, "description": desc})
    if args.limit > 0:
        plan = plan[:args.limit]
    if not plan:
        print("Nothing to upload (manifest covers everything; "
              "--force to redo).")
        return 0

    print(f"\n{'#':>2}  {'File':<60}  Title")
    print("-" * 120)
    for i, item in enumerate(plan, 1):
        print(f"{i:>2}  {os.path.basename(item['path']):<60}  "
              f"{item['title']}")
    sched = f" scheduled {publish_at.isoformat()}" if publish_at else ""
    print(f"\n{len(plan)} video(s) -> YouTube as {args.privacy} "
          f"({'DRY RUN' if args.dry_run else 'WILL UPLOAD'}){sched}\n")
    if args.dry_run:
        return 0

    if not (args.client_id and args.client_secret and args.refresh_token):
        print("ERROR: set YT_CLIENT_ID / YT_CLIENT_SECRET / "
              "YT_REFRESH_TOKEN.", file=sys.stderr)
        return 1

    access_token = mint_access_token(args.client_id, args.client_secret,
                                     args.refresh_token)
    failures = 0
    for item in plan:
        name = os.path.basename(item["path"])
        size = os.path.getsize(item["path"])
        print(f"Uploading {name} ({size / 1e6:.1f} MB) ...", flush=True)
        try:
            status = {"privacyStatus": args.privacy}
            if publish_at:
                status["publishAt"] = publish_at.strftime(
                    "%Y-%m-%dT%H:%M:%SZ")
            metadata = {
                "snippet": {"title": item["title"][:100],
                            "description": item["description"][:5000],
                            "categoryId": args.category_id},
                "status": {**status,
                           "madeForKids": args.made_for_kids,
                           "selfDeclaredMadeForKids": args.made_for_kids}}
            session_url = start_resumable_session(access_token, metadata,
                                                  size)
            video = upload_chunks(session_url, access_token,
                                  item["path"], size)
            vid = video["id"]
            print(f"  OK -> https://youtu.be/{vid}", flush=True)
            if args.playlist_id:
                add_to_playlist(access_token, vid, args.playlist_id)
                print(f"  added to playlist {args.playlist_id}", flush=True)
            manifest[name] = {
                "video_id": vid, "url": f"https://youtu.be/{vid}",
                "title": item["title"],
                "uploaded_at_utc": datetime.now(timezone.utc).isoformat()}
        except Exception as e:  # keep going; report at the end
            failures += 1
            print(f"  FAILED: {e}", flush=True)
        save_manifest(folder, manifest)
        time_module.sleep(2)

    print(f"\nDone: {len(plan) - failures} uploaded, {failures} failed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
