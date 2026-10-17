/**
 * Tests for the admin dashboard's pure logic in public/admin/app.js.
 *
 * The dashboard ships as a single IIFE with no build step, so there is nothing
 * to import. This test loads the file, swaps the browser boot block for an
 * export of the internal helpers, and runs it inside a `node:vm` context with
 * just enough browser globals to evaluate it.
 *
 * Run with:  npm run test:admin
 *        or: node --test scripts/tests/
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const APP_URL = new URL('../../public/admin/app.js', import.meta.url);
const source = readFileSync(APP_URL, 'utf8');

const BOOT_BLOCK = `  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
`;

const EXPORTED = [
  'parseFrontmatter',
  'buildFrontmatter',
  'renderMarkdown',
  'toInputDate',
  'fromInputDate',
  'todayStamp',
  'prettyDate',
  'slugify',
  'parseTags',
  'countWords',
  'validateFields',
  'sanitizeFileName',
  'queueRows',
  'state'
];

assert.ok(source.includes(BOOT_BLOCK), 'the boot block was not found in app.js — update this test');

const instrumented =
  source.replace(BOOT_BLOCK, `  globalThis.__admin = { ${EXPORTED.join(', ')} };\n`) + '\n';

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
  fetch: () => Promise.reject(new Error('network access is not available in tests')),
  window: {},
  document: {
    readyState: 'complete',
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {} }),
    body: {}
  }
};

vm.createContext(sandbox);
vm.runInContext(instrumented, sandbox, { filename: 'app.js' });

const admin = sandbox.__admin;
assert.ok(admin, 'app.js did not expose its internals');

/* Values built inside the vm live in another realm, so their Array prototype
   differs from ours. Re-create them here before comparing. */
const arr = (value) => Array.from(value);
const pick = (value, key) => Array.from(value, (item) => item[key]);

/* ── Frontmatter ─────────────────────────────────────────────────────── */

test('parseFrontmatter reads a real post from the repo', () => {
  const post = readFileSync(
    new URL('../../src/content/blog/migrate-static-html-site-to-astro.md', import.meta.url),
    'utf8'
  );
  const parsed = admin.parseFrontmatter(post);
  assert.equal(parsed.hasFrontmatter, true);
  assert.equal(parsed.fields.title, 'Migrate a Static HTML Site to Astro with Content Collections');
  assert.equal(parsed.fields.category, 'Web Development');
  assert.equal(parsed.fields.pubDate, 'Oct 02 2026');
  assert.equal(parsed.fields.heroImage, '/migrate-static-html-site-to-astro-hero.webp');
  assert.deepEqual(arr(parsed.fields.tags), ['Astro', 'Static Site', 'Content Collections', 'Migration']);
  assert.equal(parsed.extras.length, 0);
  assert.ok(parsed.body.trimStart().startsWith('In this project'));
});

test('parseFrontmatter tolerates blank lines inside the block', () => {
  const parsed = admin.parseFrontmatter(
    '---\n\ntitle: "Hello"\npubDate: "Oct 15 2026"\ntags:\n  - "One"\n  - "Two"\n\n---\n\nBody here.\n'
  );
  assert.equal(parsed.fields.title, 'Hello');
  assert.deepEqual(arr(parsed.fields.tags), ['One', 'Two']);
  /* The blank line after the closing fence is part of the body, exactly as it
     is in the real posts — the editor strips leading newlines when saving. */
  assert.equal(parsed.body, '\nBody here.\n');
});

test('parseFrontmatter keeps unknown keys instead of dropping them', () => {
  const parsed = admin.parseFrontmatter('---\ntitle: "T"\ndraft: true\nogImage: "/x.png"\n---\n\nBody\n');
  assert.equal(parsed.extras.length, 2);
  assert.deepEqual(pick(parsed.extras, 'key'), ['draft', 'ogImage']);
  const rebuilt = admin.buildFrontmatter(parsed.fields, parsed.extras);
  assert.ok(rebuilt.includes('draft: true'), 'unmanaged keys must survive a round trip');
  assert.ok(rebuilt.includes('ogImage: "/x.png"'));
});

test('buildFrontmatter writes the schema order and quotes scalars', () => {
  const out = admin.buildFrontmatter({
    title: 'A "quoted" title',
    description: 'Desc',
    heroImage: '/a.webp',
    pubDate: 'Jul 17 2026',
    updatedDate: 'Jul 20 2026',
    category: 'Web Development',
    tags: ['Astro', 'SEO']
  });
  const lines = out.split('\n');
  assert.equal(lines[0], '---');
  assert.equal(lines[lines.length - 1], '---');
  assert.deepEqual(
    arr(lines).slice(1, -1).map((line) => line.split(':')[0]),
    ['title', 'description', 'heroImage', 'pubDate', 'updatedDate', 'category', 'tags']
  );
  assert.ok(out.includes('title: "A \\"quoted\\" title"'));
  assert.ok(out.includes('tags: ["Astro", "SEO"]'));
});

