import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLOG_PAGE_SIZE, blogPageUrl, paginateBlogPosts } from '../../src/utils/blog-pagination.mjs';

const makePosts = (count) => Array.from({ length: count }, (_, index) => ({
	id: `post-${index + 1}`,
	data: { pubDate: new Date(Date.UTC(2026, 0, index + 1)) },
}));

test('limits pages to eight posts, newest first, without mutating the collection', () => {
	const posts = makePosts(19);
	const original = [...posts];
	const pages = [1, 2, 3].map((page) => paginateBlogPosts(posts, page));
	assert.equal(BLOG_PAGE_SIZE, 8);
	assert.deepEqual(pages.map((page) => page.posts.length), [8, 8, 3]);
	assert.deepEqual(pages.map((page) => page.start), [0, 8, 16]);
	assert.ok(pages.every((page) => page.totalPages === 3 && page.totalPosts === 19));
	assert.deepEqual(pages.flatMap((page) => page.posts), [...original].reverse());
	assert.deepEqual(posts, original);
});

test('handles empty collections and exact page boundaries without an extra page', () => {
	assert.deepEqual(paginateBlogPosts([]), {
		posts: [], currentPage: 1, totalPages: 1, totalPosts: 0, start: 0,
	});
	for (const count of [1, 6, 8, 16]) {
		const page = paginateBlogPosts(makePosts(count));
		assert.equal(page.totalPages, Math.ceil(count / 8));
		assert.equal(page.posts.length, Math.min(count, 8));
	}
});

test('rejects invalid or out-of-range pages', () => {
	for (const page of [0, -1, 1.5, 3, NaN]) {
		assert.throws(() => paginateBlogPosts(makePosts(9), page), RangeError);
	}
});

test('keeps page one at the existing blog URL', () => {
	assert.equal(blogPageUrl(1), '/blog/');
	assert.equal(blogPageUrl(2), '/blog/page/2/');
	assert.equal(blogPageUrl(10), '/blog/page/10/');
});