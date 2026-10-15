/**
 * The content-collection entry id Astro derives from a blog filename.
 *
 * The id is used for BOTH the post URL (`/blog/<id>/`) and its social card
 * (`/og/<id>.png` — see src/pages/blog/[...slug].astro), so every script that
 * names a card, a LinkedIn teaser or an IndexNow URL has to agree with it.
 *
 * Astro lowercases the filename, drops every character outside [a-z0-9 _-] and
 * turns spaces into dashes:
 *
 *   "Simple-Ghostty-terminal-configuration-guide.md"
 *     -> "simple-ghostty-terminal-configuration-guide"
 *   "update-tpm- firmware-in-windows-11-guide (1).md"
 *     -> "update-tpm--firmware-in-windows-11-guide-1"
 *
 * Deriving the slug from the raw filename instead (`file.replace(/\.(md|mdx)$/i, '')`)
 * silently produces a URL the site does not serve: that is how the Ghostty and
 * TPM posts ended up with 404 social images (2026-10-15). Always use this helper.
 *
 * @param {string} filename file name or path, with or without the extension
 * @returns {string} the entry id / URL slug / social card name
 */
export function postSlug(filename) {
  return String(filename)
    .replace(/\.(md|mdx)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, '')
    .replace(/ /g, '-');
}
