/**
 * Admin auth worker — GitHub OAuth login for /admin plus a token-free proxy.
 *
 * The site itself is a static Astro build (`assets.directory: ./dist`). This
 * script sits in front of exactly two path patterns (`run_worker_first`):
 *
 *   /admin/auth/*     GitHub OAuth App login / callback / logout
 *   /admin/api/*      session info + a GitHub API proxy
 *   /admin, /admin/*  gated: no valid session cookie -> redirect to login
 *   everything else   straight to `env.ASSETS.fetch(request)`
 *
 * Why a worker at all: an OAuth authorization-code exchange needs the client
 * secret, and a browser-held PAT is a standing credential. Here the browser
 * gets only an HMAC-signed, HttpOnly session cookie; the fine-grained PAT lives
 * in a Worker secret and is never shipped to the client.
 *
 * Worker secrets (wrangler secret put ... / .dev.vars locally):
 *   GITHUB_OAUTH_CLIENT_ID      OAuth App client id
 *   GITHUB_OAUTH_CLIENT_SECRET  OAuth App client secret
 *   SESSION_SECRET              32+ random bytes, signs the session cookie
 *   GITHUB_TOKEN                fine-grained PAT (Contents: Read and write)
 *   ADMIN_GITHUB_LOGINS         comma separated GitHub logins allowed in
 *   ADMIN_GITHUB_IDS            (optional) comma separated numeric user ids
 *   ADMIN_REPO                  (optional) owner/name the proxy may touch
 *
 * Deploy note: the OAuth App's callback URL must be
 *   https://www.techtips.fun/admin/auth/callback
 */

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const API_URL = "https://api.github.com";

const SESSION_COOKIE = "ttadmin_session";
const MODE_COOKIE = "ttadmin_mode"; // readable by app.js: tells it to use OAuth
const STATE_COOKIE = "ttadmin_state";
const NEXT_COOKIE = "ttadmin_next";

const SESSION_TTL = 8 * 60 * 60; // 8 hours
const DEFAULT_REPO = "saonbd1/TechtipsFun";
const CALLBACK_PATH = "/admin/auth/callback";

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/admin/auth/login") return await handleLogin(request, env, url);
      if (path === CALLBACK_PATH) return await handleCallback(request, env, url);
      if (path === "/admin/auth/logout") return handleLogout(request);
      if (path === "/admin/api/session") return await handleSession(request, env);
      if (path.startsWith("/admin/api/github/")) return await handleProxy(request, env, url);
      if (path === "/admin" || path.startsWith("/admin/")) {
        const session = await readSession(request, env);
        if (!session) return redirect(loginUrl(url));
        return env.ASSETS.fetch(request);
      }
    } catch (error) {
      console.error("admin worker error", path, error && error.message);
      return text(500, "Admin request failed. Check the Worker logs.");
    }

    return env.ASSETS.fetch(request);
  },
};

/* ── Configuration ──────────────────────────────────────────────────── */

/**
 * @typedef {Object} Env
 * @property {{ fetch: (request: Request) => Promise<Response> }} ASSETS
 * @property {string} [GITHUB_OAUTH_CLIENT_ID]
 * @property {string} [GITHUB_OAUTH_CLIENT_SECRET]
 * @property {string} [SESSION_SECRET]
 * @property {string} [GITHUB_TOKEN]
 * @property {string} [ADMIN_GITHUB_LOGINS]
 * @property {string} [ADMIN_GITHUB_IDS]
 * @property {string} [ADMIN_REPO]
 */

/** @param {Env} env */
function missingConfig(env) {
  const needed = ["GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET", "SESSION_SECRET", "ADMIN_GITHUB_LOGINS"];
  const missing = needed.filter((key) => !env[key]);
  if (!missing.length) return null;
  return text(
    503,
    "Admin sign-in is not configured yet. Missing Worker secrets: " +
      missing.join(", ") +
      ". Run `wrangler secret put <NAME>` (see worker/index.js for the list).",
  );
}

/** @param {string|undefined} value */
function splitList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** @param {URL} url */
function callbackUrl(url) {
  return url.origin + CALLBACK_PATH;
}

/** @param {URL} url */
function loginUrl(url) {
  const next = url.pathname + url.search;
  const safe = next.startsWith("/admin") && !next.startsWith("/admin/auth") ? next : "/admin/";
  return "/admin/auth/login?next=" + encodeURIComponent(safe);
}

