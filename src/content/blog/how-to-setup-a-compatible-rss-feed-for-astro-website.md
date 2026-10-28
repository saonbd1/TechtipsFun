---
title: "How to Set Up a Compatible RSS Feed for an Astro Website"
description: "A practical, evidence-based guide to building an Astro RSS feed with images, authors, tags, auto discovery, and validation."
heroImage: "/article-media/astro-rss-feed-cover.webp"
pubDate: "Oct 25 2026"
category: "Web Development"
tags: ["Astro", "RSS", "Javascript", "Seo"]
---

An Astro blog can publish a valid RSS feed with very little code. The difficult part is not creating `/rss.xml`; it is making the output useful across different readers. Some readers look for an image inside the HTML content, some inspect Media RSS, and others expect a standard RSS enclosure. Author and tag fields also vary between consumers.

This guide is based on the RSS implementation completed for TechTips.fun. The project uses Astro 5 and Cloudflare Workers with static assets. The final feed is available at [`https://www.techtips.fun/rss.xml`](https://www.techtips.fun/rss.xml). The implementation was validated with the W3C Feed Validation Service in the project workflow, and a live inspection confirms that the feed exposes images, author metadata, categories, subjects, and an Atom self link.

The goal is a practical pattern you can adapt to another Astro blog, not a claim that every RSS reader renders the same way.

![Architecture of the Astro RSS feed implementation](article-media/astro-rss-feed-architecture.png)

*Architecture diagram for the implementation described in this article. It shows the project structure and the metadata paths added for RSS readers.*

## What the finished feed should do

A useful feed should give a reader enough information to identify, display, and open each post. In this implementation, every item includes a title, canonical link, permalink-style GUID, description, publication date, author, categories, and image data.

The image is exposed in three complementary ways:

- `content:encoded` includes HTML content with an absolute `<img>` URL.
- `media:content` declares the image as Media RSS content.
- `enclosure` attaches the image as a standard RSS media object.

The feed also declares `atom:link rel="self"`, which tells consumers the canonical URL of the feed itself. The site head contains an RSS autodiscovery link, and the footer contains a visible RSS link for people who want to subscribe manually.

These layers are intentional. RSS readers do not all use the same extension or presentation rule, so one image representation is not enough for broad compatibility.

## Prerequisites and evidence boundary

You need an Astro project with a blog route, a configured site URL, and post data that contains at least a title, description, publication date, URL or slug, and image information. Astro’s official RSS recipe uses `@astrojs/rss`, a `src/pages/*.xml.js` endpoint, and the `site` value from the Astro configuration or endpoint context. See the [Astro RSS recipe](https://docs.astro.build/en/recipes/rss/) for the supported setup.

The TechTips.fun implementation used these verified project facts:

- The framework is Astro 5.
- The feed endpoint is `src/pages/rss.xml.js`.
- The public route is `/rss.xml`.
- Posts are emitted newest first.
- The author is `SaonBD`.
- Post images are hosted on the same public domain as the articles.
- `BaseHead.astro` contains the RSS autodiscovery metadata.
- `Footer.astro` contains a visible RSS link.
- The previous project validation passed the W3C feed validator with no errors or warnings.
- Live feed inspection shows `author`, `dc:creator`, `category`, `dc:subject`, `content:encoded`, `media:content`, `enclosure`, and `atom:link` elements.

No traffic, subscriber, ranking, or engagement improvement is claimed here. Those outcomes were not measured as part of the implementation.

## 1. Install and configure the Astro RSS helper

Install the official package in the project:

```bash
pnpm add @astrojs/rss
```

Then confirm that `astro.config.mjs` has a public `site` value:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.example.com',
});
```

The site URL matters because RSS items should contain absolute links. It also gives Astro the base URL it needs when generating the feed. If the project uses a different canonical domain, use that domain consistently in the configuration, post links, and image URLs.

If posts come from content collections, define a schema for the fields the feed needs. Astro’s [content collections documentation](https://docs.astro.build/en/guides/content-collections/) recommends schemas for predictable data and explains how to query entries with `getCollection()`.

## 2. Create the `rss.xml.js` endpoint

Create this file:

```text
src/pages/rss.xml.js
```

The `.xml.js` filename produces an XML route. A minimal endpoint looks like this:

```js
import rss from '@astrojs/rss';

