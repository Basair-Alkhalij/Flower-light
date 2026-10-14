# Flower Light — Final release verification (Step 15)

This is the acceptance checklist for the published GitHub Pages site. **Passing automated tests does not prove that a live Supabase account, WhatsApp handoff, or a real customer device works.** Do not mark manual checks complete based on a mock test.

## Scope and rollback

- Repository: `Basair-Alkhalij/Flower-light`; release source is the tested commit on `main`.
- Confirm GitHub Actions `Build, test and deploy Pages` is green **on the intended main commit**, including the `deploy` job.
- Record that commit hash and preserve it as the rollback reference before any subsequent release.
- Existing Supabase backup is separate from a GitHub source-code rollback; no database changes or SQL are part of this release.
- After publishing, recheck the site in a fresh private tab and an existing installed PWA. The Service Worker and asset URLs now include the GitHub commit identifier, so updated static files get a fresh cache key.

## Automated acceptance (GitHub Actions)

- [ ] `npm ci` and `npm run test:static` pass.
- [ ] `npm run build` passes and emits built files with no unreplaced version tokens.
- [ ] `npm run test:browser` passes on the **built** `dist` files.
- [ ] `Flower Light validation` and `Flower Light browser smoke` workflows are green.
- [ ] `build` and `deploy` are green on the final `main` commit.

Existing tests cover Arabic/English, dark/light themes, responsive catalog, search and dependent filters, static product/category links, PDF/JPG downloads, mocked Excel exports of 1005 rows, administrative navigation/permissions, Turnstile-denial behavior, thumbnail lazy loading, and import safety matching. They are **mock or synthetic tests**, not full live-account tests.

## Manual live checks — do not modify production data

- [ ] Open the public URL on a phone and desktop, using a new private tab. Verify logo, first load, theme, Arabic/English, and contact links.
- [ ] Open the catalog; search by code; test owner-selected filters together; open a product with multiple images.
- [ ] Open a genuine `/p/...` product link directly in a private tab and verify correct title, image and description.
- [ ] Use the quote list and verify the WhatsApp destination, product details and quantities **without sending an unintended customer message**.
- [ ] Download an actual product PDF and JPG and check that images/text are present. Check a multi-product PDF as well.
- [ ] Sign in to both authorized admin views (owner/assistant) and confirm allowed/hidden navigation; do not change permissions.
- [ ] Export Excel using a real current catalog, open it, and compare total product rows to the manager's catalog total. Verify image links and bilingual/spec fields.
- [ ] Upload an Excel/ZIP only to **staging/test copies** when testing updates, ambiguity detection, image replacements and rollback; **never test destructive writes against live products**.
- [ ] Reload an existing PWA installation after deployment and verify the updated interface appears (allow one extra refresh for SW activation).
- [ ] If mobile speed is a release criterion, run `npm run perf:mobile` against the published site and record median FCP/LCP/CLS; its throttled Chromium results are synthetic, not physical-device results.

## Known limitations and guardrails

- Import preview counts are estimates, not a guarantee of successful saved rows.
- A multi-row import is not a single cross-row database transaction. Failure after an existing product update can require manual review of that product. Avoid high-risk production imports without a backup and test copy.
- Old images are removed only after successful gallery save and only if no other product references them. Storage-cleanup failure may leave unused images for later maintenance.
- Public product data comes from Supabase; a static GitHub Pages deployment is not itself proof of database correctness or backup recency.
- A published JavaScript fix and clean CI do not certify production account permissions, live data quality, or real WhatsApp service reachability.

## Release sign-off

- Source commit tested: **to be filled after merge**.
- GitHub Pages deployment: **pending visual confirmation for that commit**.
- Production smoke checks: **pending** (check individual boxes above).
- Until all required acceptance checks are complete, call this a *tested release candidate*, not a fully verified production release.