/** @param {string|null} value */
function safeNext(value) {
  if (!value || !value.startsWith("/admin") || value.startsWith("/admin/auth")) return "/admin/";
  return value;
}


/* ── Cookies + crypto ───────────────────────────────────────────────── */

/** @param {Request} request @param {string} name */
function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * @param {string} name
 * @param {string} value
 * @param {{ maxAge?: number, httpOnly?: boolean }} [options]
 */
function cookie(name, value, options = {}) {
  const httpOnly = options.httpOnly !== false;
  let out = `${name}=${encodeURIComponent(value)}; Path=/admin; SameSite=Lax; Secure`;
  if (httpOnly) out += "; HttpOnly";
  if (options.maxAge !== undefined) out += `; Max-Age=${options.maxAge}`;
  return out;
}

/** @param {Uint8Array} bytes */
function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** @param {string} value */
function fromBase64url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** @param {string} textValue @param {string} secret */
async function hmac(textValue, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(textValue));
  return base64url(new Uint8Array(signature));
}

/** Constant-time string compare. @param {string} a @param {string} b */
function equal(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

/** @param {number} [byteLength] */
function randomToken(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/* ── Session ────────────────────────────────────────────────────────── */

/**
 * @param {Env} env
 * @param {{ login: string, id: number, name?: string|null, avatar_url?: string }} user
 */
async function createSession(env, user) {
  const claims = {
    login: user.login,
    id: user.id,
    name: user.name || user.login,
    avatar: user.avatar_url || "",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL,
  };
  const body = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  return body + "." + (await hmac(body, /** @type {string} */ (env.SESSION_SECRET)));
}

/** @param {Request} request @param {Env} env */
async function readSession(request, env) {
  const secret = env.SESSION_SECRET;
  if (!secret) return null;
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  const split = raw.lastIndexOf(".");
  if (split < 1) return null;
  const body = raw.slice(0, split);
  const signature = raw.slice(split + 1);
  if (!equal(signature, await hmac(body, secret))) return null;
  /** @type {{ login?: string, id?: number, exp?: number }} */
  let claims;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
  } catch {
    return null;
  }
  if (!claims || typeof claims.exp !== "number") return null;
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}

/* ── Responses ──────────────────────────────────────────────────────── */

/** @param {string} location @param {number} [status] */
function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: { Location: location, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

/** @param {number} status @param {string} message */
function text(status, message) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/** @param {number} status @param {unknown} payload */
function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}


/* ── OAuth ──────────────────────────────────────────────────────────── */

/**
 * Step 1: bounce to GitHub with a one-shot state value and the `next` target.
 * @param {Request} request @param {Env} env @param {URL} url
 */
function handleLogin(request, env, url) {
  const configError = missingConfig(env);
  if (configError) return configError;

  const state = randomToken();
  const target = new URL(AUTHORIZE_URL);
  target.searchParams.set("client_id", /** @type {string} */ (env.GITHUB_OAUTH_CLIENT_ID));
  target.searchParams.set("redirect_uri", callbackUrl(url));
  // read:user is all the login needs - writes go through the Worker's PAT.
  target.searchParams.set("scope", "read:user");
  target.searchParams.set("state", state);
  target.searchParams.set("allow_signup", "false");

  const response = redirect(target.toString());
  response.headers.append("Set-Cookie", cookie(STATE_COOKIE, state, { maxAge: 600 }));
  response.headers.append(
    "Set-Cookie",
    cookie(NEXT_COOKIE, safeNext(url.searchParams.get("next")), { maxAge: 600 }),
  );
  return response;
}

/**
 * Step 2: verify state, swap the code for a token, check the allowlist, and
 * mint the session cookie.
 * @param {Request} request @param {Env} env @param {URL} url
 */
async function handleCallback(request, env, url) {
  const configError = missingConfig(env);
  if (configError) return configError;

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (url.searchParams.get("error")) {
    return text(403, "GitHub sign-in was cancelled (" + url.searchParams.get("error") + ").");
  }
  if (!code) return text(400, "GitHub sign-in failed: no authorization code.");
  const expectedState = getCookie(request, STATE_COOKIE);
  if (!state || !expectedState || !equal(state, expectedState)) {
    return text(400, "GitHub sign-in failed: state mismatch. Start again at /admin/auth/login.");
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(url),
    }),
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  const accessToken = tokenPayload && tokenPayload.access_token;
  if (!accessToken) {
    console.error("github token exchange failed", JSON.stringify(tokenPayload).slice(0, 300));
    return text(502, "GitHub rejected the sign-in code. Check the OAuth App client id/secret.");
  }

  const userResponse = await fetch(API_URL + "/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + accessToken,
      "User-Agent": "techtips-admin-worker",
    },
  });
  if (!userResponse.ok) return text(502, "Could not read the GitHub profile for this sign-in.");
  const user = await userResponse.json();

  const logins = splitList(env.ADMIN_GITHUB_LOGINS).map((value) => value.toLowerCase());
  const ids = splitList(env.ADMIN_GITHUB_IDS).map(Number);
  const allowed = ids.includes(user.id) || logins.includes(String(user.login).toLowerCase());
  if (!allowed) {
    console.warn("blocked admin sign-in", user.login, user.id);
    return text(
      403,
      "Signed in as " + user.login + ", but that account is not allowed to open this dashboard.",
    );
  }

  const session = await createSession(env, user);
  const response = redirect(safeNext(getCookie(request, NEXT_COOKIE)));
  response.headers.append("Set-Cookie", cookie(SESSION_COOKIE, session, { maxAge: SESSION_TTL }));
  // Readable on purpose: app.js uses it to pick OAuth mode over the PAT gate.
  response.headers.append(
    "Set-Cookie",
    cookie(MODE_COOKIE, "oauth", { maxAge: SESSION_TTL, httpOnly: false }),
  );
  response.headers.append("Set-Cookie", cookie(STATE_COOKIE, "", { maxAge: 0 }));
  response.headers.append("Set-Cookie", cookie(NEXT_COOKIE, "", { maxAge: 0 }));
  return response;
}

