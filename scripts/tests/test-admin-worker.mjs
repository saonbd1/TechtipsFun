/**
 * Tests for worker/index.js — the GitHub OAuth gate in front of /admin.
 *
 * No dependencies and no wrangler: the worker is a plain ES module whose
 * `fetch(request, env)` can be called directly. Node 22+ already has Request,
 * Response, crypto.subtle, TextEncoder and btoa, so only three things need
 * stubbing: the global `fetch` (GitHub's endpoints), `env.ASSETS`, and secrets.
 *
 * Run with:  npm run test:admin
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../../worker/index.js';

const SECRETS = {
  GITHUB_OAUTH_CLIENT_ID: 'client-id',
  GITHUB_OAUTH_CLIENT_SECRET: 'client-secret',
  SESSION_SECRET: 'test-session-secret-0123456789abcdef',
  GITHUB_TOKEN: 'github_pat_worker',
  ADMIN_GITHUB_LOGINS: 'saonbd1',
  ADMIN_REPO: 'saonbd1/TechtipsFun'
};

const ORIGIN = 'https://www.techtips.fun';

function makeEnv(overrides = {}) {
  const assets = {
    calls: 0,
    fetch(request) {
      assets.calls += 1;
      return new Response('asset:' + new URL(request.url).pathname, { status: 200 });
    }
  };
  return { env: { ASSETS: assets, ...SECRETS, ...overrides }, assets };
}

/* A stub GitHub: token exchange + /user, and a pass-through REST endpoint that
   echoes what the worker actually forwarded. */
