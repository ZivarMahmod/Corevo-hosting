# Super-admin ↔ databas — nod-för-nod revision (2026-06-04)

6 subagenter granskade hela plattform-super-admin-ytan (11 vyer, 18 lib-filer, 16 komponenter) mot live-DB (Supabase prod `clylvowtowbtotrahuad`, 21 tabeller). Fråga per nod: **har den en riktig tabell + en riktig funktion, eller är det död kod / mock / no-op?**

Sammanfattning: ytan är **mestadels äkta och ärlig** — soft-delete, status, branding, billing, audit-logg, alla stat-counts läser/skriver riktiga tabeller. Tomma siffror beror på att `bookings`/`payments` har 0 rader (ärlig nolla, inte fejk). Men det finns **6 falska knappar, 4 noder utan DB-stöd, flera hårdkodade mock-värden, och 1 stale logik-bugg**.

Allvarsskala: 🔴 lurar användaren · 🟠 saknar DB helt · 🟡 mock/stale · ⚪ oanvänd kod · 🟢 äkta.

---

## 🔴 FALSKA KNAPPAR (finns i UI, gör inget — vissa LJUGER)

**1. 🔴 "Hjälp salongen"** — `components/platform/TenantDetailActions.tsx:69`
- Menad: gå in i hjälp-/impersonation-läge åt salongen, "allt loggas".
- Gör: BARA en toast "du agerar åt salongen — allt loggas." Ingen server-action, ingen impersonation, `logPlatformAction` anropas ALDRIG. Toasten påstår en loggad åtgärd som inte sker. Värsta noden — den ljuger.

**2. 🔴 "Bjud in personal" (submit i drawer)** — `components/platform/PersonalClient.tsx:308-311`
- Menad: skicka magic-link-invite till ny personal.
- Gör: toast "Invite skickad…" + stänger. E-post/namn/salong-fälten är okontrollerade och slängs. Inget skrivs. OBS: riktig action `createTenantStaff` FINNS (`actions.ts:491`) men drawern anropar den inte.

**3. 🔴 "Påminn" (per rad, personal)** — `components/platform/PersonalClient.tsx:249`
- Menad: påminn en väntande invite.
- Gör: toast "Påminnelse skickad…". Inget anrop, inget nätverk.

**4. 🟠 "Hantera" (varje integrationskort)** — `components/platform/IntegrationsGrid.tsx:83`
- Menad: öppna integrationens inställningar.
- Gör: toast "…inställningar öppnade". Öppnar inget, sparar inget.

**5. 🟠 "Docs" (varje integrationskort)** — `components/platform/IntegrationsGrid.tsx:88`
- Menad: länk till integrationsdokumentation.
- Gör: knapp utan `onClick` OCH utan `href`. Helt död (kommentar i kod: "no target in the law source — visual parity only").

**6. ⚪ "Lägg till kund"-drawer** — `components/platform/kunder/KunderView.tsx:346-368`
- Menad: skapa ny kund.
- Gör: bara "Stäng"-knapp + info-text. Inga fält, ingen submit. Avsiktlig stub.

---

## 🟠 NODER UTAN DB-STÖD (UI finns, ingen tabell/kolumn att spara i)

**7. 🟠 Behörighetsmatris (Roller)** — `components/platform/RolesMatrix.tsx:115` + `lib/platform/catalog-shared.ts:14` + `catalog.ts:40-81`
- Menad: 7-områdes × per-roll RBAC-rättighetsgrid man kan redigera.
- Gör: HELT HÅRDKODAD. `roles`-tabellen har BARA `name`+`level` — INGA rättighetskolumner finns. Matrisen är read-only: ingen checkbox, ingen toggle, ingen save, ingen action. Rättigheter KAN inte sparas och försöker inte. Den är design-på-papper, inte live config. (Per-roll användarantal ÄR dock äkta — räknas från `users→roles(name)`.)

**8. 🟠 Inställningar — 4 reglage (MFA, IP-whitelist, Auto-klar bokningar, Daglig sammanfattning)** — `app/(platform)/installningar/Settings.tsx:43-78`
- Menad: slå på/av plattforms-säkerhet/drift.
- Gör: alla `<button disabled>` med "Kommer snart"-pill. Ingen plattforms-settings-tabell finns. Inget sparas. (Ärligt avstängda, inte vilseledande.)

**9. 🟠 DomänPanel (lägg till domän / CNAME / verifiera)** — `components/platform/DomainPanel.tsx:14-55`
- Menad: koppla egen domän → `tenant_domains`.
- Gör: `<fieldset disabled>`, ingen submit, inget Cloudflare-anrop, skriver INGEN `tenant_domains`-rad. Bakom spärr `DOMAIN_PROVISIONING_ENABLED`. (Avsiktlig spärr — `tenant_domains` har bara 1 rad just därför. Ärligt avstängd.)

