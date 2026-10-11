// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import fs from "node:fs";
import path from "node:path";
import rehypeResponsiveImages from "./src/utils/rehype-responsive-images.mjs";

const blogDir = "./src/content/blog";

// Maps each post URL slug to its last-modified date (updatedDate, else pubDate).
function readPostDates() {
	const dates = new Map();
	for (const file of fs.readdirSync(blogDir).filter((f) => /\.mdx?$/.test(f))) {
		const frontmatter = fs.readFileSync(path.join(blogDir, file), "utf8").match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? "";
		const field = (key) => frontmatter.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)`, "m"))?.[1];
		const date = new Date(field("updatedDate") ?? field("pubDate") ?? "");
		if (Number.isNaN(date.valueOf())) continue;
		const slug = file.replace(/\.mdx?$/, "").toLowerCase().replace(/[^a-z0-9 _-]/g, "").replace(/ /g, "-");
		dates.set(slug, date);
	}
	return dates;
}
const postDates = readPostDates();


// https://astro.build/config
export default defineConfig({
	output: "static",
	site: "https://www.techtips.fun",
	markdown: {
		rehypePlugins: [rehypeResponsiveImages],
	},
	integrations: [
			mdx(),
			sitemap({
				filter: (page) => !page.includes('/categories/') && !page.includes('/tags/') && !page.includes('/sitemap/'),
				serialize(item) {
					const slug = item.url.match(/\/blog\/([^/]+)\/$/)?.[1];
					const lastmod = slug && postDates.get(slug);
					return lastmod ? { ...item, lastmod: lastmod.toISOString() } : item;
				},
			}),
		],
});
