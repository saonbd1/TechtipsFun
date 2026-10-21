export const BLOG_PAGE_SIZE = 8;

/** @param {number} page */
export function blogPageUrl(page) {
	return page === 1 ? '/blog/' : `/blog/page/${page}/`;
}

/**
 * Keep the listing and static routes on the same page size and date order.
 * @template {{ data: { pubDate: Date } }} T
 * @param {T[]} posts
 * @param {number} [currentPage]
 */
export function paginateBlogPosts(posts, currentPage = 1) {
	const totalPosts = posts.length;
	const totalPages = Math.max(1, Math.ceil(totalPosts / BLOG_PAGE_SIZE));
	if (!Number.isInteger(currentPage) || currentPage < 1 || currentPage > totalPages) {
		throw new RangeError('Invalid blog page');
	}
	const start = (currentPage - 1) * BLOG_PAGE_SIZE;
	const sortedPosts = [...posts].sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
	return {
		posts: sortedPosts.slice(start, start + BLOG_PAGE_SIZE),
		currentPage,
		totalPages,
		totalPosts,
		start,
	};
}