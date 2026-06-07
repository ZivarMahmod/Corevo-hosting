# BRIEF-FX-019: Ärlighetspass — döda falska knappar + wire snabba riktiga + bugfixar
Thinking: 🟡 Think (många små ytor, noll migrationer)

> ## ✅ KLAR (2026-06-05) — render-verifierad, oberoende granskad
> Alla 11 noder gjorda (inga migrationer). **Render-verifierad** inloggad som super_admin (platform@corevo.se) på `booking.localhost`: #1 Hjälp salongen → klick skrev RIKTIG `audit_log`-rad (`platform.help_mode_open`, server-side actor) + ärlig toast (ej fejk); #2 invite-drawer = ENDAST Namn+Salong (e-post/roll-fält borta, "Skapar personalrad direkt"); #3 Påminn borta; #4 Hantera/#5 Docs borta; #13 badge härledd (Stripe 0/7→Inaktiv, Cloudflare 1/7→Aktiv, no-source→ingen badge); #15 Bokningar = riktig räkning (FreshCut **2**, övriga 0, EN grupperad query); #16 "Skapad"-kolumn riktigt datum; #18 Anpassningsnivå 2 ur riktig signal (tema satt). #8 4 vilseledande reglage borta; #17 readBookingVariant; #19 platformMetrics DORMANT-kommenterad (ej raderad). **0 console-fel** alla ytor. Gate: typecheck 0 · lint 0 · **vitest 203** (+countBookingsByTenant + variant-labels + deriveCustomizationLevel-tester). Oberoende adversariell granskning: 0 kvarvarande lögner, bara 4 small future-scale-noter (icke-blockerande). POS 200/200. **DEPLOYAD LIVE** worker `562c09ad-87f3-4896-9944-98e1c1b29a81` (rollback `1424d997-814f-45c6-ad83-06a5ced170aa`); smoke: corevo.se 200 · admin.corevo.se 200 · booking.corevo.se 307→login · freshcut.corevo.se 200 + `x-corevo-tenant-kind=tenant` (ingen .env.local-läcka); middleware.js grep-guard 0 träffar.

## Mål
Ta bort ALL aktiv vilseledning i super-admin-ytan: falska knappar som påstår åtgärder som inte sker, hårdkodade värden som ser live ut, och stale logik. Wire det som har en riktig action redan idag. INGA migrationer — bara UI/lib-kod.

## Lägeskoppling
- Audit `4-Dokument-Underlag/superadmin-db-audit-2026-06-04.md` noder #1,#2,#3,#4,#5,#8,#13,#15,#16,#17,#18,#19.
- Plan `2-Byggplan/AUDIT-FIX-PLAN-superadmin-2026-06-04.md` → GOAL-19.
- **Bärande regel (Zivar):** all data i UI ska ha riktig DB-koppling; ingen hårdkodad siffra som kan förväxlas med kunddata. Ärlig nolla OK, fejk inte.

## Kontext (verifierade ankare)
- `logPlatformAction(supabase, { action, tenantId, actorId, entityId?, meta? })` — `5-Kod/apps/web/lib/platform/audit.ts:25`, skriver `audit_log` (append-only, best-effort). `PlatformAuditAction` är en union-typ i samma fil — ny action-sträng måste läggas till där.
- `createTenantStaff(_p, fd)` — `lib/platform/actions.ts:491`. Tar FormData `{ tenantId, title }`, slår upp primär location, inserter `staff {tenant_id, location_id, title, active:true}`, loggar `tenant.staff_create`. **Tar INTE email/roll** — magic-link-invite existerar inte.
- `readBookingVariant(settings)` — `lib/platform/booking-variant.ts:68`. 4 id: `wizard|compact|drawer|inline`. Legacy `'3'→wizard`, `'4'→compact`.
- Integration-katalog `lib/platform/catalog.ts:125` + counts i `getPlatformIntegrations` (`tenants.stripe_charges_enabled`, `tenant_domains.verified`, `tenant_settings.settings.google_review_url`).

