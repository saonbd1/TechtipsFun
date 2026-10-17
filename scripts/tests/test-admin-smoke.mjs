/**
 * Integration smoke test for the admin dashboard.
 *
 * The unit tests cover the pure helpers; this one proves the UI actually runs.
 * It builds a permissive stub DOM, mocks fetch with canned GitHub Contents API
 * responses, boots public/admin/app.js, then drives it the way a person would:
 * sign in, open every page, open the editor, save a post.
 *
 * It cannot check that the HTML looks right — it checks that nothing throws,
 * that the right requests are made, and that saves carry the expected payload.
 *
 * Run with:  npm run test:admin
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../public/admin/app.js', import.meta.url), 'utf8');

const POST_TEXT = `---
title: "Existing post"
description: "An existing post."
heroImage: "/x.webp"
pubDate: "Jul 17 2026"
category: "Web Development"
tags: ["Astro", "SEO"]
---

Body of the existing post.
`;

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');

/* ── A stub DOM ──────────────────────────────────────────────────────── */

function createDom() {
  const registry = new Map();

  function makeElement(selector) {
    return {
      selector,
      innerHTML: '',
      textContent: '',
      value: '',
      hidden: false,
      disabled: false,
      checked: false,
      files: [],
      style: {},
      dataset: {},
      handlers: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      addEventListener(type, handler) {
        (this.handlers[type] = this.handlers[type] || []).push(handler);
      },
      removeEventListener() {},
      setAttribute() {},
      getAttribute: () => null,
      querySelector: (inner) => makeElement(selector + ' ' + inner),
      querySelectorAll: () => [],
      appendChild() {},
      remove() {},
      replaceWith() {},
      focus() {},
      setSelectionRange() {},
      dispatchEvent() {},
      closest: () => null
    };
  }

  function lookup(selector) {
    if (!registry.has(selector)) registry.set(selector, makeElement(selector));
    return registry.get(selector);
  }

  const documentHandlers = {};
  const document = {
    readyState: 'complete',
    body: makeElement('body'),
    addEventListener(type, handler) {
      (documentHandlers[type] = documentHandlers[type] || []).push(handler);
    },
    querySelector: lookup,
    querySelectorAll: () => [],
    createElement: () => makeElement('created'),
    documentElement: makeElement('html')
  };

  return { document, documentHandlers, lookup };
}

/* ── Stub storage ────────────────────────────────────────────────────── */

function createStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    _map: map
  };
}

/* ── Canned GitHub API ───────────────────────────────────────────────── */

function createApi() {
  const calls = [];
  const state = { postText: POST_TEXT, orderText: 'queued.md\n', saved: null, rejectAuth: false };

  const files = {
    'src/content/blog/existing-post.md': { text: () => state.postText, sha: 'sha-post' },
    'pending-posts/.order': { text: () => state.orderText, sha: 'sha-order' }
  };

  const dirs = {
    'src/content/blog': [
      {
        name: 'existing-post.md',
        path: 'src/content/blog/existing-post.md',
        sha: 'sha-post',
        size: POST_TEXT.length,
        type: 'file'
      }
    ],
    'pending-posts': [
      { name: 'queued.md', path: 'pending-posts/queued.md', sha: 'sha-q', size: 120, type: 'file' }
    ],
    'public/article-media': [
      { name: 'shot.png', path: 'public/article-media/shot.png', sha: 'sha-m', size: 2048, type: 'file' }
    ],
    'public/og': [
      { name: 'existing-post.png', path: 'public/og/existing-post.png', sha: 'sha-o', size: 4096, type: 'file' }
    ]
  };

  function json(body, status = 200) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body))
    });
  }

  function handle(url, init) {
    const method = (init && init.method) || 'GET';
    const path = String(url).replace('https://api.github.com', '').split('?')[0];
    const body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });

    if (path === '/user') {
      return state.rejectAuth
        ? json({ message: 'Bad credentials' }, 401)
        : json({ login: 'tester', name: 'Test Person' });
    }
    /* The app defaults to the real repository, so match any owner/name. */
    if (/^\/repos\/[^/]+\/[^/]+$/.test(path)) {
      return json({ default_branch: 'main', full_name: path.replace(/^\/repos\//, '') });
    }

    const match = path.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/);
    if (!match) return json({ message: 'Unhandled ' + path }, 404);
    const target = match[1];
    calls[calls.length - 1].target = target;

    if (method === 'PUT') {
      const text = Buffer.from(body.content, 'base64').toString('utf8');
      state.saved = { path: target, body, text };
      if (target === 'pending-posts/.order') state.orderText = text;
      if (target.startsWith('src/content/blog/')) state.postText = text;
      return json({ commit: { sha: 'new-sha' } });
    }
    if (method === 'DELETE') return json({ commit: { sha: 'del-sha' } });
    if (dirs[target]) return json(dirs[target]);
    if (files[target]) {
      const entry = files[target];
      return json({
        type: 'file',
        name: target.split('/').pop(),
        path: target,
        sha: entry.sha,
        size: entry.text().length,
        content: b64(entry.text())
      });
    }
    return json({ message: 'Not Found' }, 404);
  }

  return { handle, calls, state, dirs };
}

