# TechTips.fun Documentation

This folder is the documentation index. The repository root [`README.md`](../README.md) remains the project overview and quick-start guide. Detailed instructions live beside the component they describe so commands and paths stay relative to the code they document.

## Start here

- [Project overview and quick start](../README.md) — stack, local development, publishing, deployment, tests, and automation.
- [Publishing guide](PUBLISHING.md) — publishing workflow details.
- [Social cards](../SOCIAL_CARDS.md) — OG image generation and troubleshooting.

## Article reels

- [Reel generation pipeline](../reels/README.md) — CLI, Reel Studio, rendering options, architecture, customization, Linux setup, and pitfalls.
- [Generated reel library and publishing](../article-reels/README.md) — automatic/manual runs, refreshes, YouTube uploads, and output management.
- [Staged CI workflows](../reels/ci/README.md) — installing the reel and link-check workflows.

These guides overlap on the basic pipeline and triggers. The project overview gives only a summary; use the relevant component guide for the authoritative instructions rather than duplicating those details here.

## Content administration

- [Admin dashboard](../public/admin/README.md) — OAuth and fallback sign-in, permissions, Worker configuration, features, content rules, tests, and deployment.

## Standalone tools and examples

- [Standalone projects](../standalone/README.md) — moving standalone projects into their own repositories.
- [Bengali tip cards](../standalone/bengali-tip-cards/README.md) — clean text into CSV and generate social cards.
- [Bengali tip-card examples](../standalone/bengali-tip-cards/scripts/examples/README.md) — sample inputs, outputs, and regeneration commands.
- [Bengali tip-card fonts](../standalone/bengali-tip-cards/scripts/assets/fonts/README.md) — bundled font sources and licensing.
- [Repository text-cleanup examples](../scripts/examples/README.md) — example input, CSV output, and card-generation commands.
- [Repository bundled fonts](../scripts/assets/fonts/README.md) — font sources and licensing used by the repository's card generator.
- [Tool Hub](../standalone/tools-hub/README.md) — registry, generation, filters, and optional live stats.

The two font guides describe separate copies of the bundled fonts in the main project and standalone project. The two example guides cover related sample data but different usage contexts; both are retained so each project remains self-contained.

## Repository maintenance

- [Patch notes](../patches/README.md) — applying local patches and historical workflow notes.

## Documentation conventions

- Keep detailed, frequently changing instructions beside the code they describe; link to them from this index instead of copying the same material into multiple guides.
- When the same workflow is mentioned in multiple places, keep this page as navigation and maintain operational details in the component guide.
- When moving a guide, update links in the root README, this index, and any neighboring documentation.