export function GET(context) {
  return rss({
    title: 'Example Blog',
    description: 'Practical articles about the web.',
    site: context.site,
    items: [],
  });
}
```

In a real blog, replace the empty array with entries from your content collection or page imports. Astro’s RSS helper supports standard item values such as `title`, `description`, `link`, `pubDate`, and `content`. The official documentation also notes that full post content can include images when the image URLs are absolute.

## 3. Sort posts before generating items

Do not rely on the order returned by a collection query. Astro documents that collection order is not deterministic, so sort posts explicitly before mapping them into RSS items.

A typical pattern is:

```js
const posts = await getCollection('blog');

const newestFirst = posts.sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
);
```

Then map `newestFirst` to the item shape expected by `rss()`. In the TechTips.fun feed, the first live item is the newest published article, followed by older posts in descending publication order.

When sorting, use the publication date rather than a filesystem name or an incidental collection order. This prevents a feed reader from showing stale entries above newer work.

## 4. Use absolute URLs for article links and images

RSS readers fetch content outside the context of your website. A relative image such as `/images/cover.webp` may work in a browser but fail in a consumer that does not resolve it correctly.

Build each post URL and image URL as an absolute `https://` URL:

```js
const siteUrl = 'https://www.example.com';

const imageUrl = new URL(post.data.image, siteUrl).toString();
const postUrl = new URL(`/blog/${post.id}/`, siteUrl).toString();
```

The live TechTips.fun feed uses absolute URLs such as `https://www.techtips.fun/article-media/...png`. That makes the image independently fetchable and avoids ambiguity when a reader renders the item outside the site.

## 5. Add the image in three compatible forms

The image problem that triggered this implementation was simple: the feed contained image information, but the image did not appear consistently in readers. The fix was to provide the same image through three different mechanisms.

First, include it in the full HTML content:

```js
const content = `
  <p>${escapeHtml(post.data.description)}</p>
  <p>
    <img
      src="${imageUrl}"
      alt="${escapeHtml(post.data.title)}"
    />
  </p>
`;
```

The `content:encoded` element belongs to the Content module namespace. It is useful for readers that render the body of the item and look for ordinary HTML images.

Second, add Media RSS metadata:

```xml
<media:content
  url="https://www.example.com/images/post-cover.webp"
  medium="image"
  type="image/webp" />
```

Third, add a standard RSS enclosure:

```xml
<enclosure
  url="https://www.example.com/images/post-cover.webp"
  length="0"
  type="image/webp" />
```

