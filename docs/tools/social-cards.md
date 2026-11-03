# Social-sharing cards

The site generates a branded **1200×630 PNG** for each blog post at `/og/{post-id}.png`. Post metadata references the generated image for social previews. The card uses the post title, featured image, and author identity.

## Regenerate cards

After adding or changing posts or images, run the asset generator from the repository root:

```bash
npm run generate:assets
```

The production build runs asset generation as part of its configured steps; check `package.json` if changing that pipeline.

## Image requirements

Keep each post's `heroImage` as a root-relative path under `public/`. The generator crops the image for the card. The author portrait is stored in `public/portrait.webp`.

## Refresh social previews

After deploying updated cards, social platforms may continue to show cached previews. Request a refresh with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) or the X card validation tool.

For project commands and build context, see the [root README](../../README.md). The original project-level notes are also available in [`SOCIAL_CARDS.md`](../../SOCIAL_CARDS.md).
