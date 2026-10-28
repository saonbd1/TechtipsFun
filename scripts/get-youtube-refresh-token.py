#!/usr/bin/env python3
"""get-youtube-refresh-token.py — Mint a YT_REFRESH_TOKEN for the reels uploader.

Stdlib only (no pip installs). Run it ONCE on your own machine, then store the
three values as repo Secrets:

    YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN

Usage:
    # 1. In Google Cloud Console -> APIs & Services -> Credentials, create an
    #    OAuth client of type "Desktop app" and copy its id + secret.
    # 2. In Google Auth Platform -> Audience, click "Publish app" so the
    #    publishing status is "In production". While it stays "Testing" every
    #    refresh token dies after 7 days - that is why the daily upload job
    #    starts failing with invalid_grant ("Token has been expired or
    #    revoked").
    export YT_CLIENT_ID=...apps.googleusercontent.com
    export YT_CLIENT_SECRET=...
    python scripts/get-youtube-refresh-token.py

    # then
    gh secret set YT_REFRESH_TOKEN --body "<printed token>"

    # verify the three secrets without uploading anything
    python scripts/upload-reels-to-youtube.py --check-auth

Flow: loopback redirect (RFC 8252) on 127.0.0.1 with an ephemeral port, which
Google still supports for "Desktop app" clients. The old
"urn:ietf:wg:oauth:2.0:oob" out-of-band flow is dead (removed in 2022), so
--manual is offered for headless boxes: paste the final redirect URL back.
"""

import argparse
import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

# youtube.upload  -> videos.insert (the uploads themselves)
# youtube         -> playlistItems.insert (needed for YT_PLAYLIST_ID)
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]

RESULT_TEMPLATE = """<!doctype html><meta charset="utf-8">
<title>YouTube token</title>
<body style="font:16px system-ui;padding:2rem">
<h2>{title}</h2><p>{message}</p></body>"""


def http_json(url, *, method="GET", data=None, headers=None, timeout=120):
    req = urllib.request.Request(url, data=data, method=method,
                                 headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} {url}: {detail}") from e


def build_auth_url(client_id: str, redirect_uri: str, state: str) -> str:
    query = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",   # asks for a refresh_token
        "prompt": "consent",        # forces a refresh_token even on re-consent
        "include_granted_scopes": "true",
        "state": state,
    })
    return f"{AUTH_URL}?{query}"