test('buildFrontmatter omits empty optional fields', () => {
  const out = admin.buildFrontmatter({
    title: 'T',
    description: 'D',
    pubDate: 'Jul 17 2026',
    category: 'C',
    tags: []
  });
  assert.ok(!out.includes('heroImage'));
  assert.ok(!out.includes('updatedDate'));
  assert.ok(!out.includes('tags:'));
});

test('frontmatter round trip is stable', () => {
  const fields = {
    title: 'Round trip',
    description: 'Stable',
    heroImage: '/x.webp',
    pubDate: 'Jul 17 2026',
    category: 'C',
    tags: ['a', 'b']
  };
  const once = admin.buildFrontmatter(fields, []);
  const parsed = admin.parseFrontmatter(once + '\n\nBody\n');
  assert.equal(admin.buildFrontmatter(parsed.fields, parsed.extras), once);
});

/* ── Dates ───────────────────────────────────────────────────────────── */

test('date helpers round trip and match the scheduler format', () => {
  assert.equal(admin.fromInputDate('2026-07-17'), 'Jul 17 2026');
  assert.equal(admin.fromInputDate('2026-10-02'), 'Oct 02 2026');
  assert.equal(admin.toInputDate('Jul 17 2026'), '2026-07-17');
  assert.equal(admin.toInputDate('Oct 02 2026'), '2026-10-02');
  assert.equal(admin.prettyDate('Oct 02 2026'), 'Oct 02 2026');
  assert.equal(admin.fromInputDate(''), '');
  assert.equal(admin.toInputDate('not a date'), '');
  assert.match(admin.todayStamp(), /^[A-Z][a-z]{2} \d{2} \d{4}$/);
});

test('published post dates parse into a date input and back', () => {
  const files = ['migrate-static-html-site-to-astro.md', 'astro-table-of-contents-component-guide.md'];
  for (const name of files) {
    const post = readFileSync(new URL(`../../src/content/blog/${name}`, import.meta.url), 'utf8');
    const parsed = admin.parseFrontmatter(post);
    const input = admin.toInputDate(parsed.fields.pubDate);
    assert.match(input, /^\d{4}-\d{2}-\d{2}$/, `${name} pubDate should parse`);
    assert.equal(admin.fromInputDate(input), parsed.fields.pubDate, `${name} pubDate should round trip`);
  }
});

/* ── Slug / tags / words ─────────────────────────────────────────────── */

test('slugify matches the repo filename convention', () => {
  assert.equal(admin.slugify('How to Fix Windows 11 Wi-Fi!'), 'how-to-fix-windows-11-wi-fi');
  assert.equal(admin.slugify('a.md'), 'a');
  assert.equal(admin.slugify('  spaced  out  '), 'spaced-out');
});

test('parseTags splits, trims and drops blanks', () => {
  assert.deepEqual(arr(admin.parseTags('Astro, SEO ,, Windows 11')), ['Astro', 'SEO', 'Windows 11']);
  assert.deepEqual(arr(admin.parseTags('')), []);
});

test('countWords ignores fenced code blocks', () => {
  assert.equal(admin.countWords('one two three'), 3);
  assert.equal(admin.countWords('one\n```\nmany many words here\n```\ntwo'), 2);
});

test('sanitizeFileName makes a safe path segment', () => {
  assert.equal(
    admin.sanitizeFileName('Screenshot 2026-09-29 163710.png'),
    'Screenshot-2026-09-29-163710.png'
  );
  assert.equal(admin.sanitizeFileName('weird/../name?.png'), 'weird..name.png');
});

/* ── Validation ──────────────────────────────────────────────────────── */

test('validateFields enforces the content schema', () => {
  assert.deepEqual(
    arr(admin.validateFields({ title: 'T', description: 'D', pubDate: 'Jul 17 2026', category: 'C' })),
    []
  );
  assert.equal(admin.validateFields({}).length, 4);
  assert.equal(
    admin.validateFields({
      title: 'T',
      description: 'D',
      pubDate: 'Jul 17 2026',
      category: 'C',
      heroImage: 'nope.png'
    }).length,
    1
  );
});

/* ── Markdown preview ────────────────────────────────────────────────── */

test('renderMarkdown escapes raw HTML', () => {
  const html = admin.renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script>'), 'no live script tag is produced');
  assert.ok(!/<img[^>]*>/i.test(html), 'raw <img ...> is not turned into a tag');
  assert.ok(html.includes('&lt;script&gt;'), 'the raw HTML is shown as escaped text');
  assert.ok(html.includes('&lt;/script&gt;'));
});

