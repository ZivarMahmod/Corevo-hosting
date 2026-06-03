# goal-17 GAP INVENTORY (Steg 0 result, 2026-06-03)

Mechanical presence/structure inventory: design package (`2-Byggplan/` root = LAW) vs current code. Produced by 7-agent inventory fleet (workflow `wf_17fca355-81b`). **Totals: 54 MISSING elements · 99 candidate gaps · 68 render-confirm diffs.** Conclusion: the "eyeball-confirmed done" back-office is NOT yet an exact copy — confirms the 62%-trap.

Scope buckets (mine): **B**=build now (pure-frontend, real data exists) · **D**=data-gated (no DB field; build graceful/derived only, NEVER fake, flag) · **X**=defer (cross-tenant data / needs backend / overlaps separate "split platform-admin" card / beyond goal-17's frozen ren-frontend zone) · **RC**=render-confirm before deciding.

---

## 1. Shared back-office chrome  [miss=3 gap=7]
- **B** `topbar-command-palette` — ⌘K CommandPalette overlay (Shell.jsx:276-329) absent; code topbar = plain inert input.
- **B** `topbar-bell-notification-dot` — bell icon-button + gold notification dot (Shell.jsx:265-267) absent.
- **RC** `topbar-context-link` — "Se din sida"(salon)/"Supabase"(super) link lives in page content (OpenSiteLink), not shared chrome.
- **X** `platform-nav-groups` — super rail mock = 4 groups/11 items; code = 2 groups/4 items. Missing groups "Data & drift"(Kunder,Personal,Drift&logg) + "Plattform"(Integrationer,Roller,Inställningar) → those routes don't exist (see §2 X-items).
- **RC** sidebar logout placement (moved to topbar — intentional), Fakturering dollar→creditCard icon, label drifts (Dashboard→Översikt etc.). admin extra "Platser" = real multi-location, keep.

## 2. Super admin / platform  [miss=16 gap=27] — LEAST built surface
ENTIRE VIEWS MISSING (no route):
- **X** `SuperOps` "Drift & logg" (platform-wide health + actor log) — cross-tenant + backend.
- **X** `SuperCustomers` "Kunder" cross-tenant search — cross-tenant data, security-sensitive.
- **X** `SuperStaff` "Personal" cross-tenant invite — cross-tenant data.
- **B/RC** `SuperIntegrations` "Integrationer" (6 integration cards) — mostly static/config UI, buildable.
- **B/RC** `SuperRoles` "Roller & behörighet" (role list + RBAC matrix) — static reference UI buildable; live RBAC edit = X.
- **B** `SuperSettings` platform "Inställningar" (security/drift toggles + billing-model card).
Översikt: **B** health-pills, senaste-händelser (audit list — has data), premium-utan-kod inverted-forest card, sparkline KPI.
Salonger: **B** Kort/Lista ViewSwitcher, card-grid (primary view), per-card Storefront btn. **RC** search live-pills, list columns.
Onboarda: **RC** 5-step stepper (code is single form), theme-picker (5 themes vs 4 layouts), **B** ThemePreview browser-chrome, owner-step + confirm card.
Salong-detalj: **B** owner-card, integrationer-tab; **RC** 6 SubTabs, personal-tab, header avatar/meta, drift danger-card.

## 3. Salong-admin — Dashboard / Bokningar / Kunder  [miss=9 gap=19]
Dashboard §4.7: **B** quick-actions row (4 cards), röd-tråd gold "Öppna {storefront}" CTA, Stripe payment card. **RC** kommande-row leads w/ customer+note, vertical PeakChart, KPI meaning (Beläggning/Nya lojalitetskunder).
Bokningar §4.6 drawer (renders only WITH booking data — DATA-GATED visual verify): **B** customer-recognition section (avatar/tier·visits·since), **B** time-bound PII Visa/Dölj, **B** Noteringar chat + add-note, **B** auto-klar + payment-guard bands. **RC** status-aware actions, Vecka fixed-7-day grid, Lista Kund/Kanal cols, status filter-pills w/ counts.
Kunder §4.6: **B** detail Lojalitet section (big gold points 28px + Nästa nivå + progress), header Exportera/Ny kund. **RC** Frisör column, KPI Guld-nivå, identity fields.

## 4. Salong-admin — Tjänster / Scheman  [miss=2 gap=8]
Tjänster §4.4: **B** per-row storefront-section `<select>` (THE core "see where it lands" promise). **D** "Populär" gold badge (no backing field). **RC** Table-vs-list, "Ny tjänst" CTA.
Scheman §4.5: **RC** 7-day vs 5-day week-grid, staff colored pill-chips (vs dropdown), in-cell ×/+Tid, header Återställ/Spara actions.

## 5. Salong-admin — Personal / Varumärke / Inställningar  [miss=5 gap=8]
Personal: **B** per-staff DetailModal (bio/specialties, eget-konto+magic-link, multi-location, "Verklig dag·idag"). **D** specialty/bio chips, verklig-dag list (data-dependent — same store as M5). 
Varumärke §4.3: **CLEAN — flagship confirmed done (0 miss/0 gap).** ✓
Inställningar: **B** drop-in toggle (no field → needs settings key), confirmation green proof-band, payment-protection amber band. **RC** SMS→Påminnelse wording, Betalning card restructure.

## 6. Frisör "idag"  [miss=12 gap=19] — heavily under-built, MANY data-gated
Today: **D** status-accent-bar, Stamkund pill (visits≥5 — derivable?), prefs-chips (NO DB prefs field), kundnote-icon+band (customer_notes 'kund'-channel?), recognition strip cadence/drink (NO DB field — mock-only), prefs section, **D** paid badge (needs payment data). **B/RC** recognition card as drawer.
Schedule: **RC** 7-col week slot-grid, free/"Ledig" slot cells, today gold-highlight.
Frånvaro: **B** type-pills (Semester/Sjuk/Ledig/Annat), info-callout band. **D/X** approval status Godkänd/Väntar (no approval workflow), "Skicka anmälan" framing.

## 7. Kundportal /konto (Fas 2)  [miss=7 gap=11] — 2× P0
- **P0 B** `konto-stylist-card-dinfrisor` — "DIN FRISÖR" relationship card (emotional core): avatar, note/quote, "minns om dig" chips, style gallery, Boka+message. **(D for memory-chips/quote if no data.)**
- **P0 B** `konto-privacy-name-picker` — segmented Fullt namn/Bara förnamn/Initialer + contact + consent.
- **P1 B** `konto-privacy-consent-toggle`, `konto-usual-card-dinvanliga` (.cust-usual CSS exists, no JSX), `konto-booking-message-to-salon`.
- **P2/D** today-teaser (derivable), history points-per-visit (loyalty_ledger derivable), **RC** loyalty-band filled-primary, header chrome, inline Omboka/Avboka location, cancelled-row.

---
## Build order (goal §5 + phasing): BACK-OFFICE fully+verified → /konto → storefront.
Per phase: shared primitives/icons/data-layer first (solo) → per-page fan-out → render-verify each vs mock (§6 checklist) → gate (tsc+lint+vitest+opennext+grep-guard) → iterate. Bokningar drawer = code-build now, visual-verify via Supabase branch seed (no prod write). Deploy after all phases green.
Full raw inventory JSON: workflow `wf_17fca355-81b` output.

---
## ROUND 1 — BUILT + RENDER-VERIFIED (2026-06-03)
Shared pass (truth + data-layer + shared UI primitives: Callout/Drawer/Toast/ViewSwitcher already, + CommandPalette/Bell/CustomerRecognition/LoyaltyBlock/PiiReveal/NotesThread) → gate green (tsc/lint/175 tests). Back-office build fleet (9 pages) → gate green. Captured rendered LAW (kit `ui_kits/back-office/entry-{salon,staff}.html` + `backoffice-pages/*.html`) vs rendered BUILT (local `next dev`, real login) → judge fleet vs §6.

**Round-1 verdicts:** PASS=0 · MINOR=[dashboard 90, kunder 90, tjanster 88, scheman 82, frisor-idag 82, frisor-franvaro 90] · FAIL=[bokningar 28, personal 48, installningar 62, varumarke 66, frisor-schema 68].
**Dominant pattern:** agents OVER-BUILT — bolted new signature components onto existing busy pages + kept old forms, instead of replacing to the lean mock composition. (FAILs = verification working; last round eyeball-shipped this as "done" = the 62%.)

**Chrome fix (orchestrator, done+gated):** PortalTopbar = search + "Se din sida" + bell; user-identity + logout moved to sidebar footer (matches mock); `lib/storefront-url.ts` computes `https://{slug}.corevo.se` (kills the dashboard localhost leak). Clears the topbar delta on ~5 pages.

**Fix fleet (round 1, wf_89b93d14-694):** 10 pages, 3-way test (replace mock-re-expresses / keep+restyle shipped-no-mock-equiv / remove decoration). Key: bokningar = remove the `rows.length===0` gate + server date-range form, always mount BookingsClient, render 7-day grid scaffold as the empty-state; personal = drop KPI band, rich cards + Drawer edit; installningar = KEEP contact/domain/notif (restyle) + AKTIV/AV pills + proof-callouts, no dead toggles; varumarke = dropzone + gold callout + eyebrows (KEEP content editors); frisor-schema = drop sub/callout, keep hours-editor.

**Deferred (need migration/backend — out of frozen scope, flagged not faked):** tjanster per-row storefront-section `<select>` + Populär badge (no `services.section`/`popular` column); SuperOps/SuperCustomers/SuperStaff cross-tenant views (RLS hard-fence, crossTenantRead=false). **Data-unlock (read exists, end seed-pass):** bokningar `customer_id`→drawer recognition/PII; frisor working_hour_slots dense ticks; Stamkund batched visits.

**NEXT:** gate fix fleet → re-capture changed pages → re-judge → seed-branch pass (bokningar populated drawer) → commit → phased deploy. Then Fas 2 `/konto`, Fas 3 storefront.
