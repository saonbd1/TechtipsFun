---
title: "Create an Astro Site Layout Responsive & Mobile Friendly"
description: "Build an Astro blog/site template fully responsive. Implement the header, footer and navigation components using shared layout system, see example."
heroImage: "/responsive-astro-site.png"
pubDate: "Sep 08 2026"
category: "Web Development"
tags: ["Astro", "Blog", "Responsive", "SEO"]
---


## How to Build a Responsive Astro Blog Header, Footer & Nav

A website header identifies the site branding and a head menu helps readers move between pages. The footer section contains secondary links without distracting from the article. Both components need to work on narrow screens, support keyboard users, and remain easy to reuse.

This guide follows the structure of the astro-blog-starter-template repository. The project keeps the header and footer in separate `Header.astro` and `Footer.astro` components, then imports them into the shared article layout. Astro layouts support this pattern by providing common page elements and a `<slot />` for each page’s content. You can also add reader navigation inside long posts with this guide to an [accessible Astro table of contents](/blog/astro-table-of-contents-component-guide/).

> **This guide covers:** a centered brand site, primary navigation,  a three-column footer desktop version, and a one-column mobile version footer implimentation.  

## Plan the template layout design

Plan the components before you start the work. Keep the site shell out of individual pages. A shared layout removes repeated coding and gives every page the same navigation structure. 

- **`Header.astro`**
  - **Main responsibility:** Brand logo, homepage link, blog page navigation, categories and tags, and social share links.
  - **Responsive behavior:** Keeps the brand logo or site title centered and replace the visible Blog label with a menu icon on all mobile view screens.


- **`Footer.astro`**
  - **Main responsibility:** Users explore site links, privacy policy, terms, brand social links, and copyright info.
  - **Responsive behavior:** Changes three columns into one centered column.
- **Blog layout**
  - **Main responsibility:** Places the shared shell around article content.
  - **Responsive behavior:** Keeps the article content independent from global navigation.
- **Global styles**
  - **Main responsibility:** Defines page width, typography, colors, and focus behavior.
  - **Responsive behavior:** Applies site-wide rules without duplicating them in every component.

Astro components render HTML without a client-side runtime. Add a standard `<script>` only when a component needs browser-side interaction. That makes static header and footer as practical choice for a seo friendly blog or website site.

## Create the shared layout Components

Create a base layout that imports the header and footer. Place page content inside a semantic `<main>` element.

```astro
---
import BaseHead from '../components/BaseHead.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description: string;
}

const { title, description } = Astro.props;
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <BaseHead title={title} description={description} />
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

The `<slot />` marks the place where each page supplies its content. Astro recognize this pattern as the basis of a layout component. The layout gives every pages the same structure: header, main content, and footer.

Keep the site header and footer labels out of the article’s heading hierarchy. Use the post title as the only H1, then use H2 elements for article sections. This keeps the document outline clear for readers and search engine friendly systems.

## Build the header with semantic HTML

Wrap the site header in `<header>`. Put the primary menu links inside a `<nav>` with an accessible label. Use ordinary links for navigation, and use a disclosure control when a group of links must open and close.

The project header uses a centered brand and two navigation groups. It also reads [blog post categories and tags](https://www.techtips.fun/blog/how-to-create-categories-and-tags-in-an-astro-blog/) options from the content collection instead of hard coding category and tags. 

```astro
---
import HeaderLink from './HeaderLink.astro';
import { getCollection } from 'astro:content';
import { SITE_TITLE } from '../consts';
import { toTaxonomySlug } from '../utils/taxonomy';

const categories = [
  ...new Set((await getCollection('blog')).map((post) => post.data.category)),
].sort((a, b) => a.localeCompare(b));

const isBlogActive =
  Astro.url.pathname.startsWith('/blog') ||
  Astro.url.pathname.startsWith('/categories');
---

<header class="site-header">
  <nav aria-label="Primary navigation">
    <div class="brand-wrapper">
      <a class="brand" href="/">
        <span class="brand-mark" aria-hidden="true">
          <!-- Place the site mark here. -->
        </span>
        <span class="brand-name">{SITE_TITLE}</span>
      </a>
    </div>

    <div class="internal-links">
      <HeaderLink href="/">Home</HeaderLink>

      <details class:list={[{ 'category-dropdown': true, active: isBlogActive }]}>
        <summary aria-label="Open blog navigation">
          <span class="blog-label">Blog</span>
          <span class="mobile-menu-icon" aria-hidden="true">☰</span>
        </summary>

        <div class="category-dropdown__menu">
          <a href="/blog/">All posts</a>
          <p class="category-dropdown__label">Categories</p>
          {categories.map((category) => (
            <a href={`/categories/${toTaxonomySlug(category)}/`}>
              {category}
            </a>
          ))}
        </div>
      </details>
    </div>
  </nav>