**10. 🟠 Onboarding wizard "Ägarens namn"** — `components/platform/CreateTenantForm.tsx:136` → `lib/platform/actions.ts:163`
- Menad: spara salongsägarens namn.
- Gör: skrivs BARA till auth `user_metadata.full_name` på den inbjudna ägaren. `public.users` har INGEN namn-kolumn. INGEN salong/plattform-vy läser ägarens `user_metadata.full_name` → DÖD SKRIVNING. Dessutom: om e-post är tom ELLER service-nyckel saknas hoppas hela invite-blocket → namnet slängs tyst.

**11. 🟠 Onboarding wizard steg 5 "& roll"** — `CreateTenantForm.tsx:79` (bara label, ingen kontroll)
- Menad: välj ägarens roll.
- Gör: det finns INGEN roll-väljare i UI:t — "& roll" är kosmetiskt. Rollen är hårdkodad: createTenant skapar alltid `salon_admin` level 6 (`actions.ts:142`). Själva `users.role_id`-skrivningen är OK, men valet är borttaget.

---

## 🟡 MOCK / HÅRDKODAT (ser live ut, är statiskt)

**12. 🟡 Hälsopiller "Plattformshälsa" (API-uptid / Workers / DB-pool / Köade SMS)** — Översikt `app/(platform)/platform/page.tsx:137` + Drift `components/platform/DriftLog.tsx:168` ← `lib/platform/metrics.ts:165`
- Menad: 4 live system-hälso-mätvärden (mock visade "99,98% · 34% · 3").
- Gör: `getPlatformHealth()` returnerar ALLTID `available:false`. Varje piller visar "—" + "ej kopplad". Ingen telemetri-källa finns. (Ärlig platshållare — fejkar ingen uptime.) OBS: `private.rate_limit_hits` (6 rader) finns men ytan läser den inte.

**13. 🟡 Integration status-badge (Aktiv / Pilot / Delvis / Inaktiv) på alla 6 kort** — `IntegrationsGrid.tsx:66` ← `catalog.ts:131-181`
- Menad: live anslutningshälsa per integration.
- Gör: HÅRDKODADE strängar. Stripe visar "Aktiv" oavsett om `stripe_charges_enabled`-antalet är 0/7. Inte härlett från någon signal. (Anslutnings-ANTALEN bredvid är dock äkta: Stripe/Domän/Google räknas från riktiga tabeller.)

**14. 🟡 Översikt-tabell kolumn "Stad"** — `page.tsx:251`
- Menad: salongens stad.
- Gör: hårdkodat "—" varje rad. Ingen stad-kolumn finns på `tenants`/`locations` läses inte. Permanent tom.

**15. 🟡 Översikt-tabell kolumn "Bokningar" (per salong)** — `page.tsx:260`
- Menad: bokningar per salong.
- Gör: hårdkodat `<span>0</span>` varje rad — ingen query alls. (`listTenants` returnerar inget bokningsantal.)

**16. 🟡 Översikt-tabell kolumn "Senast aktiv"** — `page.tsx:257`
- Menad: när salongen senast var aktiv.
- Gör: ingen aktivitets-telemetri finns → visar `Skapad {created_at}` (äkta `tenants.created_at`) men med fel rubrik. Datumet är live, betydelsen utbytt.

---

## 🟡 STALE / INKONSEKVENT LOGIK (äkta DB, fel kod-väg)

**17. 🟡 Variant-etikett på salongs-korten** — `lib/platform/tenants.ts:67,180,202`
- Menad: visa salongens valda bokningsvariant.
- Gör: kortet använder en inline LEGACY-parser (`booking.variant === '4' ? '4' : '3'`) med 2 värden, INTE kanoniska `readBookingVariant` (4-id `wizard|compact|drawer|inline`). En salong som sparar nya id:t `wizard`/`compact` faller igenom till "Steg-för-steg". Detalj-redigeraren använder rätt 4-id-modell → ytorna är oense. Ingen synlig krasch idag (bara `zigge` har legacy `'3'`), men logiken är stale.

**18. 🟡 "Nivå"-badge customization-level** — `lib/platform/tenants.ts:89-91`
- Menad: Nivå 1/2/3-nivå per salong.
- Gör: `deriveCustomizationLevel` LÄSER `layout.nav_variant || layout.hero_variant` — RETIRERADE/döda nycklar. Inget i appen SKRIVER dem längre → den signalen är alltid false. Dessutom kräver Nivå 3 `settings.custom_override.css` som INGEN skriv-väg sätter → Nivå 3 oåtkomlig utom via manuell DB-edit. (Korten visar i praktiken bara Nivå 1–2.)