test('renderMarkdown renders the constructs the posts use', () => {
  const md = [
    '## Heading',
    '',
    'A paragraph with **bold**, *italic*, `code` and a [link](https://example.com).',
    '',
    '- one',
    '- two',
    '',
    '1. first',
    '2. second',
    '',
    '> quoted',
    '',
    '```bash',
    'npm run build',
    '```',
    '',
    '![alt text](/img.png)',
    '',
    '| a | b |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
    '---'
  ].join('\n');
  const html = admin.renderMarkdown(md);
  assert.ok(html.includes('<h2>Heading</h2>'));
  assert.ok(html.includes('<strong>bold</strong>'));
  assert.ok(html.includes('<em>italic</em>'));
  assert.ok(html.includes('<code>code</code>'));
  assert.ok(html.includes('<a href="https://example.com"'));
  assert.ok(html.includes('<ul>\n<li>one</li>'));
  assert.ok(html.includes('<ol>\n<li>first</li>'));
  assert.ok(html.includes('<blockquote>quoted</blockquote>'));
  assert.ok(html.includes('<pre><code class="language-bash">npm run build</code></pre>'));
  assert.ok(html.includes('<img src="/img.png" alt="alt text"'));
  assert.ok(html.includes('<table><thead><tr>'));
  assert.ok(html.includes('<th>a</th>'));
  assert.ok(html.includes('<th>b</th>'));
  assert.ok(html.includes('<td>1</td>'));
  assert.ok(html.includes('<hr>'));
});

test('renderMarkdown handles an empty body', () => {
  assert.equal(admin.renderMarkdown(''), '');
  assert.equal(admin.renderMarkdown(null), '');
});

/* ── Queue ordering (mirrors schedule-posts.yml) ─────────────────────── */

test('queueRows follows .order, then appends stray files', () => {
  const state = admin.state;
  const previous = { order: state.order, pendingFiles: state.pendingFiles };
  state.order = ['b.md', 'a.md', 'gone.md'];
  state.pendingFiles = [
    { name: 'a.md', path: 'pending-posts/a.md', size: 1 },
    { name: 'b.md', path: 'pending-posts/b.md', size: 2 },
    { name: 'c.md', path: 'pending-posts/c.md', size: 3 }
  ];
  const rows = admin.queueRows();
  assert.deepEqual(pick(rows, 'name'), ['b.md', 'a.md', 'gone.md', 'c.md']);
  assert.equal(rows[0].inOrder, true);
  assert.equal(rows[0].file.name, 'b.md');
  assert.equal(rows[2].file, null, 'a missing file is still listed, flagged');
  assert.equal(rows[3].inOrder, false, 'a file not in .order is flagged');
  state.order = previous.order;
  state.pendingFiles = previous.pendingFiles;
});

/* ── Static sanity ───────────────────────────────────────────────────── */

test('every called identifier is declared or a known global', () => {
  /* This check exists because it already caught a real bug: `attr()` was called
     44 times before it was ever defined, which would have thrown a
     ReferenceError the first time a view rendered. Comments and string literals
     are stripped first so prose and message text cannot look like calls. */
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');

  const declared = new Set();
  for (const match of source.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) declared.add(match[1]);
  for (const match of source.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)) declared.add(match[1]);
  for (const match of source.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/[=\s]/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }

  const globals = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'new', 'delete', 'void', 'in',
    'of', 'function', 'fetch', 'btoa', 'atob', 'setTimeout', 'clearTimeout', 'setInterval',
    'Number', 'String', 'Array', 'Object', 'Boolean', 'Date', 'JSON', 'Math', 'Promise', 'Error',
    'TypeError', 'RegExp', 'TextEncoder', 'TextDecoder', 'Uint8Array', 'Int8Array', 'parseInt',
    'parseFloat', 'isNaN', 'decodeURIComponent', 'encodeURIComponent', 'Symbol', 'Map', 'Set',
    'WeakMap', 'Event', 'CustomEvent', 'AbortController', 'Blob', 'File', 'FileReader', 'URL',
    'URLSearchParams', 'confirm', 'alert', 'requestAnimationFrame', 'structuredClone', 'navigator',
    'document', 'window', 'globalThis', 'console', 'performance', 'crypto', 'localStorage',
    'sessionStorage', 'location', 'history', 'undefined', 'null', 'true', 'false', 'this'
  ]);

  const called = new Set();
  /* The backslash in the lookbehind skips escapes such as the `\u0000(` inside a
     regular expression literal. */
  for (const match of code.matchAll(/(?<![.\w$\\])([A-Za-z_$][\w$]*)\s*\(/g)) called.add(match[1]);

  const undefinedCalls = [...called].filter((name) => !declared.has(name) && !globals.has(name)).sort();
  assert.deepEqual(undefinedCalls, [], 'app.js calls identifiers that are never defined');
});

