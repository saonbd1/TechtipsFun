# Build a Compatible RSS Feed for an Astro Blog

An Astro blog can publish a valid RSS feed with little code. The harder task is to make the feed useful for different readers. Some readers find images in the HTML content. Others read Media RSS or a standard RSS enclosure. Author and tag fields also differ between readers.

This guide uses the RSS implementation for TechTips.fun as an example. The project uses Astro 5 and Cloudflare Workers with static assets. The live feed is available at [`https://www.techtips.fun/rss.xml`](https://www.techtips.fun/rss.xml). The project workflow passed the W3C Feed Validation Service. A live inspection also found image data, author data, categories, subjects, and an Atom self link.

This guide gives you a pattern for another Astro blog. It does not claim that every RSS reader displays the feed in the same way.

![Architecture of the Astro RSS feed implementation](public/article-media/astro-rss-feed-architecture.png)

*Architecture diagram for the implementation in this guide. It shows the project structure and the metadata paths that RSS readers use.*

## What the finished feed must do

A useful feed gives readers enough information to identify, display, and open each post. In this implementation, each item has a title, canonical link, permalink-style GUID, description, publication date, author, categories, and image data.

The feed exposes each image in three ways:

- `content:encoded` contains HTML with an absolute `<img>` URL.
- `media:content` declares the image as Media RSS content.
- `enclosure` attaches the image as a standard RSS media object.

The feed also declares `atom:link rel="self"`. This element gives readers the canonical URL of the feed. The site head contains an RSS autodiscovery link. The footer contains a visible RSS link for people who want to subscribe manually.

These layers have a purpose. RSS readers do not use the same extensions or display rules. One image format is not enough for broad compatibility.

## Prerequisites and evidence boundary

You need an Astro project with a blog route, a site URL, and post data. The data must include at least a title, description, publication date, URL or slug, and image information. Astro’s official RSS recipe uses `@astrojs/rss`, a `src/pages/*.xml.js` endpoint, and the `site` value from the Astro configuration or endpoint context. See the [Astro RSS recipe](https://docs.astro.build/en/recipes/rss/) for the supported setup.

The TechTips.fun implementation used these project facts:

- The framework is Astro 5.
- The feed endpoint is `src/pages/rss.xml.js`.
- The public route is `/rss.xml`.
- Posts appear newest first.
- The author is `SaonBD`.
- Post images use the same public domain as the articles.
- `BaseHead.astro` contains the RSS autodiscovery metadata.
- `Footer.astro` contains a visible RSS link.
- The project passed the W3C feed validator with no errors or warnings.
- A live feed inspection found `author`, `dc:creator`, `category`, `dc:subject`, `content:encoded`, `media:content`, `enclosure`, and `atom:link` elements.

This guide does not claim traffic, subscriber, ranking, or engagement gains. The implementation did not measure those results.

## 1. Install and configure the Astro RSS helper

Install the official package in the project:

```bash
pnpm add @astrojs/rss
```

Then make sure that `astro.config.mjs` has a public `site` value:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.example.com',
});
```

The site URL gives RSS items absolute links. It also gives Astro the base URL for the feed. If the project uses another canonical domain, use that domain in the configuration, post links, and image URLs.

If posts come from content collections, define a schema for the fields that the feed needs. Astro’s [content collections documentation](https://docs.astro.build/en/guides/content-collections/) recommends schemas for predictable data. It also explains how to query entries with `getCollection()`.

## 2. Create the `rss.xml.js` endpoint

Create this file:

```text
src/pages/rss.xml.js
```

The `.xml.js` filename creates an XML route. A minimal endpoint looks like this:

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

In a real blog, replace the empty array with entries from your content collection or page imports. Astro’s RSS helper supports values such as `title`, `description`, `link`, `pubDate`, and `content`. The official documentation also states that full post content can contain images with absolute URLs.

## 3. Sort posts before you create feed items

Do not rely on the order from a collection query. Astro states that collection order is not deterministic. Sort the posts before you map them to RSS items.

Use a pattern like this:

```js
const posts = await getCollection('blog');