def exchange_code(client_id, client_secret, code, redirect_uri) -> dict:
    data = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }).encode()
    _, payload = http_json(
        TOKEN_URL, method="POST", data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    if "refresh_token" not in payload:
        raise RuntimeError(
            "Google did not return a refresh_token. Re-run and make sure the "
            "OAuth client is type 'Desktop app' (prompt=consent is already "
            f"set). Raw response: {payload}")
    return payload


def main() -> int:
    p = argparse.ArgumentParser(
        description="Mint a Google OAuth refresh token for YouTube uploads.")
    p.add_argument("--client-id", default=os.environ.get("YT_CLIENT_ID", ""))
    p.add_argument("--client-secret",
                   default=os.environ.get("YT_CLIENT_SECRET", ""))
    p.add_argument("--port", type=int, default=0,
                   help="loopback port (default: pick a free one)")
    p.add_argument("--manual", action="store_true",
                   help="headless: print the URL, paste the redirect back")
    p.add_argument("--no-browser", action="store_true",
                   help="do not try to open a browser automatically")
    args = p.parse_args()

    if not args.client_id or not args.client_secret:
        print("ERROR: set YT_CLIENT_ID and YT_CLIENT_SECRET (or pass "
              "--client-id/--client-secret).", file=sys.stderr)
        return 2

    state = secrets.token_urlsafe(24)
    server = thread = result = None
    if not args.manual:
        server, thread, result = wait_for_code(args.port, state)
        redirect_uri = f"http://127.0.0.1:{server.server_address[1]}"
    else:
        redirect_uri = f"http://127.0.0.1:{args.port or 8080}"

    auth_url = build_auth_url(args.client_id, redirect_uri, state)
    print("Scopes requested:\n  " + "\n  ".join(SCOPES) + "\n")

    if args.manual:
        code = manual_code_entry(auth_url)
    else:
        if not args.no_browser:
            try:
                webbrowser.open(auth_url)
                print("Opened your browser. If nothing happened, use the URL "
                      "below.")
            except Exception:
                pass
        print("Waiting for the browser redirect on "
              f"{redirect_uri} ...\nIf it does not open, visit:\n{auth_url}\n")
        thread.join(timeout=server.timeout)
        server.server_close()
        if result["error"]:
            print(f"ERROR: {result['error']}", file=sys.stderr)
            return 1
        code = result["code"]

    token = exchange_code(args.client_id, args.client_secret, code,
                          redirect_uri)
    refresh_token = token["refresh_token"]
    expires_in = token.get("refresh_token_expires_in")
    info = check_token(token["access_token"])

    print("\n" + "=" * 72)
    print(f"Refresh token : {refresh_token}")
    print(f"Granted scopes: {info.get('scope', '(unknown)')}")
    print("=" * 72)
    print("\nStore it (never commit it):")
    print(f'  gh secret set YT_REFRESH_TOKEN --body "{refresh_token}"')
    print(f'  gh secret set YT_CLIENT_ID --body "{args.client_id}"')
    print(f'  gh secret set YT_CLIENT_SECRET --body "{args.client_secret}"')

    if expires_in:
        days = int(expires_in) / 86400
        print(f"\nWARNING: Google reports this refresh token expires in "
              f"{days:.1f} days ({expires_in}s).")
        print("  That is the 'Testing' publishing status signature: publish "
              "the app")
        print("  (Google Auth Platform -> Audience -> Publish app), then mint "
              "a new token.")
    else:
        print("\nGood: no refresh_token_expires_in in the response, so this "
              "token")
        print("  is not on the 7-day Testing-mode timer. It only dies if "
              "unused for")
        print("  6 months, revoked by you, or pushed out by 50+ newer tokens "
              "for the")
        print("  same client/user pair.")
    return 0


def wait_for_code(port: int, expected_state: str, timeout=300):
    """Serve one request on 127.0.0.1:port and pull ?code= out of the query."""
    result = {"code": None, "error": None}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 (stdlib naming)
            params = urllib.parse.parse_qs(
                urllib.parse.urlparse(self.path).query)
            if params.get("state", [""])[0] != expected_state:
                result["error"] = "state mismatch (possible CSRF); retry"
            elif "error" in params:
                result["error"] = params["error"][0]
            elif "code" in params:
                result["code"] = params["code"][0]
            else:
                result["error"] = "no code in redirect"
            ok = result["code"] is not None
            body = RESULT_TEMPLATE.format(
                title="Authorised" if ok else "Failed",
                message=("You can close this tab and return to the terminal."
                         if ok else result["error"] or "")).encode()
            self.send_response(200 if ok else 400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):  # silence request logging
            pass

    server = HTTPServer(("127.0.0.1", port), Handler)
    server.timeout = timeout
    thread = Thread(target=server.handle_request, daemon=True)
    thread.start()
    return server, thread, result


def manual_code_entry(auth_url: str) -> str:
    print("\nOpen this URL in any browser (on any machine) and sign in:\n")
    print(auth_url)
    print("\nAfter approving you land on a 127.0.0.1 URL that fails to load.")
    print("Paste that whole URL (or just the code= value) here.\n")
    raw = input("redirect URL / code: ").strip()
    if not raw:
        raise RuntimeError("no code provided")
    if "code=" in raw:
        query = urllib.parse.urlparse(raw).query or raw.split("?", 1)[-1]
        raw = urllib.parse.parse_qs(query).get("code", [""])[0]
    return raw


def check_token(access_token: str) -> dict:
    _, info = http_json(f"{TOKENINFO_URL}?access_token="
                        + urllib.parse.quote(access_token))
    return info


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        sys.exit(130)
    except Exception as exc:  # keep the terminal readable
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
