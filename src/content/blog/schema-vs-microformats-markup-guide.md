---
title: "Schema Markup vs Microformats: Differences and Which to Use"
description: "Learn how Schema.org markup and microformats differ, how JSON-LD and HTML classes work, and which approach is best for SEO, rich results, and IndieWeb projects."
heroImage: "/article-media/schema-microformats-cover.png"
pubDate: "Aug 23 2026"
category: "Web Development"
tags: ["SEO", "Structured Data", "Schema.org", "Microformats", "Web Development"]
---

**Schema markup and microformats both add meaning to web content, but they solve different problems.** Schema.org is a broad vocabulary for describing entities such as articles, products, people, and events. Microformats are lightweight HTML conventions that identify content with familiar class names such as `h-entry`, `h-card`, and `h-event`.

For most websites that want search engines to understand their pages and qualify for supported rich results, **Schema.org vocabulary encoded as JSON-LD is the practical default**. Microformats are still valuable when your site participates in the IndieWeb or needs compatibility with tools that parse semantic HTML classes. This guide explains the differences, shows both approaches in code, and helps you choose without creating conflicting markup.

## Quick answer: Schema.org or microformats?

Choose **Schema.org with JSON-LD** when your priority is search-engine understanding, supported Google Search features, and a structured format that is easy to maintain separately from your visible HTML. Choose **microformats** when you need lightweight, human-readable HTML that works with IndieWeb tools, Webmentions, or microformat parsers.

You can use both on the same page when each describes the same visible information and the two representations stay consistent. Adding markup does not guarantee a rich result, and Google requires structured data to accurately represent content that users can see on the page.



## What is Schema.org markup?

[Schema.org](https://schema.org/) is a shared vocabulary for describing things on the web. It defines types such as `Article`, `Person`, `Product`, `Organization`, and `Event`, together with properties such as `headline`, `author`, `price`, and `startDate`.

Schema.org is the **vocabulary**, not the encoding format. You can express the vocabulary with JSON-LD, Microdata, or RDFa. Google recommends JSON-LD in general because it is usually easier to implement and maintain at scale.

### Schema.org with JSON-LD

The following example describes a blog article. The information should match the visible content on the page, including the article title and author.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "How to Bake Bread",
  "author": {
    "@type": "Person",
    "name": "Alice"
  },
  "datePublished": "2026-08-23",
  "image": "https://example.com/images/bread-guide.jpg"
}
</script>
```

JSON-LD keeps the structured description separate from the article’s visible markup. That separation can make nested objects easier to express and reduces the chance that presentation changes will break the data. It does not remove the need to use the correct type, include required properties for a specific Google feature, or validate the final page.

Schema.org can also be written directly in HTML with Microdata. In that case, attributes such as `itemscope`, `itemtype`, and `itemprop` connect visible elements to the vocabulary:

```html
<article itemscope itemtype="https://schema.org/Article">
  <h1 itemprop="headline">How to Bake Bread</h1>
  <p>By <span itemprop="author">Alice</span></p>
</article>
```

## What are microformats?

Microformats are small, established conventions for marking up common content patterns with normal HTML. Instead of adding a separate vocabulary through custom attributes, a page uses agreed class names and semantic elements.

For example, `h-card` identifies a person or organization, `p-name` identifies a name, and `h-entry` identifies a post or article. Date and URL properties are commonly represented with classes such as `dt-published` and `u-url`.

### Microformats example

This `h-card` identifies Alice as a person and exposes her name and profile URL to microformat parsers:

```html
<a class="h-card" href="https://example.com/alice">
  <span class="p-name">Alice</span>
</a>
```

An `h-entry` can describe a blog post while keeping the content readable in the page source:

```html
<article class="h-entry">
  <h1 class="p-name">How to Bake Bread</h1>
  <a class="u-url" href="https://example.com/bread-guide">
    Permalink
  </a>
  <time class="dt-published" datetime="2026-08-23">
    August 23, 2026
  </time>
  <div class="e-content">
    This guide explains how to bake a simple loaf at home.
  </div>