const newestFirst = posts.sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
);
```

Then map `newestFirst` to the item shape that `rss()` expects. In the TechTips.fun feed, the first live item is the newest published article. Older posts follow in descending publication order.

Sort by publication date. Do not sort by a file name or by collection order. This keeps old entries below newer posts.

## 4. Use absolute URLs for article links and images

RSS readers fetch content outside your website. A relative image such as `/images/cover.webp` can work in a browser. A feed reader can fail to resolve it.

Build each post URL and image URL as an absolute `https://` URL:

```js
const siteUrl = 'https://www.example.com';

const imageUrl = new URL(post.data.image, siteUrl).toString();
const postUrl = new URL(`/blog/${post.id}/`, siteUrl).toString();
```

The live TechTips.fun feed uses absolute URLs such as `https://www.techtips.fun/article-media/...png`. Readers can fetch the image without guessing its base URL.

## 5. Add the image in three compatible forms

The original problem was simple. The feed contained image data, but some readers did not display the image. The solution was to publish the same image through three mechanisms.

First, include the image in the full HTML content:

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

The `content:encoded` element belongs to the Content module namespace. Readers that display the item body can find the normal HTML image.

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

The RSS 2.0 specification defines `enclosure` as an attached media object. It requires `url`, `length`, and `type` attributes. See the [RSS 2.0 specification](https://www.rssboard.org/rss-specification) for the item and enclosure rules.

The TechTips.fun feed currently sets `length="0"` for image enclosures. The live images resolve, and the completed validation checks parsed the feed correctly. A stricter implementation must calculate and publish the actual byte length when possible. This removes an avoidable compatibility problem.

Do not use a successful browser preview as proof that the feed image works. Read the raw XML. Also request each representative image URL separately.

## 6. Add author and category metadata with more than one vocabulary

RSS 2.0 has an `author` element and one or more `category` elements. For wider compatibility, this implementation also uses Dublin Core:

```xml
<author>SaonBD</author>
<dc:creator>SaonBD</dc:creator>
<category>Developer Productivity</category>
<category>AI</category>
<dc:subject>AI</dc:subject>
<dc:subject>Tools</dc:subject>
```

The `category` values can include a broad site category and post-specific tags. `dc:subject` carries tag-like subjects for readers that prefer Dublin Core. The [Dublin Core metadata terms reference](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) defines `creator` and `subject` as reusable metadata terms.

The RSS specification describes `author` as an email address. A display name can follow the address. Many blog feeds use only a display name, and common readers parse that value. If strict RSS author semantics matter, use a value such as `editor@example.com (SaonBD)`. Keep `dc:creator` as the clean display name. The TechTips.fun implementation kept the requested display name. Common parsers exposed it as `SaonBD`.

## 7. Declare feed namespaces and the self link

Custom XML elements are valid only when their namespaces are declared. The feed root must include the namespaces for the item fields:

```xml
<rss
  version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
```

Then identify the feed URL at the channel level:

```xml
<atom:link
  href="https://www.example.com/rss.xml"
  rel="self"
  type="application/rss+xml" />
```

The self link helps when the feed uses redirects, mirrors, or multiple hostnames. It also gives inspection tools a clear channel URL.

## 8. Add RSS autodiscovery and a visible link

Autodiscovery lets an RSS reader find the feed from the site’s main URL. Add this element inside the shared `<head>` component:

```astro
<link
  rel="alternate"
  type="application/rss+xml"
  title="Example Blog RSS Feed"
  href={new URL('rss.xml', Astro.site)}
/>
```

Astro documents this pattern in its [RSS autodiscovery guidance](https://docs.astro.build/en/recipes/rss/). In the TechTips.fun project, the metadata was added to `src/components/BaseHead.astro`.

Also add a normal link in the footer or navigation:

```astro
<a href="/rss.xml" aria-label="Subscribe to the RSS feed">
  RSS Feed
</a>
```

Automated tools and human visitors then have a clear path to the feed. The implementation added the visible link to `src/components/Footer.astro`.

## 9. Validate the generated feed, not only the source code

Build the project first. This tests the generated XML instead of an endpoint that has not run:

```bash
pnpm build
```

Then request the route locally or from the deployed hostname:

```bash
curl -I https://www.example.com/rss.xml
curl -s https://www.example.com/rss.xml | head -40
```

The [W3C Feed Validation Service](https://validator.w3.org/feed/) checks RSS and Atom syntax. Its documentation states that it checks RSS 2.0 rules and common namespaces, including Dublin Core and `content:encoded`. The completed TechTips.fun workflow used this validator and passed with no errors or warnings.

A validator is necessary but not sufficient. Read the output with an XML parser or feed library. Make sure that the fields required by readers are present:

```python
import feedparser

feed = feedparser.parse('https://www.example.com/rss.xml')
entry = feed.entries[0]

print(entry.title)
print(entry.get('author'))
print(entry.get('tags'))
print(entry.get('media_content'))
```

Finally, request at least one image URL directly. Make sure that the response succeeds. Also make sure that `Content-Type` matches the file, such as `image/jpeg`, `image/png`, or `image/webp`.

## Common problems and fixes

### The feed loads, but images do not appear

First, look for relative image URLs. Then inspect `content:encoded` for an actual `<img>` element. Make sure that `media:content` and `enclosure` use the same absolute URL. Also make sure that the image server does not block the user agents that RSS readers use.

### The newest post is not first

Sort the collection by publication date. Do not depend on the order from `getCollection()` or the file order in a directory.

### Tags are missing in a reader

Use repeated `<category>` elements. Do not join tags into one comma-separated string. If the reader prefers Dublin Core, also publish repeated `dc:subject` elements. Use consistent tag values. For example, `AI`, `ai`, and `Artificial Intelligence` can become three unrelated labels.

### The author is blank or appears as an email

Read both the raw XML and the parsed result. Some libraries expose RSS `author`. Other libraries expose `dc:creator`. If strict RSS conformance matters, put the expected email-shaped value in `author`. Keep the display name in `dc:creator`.

### The validator passes, but the deployed feed is old

Check the deployed hostname, response headers, and commit connected to the deployment. Cloudflare builds can also wait because a Git integration failed or paused. A local commit and a successful Git push do not prove that the production Worker has updated.

### The image enclosure has a zero length

The RSS specification requires the `length` attribute. A zero value can parse in permissive readers. Calculating the actual byte length is safer for strict clients and downstream tools.

## Publishing checklist

Before you publish an Astro RSS feed, make sure that:

- `/rss.xml` returns XML with the expected content type.
- The feed has one channel title, description, link, and Atom self link.
- Items appear newest first.
- Each item has a title, canonical link, GUID, description, and publication date.
- Article links and image links are absolute HTTPS URLs.
- Images appear in `content:encoded` and through `media:content` and `enclosure`.
- The enclosure has the correct MIME type and, ideally, the correct byte length.
- Author data appears in the selected RSS and Dublin Core fields.
- Categories and tags use repeated elements, not one delimited string.
- The site head contains an RSS autodiscovery link.
- The footer or navigation contains a visible RSS link.
- The W3C validator reports no errors or warnings.
- A feed parser can read the author, tags, image data, and publication date.
- Representative image URLs return successfully.
- The production feed matches the approved local output after deployment.

## Conclusion

An Astro RSS feed becomes dependable when it supports different readers instead of relying on one XML form. Start with Astro’s `@astrojs/rss` helper. Sort the posts yourself. Use absolute URLs. Publish each image in full HTML, Media RSS, and a standard enclosure. Add RSS and Dublin Core metadata when it improves parser compatibility. Then inspect the generated feed with a validator and a real parser.

The TechTips.fun implementation uses this pattern. Its live XML contains the image, author, category, tag, and self-reference metadata that common readers need. The remaining improvement is to replace zero-length image enclosures with their actual byte sizes when strict enclosure handling matters.
