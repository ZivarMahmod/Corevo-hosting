# Onboarding — omarbetning + buggfix (plan)

Status: 2026-06-16. Underlag: Zivars live-test av "Skapa salong"-wizarden + verifiering i kod (`lib/platform/actions.ts`, `components/platform/CreateTenantForm.tsx`) och prod-DB (clylvowtowbtotrahuad).
Lägeskoppling: `1-Planering/04-hosting-onboarding`. Briefs läggs i `2-Byggplan/goals/` när de plockas. Relaterat: `fix-25` (onboarding steg-5-text).

## TL;DR
Två riktiga buggar (orphan-salong vid invite-fail + Auth-mail funkar inte) och en UX-omarbetning av wizarden i 5 punkter. **Buggarna först** — de blockerar riktig onboarding. Sen UX.

---

## A. Buggar (verifierade i prod)

### A1 — Invite-fail lämnar en orphan-salong, och går inte att rätta
**Vad händer:** `createTenant` skapar salongen i 4 atomiska steg (tenant → settings → location → roll+moduler) som rullar tillbaka ihop. **Ägar-inbjudan (steg 5) ligger UTANFÖR rollbacken** ("best effort"). Failar inbjudan → salongen blir kvar, utan ägare, och success-toasten ser ut som ett fel.
**Verifierat:** tenant `test-barber` fanns kvar (active, ingen ägare); 0 auth-user för ägar-mailen; reset gav "User not found". Hela auth-tabellen hade bara superadmin. *(Städat: omdöpt → `zz-deleted-test-barber-...`, soft-deleted, slug fri.)*
**Extra fynd (latent):** en hård radering av en salong som hunnit logga `tenant.create` blockeras av `audit_log` (append-only, by design — korrekt). App-rollbacken klarar sig idag bara för att audit loggas sist. Fragilt, värt att veta.
**Gap:** ägar-inbjudan sker BARA vid skapande. Failar den (eller hoppas över) finns ingen knapp för att skicka igen. Reset funkar inte (ingen user än).
**Beslut (reko):** ägare är frivillig (design: "inget tvingande"). Rulla därför INTE tillbaka — istället:
1. Ärlig status: "Salong skapad. Ägare ej inbjuden än — gör det nedan." (inte rött fel).
2. Lägg en **"Bjud in / återsänd ägar-invite"-action** på salong-detaljen, körbar när som helst.
3. A2 nedan får mailen att faktiskt gå ut.
**Alternativ:** hård atomicitet (rulla tillbaka tenant om invite failar). Sämre — krockar med "ägare frivillig" och slänger allt annat arbete pga ett mailfel.

### A2 — Auth-inbjudan/mail går inte ut
**Trolig rot:** Supabase Auth's egen SMTP är inte kopplad till one.com. App-mailen (booking@) går via edge function `send-email` — men `inviteUserByEmail` och recovery går via Supabases **inbyggda** mailkanal (strypt/test) → invite failar, ingen user skapas, inget mail.
**Bekräfta (2 min):** Supabase → Auth → SMTP-inställningar. Tomt/default = roten.
**Fix:** koppla Auth-SMTP till one.com (samma avsändardomän). Sätt invite- + recovery-mallarna. Test: invite en färsk adress → mail kommer + auth-user skapas.
**Not:** mest config/ops, lite kod.

### A3 — Vilseledande copy "skapad och live på X.corevo.se"
Inget är deployat/live än → texten ljuger. Byt till neutral: "Salong skapad." (ev. "förhandsvisa" istället för "live"). En rad i `actions.ts` (~rad 254).

---

## B. UX-omarbetning av wizarden (dina 5 punkter)

Wizard: `components/platform/CreateTenantForm.tsx` (6 steg). Dagens preview = `ThemePreview` — en **trogen MOCK** som speglar `THEME_CONTENT`, visas bara i steg 2. Inte en riktig storefront-render (bra — salongen finns ju inte i DB än).

### B1 — Live-preview av hela sidan genom ALLA steg (måste)
Tomma högersidan blir en stående preview-panel som uppdateras live:
- bransch → grund-looken
- namn → namn i header, slug i adressfält
- mall → temat byter
- **moduler → sektioner tänds/släcks** (booking, shop, blogg, lojalitet…) ← din viktigaste
- accent / tagline / logga → live
**Approach:** bygg UT `ThemePreview`-mocken (matas av wizard-state, ingen DB) till hela sidan + alla steg. INTE iframe mot riktig storefront (den läser DB per slug — finns inte än).
**Reko:** störst vinst, bygg den först av UX-delarna.

### B2 — Packa ihop steg (6 → 4) + döp om "Token-branding"
- Slå ihop **bransch + namn/subdomän** (bransch = ett klick, namnfält dyker upp).
- Slå ihop **tema + token-branding → "Utseende"** (mall + accent + tagline + logga på en yta).
- "Token-branding" säger ingenting → heter **"Utseende & logga"**.
- Resultat: **Bransch+namn · Utseende · Moduler · Ägare = 4 steg**.

### B3 — Koppla loss mall från bransch
Idag filtreras mallar på bransch (`tags.bransch`) → känns låst.
**Fix:** bransch = förval (rätt mall förmarkerad), men visa "alla mallar" så du fritt kan byta. Aldrig lås.

### B4 — Av/på i onboarding — livscykeln flyttar till Drift
Idag exponeras hela livscykeln (av→utkast→live→pausad) i modulsteget → förvirrar.
**Fix:** i onboarding bara **Av / På** per modul (Bokning alltid på). Utkast/live/pausad hör hemma på salongens **Drift-flik** efter skapande — där den redan finns ("Aktivering är super-admin-spärrad i DB").

---

## C. Sekvens (briefs)
Buggar blockerar riktig onboarding → de först. En brief i taget → verifiera → nästa.
1. **FIX-30** — Auth-SMTP mot one.com (A2). Utan den funkar ingen invite.
2. **FIX-31** — Återsänd/bjud-in-ägare-action + ärlig status + neutral copy (A1 + A3).
3. **GOAL-31** — Live-preview-panel, hela sidan / alla steg (B1).
4. **GOAL-32** — Packa steg 6→4 + "Utseende"-steg + rename (B2) + koppla loss mall (B3).
5. **GOAL-33** — Av/på i onboarding-modulsteget (B4).

---

## Beslut (låsta 2026-06-16)
1. **A1-approach:** ägare frivillig + återsänd-knapp + ärlig status. Ej hård rollback.
2. **SMTP-avsändare:** one.com (booking@) även för Auth-mail. *(default — säg till om separat no-reply önskas)*
3. **Stegordning B2:** 4 steg — Bransch+namn · Utseende · Moduler · Ägare. *(default)*

---

## Berörda filer (för briefs)
- `5-Kod/apps/web/components/platform/CreateTenantForm.tsx` — wizard + `ThemePreview`
- `5-Kod/apps/web/lib/platform/actions.ts` — `createTenant` (+ ev. ny `resendOwnerInvite`)
- `5-Kod/apps/web/lib/platform/tenants.ts` — onboarding-stege-text (jfr `fix-25`)
- `5-Kod/apps/web/components/platform/OperativeControls.tsx` — Drift-flikens modul-livscykel
- Supabase → Auth → SMTP (config, A2)

## Guardrails
- Bygg via `C:\tmp\kod` (ö i repo-sökväg kraschar opennext).
- Rör inte `audit_log` (append-only). Soft-delete, aldrig hård radering av tenant som loggat.
- En brief i taget → verifiera → `2-Byggplan/klart/`.