/* ── Boot the app in a sandbox ───────────────────────────────────────── */

function boot() {
  const dom = createDom();
  const api = createApi();
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const windowHandlers = {};
  const location = {
    hash: '',
    replace(next) {
      this.hash = next.startsWith('#') ? next : '#' + next;
    }
  };

  const sandbox = {
    TextEncoder,
    TextDecoder,
    btoa,
    atob,
    console,
    Promise,
    setTimeout,
    clearTimeout,
    URL,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
    fetch: (url, init) => api.handle(url, init),
    localStorage,
    sessionStorage,
    location,
    document: dom.document,
    window: {
      addEventListener(type, handler) {
        (windowHandlers[type] = windowHandlers[type] || []).push(handler);
      },
      bootstrap: {
        Modal: { getOrCreateInstance: () => ({ show() {}, hide() {} }) },
        Alert: { getOrCreateInstance: () => ({ close() {} }) }
      }
    }
  };
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'app.js' });

  return { sandbox, dom, api, localStorage, sessionStorage, windowHandlers, location };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

async function settle() {
  for (let i = 0; i < 80; i++) await flush();
}

async function navigate(app, hash) {
  app.location.hash = hash;
  for (const handler of app.windowHandlers.hashchange || []) handler({});
  await settle();
}

async function signIn(app) {
  app.dom.lookup('#gate-token').value = 'github_pat_test';
  const form = app.dom.lookup('#gate-form');
  for (const handler of form.handlers.submit || []) handler({ preventDefault() {} });
  await settle();
}

const viewHtml = (app) => app.dom.lookup('#view').innerHTML;

/* ── Tests ───────────────────────────────────────────────────────────── */

test('boots to the sign-in gate and touches nothing else', () => {
  const app = boot();
  assert.equal(app.dom.lookup('#gate').hidden, false, 'the gate is visible');
  assert.equal(app.dom.lookup('.app-wrapper').style.display, 'none', 'the app is hidden');
  assert.equal(app.dom.lookup('#gate-repo').textContent, 'saonbd1/astro-blog-starter-template');
  assert.deepEqual(app.api.calls, [], 'no API call is made before signing in');
  assert.equal(viewHtml(app), '', 'no view is rendered before signing in');
});

test('a rejected token keeps the gate up and stores nothing', async () => {
  const app = boot();
  app.api.state.rejectAuth = true;
  await signIn(app);
  assert.equal(app.dom.lookup('#gate').hidden, false, 'the gate stays visible');
  assert.match(app.dom.lookup('#gate-error').textContent, /Bad credentials|rejected/i);
  assert.equal(app.sessionStorage.getItem('ttadmin.token'), null);
  assert.equal(app.localStorage.getItem('ttadmin.token.remember'), null);
});

test('signing in renders the dashboard with live counts', async () => {
  const app = boot();
  await signIn(app);
  assert.equal(app.dom.lookup('#gate').hidden, true, 'the gate is hidden');
  assert.equal(app.sessionStorage.getItem('ttadmin.token'), 'github_pat_test', 'session-scoped by default');
  assert.equal(app.localStorage.getItem('ttadmin.token.remember'), null);

  const html = viewHtml(app);
  assert.match(html, /Published posts/);
  assert.match(html, /Existing post/, 'the newest posts table lists the post');
  assert.equal(app.dom.lookup('#nav-posts-count').textContent, '1');
  assert.equal(app.dom.lookup('#nav-queue-count').textContent, '1');
  assert.equal(
    app.dom.lookup('#footer-repo').textContent,
    'saonbd1/astro-blog-starter-template · main'
  );
});

test('every page renders without throwing', async () => {
  const app = boot();
  await signIn(app);

  const pages = [
    ['#/dashboard', /Published posts/],
    ['#/posts', /Published posts|No posts match/],
    ['#/queue', /Publish queue/],
    ['#/media', /Library/],
    ['#/settings', /Repository/]
  ];

  for (const [hash, expected] of pages) {
    await navigate(app, hash);
    const html = viewHtml(app);
    assert.ok(html.length > 0, `${hash} rendered nothing`);
    assert.match(html, expected, `${hash} did not render its expected content`);
    assert.ok(!/Something went wrong/.test(html), `${hash} rendered the error panel`);
  }
});


