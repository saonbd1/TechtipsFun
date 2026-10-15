# patches/

Changes an automated session could not push directly. GitHub rejects pushes
from a GitHub App token that lacks the `workflows` permission:

```
! [remote rejected] ... (refusing to allow a GitHub App to create or update
workflow `.github/workflows/<file>` without `workflows` permission)
```

Apply a patch with:

```bash
git apply patches/<name>.patch
```

Delete the patch once its change is in the tree.

## schedule-posts-og-card-slug.patch

Normalises the OG card name when `schedule-posts.yml` publishes a staged post,
and reports the normalised slug to the LinkedIn / IndexNow steps. Pairs with
`scripts/check-og-cards.mjs` and `src/utils/post-slug.mjs` (committed separately).