</header>
```

The `details` and `summary` elements provide a native show-and-hide control. They suit a small category list and do not need a client framework. WAI-ARIA Authoring Practices also warns against using the ARIA `menu` role for ordinary site navigation. Use regular links unless the interface needs the keyboard behavior of a true menu widget.

### Mark the active section

Show readers which section they are viewing. In this example project, `isBlogActive` checks the current URL and adds an `active` class to the Blog disclosure.

```astro
const isBlogActive =
  Astro.url.pathname.startsWith('/blog') ||
  Astro.url.pathname.startsWith('/categories');
```

Use the same idea for direct links. A reusable `HeaderLink.astro` component can compare `Astro.url.pathname` with the link path and add `aria-current="page"` when the link is active.

```astro
---
interface Props {
  href: string;
  label?: string;
}

const { href, label } = Astro.props;
const active = Astro.url.pathname === href;
---

<a href={href} class:list={{ active }} aria-current={active ? 'page' : undefined}>
  <slot />
</a>
```

The `aria-current` value tells assistive technology which link represents the current page. Use it only on the active link.

### Keep navigation labels clear

A social icon still needs an accessible name when it has no visible label. Add visually hidden text and mark the decorative SVG as hidden.

```astro
<a href="https://github.com/saonbd1/astro-blog-starter-template/">
  <span class="sr-only">Go to the Techtips GitHub repository</span>
  <svg aria-hidden="true" viewBox="0 0 16 16">
    <!-- Icon path -->
  </svg>
</a>
```

Use a descriptive label that explains the destination. Do not use labels such as “Click here” or “Icon.” Keep external links consistent with the project’s approved profile and repository URLs.

## Make the header responsive with CSS

Use one header component at every viewport. Let CSS change the layout while the HTML structure stays the same.

The project uses a css three-column grid. The first column holds internal links. The middle column holds the site title and the last column holds social links.

```css
.site-header {
  padding: 0 1rem;
  background: linear-gradient(115deg, #101421, #1b2040);
}

.site-header nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  min-height: 4rem;
  gap: 0.75rem;
}

.brand-wrapper {
  grid-column: 2;
}

.internal-links {
  display: flex;
  grid-column: 1;
  gap: 0.1rem;
}

.social-links {
  display: flex;
  grid-column: 3;
  justify-self: end;
}
```

At narrow widths in mobile screen view, keep the brand name in the center and move the controls to the outer columns. Hide secondary social links when the available space cannot fit them.

```css
@media (max-width: 720px) {
  .site-header {
    padding: 0 0.75rem;
  }

  .site-header nav {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    min-height: 3.75rem;
    gap: 0;
  }

  .brand-wrapper {
    grid-column: 2;
    justify-self: center;
  }

  .internal-links {
    display: contents;
  }

  .internal-links > a {
    grid-column: 1;
    justify-self: start;
  }

  .internal-links > .category-dropdown {
    grid-column: 3;
    justify-self: end;
  }

  .blog-label {
    display: none;
  }

  .mobile-menu-icon {
    display: block;
    width: 1.35rem;
    height: 1.35rem;
  }

  .social-links {
    display: none;
  }
}
```

The layout keeps the site identity visible on mobile and avoids a crowded row of links. The category panel opens from the right edge, so it stays inside the viewport.

## Add a visible focus state

Keep a visible focus style. Keyboard users need to see the active control, and [MDN warns that removing focus styles can make keyboard navigation inaccessible](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:focus) for sighted users.

Use `:focus-visible` for links and controls that receive keyboard focus.

```css
a:focus-visible,
summary:focus-visible {
  outline: 3px solid #bfc4ff;
  outline-offset: 3px;
}
```

Check the focus state against the header background. The outline must remain visible in normal and active states.

If you replace the native `details` behavior with a custom JavaScript button, keep the state in the HTML. The button must use `type="button"`, `aria-expanded`, and `aria-controls`. The controlled panel must have a matching `id`.

```html
<button
  type="button"
  aria-expanded="false"
  aria-controls="blog-links"
>
  Blog
</button>

<div id="blog-links" hidden>
  <!-- Blog links -->
</div>
```

Use native `details` when it fits the design. A custom disclosure adds code, keyboard cases, and states that you must maintain.

## Build a footer that supports the next action

Group footer links by purpose. This project uses legal Policies, Terms & disclosures pages. Each group has a section label and a list of links.

```astro
---
const today = new Date();
---

<footer>
  <nav class="footer-sections" aria-label="Footer navigation">
    <section aria-labelledby="footer-explore">
      <p id="footer-explore" class="footer-label">Explore</p>
      <ul>
        <li><a href="/about/">About</a></li>
        <li><a href="/contact-me/">Contact</a></li>
        <li><a href="/sitemap-index.xml">XML Sitemap</a></li>
        <li><a href="/rss.xml">RSS Feed</a></li>
      </ul>
    </section>

    <section aria-labelledby="footer-policies">
      <p id="footer-policies" class="footer-label">Policies</p>
      <ul>
        <li><a href="/privacy-policy/">Privacy Policy</a></li>
        <li><a href="/cookies/">Cookie Policy</a></li>
      </ul>
    </section>

    <section aria-labelledby="footer-terms">
      <p id="footer-terms" class="footer-label">Terms &amp; disclosures</p>
      <ul>
        <li><a href="/terms-of-service/">Terms of Service</a></li>
        <li><a href="/disclosure/">Disclosure</a></li>
      </ul>
    </section>
  </nav>

  <p class="copyright">&copy; {today.getFullYear()} Techtips.fun All rights reserved.</p>