test('the editor loads a post, parses frontmatter and previews the body', async () => {
  const app = boot();
  await signIn(app);
  await navigate(app, '#/posts/edit/' + encodeURIComponent('src/content/blog/existing-post.md'));

  const html = viewHtml(app);
  assert.match(html, /Existing post/, 'the title is shown');
  assert.match(html, /Web Development/, 'the category is shown');
  assert.match(html, /value="2026-07-17"/, 'the publish date is shown');
  assert.match(html, /value="existing-post\.md" readonly/, 'the filename is shown and locked');
  assert.match(html, /Body of the existing post\./, 'the body is in the textarea');

  /* The preview is written into its own element, and updates are debounced, so
     type into the body the way the input event would and wait it out. */
  app.dom.lookup('#f-body').value = 'Body of the existing post.';
  for (const handler of app.dom.lookup('#f-body').handlers.input || []) handler({});
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.match(
    app.dom.lookup('#f-preview').innerHTML,
    /<p>Body of the existing post\.<\/p>/,
    'the Markdown preview rendered the body'
  );
});

test('saving an existing post commits frontmatter and body to the blog folder', async () => {
  const app = boot();
  await signIn(app);
  await navigate(app, '#/posts/edit/' + encodeURIComponent('src/content/blog/existing-post.md'));

  /* The stub DOM does not derive input values from the rendered HTML, so fill
     the form the way a person would before pressing save. */
  app.dom.lookup('#f-title').value = 'Existing post';
  app.dom.lookup('#f-description').value = 'An existing post.';
  app.dom.lookup('#f-hero').value = 'x.webp';
  app.dom.lookup('#f-pubdate').value = '2026-07-17';
  app.dom.lookup('#f-category').value = 'Web Development';
  app.dom.lookup('#f-tags').value = 'Astro, SEO';
  app.dom.lookup('#f-body').value = 'Updated body text.';

  for (const handler of app.dom.lookup('#editor-save').handlers.click || []) handler({});
  await settle();

  const saved = app.api.state.saved;
  assert.ok(saved, 'a PUT was issued');
  assert.equal(saved.path, 'src/content/blog/existing-post.md');
  assert.equal(saved.body.branch, 'main');
  assert.match(saved.body.message, /admin: update post existing-post/);
  assert.equal(saved.body.sha, 'sha-post', 'the existing file sha is sent so the write is not rejected');

  assert.match(saved.text, /^---\n/);
  assert.match(saved.text, /title: "Existing post"/);
  assert.match(saved.text, /heroImage: "\/x\.webp"/, 'the leading slash is restored');
  assert.match(saved.text, /pubDate: "Jul 17 2026"/);
  assert.match(saved.text, /tags: \["Astro", "SEO"\]/);
  assert.match(saved.text, /\n---\n\nUpdated body text\.\n$/, 'the body is saved verbatim');
});

test('saving without a title is refused instead of committing bad frontmatter', async () => {
  const app = boot();
  await signIn(app);
  await navigate(app, '#/posts/new');

  const before = app.api.calls.length;
  for (const handler of app.dom.lookup('#editor-save').handlers.click || []) handler({});
  await settle();

  assert.equal(app.api.calls.length, before, 'nothing was committed');
  assert.equal(app.api.state.saved, null);
});

test('a new queued draft is written and appended to .order', async () => {
  const app = boot();
  await signIn(app);
  await navigate(app, '#/queue/new');

  app.dom.lookup('#f-title').value = 'Brand new draft';
  app.dom.lookup('#f-description').value = 'A draft.';
  app.dom.lookup('#f-category').value = 'Web Development';
  app.dom.lookup('#f-pubdate').value = '2026-07-17';
  app.dom.lookup('#f-name').value = 'brand-new-draft.md';
  app.dom.lookup('#f-enqueue').checked = true;
  app.dom.lookup('#f-body').value = 'Draft body.';

  for (const handler of app.dom.lookup('#editor-save').handlers.click || []) handler({});
  await settle();

  const puts = app.api.calls.filter((call) => call.method === 'PUT');
  assert.equal(puts.length, 2, 'the draft and then .order are committed');
  assert.equal(puts[0].target, 'pending-posts/brand-new-draft.md');
  assert.match(puts[0].body.message, /admin: add queued draft brand-new-draft/);
  assert.equal(puts[1].target, 'pending-posts/.order');
  assert.equal(puts[1].body.sha, 'sha-order', '.order is updated with its current sha');
  assert.equal(
    app.api.state.orderText,
    'queued.md\nbrand-new-draft.md\n',
    'the draft is appended after the existing entry'
  );
  /* state.saved holds the most recent write (.order), so read the draft itself. */
  const draft = Buffer.from(puts[0].body.content, 'base64').toString('utf8');
  assert.match(draft, /title: "Brand new draft"/);
  assert.match(draft, /pubDate: "Jul 17 2026"/);
});