function stubGitHub({ user = { login: 'saonbd1', id: 42, name: 'Owner' } } = {}) {
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    seen.push({ url: target, init });
    if (target === 'https://github.com/login/oauth/access_token') {
      return new Response(JSON.stringify({ access_token: 'gho_user_token' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (target === 'https://api.github.com/user') {
      return new Response(JSON.stringify(user), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ proxied: target }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-RateLimit-Remaining': '4999' }
    });
  };
  return seen;
}

const call = (path, options = {}) => {
  const { env } = makeEnv(options.env);
  return worker.fetch(
    new Request(ORIGIN + path, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body
    }),
    env
  );
};

const setCookies = (response) =>
  response.headers.getSetCookie ? response.headers.getSetCookie() : [];

const cookieValue = (response, name) => {
  const found = setCookies(response)
    .map((raw) => raw.split(';')[0])
    .find((pair) => pair.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
};

/** Walk login -> callback and return the cookie values it issued. */
async function signIn() {
  stubGitHub();
  const login = await call('/admin/auth/login?next=%2Fadmin%2F');
  const state = cookieValue(login, 'ttadmin_state');
  const callback = await call(`/admin/auth/callback?code=abc&state=${state}`, {
    headers: { Cookie: `ttadmin_state=${state}; ttadmin_next=/admin/` }
  });
  return {
    login,
    callback,
    session: cookieValue(callback, 'ttadmin_session'),
    mode: cookieValue(callback, 'ttadmin_mode')
  };
}

/* ── Gate ───────────────────────────────────────────────────────────── */

test('an anonymous /admin request is redirected to the login route', async () => {
  const { env, assets } = makeEnv();
  const response = await worker.fetch(new Request(ORIGIN + '/admin/'), env);
  assert.equal(response.status, 302);
  assert.match(response.headers.get('Location'), /^\/admin\/auth\/login\?next=/);
  assert.equal(assets.calls, 0, 'the static asset is never served without a session');
});

test('a valid session cookie lets the static asset through', async () => {
  const { session } = await signIn();
  const { env, assets } = makeEnv();
  const response = await worker.fetch(
    new Request(ORIGIN + '/admin/index.html', { headers: { Cookie: 'ttadmin_session=' + session } }),
    env
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'asset:/admin/index.html');
  assert.equal(assets.calls, 1);
});

test('a tampered session cookie is rejected', async () => {
  const { session } = await signIn();
  const [body, signature] = session.split('.');
  const forged = body + '.' + (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
  const { env, assets } = makeEnv();
  const response = await worker.fetch(
    new Request(ORIGIN + '/admin/', { headers: { Cookie: 'ttadmin_session=' + forged } }),
    env
  );
  assert.equal(response.status, 302);
  assert.equal(assets.calls, 0);
});

test('non-admin paths always go to the assets', async () => {
  const { env, assets } = makeEnv();
  const response = await worker.fetch(new Request(ORIGIN + '/blog/some-post/'), env);
  assert.equal(await response.text(), 'asset:/blog/some-post/');
  assert.equal(assets.calls, 1);
});

/* ── OAuth ──────────────────────────────────────────────────────────── */

test('login redirects to GitHub with client id, callback and state', async () => {
  const response = await call('/admin/auth/login');
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.origin + location.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(location.searchParams.get('client_id'), 'client-id');
  assert.equal(location.searchParams.get('redirect_uri'), ORIGIN + '/admin/auth/callback');
  assert.equal(location.searchParams.get('scope'), 'read:user');
  assert.ok(location.searchParams.get('state'), 'a state value is sent');
  assert.equal(location.searchParams.get('allow_signup'), 'false');

  const stateCookie = setCookies(response).find((raw) => raw.startsWith('ttadmin_state='));
  assert.match(stateCookie, /HttpOnly/);
  assert.match(stateCookie, /SameSite=Lax/);
  assert.match(stateCookie, /Secure/);
});

test('callback exchanges the code and sets session + mode cookies', async () => {
  const { callback, session, mode } = await signIn();
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('Location'), '/admin/');
  assert.ok(session, 'session cookie set');

  const sessionCookie = setCookies(callback).find((raw) => raw.startsWith('ttadmin_session='));
  assert.match(sessionCookie, /HttpOnly/, 'the session is not readable by script');
  assert.match(sessionCookie, /Path=\/admin/);
  assert.equal(mode, 'oauth');
  const modeCookie = setCookies(callback).find((raw) => raw.startsWith('ttadmin_mode='));
  assert.doesNotMatch(modeCookie, /HttpOnly/, 'app.js must be able to read the mode cookie');
});

test('callback rejects a state mismatch', async () => {
  const { env } = makeEnv();
  const response = await worker.fetch(
    new Request(ORIGIN + '/admin/auth/callback?code=abc&state=wrong', {
      headers: { Cookie: 'ttadmin_state=expected' }
    }),
    env
  );
  assert.equal(response.status, 400);
  assert.match(await response.text(), /state mismatch/i);
});

test('callback rejects a missing code or a cancelled login', async () => {
  const { env } = makeEnv();
  const missing = await worker.fetch(
    new Request(ORIGIN + '/admin/auth/callback?state=s', { headers: { Cookie: 'ttadmin_state=s' } }),
    env
  );
  assert.equal(missing.status, 400);
  const cancelled = await worker.fetch(
    new Request(ORIGIN + '/admin/auth/callback?error=access_denied&state=s', {
      headers: { Cookie: 'ttadmin_state=s' }
    }),
    env
  );
  assert.equal(cancelled.status, 403);
});

test('an allowed login is case-insensitive', async () => {
  stubGitHub({ user: { login: 'SaonBD1', id: 42 } });
  const login = await call('/admin/auth/login');
  const state = cookieValue(login, 'ttadmin_state');
  const response = await call(`/admin/auth/callback?code=abc&state=${state}`, {
    headers: { Cookie: `ttadmin_state=${state}` }
  });
  assert.equal(response.status, 302);
  assert.ok(cookieValue(response, 'ttadmin_session'));
});

test('an account outside the allowlist gets 403 and no cookie', async () => {
  stubGitHub({ user: { login: 'someone-else', id: 99 } });
  const login = await call('/admin/auth/login');
  const state = cookieValue(login, 'ttadmin_state');
  const response = await call(`/admin/auth/callback?code=abc&state=${state}`, {
    headers: { Cookie: `ttadmin_state=${state}` }
  });
  assert.equal(response.status, 403);
  assert.equal(cookieValue(response, 'ttadmin_session'), null);
  assert.match(await response.text(), /not allowed/i);
});

test('numeric ADMIN_GITHUB_IDS also grants access', async () => {
  stubGitHub({ user: { login: 'renamed-account', id: 42 } });
  const { env } = makeEnv({ ADMIN_GITHUB_LOGINS: 'nobody', ADMIN_GITHUB_IDS: '42' });
  const login = await worker.fetch(new Request(ORIGIN + '/admin/auth/login'), env);
  const state = cookieValue(login, 'ttadmin_state');
  const response = await worker.fetch(
    new Request(ORIGIN + `/admin/auth/callback?code=abc&state=${state}`, {
      headers: { Cookie: `ttadmin_state=${state}` }
    }),
    env
  );
  assert.equal(response.status, 302);
});

test('a next target outside /admin is not honoured', async () => {
  stubGitHub();
  const login = await call('/admin/auth/login?next=' + encodeURIComponent('https://evil.example/x'));
  const state = cookieValue(login, 'ttadmin_state');
  const next = cookieValue(login, 'ttadmin_next');
  assert.equal(next, '/admin/', 'open redirects are dropped');
  const response = await call(`/admin/auth/callback?code=abc&state=${state}`, {
    headers: { Cookie: `ttadmin_state=${state}; ttadmin_next=${encodeURIComponent(next)}` }
  });
  assert.equal(response.headers.get('Location'), '/admin/');
});

test('logout clears both cookies and leaves the admin area', async () => {
  const response = await call('/admin/auth/logout');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), '/');
  const jar = setCookies(response).join('\n');
  assert.match(jar, /ttadmin_session=;.*Max-Age=0/);
  assert.match(jar, /ttadmin_mode=;.*Max-Age=0/);
});

