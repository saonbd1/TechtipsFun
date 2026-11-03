import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  InstapaperClient,
  findFolder,
  normaliseBookmarks,
  normaliseFolders,
} from '../instapaper.mjs';

const FOLDERS = [
  { type: 'folder', folder_id: 1001, title: 'Tech News', display_title: 'Tech News', position: 1 },
  { type: 'folder', folder_id: 1002, title: 'Later', display_title: 'Read Later', position: 2 },
];

/** Fake authenticated user; authFor() only needs to return a header string here. */
function fakeUser() {
  return {
    oauthToken: 'token',
    oauthTokenSecret: 'secret',
    authFor: (method, path) => `OAuth fake(${method} ${path})`,
  };
}

/** Replace global fetch for one test and record every request. */
function stubFetch(t, handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: String(init.body ?? '') });
    const result = await handler(String(url), init, calls.length);
    return {
      ok: result.ok ?? true,
      status: result.status ?? 200,
      json: async () => result.json ?? [],
      text: async () => result.text ?? '',
    };
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return calls;
}

test('findFolder matches title case-insensitively', () => {
  assert.equal(findFolder(FOLDERS, 'tech news').folder_id, 1001);
});

test('findFolder matches display_title and keeps numeric ids', () => {
  const match = findFolder(FOLDERS, 'Read Later');
  assert.equal(match.folder_id, 1002);
  assert.equal(match.title, 'Later');
});

test('findFolder returns null for unknown or empty names', () => {
  assert.equal(findFolder(FOLDERS, 'Podcasts'), null);
  assert.equal(findFolder(FOLDERS, '  '), null);
  assert.equal(findFolder(undefined, 'Tech News'), null);
});

test('findFolder tolerates folders that expose `id` instead of `folder_id`', () => {
  assert.equal(findFolder([{ id: 42, title: 'Tech News' }], 'Tech News').folder_id, 42);
});

test('normaliseFolders drops rows without an id and meta rows', () => {
  const folders = normaliseFolders([
    { type: 'folder', folder_id: 7, title: 'Tech News' },
    { type: 'meta', bookmark_count: 3 },
    { type: 'folder', title: 'No id' },
  ]);
  assert.deepEqual(folders.map((f) => f.folder_id), [7]);
});

test('normaliseBookmarks drops the meta row from bookmarks/list', () => {
  const bookmarks = normaliseBookmarks([
    { type: 'meta', bookmark_count: 2, limit: 500, have: '' },
    { type: 'bookmark', bookmark_id: 1, url: 'https://example.com/a' },
    { type: 'bookmark', bookmark_id: 2, url: 'https://example.com/b' },
  ]);
  assert.deepEqual(bookmarks.map((b) => b.bookmark_id), [1, 2]);
});

