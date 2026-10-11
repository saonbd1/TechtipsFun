// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import rehypeResponsiveImages from "./src/utils/rehype-responsive-images.mjs";


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
			}),
		],
});