## Berörda filer
- `5-Kod/apps/web/components/platform/TenantDetailActions.tsx` (~68) — #1 Hjälp salongen.
- `5-Kod/apps/web/components/platform/PersonalClient.tsx` (~249, ~305) — #2 Bjud in personal, #3 Påminn.
- `5-Kod/apps/web/components/platform/IntegrationsGrid.tsx` (~78, ~87) — #4 Hantera, #5 Docs, #13 badge.
- `5-Kod/apps/web/lib/platform/catalog.ts` (~125) — #13 badge-härledning.
- `5-Kod/app/(platform)/platform/page.tsx` (~251, ~257, ~260) — #15 Bokningar, #16 Senast aktiv. (#14 Stad hanteras i GOAL-20, inte här — lämna "—" tills dess, ELLER ta bort kolumnen temporärt; se anti-patterns.)
- `5-Kod/apps/web/lib/platform/tenants.ts` (~67,180,202 variant; ~81-95 nivå) — #17, #18.
- `5-Kod/apps/web/lib/platform/actions.ts` — ev. ny `enterHelpMode`-action (#1) + ev. `inviteTenantStaff`-wire (#2).
- `5-Kod/apps/web/lib/platform/audit.ts` — lägg ev. `platform.help_mode_open` i `PlatformAuditAction`.
- `5-Kod/apps/web/lib/platform/metrics.ts` (~19) — #19 dormant-kommentar.
- Testfiler: `lib/platform/booking-variant.test.ts`, ev. ny för listTenants-bokningsräkning.

## Steg

### #1 Hjälp salongen → ärlig minimal (TenantDetailActions.tsx)
1. Ta bort den falska toasten `'…allt loggas.'`.
2. Lägg en riktig server-action `enterHelpMode(tenantId)` i `actions.ts` som ENBART anropar `logPlatformAction(supabase, { action:'platform.help_mode_open', tenantId, actorId })` och returnerar success. Lägg `platform.help_mode_open` i `PlatformAuditAction`.
3. Knappen anropar den via `useTransition` → ärlig toast: `"Hjälp-läge öppnat för {tenantName} — loggat."` Ingen impersonation, ingen påstådd salongs-loggning.
4. Om detta blir rörigt (t.ex. actor-id ej tillgängligt i kontексten) → **dölj knappen** istället. Ärligt borta > falskt kvar.

### #2 Bjud in personal → wire till createTenantStaff (PersonalClient.tsx)
1. Drawern ska submitta till `createTenantStaff` (FormData `tenantId` = salong-select, `title` = namn-fält) via `useActionState`/form-action.
2. **Ta bort fält som inte lagras** (email + roll) ELLER märk drawern ärligt om de behålls visuellt — men de får INTE se ut att sparas. Minst dött: behåll salong + namn, ta bort email/roll-inputs.
3. Ärlig success-toast: `"Personal tillagd"` (INTE "magic-link skickad" — ingen e-post går).
4. **Not (egen framtida goal):** riktig magic-link-e-postinvite (epost + roll-val + auth-invite) = separat — INTE här.

### #3 Påminn → dölj (PersonalClient.tsx ~249)
- Ta bort `RemindButton`/Påminn-knappen (ingen reminder-action finns).

### #4 Hantera / #5 Docs → dölj döda knappar (IntegrationsGrid.tsx)
- Ta bort "Hantera"-knappen (~78, bara toast) och "Docs"-knappen (~87, varken onClick eller href). Inget riktigt mål finns.

### #13 Integration-badge → härled från riktig signal (catalog.ts + IntegrationsGrid.tsx)
1. Badge får INTE vara hårdkodad sträng. Härled per kort ur det riktiga kopplings-antalet: `count > 0 → "Aktiv"`, `count === 0 → "Inaktiv"`. För kort utan `countSource` (SMS/Mail/POS) → ingen badge alls.
2. Behåll de riktiga kopplings-antalen (de är redan äkta).

### #15 Bokningar-kolumn → wire riktig räkning (page.tsx + tenants.ts)
1. Utöka `listTenants` (`tenants.ts:29`) att returnera `bookingsCount` per tenant — en riktig `count` mot `bookings` grupperat på `tenant_id` (platform_admin läser cross-tenant). Ärlig 0 där inga finns.
2. `page.tsx:260` renderar `t.bookingsCount` istället för hårdkodad `0`.

### #16 Senast aktiv → relabela (page.tsx)
- Byt kolumnrubrik "Senast aktiv" → "Skapad" och visa `formatDate(t.createdAt)` rakt (datumet är redan äkta `tenants.created_at`; bara rubriken ljög).

### #17 Variant-etikett → readBookingVariant (tenants.ts)
- Ersätt legacy-parsern (`booking.variant === '4' ? '4' : '3'` på ~180) + 2-värdes `VARIANT_LABEL` med `readBookingVariant(settings)` → mappa de 4 id:na till etiketter (`wizard→Steg-för-steg`, `compact→Snabbboka`, `drawer→Drawer`, `inline→Inline` — använd befintliga etiketter om de finns).

### #18 Nivå-badge → läs riktig roll (tenants.ts deriveCustomizationLevel)
- Sluta läsa döda `settings.layout.nav_variant/hero_variant`. Härled nivån ur riktig signal: salongens roll/`roles.level` (salon_admin = self-service-nivå) ELLER faktiskt satt branding/tema. Ta bort `custom_override.css`-grenen (Nivå 3 byggs aldrig här — den fantomvägen tas bort). Resultat: badgen speglar verklig konfiguration, inga döda nycklar.

### #19 Dead code → dormant-markering (metrics.ts ~19)
- Lägg kommentar `// DORMANT — build-once-never-delete; ersatt av platformOverview. Radera ej.` ovanför `platformMetrics`. Radera INGET.

### #8 Settings 4 reglage → ta bort (om i scope för denna yta)
- I `app/(platform)/installningar/Settings.tsx:43-78`: ta bort de 4 vilseledande `<button disabled>`-reglagen (MFA/IP-whitelist/Auto-klar/Daglig). Lämna sidan ärlig (tom eller kort "inställningar kommer i egen iteration"). Park: superadmin-settings-katalog = egen plan, byggs ej här.

## Verifiering
- [ ] Grep: ingen kvarvarande `notify(...)`/toast som påstår en åtgärd utan att en server-action körts (Hjälp/Invite/Påminn/Hantera). Varje f.d. falsk knapp gör nu antingen en riktig sak eller finns inte.
- [ ] #1: klick → `audit_log`-rad skapas (verifiera rad), ärlig toast. ELLER knappen borta.
- [ ] #2: drawer-submit → ny `staff`-rad i DB för vald tenant; toast ärlig; inga dött-lagrade fält.
- [ ] #13: sätt en integration-count till 0 → badge blir "Inaktiv"; >0 → "Aktiv". Ingen hårdkodad "Aktiv" kvar.
- [ ] #15: en tenant med 0 bokningar visar 0, en med N visar N (radera/lägg → siffran följer). Ingen hårdkodad `0`.
- [ ] #16: kolumn heter "Skapad", visar riktigt datum.
- [ ] #17: en tenant med `settings.booking.variant='wizard'` visar rätt etikett (inte fallback "Steg-för-steg" pga legacy).
- [ ] #18: badgen ändras när roll/branding ändras; inga `layout.*`-läsningar kvar (grep).
- [ ] vitest grön (uppdatera/lägg test för listTenants-bokningsräkning + variant-etikett). typecheck + lint rena.
- [ ] POS `corevo.se`+`admin.corevo.se` → 200. Inloggad super-admin: 0 console-fel.

## Anti-patterns
- Lämna INGEN knapp som visar en success-toast utan att en riktig action körts.
- Wire INTE email/roll i invite-drawern till createTenantStaff (den lagrar dem inte) — ta bort fälten istället. Inga dött-skrivna fält.
- Rör INTE #14 Stad här (kräver migration → GOAL-20). Om "—" känns vilseledande i mellantiden: dölj kolumnen tills GOAL-20, men ändra INGET schema.
- Radera INTE `platformMetrics` (build-once-never-delete).
- Härled INTE bokningsräkning client-side på N+1 — gör EN grupperad count i `listTenants`.

## Kopplingar
- #2 öppnar för framtida "riktig magic-link-personal-invite"-goal.
- #14 Stad + roll-väljare = GOAL-20. RBAC-roller (#18 lutar sig mot roll) = GOAL-21.

## Rollback
- Rent additiv/subtraktiv UI+lib — `git revert` av commiten + redeploy. Ingen DB-migration, inget destruktivt.