</footer>
```

A `<nav>` landmark with an `aria-label` separates footer navigation from primary navigation. The section labels use paragraphs rather than headings, so they do not add unrelated headings to the article outline.

### Use a desktop grid and a mobile stack

Use equal columns on wide screens and switch to one column at narrow widths.

```css
footer {
  padding: 3rem 1rem 4rem;
  color: #aeb4d6;
  text-align: center;
  background:
    radial-gradient(circle at 10% 0%, rgba(104, 112, 246, 0.36), transparent 38%),
    linear-gradient(115deg, #0b0e19, #20264b);
}

.footer-sections {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2rem;
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 1.4rem;
  text-align: left;
}

.footer-section ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.footer-section li + li {
  margin-top: 0.5rem;
}

.footer-section a:focus-visible,
.social-links a:focus-visible {
  outline: 3px solid #bfc4ff;
  outline-offset: 3px;
}

@media (max-width: 36rem) {
  .footer-sections {
    grid-template-columns: 1fr;
    gap: 1.75rem;
    text-align: center;
  }
}
```

The project places circular social links below the panel and generates the copyright year. Keep social links separate from policy links so readers can scan both groups quickly.

## Check common responsive errors

Use this list to check common responsive navigation problems during implementation.

- **The brand moves off-center**
  - **Cause:** The layout uses unequal side content.
  - **Fix:** Use a three-column grid with an auto-sized center column.
- **The category panel leaves the viewport**
  - **Cause:** The panel uses a fixed left position on mobile.
  - **Fix:** Set `left: auto` and `right: 0` at the mobile breakpoint.
- **The footer creates horizontal scrolling**
  - **Cause:** A fixed width or large gap exceeds the viewport.
  - **Fix:** Use `width: min(100%, 760px)` and switch to one column.
- **Keyboard users cannot find the control**
  - **Cause:** The focus outline was removed.
  - **Fix:** Add a visible `:focus-visible` style.
- **A screen reader reads only “graphic”**
  - **Cause:** The icon link has no accessible name.
  - **Fix:** Add visually hidden link text and use `aria-hidden="true"` on the SVG.
- **The outline gains extra headings**
  - **Cause:** Footer labels use H2 or H3 elements.
  - **Fix:** Use labeled sections with paragraph labels.
- **The menu has too much JavaScript**
  - **Cause:** A custom toggle replaces native disclosure behavior.
  - **Fix:** Use `details` and `summary` for a simple link group.

[WAI-ARIA guidance recommends testing disclosure navigation with assistive technology](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/). Support can vary across browsers and assistive technology combinations. A visual check covers only part of the review.

## Verify the implementation

Run the production build before reviewing the result. In this project, `npm run build` also runs the social asset generation script, so it covers the complete build.

```bash
npm install
npm run build
```

Inspect the header and footer at wide and narrow viewports. Use the browser’s responsive mode or a real mobile device.

- **Structure:** Confirm that the page contains one header, one main region, and one footer.
- **Navigation:** Open the Blog disclosure and activate every link.
- **Mobile layout:** Confirm that the brand remains visible and no content causes horizontal scrolling.
- **Keyboard use:** Press Tab through the header and footer. Confirm that every focus state is visible.
- **Screen reader names:** Confirm that icon links have clear accessible names.
- **Footer:** Confirm that all policy, contact, feed, and sitemap links resolve.
- **Article outline:** Confirm that the header and footer labels do not create unwanted H1-H6 elements.
- **Generated HTML:** Inspect the built route for the expected semantic elements and links.

For a change in design, open a local preview after the build. Review the desktop and mobile layouts before release. Do not commit or deploy a visual change until you sure about the changes.

## Final Note

A responsive Astro blog framework needs only a few reusable components. Put the header and footer in shared layouts. Use semantic HTML for menu and links, native disclosure for simple astro site category and tag navigation, and [CSS Grid](https://www.techtips.fun/blog/css-grid-vs-flexbox-when-to-actually/) to center the brand position and stack footer groups on small screens.

Choose between native behavior and custom control based on the interface. Native `details` needs less code and testing. A custom menu gives you more visual control, but you must manage its state, focus, and keyboard behavior. Start with the native pattern and add JavaScript only when native HTML cannot provide the required behavior.

This component pattern also fits on any Astro based templates. A fast clean UI still needs clear navigation and usable layouts across different screen sizes. The repository supports the implementation details in this guide.


## Evidence note

The project-specific details in this article come from the selected repository’s `src/components/Header.astro`, `src/components/Footer.astro`, `src/layouts/`, and project profile. The code blocks are adapted on, not a verified claim that every snippet appears unchanged in the repository.