</article>
```

Microformats are especially useful when your publishing workflow depends on the IndieWeb ecosystem. They can make it easier for compatible tools to discover authors, posts, dates, replies, and relationships directly from the HTML document.

## Schema.org vs. microformats: the main differences

### 1. Vocabulary and encoding are different concepts

Schema.org provides a large vocabulary. JSON-LD, Microdata, and RDFa are ways to encode that vocabulary. Microformats combine a set of HTML-based conventions with their own small vocabularies.

This distinction matters because “Schema.org versus JSON-LD” is not a true comparison: Schema.org is the description system, while JSON-LD is one way to write that description. Likewise, Microdata is an encoding format, not the same thing as microformats.

### 2. They target different ecosystems

Schema.org is widely used by search engines and other systems that consume structured data. Google Search supports JSON-LD, Microdata, and RDFa for structured data, although its documentation generally recommends JSON-LD for maintainability.

Microformats are designed around ordinary HTML and are strongly associated with decentralized publishing and the IndieWeb. They are a good fit when a human-readable DOM structure is important to your downstream tools.

### 3. Their coverage is not the same

Schema.org covers many entity types and relationships, including products, recipes, organizations, local businesses, courses, and events. Microformats cover a smaller set of common publishing patterns, such as people, organizations, posts, events, and reviews.

A larger vocabulary is not automatically better. Use the most specific model that accurately represents the page, and do not add properties simply to insert more keywords. Structured data must be relevant, complete enough for the feature you are targeting, and consistent with the visible content.

### 4. Search visibility is not guaranteed

Structured data can help search engines understand a page and can make it eligible for certain enhanced search appearances. It is not a ranking shortcut or a guarantee that a rich result will appear. Google may choose a different presentation based on the query, device, location, page quality, and other signals.

Microformats can support semantic discovery and third-party parsers, but they are not a substitute for following the documentation for the specific search feature you want. Always check the current Google Search Central guidance before implementing a feature-specific markup type.

## Which one should you use?

### Use Schema.org with JSON-LD for most SEO-focused websites

For a typical blog, documentation site, business website, or ecommerce store, use Schema.org with JSON-LD when you want search engines to understand the page’s entities. Start with a complete, accurate type that reflects the main purpose of the page, such as `BlogPosting`, `Product`, `Organization`, or `Event`.

Prioritize the page’s real content over a long list of optional properties. For an article, useful properties can include the headline, author, publication date, modification date, image, and the canonical page URL. Follow the requirements and recommendations for the specific Google Search feature you are targeting.

### Use microformats for IndieWeb compatibility

Use microformats when your project needs `h-card`, `h-entry`, `h-event`, or related conventions. They are a strong choice for personal sites, community publishing, Webmention workflows, and applications that parse the HTML document instead of reading JSON-LD.

Microformats are also useful when you want relationships and content properties to remain close to the visible HTML. They can coexist with Schema.org as long as the two descriptions do not disagree.

### Use both when there is a clear reason

A page can expose an `h-entry` for IndieWeb consumers and a `BlogPosting` JSON-LD object for search engines. If you do this, keep the title, author, URL, dates, and other shared details synchronized. Do not mark up content that is hidden, misleading, or unrelated to the main page.

A practical implementation might look like this:

```html
<article class="h-entry">
  <h1 class="p-name">A practical article title</h1>
  <time class="dt-published" datetime="2026-08-23">
    August 23, 2026
  </time>

  <div class="e-content">
    <p>The visible article content belongs here.</p>
  </div>
</article>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "A practical article title",
  "datePublished": "2026-08-23"
}
</script>
```

The two blocks are not competing ranking signals. They are two representations for different consumers. The important requirement is that both describe the same page accurately.

Google’s documentation states that structured data enables a feature but does not guarantee that the feature will appear in search results. Treat it as a way to communicate meaning clearly, not as a promise of higher rankings.

## Common mistakes to avoid

### Confusing Schema.org, JSON-LD, Microdata, and microformats

These terms describe different layers. Schema.org is a vocabulary. JSON-LD and Microdata are encoding formats. Microformats are HTML conventions and vocabularies. Keeping these definitions separate prevents incorrect implementation decisions.

### Adding markup that users cannot see

Do not describe a review, author, price, event, or rating that is not represented in the visible page content. Misleading or irrelevant structured data can make a page ineligible for rich results and may lead to a manual action.

### Treating markup as a keyword field

Structured data is not a place to repeat target phrases or invent extra entities. Use properties to describe real content. A smaller, complete, accurate implementation is better than a large, inconsistent block.

### Assuming valid markup guarantees a rich result

Syntax validation confirms that the markup can be read. It does not guarantee eligibility or display. Use the Rich Results Test for technical checks, then monitor the page in Search Console after it is live.

## Final recommendation

For most websites, start with **Schema.org vocabulary in JSON-LD**. It offers broad coverage, keeps structured data separate from presentation, and aligns with Google’s general recommendation for maintainability. Add **microformats** when IndieWeb tools, Webmentions, or HTML-based parsers are part of your publishing requirements.

If you need both, implement both deliberately and keep their shared information identical. The best markup is not the markup with the most fields. It is the markup that gives search engines and other software a clear, accurate description of content that people can actually see.

