# VÅG 5 — rollback + recorded decisions

Deep adversarial mangle (3-agent flotta) of the integrated VÅG 1–4 build. Verdict:
**all three agents `pass-with-notes`** — no disappear/double-book/cross-tenant/leak
blocker. One HIGH (fixed below), one MED a11y (fixed), two LOW deferred-with-reason.

## What shipped in VÅG 5
| Sev | Finding | Fix |
|---|---|---|
| HIGH | `create_public_booking` booked staff at a location they don't work at (anon-reachable; availability read-layer fenced it, the RPC did not). Intra-tenant scheduling-integrity hole — **not** cross-tenant (cross-tenant `p_location` was already rejected `invalid_location`). | **migr `0022`** — staff↔location fence: require `working_hours` for `p_staff` at `v_location`, else raise `invalid_staff_location` (P0002). Mirrors `getAvailableSlots` (boka/actions.ts L133-145) exactly. |
| HIGH↗ | A real user on a stale page could hit the new errcode (location deactivated / hours removed mid-session). | `boka/actions.ts` maps P0002 `invalid_staff_location`/`invalid_location` → the graceful "Den tiden är inte längre ledig — välj en ny tid." family (not "Något gick fel"). |
| MED | Mobile nav drawer links 36px tap height (<44px WCAG). | `nav-shell.module.css` `.overlayLinks a` → `min-height:2.75rem` + flex-center + padding (unconditional). |
| — | Pre-existing flagged crash (`saveStorefrontMedia` on image-removal). **Defensively hardened, root cause UNCONFIRMED.** | Wrapped the post-commit tail (R2-prune + `revalidate*`) in try/catch so a committed save can't surface as a crash. **Could not reproduce:** `upload.ts` was already best-effort, pre-commit is `String()`-guarded, and FreshCut has `branding={}` (VÅG 3 reset) → no media to remove on the baseline. The `error.tsx` boundary is render-time → the real crash may be a component re-render with image-removed data, not the action tail. Honest improvement, not a verified fix. |

### Verify (rolled-back DB, 3-way per advisor)
- staff with hours at L2 → book L2 → **SUCCESS**, stamped L2.
- staff only at L2 → book L1 → **rejected `invalid_staff_location`**.
- FreshCut-shape: hours at primary, `p_location=null` → primary fallback → **SUCCESS**, stamped L1 (no 1-location regression).
- Zero persistence (tenants=1, bookings=0 after). Advisors **15 WARN / 0 ERROR** (unchanged — `0022` is create-or-replace, same signature/grants, no new lint). Gate: vitest **163/163**.

## Rollback
- **Code:** `git revert <vag5-commit>` (pure additions: 1 migration + 2 edited files).
- **DB (migr 0022):** re-run the **0021** `create_public_booking` body (drops the fence
  block). The function is create-or-replace, same 10-arg signature — replacing it back
  is non-destructive. No data migration, nothing to un-backfill.
- **Worker:** `wrangler rollback 4bfead59 --config 5-Kod/apps/web/wrangler.jsonc`
  (the VÅG 4 live version, pre-VÅG-5).

## Recorded decisions — deferred LOW items (NOT silent drops)
1. **Hero title contrast (a11y agent C, LOW).** The salvia home hero title renders in
   sage over the carousel photo. Measured: 3.82:1 vs median bg, 4.08:1 vs darkest 10%
   — **clears the AA-large 3:1 floor on the dominant/dark case**; only dips to 2.06:1
   over the brightest-10% photo pixels. **Decision: DEFER.** Not an AA failure; a
   stronger overlay or white title risks regressing Zivar's tuned hero for an
   AAA-adjacent edge. Revisit only if a future carousel photo is broadly bright.
2. **Anon-readable billing/fee config on `tenant_settings` (auth agent A, LOW).** The
   anon storefront-read policy also exposes `per_booking_fee_cents` /
   `flat_monthly_fee_cents` / `setup_fee_cents` / `billing_model` / `service_fee_value`
   (all **0** for FreshCut). No secret, no PII, not exploitable. **Decision: DEFER, flag
   for real multi-tenant launch.** Exposing platform pricing TERMS publicly is a
   conscious call; before onboarding paying salons, scope these behind a column-limited
   view or split the public storefront columns from the commercial-config columns.

## Carry-forward (unchanged from prior waves, owner/ops)
- Leaked-password protection toggle (Dashboard) — advisor WARN, OPS-pending.
- `btree_gist` in `public` — backs the `no_double_booking` EXCLUDE, accepted in 0004.
- The 5 anon / 8 authenticated SECURITY DEFINER WARNs — intentional public booking
  surface; each classified benign-by-design (in-body tenant+identity fences the linter
  can't see). `get_customer_contact` (PII) is authenticated-only, never anon.