test('listBookmarks sends folder_id, limit and have to the API', async (t) => {
  const calls = stubFetch(t, () => ({ json: [{ type: 'bookmark', bookmark_id: 1 }] }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  await client.listBookmarks(fakeUser(), { folderId: 1001, limit: 500, have: '9,8' });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/bookmarks\/list$/);
  const params = new URLSearchParams(calls[0].body);
  assert.equal(params.get('folder_id'), '1001');
  assert.equal(params.get('limit'), '500');
  assert.equal(params.get('have'), '9,8');
  assert.equal(params.get('format'), 'json');
});

test('listBookmarks defaults to the unread folder', async (t) => {
  const calls = stubFetch(t, () => ({ json: [] }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  await client.listBookmarks(fakeUser());

  assert.equal(new URLSearchParams(calls[0].body).get('folder_id'), 'unread');
});

test('listAllBookmarks paginates with `have` and stops on a short page', async (t) => {
  const pageOne = Array.from({ length: 500 }, (_, i) => ({ type: 'bookmark', bookmark_id: i + 1 }));
  const pageTwo = [{ type: 'bookmark', bookmark_id: 501 }];

  const calls = stubFetch(t, (_url, _init, callCount) => ({
    json: [{ type: 'meta', bookmark_count: 501 }, ...(callCount === 1 ? pageOne : pageTwo)],
  }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  const all = await client.listAllBookmarks(fakeUser(), { folderId: 1001, pageSize: 500 });

  assert.equal(all.length, 501);
  assert.equal(calls.length, 2);
  assert.equal(new URLSearchParams(calls[0].body).get('have'), null);
  assert.equal(new URLSearchParams(calls[1].body).get('have').split(',').length, 500);
  assert.equal(new URLSearchParams(calls[1].body).get('folder_id'), '1001');
});

test('listAllBookmarks stops when the API keeps returning the same rows', async (t) => {
  const fullPage = Array.from({ length: 3 }, (_, i) => ({ type: 'bookmark', bookmark_id: i + 1 }));
  const calls = stubFetch(t, () => ({ json: fullPage }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  const all = await client.listAllBookmarks(fakeUser(), { folderId: 1001, pageSize: 3 });

  assert.equal(all.length, 3);
  assert.equal(calls.length, 2);
});

test('listFolders returns normalised folders', async (t) => {
  const calls = stubFetch(t, () => ({ json: [{ type: 'meta' }, ...FOLDERS] }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  const folders = await client.listFolders(fakeUser());

  assert.match(calls[0].url, /\/folders\/list$/);
  assert.deepEqual(folders.map((f) => f.title), ['Tech News', 'Later']);
});

test('resolveFolderId passes special folder names through', async (t) => {
  const calls = stubFetch(t, () => ({ json: FOLDERS }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  assert.equal(await client.resolveFolderId(fakeUser(), 'unread'), 'unread');
  assert.equal(await client.resolveFolderId(fakeUser(), 'Starred'), 'starred');
  assert.equal(await client.resolveFolderId(fakeUser(), 'archive'), 'archive');
  assert.equal(calls.length, 0);
});

test('resolveFolderId finds "Tech News" and returns its numeric id', async (t) => {
  stubFetch(t, () => ({ json: FOLDERS }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  assert.equal(await client.resolveFolderId(fakeUser(), '  tech news '), 1001);
});

test('resolveFolderId returns null when the folder does not exist', async (t) => {
  stubFetch(t, () => ({ json: FOLDERS }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  assert.equal(await client.resolveFolderId(fakeUser(), 'Podcasts'), null);
});

test('addBookmark sends folder_id when provided', async (t) => {
  const calls = stubFetch(t, () => ({ text: '{"ok":true}' }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  await client.addBookmark(fakeUser(), {
    url: 'https://www.techtips.fun/blog/example/',
    title: 'Example',
    description: 'Desc',
    folderId: 1001,
  });

  assert.match(calls[0].url, /\/bookmarks\/add$/);
  const params = new URLSearchParams(calls[0].body);
  assert.equal(params.get('folder_id'), '1001');
  assert.equal(params.get('title'), 'Example');
  assert.equal(params.get('url'), 'https://www.techtips.fun/blog/example/');
});

test('addBookmark omits folder_id when it is not provided', async (t) => {
  const calls = stubFetch(t, () => ({ text: '{"ok":true}' }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  await client.addBookmark(fakeUser(), { url: 'https://example.com/' });

  assert.equal(new URLSearchParams(calls[0].body).has('folder_id'), false);
});

test('resolveFolder reports the canonical folder title', async (t) => {
  stubFetch(t, () => ({ json: FOLDERS }));
  const client = new InstapaperClient({ consumerKey: 'ck', consumerSecret: 'cs' });

  assert.deepEqual(await client.resolveFolder(fakeUser(), 'tech news'), {
    type: 'folder',
    folder_id: 1001,
    title: 'Tech News',
    display_title: 'Tech News',
    position: 1,
    special: false,
  });
  assert.deepEqual(await client.resolveFolder(fakeUser(), 'archived'), null);
});
