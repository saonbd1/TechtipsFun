---
title: "CSS Grid vs Flexbox when to actually use each one"
description: "This debate has been running since Grid shipped. Most explanations are either too vague (“Grid is 2D, Flexbox is 1D”) or too prescriptive. Here’s the"
pubDate: "Feb 18 2026"
heroImage: "/css-grid-vs-flexbox.webp"
category: "Web Development"
tags: ["CSS", "Frontend", "Web Design", "Layouts"]

---

![CSS Grid vs Flexbox visual comparison](/css-grid-vs-flexbox.webp)

This debate has been running since Grid shipped. Most explanations are either too vague (“Grid is 2D, Flexbox is 1D”) or too prescriptive. Here’s the mental model that finally made it click for me.

## The one rule that decides everything

 **Does the layout drive the content, or does the content drive the layout?** 

If you have a defined grid and you’re placing items into it — use CSS Grid. If you have a bunch of items and you’re figuring out how they flow — use Flexbox.

## Grid examples

```
/* Classic 3-column layout */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

/* Magazine layout */
.magazine {
  display: grid;
  grid-template-areas:
    "hero hero sidebar"
    "post1 post2 sidebar";
}
```

## Flexbox examples

```
/* Nav bar items */
.nav {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Card that stretches button to bottom */
.card {
  display: flex;
  flex-direction: column;
}
.card-btn { margin-top: auto; }
```

> In practice, you’ll use both on the same page — Grid for the macro layout, Flexbox for the micro components.

The moment I stopped treating them as competitors and started seeing them as different tools for different jobs, my CSS got dramatically cleaner. For a practical example in a responsive blog, see [how to build an Astro site layout](/blog/create-astro-site-responsive-layout/).

Here is a sample of some basic Markdown syntax that can be used when writing Markdown content in Astro.

## Bonus Tips Markup Guide

The following HTML `<h1>`—`<h6>` elements represent six levels of section headings. `<h1>` is the highest section level while `<h6>` is the lowest.

**H1 — reserved for the article title**

## H2

### H3

#### H4

##### H5

###### H6

## Paragraph

Xerum, quo qui aut unt expliquam qui dolut labo. Aque venitatiusda cum, voluptionse latur sitiae dolessi aut parist aut dollo enim qui voluptate ma dolestendit peritin re plis aut quas inctum laceat est volestemque commosa as cus endigna tectur, offic to cor sequas etum rerum idem sintibus eiur? Quianimin porecus evelectur, cum que nis nust voloribus ratem aut omnimi, sitatur? Quiatem. Nam, omnis sum am facea corem alique molestrunt et eos evelece arcillit ut aut eos eos nus, sin conecerem erum fuga. Ri oditatquam, ad quibus unda veliamenimin cusam et facea ipsamus es exerum sitate dolores editium rerore eost, temped molorro ratiae volorro te reribus dolorer sperchicium faceata tiustia prat.

Itatur? Quiatae cullecum rem ent aut odis in re eossequodi nonsequ idebis ne sapicia is sinveli squiatum, core et que aut hariosam ex eat.

## Images

### Syntax

```markdown
![Alt text](./full/or/relative/path/of/image)
```

### Output

![Generic technology blog placeholder illustration](/blog-placeholder-about.webp)

## Blockquotes

The blockquote element represents content that is quoted from another source, optionally with a citation which must be within a `footer` or `cite` element, and optionally with in-line changes such as annotations and abbreviations.

### Blockquote without attribution

#### Syntax

```markdown
> Tiam, ad mint andaepu dandae nostion secatur sequo quae.  
> **Note** that you can use _Markdown syntax_ within a blockquote.
```

#### Output

> Tiam, ad mint andaepu dandae nostion secatur sequo quae.  
> **Note** that you can use _Markdown syntax_ within a blockquote.

### Blockquote with attribution

#### Syntax

```markdown
> Don't communicate by sharing memory, share memory by communicating.<br>
> — <cite>Rob Pike[^1]</cite>
```

#### Output

> Don't communicate by sharing memory, share memory by communicating.<br>
> — <cite>Rob Pike[^1]</cite>

[^1]: The above quote is excerpted from Rob Pike's [talk](https://www.youtube.com/watch?v=PAAkCSZUG1c) during Gopherfest, November 18, 2015.

## Tables

### Syntax

```markdown
| Italics   | Bold     | Code   |
| --------- | -------- | ------ |
| _italics_ | **bold** | `code` |
```

### Output

| Italics   | Bold     | Code   |
| --------- | -------- | ------ |
| _italics_ | **bold** | `code` |

## Code Blocks

### Syntax

we can use 3 backticks ``` in new line and write snippet and close with 3 backticks on new line and to highlight language specific syntax, write one word of language name after first 3 backticks, for eg. html, javascript, css, markdown, typescript, txt, bash

````markdown
```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>Example HTML5 Document</title>
	</head>
	<body>
		<p>Test</p>
	</body>
</html>
```
````

### Output

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>Example HTML5 Document</title>
	</head>
	<body>
		<p>Test</p>
	</body>
</html>
```

## List Types

### Ordered List

#### Syntax

```markdown
1. First item
2. Second item
3. Third item
```

#### Output

1. First item
2. Second item
3. Third item

### Unordered List

#### Syntax

```markdown
- List item
- Another item
- And another item
```

#### Output

- List item
- Another item
- And another item

### Nested list

#### Syntax

```markdown
- Fruit
  - Apple
  - Orange
  - Banana
- Dairy
  - Milk
  - Cheese
```

#### Output

- Fruit
  - Apple
  - Orange
  - Banana
- Dairy
  - Milk
  - Cheese

## Other Elements — abbr, sub, sup, kbd, mark

### Syntax

```markdown
<abbr title="Graphics Interchange Format">GIF</abbr> is a bitmap image format.

H<sub>2</sub>O

X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

Press <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> to end the session.

Most <mark>salamanders</mark> are nocturnal, and hunt for insects, worms, and other small creatures.
```

### Output

<abbr title="Graphics Interchange Format">GIF</abbr> is a bitmap image format.

H<sub>2</sub>O

X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

Press <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> to end the session.

Most <mark>salamanders</mark> are nocturnal, and hunt for insects, worms, and other small creatures.