The RSS 2.0 specification defines `enclosure` as an attached media object and requires `url`, `length`, and `type` attributes. See the [RSS 2.0 specification](https://www.rssboard.org/rss-specification) for the item and enclosure rules.

The TechTips.fun feed currently emits `length="0"` for image enclosures. The live images still resolve and the feed parsed correctly in the completed validation checks, but a stricter implementation should calculate and emit the actual byte length when possible. That small improvement removes an avoidable compatibility question.

Do not assume that a successful browser preview proves the feed image works. Check the raw XML and request each representative image URL independently.

## 6. Add author and category metadata without relying on one vocabulary

RSS 2.0 has an `author` element and one or more `category` elements. For additional interoperability, the implementation also uses Dublin Core:

```xml
<author>SaonBD</author>
<dc:creator>SaonBD</dc:creator>
<category>Developer Productivity</category>
<category>AI</category>
<dc:subject>AI</dc:subject>
<dc:subject>Tools</dc:subject>
```

The `category` values can include a broad site category followed by post-specific tags. `dc:subject` carries the tag-like subjects for consumers that prefer Dublin Core. The [Dublin Core metadata terms reference](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) defines `creator` and `subject` as reusable metadata terms.

One standards detail is worth noting: the RSS specification describes `author` as an email address, optionally followed by a display name. Many blog feeds nevertheless use a display name alone, and common readers parse it. If strict RSS author semantics are a priority, use a value such as `editor@example.com (SaonBD)` and keep `dc:creator` as the clean display name. The TechTips.fun implementation preserved the requested display name and verified that common parsers exposed it as `SaonBD`.

## 7. Declare the feed namespaces and self link

Custom XML elements are only valid when their namespaces are declared. The feed root should include the namespaces used by the item fields:

```xml
<rss
  version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
```

Then identify the feed’s own URL at channel level:

```xml
<atom:link
  href="https://www.example.com/rss.xml"
  rel="self"
  type="application/rss+xml" />
```

The self link is especially useful when the feed can be reached through redirects, mirrors, or multiple hostnames. It also makes the generated document more explicit for tools that inspect the channel metadata.

## 8. Add RSS autodiscovery and a visible link

Autodiscovery lets an RSS reader find the feed when a visitor enters the site’s main URL. Add this inside the shared `<head>` component:

```astro
<link
  rel="alternate"
  type="application/rss+xml"
  title="Example Blog RSS Feed"
  href={new URL('rss.xml', Astro.site)}
/>
```

Astro documents this exact pattern in its [RSS autodiscovery guidance](https://docs.astro.build/en/recipes/rss/). In the TechTips.fun project, the metadata was added to `src/components/BaseHead.astro`.

Also add a normal link in the footer or navigation:

```astro
<a href="/rss.xml" aria-label="Subscribe to the RSS feed">
  RSS Feed
</a>
```

This gives both automated tools and human visitors a clear path to the feed. The visible link was added to `src/components/Footer.astro` in the implementation.

## 9. Validate the generated feed, not only the source code

Build the project first so you test the generated XML rather than an unexecuted endpoint:

```bash
pnpm build
```

Then check the route locally or on the deployed hostname:

```bash
curl -I https://www.example.com/rss.xml
curl -s https://www.example.com/rss.xml | head -40
```

The [W3C Feed Validation Service](https://validator.w3.org/feed/) checks RSS and Atom syntax. Its documentation says it validates RSS 2.0 rules and commonly used namespaces including Dublin Core and `content:encoded`. The completed TechTips.fun workflow used that validator and recorded a pass with no errors or warnings.

A validator is necessary but not sufficient. Also inspect the output with a normal XML parser or feed library and confirm that the fields a reader needs are present:

```python
import feedparser

feed = feedparser.parse('https://www.example.com/rss.xml')
entry = feed.entries[0]

print(entry.title)
print(entry.get('author'))
print(entry.get('tags'))
print(entry.get('media_content'))
```

Finally, test at least one image URL directly. Confirm the response is successful and that the `Content-Type` matches the file, such as `image/jpeg`, `image/png`, or `image/webp`.

## Common problems and fixes

### The feed loads, but images do not appear

Check for relative image URLs first. Then inspect `content:encoded` for an actual `<img>` element and verify that `media:content` and `enclosure` point to the same absolute URL. Also check that the image server does not block the user agents used by feed readers.

### The newest post is not first

Sort the collection explicitly by publication date. Do not depend on the order returned by `getCollection()` or the order of files in a directory.

### Tags are missing in a reader

Use repeated `<category>` elements rather than joining tags into one comma-separated string. If the target reader prefers Dublin Core, also expose repeated `dc:subject` elements. Use consistent tag values so that `AI`, `ai`, and `Artificial Intelligence` do not accidentally become three unrelated labels.

### The author is blank or appears as an email

Inspect both the raw XML and the parsed representation. Some libraries expose RSS `author`, while others expose `dc:creator`. If you need strict RSS conformance, provide the expected email-shaped value in `author` and keep a display name in `dc:creator`.

### The validator passes, but the deployed feed is old

Check the deployed hostname, response headers, and the commit connected to the deployment. Cloudflare builds can also be delayed by a failed or paused Git integration. A local commit and a successful Git push do not prove that the production Worker has updated.

### The image enclosure has a zero length

The RSS specification requires the `length` attribute. A zero value may parse in permissive consumers, but calculating the actual byte length is safer for strict clients and downstream tooling.

## Verification checklist

Before publishing an Astro RSS feed, verify the following:

- `/rss.xml` returns XML with the expected content type.
- The feed has one channel title, description, link, and Atom self link.
- Items are sorted newest first.
- Every item has a title, canonical link, GUID, description, and publication date.
- Article links and image links are absolute HTTPS URLs.
- Images appear in `content:encoded` and are also declared through `media:content` and `enclosure`.
- The enclosure has a correct MIME type and, ideally, an accurate byte length.
- Author data is exposed through the chosen RSS and Dublin Core fields.
- Categories and tags use repeated elements, not a single delimited string.
- The site head contains an RSS autodiscovery link.
- The footer or navigation contains a visible RSS link.
- The W3C validator reports no errors or warnings.
- A feed parser can read the author, tags, image data, and publication date.
- Representative image URLs return successfully.
- The generated production feed matches the approved local output after deployment.

## Conclusion

An Astro RSS feed becomes dependable when it treats RSS as an interoperability layer rather than a single XML template. Start with Astro’s `@astrojs/rss` helper, sort the posts yourself, use absolute URLs, and publish the same image through full HTML, Media RSS, and a standard enclosure. Add both ordinary RSS metadata and Dublin Core fields where they improve parser compatibility. Then validate the generated feed and inspect it with a real parser.

The TechTips.fun implementation followed that pattern. The project moved from a feed whose images were not appearing consistently to a feed whose live XML contains the image, author, category, tag, and self-reference metadata needed by common consumers. The remaining refinement is to replace zero-length image enclosures with their actual byte sizes when strict enclosure handling matters.



