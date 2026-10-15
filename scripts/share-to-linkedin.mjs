// Share a blog post to LinkedIn as a short teaser + link.
//
// Usage:
//   node scripts/share-to-linkedin.mjs <slug>             post one post by slug
//   node scripts/share-to-linkedin.mjs --latest           post the newest post (by pubDate)
//   node scripts/share-to-linkedin.mjs <slug> --dry-run   print the post text, no API call
//
// Requires:
//   LINKEDIN_TOKEN   LinkedIn OAuth access token with scopes:
//                    openid profile w_member_social
//                    (app needs the "Share on LinkedIn" AND "Sign In with
//                    LinkedIn" products; exchange the auth code for a token)
//   LINKEDIN_AUTHOR  optional override for the owner URN. Defaults to the
//                    profile resolved from GET /v2/userinfo ("sub" claim):
//                    urn:li:person:{sub}
//
// Posts via the legacy /v2/shares endpoint: the newer /v2/ugcPosts endpoint
// rejects urn:li:person URNs for apps created under a Company Page (422:
// author must match urn:li:company:...|urn:li:member:...), while /v2/shares
// accepts urn:li:person:{openid-sub} with the w_member_social scope. The link
// preview card renders from the article's OG tags (see SOCIAL_CARDS.md); the
// OG image is also passed as the share thumbnail.
//
// The teaser is built from frontmatter: title + description (truncated to ~250 chars)
// + the canonical article URL. LinkedIn renders the link preview card from the post's
// OG tags (see SOCIAL_CARDS.md), so no image upload is needed.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postSlug } from '../src/utils/post-slug.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'src', 'content', 'blog');
const siteUrl = 'https://www.techtips.fun';
const maxExcerptChars = 250;

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    if (!raw) continue;
    if (raw.startsWith('"') && raw.endsWith('"')) {
      try {
        result[key] = JSON.parse(raw);
      } catch {
        result[key] = raw.slice(1, -1);
      }
    } else if (raw.startsWith("'") && raw.endsWith("'")) {
      result[key] = raw.slice(1, -1).replaceAll("''", "'");
    } else {
      result[key] = raw;
    }
  }
  return result;
}

function truncateAtWord(text, maxChars) {
  const trimmed = String(text).trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars)}…`;
}

function buildPostText({ title, description, slug }) {
  const excerpt = truncateAtWord(description ?? '', maxExcerptChars);
  const url = `${siteUrl}/blog/${slug}/`;
  return [title, '', excerpt, '', `Read the full article: ${url}`].join('\n');
}

async function readPosts() {
  const files = (await fs.readdir(contentDir)).filter((file) => /\.(md|mdx)$/i.test(file));
  const posts = [];
  for (const file of files) {
    const frontmatter = parseFrontmatter(await fs.readFile(path.join(contentDir, file), 'utf8'));
    posts.push({
      slug: postSlug(file),
      title: frontmatter.title,
      description: frontmatter.description,
      pubDate: frontmatter.pubDate ? new Date(frontmatter.pubDate) : new Date(0),
    });
  }
  return posts;
}

async function pickPost(slug) {
  const posts = await readPosts();
  if (slug === '--latest') {
    return posts.sort((a, b) => b.pubDate - a.pubDate)[0];
  }
  const post = posts.find((entry) => entry.slug === slug);
  if (!post) {
    console.error(`No post with slug "${slug}" in src/content/blog/.`);
    console.error(`Available: ${posts.map((entry) => entry.slug).join(', ')}`);
    process.exit(1);
  }
  return post;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const slugArg = args.find((arg) => arg !== '--dry-run');

if (!slugArg) {
  console.error('Usage: node scripts/share-to-linkedin.mjs <slug|--latest> [--dry-run]');
  process.exit(1);
}

const post = await pickPost(slugArg);
const text = buildPostText(post);

console.log(`Post: ${post.title}`);
console.log(`URL:  ${siteUrl}/blog/${post.slug}/`);
console.log('--- LinkedIn post text ---');
console.log(text);
console.log('--------------------------');

if (dryRun) {
  console.log('Dry run: no API call made.');
  process.exit(0);
}

const token = process.env.LINKEDIN_TOKEN;
if (!token) {
  console.error('LINKEDIN_TOKEN environment variable is not set. Get a token with the');
  console.error('openid profile w_member_social scopes from a LinkedIn developer app, then re-run.');
  process.exit(1);
}

async function resolveOwner() {
  if (process.env.LINKEDIN_AUTHOR) return process.env.LINKEDIN_AUTHOR;
  const r = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    throw new Error(
      `Could not resolve the LinkedIn profile (userinfo ${r.status}). ` +
        'The token needs the openid scope, or set LINKEDIN_AUTHOR explicitly.'
    );
  }
  const { sub } = await r.json();
  return `urn:li:person:${sub}`;
}

const owner = await resolveOwner();
const response = await fetch('https://api.linkedin.com/v2/shares', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  },
  body: JSON.stringify({
    content: {
      contentEntities: [
        {
          entityLocation: `https://www.techtips.fun/blog/${post.slug}/`,
          thumbnails: [{ resolveUrl: `${siteUrl}/og/${post.slug}.png` }],
        },
      ],
      title: post.title,
      description: post.description,
    },
    distribution: { linkedInDistributionTarget: {} },
    owner,
    text: { text },
  }),
});

const body = await response.text();
if (!response.ok) {
  console.error(`LinkedIn API error ${response.status}: ${body}`);
  process.exit(1);
}
console.log(`Posted to LinkedIn (owner ${owner}). Response: ${body}`);
