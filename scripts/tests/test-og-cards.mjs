import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function createBuild(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'techtips-og-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function write(relativePath, contents = '') {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  write('scripts/check-og-cards.mjs');
  copyFileSync(new URL('../check-og-cards.mjs', import.meta.url), path.join(root, 'scripts/check-og-cards.mjs'));
  write('dist/blog/index.html');
  write('dist/blog/article/index.html');
  write('dist/blog/page/2/index.html');
  write('public/og/article.png');
  return {
    write,
    run: () => spawnSync(process.execPath, [path.join(root, 'scripts/check-og-cards.mjs'), '--json'], { encoding: 'utf8' }),
  };
}

test('social card check ignores the pagination container', (t) => {
  const fixture = createBuild(t);
  const result = fixture.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { posts: 1, missing: [] });
});

test('social card check still rejects a missing article card', (t) => {
  const fixture = createBuild(t);
  fixture.write('dist/blog/missing-card/index.html');
  const result = fixture.run();
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { posts: 2, missing: ['missing-card'] });
});

test('an actual article named page still requires its own card', (t) => {
  const fixture = createBuild(t);
  fixture.write('dist/blog/page/index.html');
  const missing = fixture.run();
  assert.equal(missing.status, 1, missing.stderr);
  assert.deepEqual(JSON.parse(missing.stdout), { posts: 2, missing: ['page'] });
  fixture.write('public/og/page.png');
  const complete = fixture.run();
  assert.equal(complete.status, 0, complete.stderr);
  assert.deepEqual(JSON.parse(complete.stdout), { posts: 2, missing: [] });
});