/** @param {Request} request */
function handleLogout(request) {
  /* Send the operator to the public site, not back to /admin/auth/login:
     GitHub would silently re-approve and sign them straight back in. */
  const response = redirect("/");
  response.headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", { maxAge: 0 }));
  response.headers.append("Set-Cookie", cookie(MODE_COOKIE, "", { maxAge: 0, httpOnly: false }));
  return response;
}


/* ── Session + GitHub proxy ─────────────────────────────────────────── */

/** @param {Request} request @param {Env} env */
async function handleSession(request, env) {
  const claims = await readSession(request, env);
  if (!claims) return json(401, { error: "not_signed_in" });
  return json(200, {
    login: claims.login,
    name: /** @type {any} */ (claims).name,
    avatar: /** @type {any} */ (claims).avatar,
    repo: env.ADMIN_REPO || DEFAULT_REPO,
    expiresAt: claims.exp,
  });
}

/**
 * Proxy GitHub REST calls so the PAT never reaches the browser. Only the
 * configured repository (plus /user) is reachable, and the caller's own
 * Authorization/Cookie headers are dropped.
 * @param {Request} request @param {Env} env @param {URL} url
 */
async function handleProxy(request, env, url) {
  const claims = await readSession(request, env);
  if (!claims) return json(401, { error: "not_signed_in" });
  if (!env.GITHUB_TOKEN) {
    return json(503, { error: "GITHUB_TOKEN secret is not set on the Worker." });
  }

  const rest = url.pathname.slice("/admin/api/github".length) || "/";
  const repo = env.ADMIN_REPO || DEFAULT_REPO;
  const allowed =
    rest === "/user" || rest === `/repos/${repo}` || rest.startsWith(`/repos/${repo}/`);
  if (!allowed) return json(403, { error: "path_not_allowed", path: rest });

  const headers = new Headers();
  const accept = request.headers.get("Accept");
  const contentType = request.headers.get("Content-Type");
  headers.set("Accept", accept || "application/vnd.github+json");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Authorization", "Bearer " + env.GITHUB_TOKEN);
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  headers.set("User-Agent", "techtips-admin-worker");

  /** @type {RequestInit} */
  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(API_URL + rest + url.search, init);
  const out = new Headers();
  for (const name of ["content-type", "etag", "link", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  out.set("Cache-Control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
