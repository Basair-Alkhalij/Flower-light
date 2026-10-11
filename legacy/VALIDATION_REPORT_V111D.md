# Validation Report — Flower Light v111D

Date: 2026-10-10
Scope: Owner-controlled visibility for the public multi-product quote list

## Behavior
- New site setting: `site_settings.quote_list_enabled`
- Default: `true`
- Owner card in Admin settings can enable/disable the feature.
- When disabled, public quote add controls, floating bar and quote modal are hidden.
- Add/send actions refuse to run while disabled.
- Existing quote-list data in `localStorage` is preserved and returns when re-enabled.

## Database
- Migration: `supabase/migrations/20261010113500_quote_list_visibility.sql`
- Existing database upgrade: `supabase/UPGRADE_EXISTING_V111.sql`
- Setup file updated for fresh installations.
- No destructive database operation is included.

## Automated coverage
- Admin settings runtime test reads, renders and saves the visibility toggle.
- Static smoke checks verify Admin/Public/SQL integration.
- Browser coverage disables the feature, verifies controls disappear and adds are blocked, then re-enables it and confirms the saved list returns.
- Live-site smoke requires the deployed quote-list module to contain the visibility/event logic.

## Production activation
After code deployment, run `supabase/UPGRADE_EXISTING_V111.sql` once in Supabase SQL Editor. Expected final status:

`UPGRADE_EXISTING_V111_OK`

Do not run `SUPABASE_SETUP.sql` on the existing live database.