---

## ⚪ DÖD KOD (oanvänd, inte kopplad)

**19. ⚪ `platformMetrics` + typen `PlatformMetrics`** — `lib/platform/metrics.ts:19,12`
- NOLL anropsplatser (grep-verifierat: enda träffen är dess egen definition rad 19). Ersatt av `platformOverview`. Oanvänd kandidat — men stäm av mot **build-once-never-delete** innan radering.

---

## 🟢 ÄKTA (riktig tabell + riktig funktion — för förtroende)

- **Onboarding wizard:** 8/10 fält sparas korrekt (namn→`tenants.name`, subdomän→`tenants.slug`, tema→`settings.theme`, variant→`settings.booking.variant`, accent→`branding.color_accent` ENDAST (ingen theme-masking), tagline→`settings.copy.tagline`, logga→`branding.logo_url`, ägar-epost→`users.email`+`role_id`). "Varje salong default leander"-buggen ÄR fixad. Noll missing-db.
- **Soft-delete + status** (`setTenantStatus`): skriver `tenants.status='deleted'/'suspended'`, aldrig `.delete()`. Prod har redan 1 raderad + 1 pausad → bevisat fungerar.
- **Billing** (`saveBilling`): skriver riktiga `billing_model`/`*_fee_cents`. Fakturering läser live `tenants`/`tenant_settings`/`bookings`. Inga fejk-fakturor (ingen invoices-tabell uppfunnen). Ingen död "debitera"-knapp (manuell flöde-2 design har medvetet ingen).
- **Salonger-grid + detalj** (6 flikar): alla counts binder riktiga tabeller (`bookings`/`staff`/`users`/`services`/`working_hours`). Onboarding-status + ägare-join äkta. Per-tenant branding (`PlatformBrandingForm` → `tenant_settings.branding`) helt kopplad.
- **Kunder / Personal / Audit-logg:** läser live `customers` / `staff⋈users⋈roles` / `audit_log` cross-tenant. CSV-export + filter äkta klient-sida. Lösenordsreset = riktig action (gated på SERVICE_ROLE_KEY).
- **OnboardingChecklist:** DB-backad per-tenant (`deriveOnboarding` från live counts). Bara steg 5 "Egen domän" hårdkodat låst (avsiktlig spärr).

---

## ⚪ TOMMA TABELLER (ärlig nolla — INTE buggar)

Alla bokings-/intäkts-KPI:er på Översikt + Fakturering visar 0 för att `bookings` (0 rader) och `payments` (0 rader) är tomma. Koden är ärligt byggd: riktiga ranged queries + sparkline-buckets, ingen fejkad kurva. Sparkline ritar platt linje (alla 12 månader = 0). Visar äkta nolla, inte mock. Fylls när riktiga bokningar finns.

---

## ARKITEKTUR-NOTER

- **Edge-funktion `send-email`** (enda deployade): anropas via HTTPS-relay från BOKNINGS-notiser (`lib/notifications/email.ts`), INTE från plattform-ytan. Ingen plattform-kod anropar någon edge-fn. Ingen annan/odeployad edge-fn refereras → ingen 404-risk.
- **Realtime FINNS på plattform-ytan:** `components/realtime/RealtimeBookings.tsx` prenumererar `.channel('rt-bookings').on('postgres_changes', {table:'bookings'})`. Monterad i `app/(platform)/layout.tsx:17` UTAN tenantId → all-tenant-prenumeration, förlitar sig på platform-admin RLS. Tabellen finns. Icke-blockerande.
- **Inga uppfunna tabeller:** ingen invoices/integrations/api_keys/webhooks-tabell finns; koden uppfinner dem inte — använder statiska kataloger + en ärlig live-signal per kort. Korrekt.
- **RLS-varning (orelaterad):** `private.rate_limit_hits` har RLS AV (6 rader). Supabase-advisor flaggar kritiskt. Surfa till Zivar — kräver policy innan RLS slås på.

---

### Att-göra-prioritering (förslag, ej utfört)
1. 🔴 Koppla "Hjälp salongen" + "Bjud in personal" + "Påminn" till riktiga actions (eller dölj dem). `createTenantStaff` finns redan.
2. 🟠 Roll-väljare i wizard steg 5 (annars ta bort "& roll"-label). Lös ägar-namn-läsning eller lägg namn-kolumn.
3. 🟡 Fixa kort-grid variant-etikett att använda `readBookingVariant` (4-id), inte legacy-parsern.
4. 🟡 Sluta läsa retirerade `layout.nav_variant/hero_variant` i `deriveCustomizationLevel`.
5. ⚪ Oanvänd `platformMetrics` — stäm av build-once-never-delete före ev. radering.