/* ── Session endpoint ───────────────────────────────────────────────── */

test('session returns the signed-in identity', async () => {
  const { session } = await signIn();
  const response = await call('/admin/api/session', {
    headers: { Cookie: 'ttadmin_session=' + session }
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.login, 'saonbd1');
  assert.equal(body.name, 'Owner');
  assert.equal(body.repo, 'saonbd1/TechtipsFun');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('session is 401 without a cookie', async () => {
  const response = await call('/admin/api/session');
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'not_signed_in');
});

/* ── GitHub proxy ───────────────────────────────────────────────────── */

test('proxy forwards to the configured repo with the Worker token', async () => {
  const { session } = await signIn();
  const seen = stubGitHub();
  const response = await call(
    '/admin/api/github/repos/saonbd1/TechtipsFun/contents/src/content/blog?ref=main',
    {
      headers: {
        Cookie: 'ttadmin_session=' + session,
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer browser-value-must-be-dropped'
      }
    }
  );
  assert.equal(response.status, 200);
  const request = seen.at(-1);
  assert.equal(
    request.url,
    'https://api.github.com/repos/saonbd1/TechtipsFun/contents/src/content/blog?ref=main'
  );
  assert.equal(request.init.headers.get('Authorization'), 'Bearer github_pat_worker');
  assert.equal(response.headers.get('X-RateLimit-Remaining'), '4999');
});

test('proxy refuses any other repository', async () => {
  const { session } = await signIn();
  const response = await call('/admin/api/github/repos/someone/else/contents/x', {
    headers: { Cookie: 'ttadmin_session=' + session }
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'path_not_allowed');
});

test('proxy requires a session', async () => {
  const response = await call('/admin/api/github/repos/saonbd1/TechtipsFun');
  assert.equal(response.status, 401);
});

test('proxy forwards PUT bodies untouched', async () => {
  const { session } = await signIn();
  const seen = stubGitHub();
  const payload = JSON.stringify({ message: 'edit', content: 'abc', branch: 'main' });
  await call('/admin/api/github/repos/saonbd1/TechtipsFun/contents/x.md', {
    method: 'PUT',
    headers: { Cookie: 'ttadmin_session=' + session, 'Content-Type': 'application/json' },
    body: payload
  });
  const init = seen.at(-1).init;
  assert.equal(init.method, 'PUT');
  assert.equal(new TextDecoder().decode(init.body), payload);
});

test('proxy reports a missing Worker PAT instead of calling GitHub', async () => {
  const { session } = await signIn();
  const { env } = makeEnv({ GITHUB_TOKEN: '' });
  const response = await worker.fetch(
    new Request(ORIGIN + '/admin/api/github/repos/saonbd1/TechtipsFun', {
      headers: { Cookie: 'ttadmin_session=' + session }
    }),
    env
  );
  assert.equal(response.status, 503);
  assert.match(await response.text(), /GITHUB_TOKEN/);
});

/* ── Misconfiguration ───────────────────────────────────────────────── */

test('an unconfigured Worker explains which secrets are missing', async () => {
  const { env, assets } = makeEnv({ GITHUB_OAUTH_CLIENT_ID: '', SESSION_SECRET: '' });
  const response = await worker.fetch(new Request(ORIGIN + '/admin/auth/login'), env);
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.match(body, /GITHUB_OAUTH_CLIENT_ID/);
  assert.match(body, /SESSION_SECRET/);
  assert.equal(assets.calls, 0);
});

test('a payload signed for another secret is rejected', async () => {
  const { session } = await signIn();
  const signature = session.split('.')[1];
  const forgedBody = Buffer.from(
    JSON.stringify({ login: 'attacker', id: 1, exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  const response = await call('/admin/api/session', {
    headers: { Cookie: 'ttadmin_session=' + forgedBody + '.' + signature }
  });
  assert.equal(response.status, 401, 'a swapped payload must not validate');
});
