# goal-72 — Superadmin v2 (Admin v2)

> Skriven 2026-07-18 efter trevägs-inventering: superadmin-koden (`app/(platform)`),
> kund-adminens nya värld (`app/(admin)`, goal-67/68-eran), och SPEC:en
> (`4-Dokument-Underlag/01-acceptans/super-admin/handoff-2026-07-13/`).
> Mål (Zivar): superadmin = primära arbetsytan; så mycket som möjligt ska gå via
> frontend i stället för SQL/CLI. Samma designspråk som kund-adminen — inte identisk.

## Nulägesdom (kort)

Superadmins **struktur är frisk**: SPEC:ens 5 toppområden är byggda, kundkortet
har alla flikar + modul-flikar (delar komponenter med kund-adminen — bra), 56
server actions täcker det mesta. Det som hänt är att **kund-adminen sprungit
ifrån i mönster** (workspace-inställningar, drawers, master–detalj, tvåstegs-arm,
PiiReveal, genvägsrad, låsta navposter, personalfärger, no_show, Stat/tomlägen)
och att **nya systemdelar saknar operatörs-UI helt** (outbox/utskick, prefs/push,
cron-hälsa, juridik-fält, domänpanelen flag-gated AV, fakturering manuell).

## Gap-lista (fynd)

### A. Frontend-kontroll saknas (måste idag göras via SQL/CLI)
1. **Utskick/kommunikation**: `notifications_outbox` (0091) har ingen läsare —
   kanal/status/kostnad/skip_reason per kund osynligt. `customer_notification_prefs`
   + `push_subscriptions` likaså. SMS-leveransstatus (46elks-webhook) utan UI.
2. **Cron/jobb-hälsa**: pg_cron-jobben + `job_run_details` + outbox-kön syns inte;
   `api/cron/scheduler-health` finns men exponeras inte.
3. **Juridik**: `settings.legal` (org-nr/moms, plan 003) saknar skrivfält — både i
   kundkortet och kund-adminens Företag/Sekretess.
4. **Domänpanelen**: actions (add/verify/remove, FX-14-härdade) FINNS men UI:t är
   flag-gated AV i prod — `/domaner` är bara läs.
5. **Fakturering**: `billingUnderlag` är läs-bar, fakturering manuell (medvetet
   parkerad tills betal-rails öppnas — PARKERAD, ej v2-scope).
6. **Feature-flaggor**: ingen UI (bara sajtbyggar-flaggan, styrs utanför).

### B. Mönster-drift (kund-adminen har, superadmin saknar)
1. `/installningar` (platform) är en LÄS-infosida — kund-adminen har
   SettingsWorkspace (kategorinav + sök + varningsprickar + settings-map).
2. Genvägsrad + låsta navposter: bara kund-admin (platform får `quickActions=undefined`).
3. PiiReveal/maskning: Insyn/Slutkunder visar kontaktuppgifter utan tidsbegränsad
   avslöjning; kund-adminen maskerar (PII-hygien).
4. Tvåstegs-arm finns fläckvis (DomainManager, riskzon) — inte standard överallt.
5. Kundkortets kort är `<details>`-baserade; kund-adminen har Drawer/master–detalj.
   (Kundkortet är "heligt" per SPEC — flikarna BEHÅLLS; bara interaktionsdetaljer.)
6. Statistik-mönstret (Stat + Sparkline + ärliga tomlägen + no_show som
   förstklassig status) är rikare i kund-adminen.

### C. IA-beslut tagna men ej genomförda
1. **Salonger → Kunder** (SPEC + Zivar 2026-06-28): routes `/salonger`→`/kunder`,
   onboarding under `/kunder/ny`. Kräver namnkrock-lösning: dagens `/kunder`
   (slutkunder, Insyn) → `/slutkunder`. Redirects så inga länkar dör.
2. Terminologi-glidning kunder↔salonger i kod/etiketter.

## Etappplan (prioriterad — värde ÷ risk)

### Etapp 1 — Kontrolluckorna (störst nytta för "slippa backend")
- **1a Kommunikationscenter** (ny Insyn-undersida "Utskick"): outbox-tabell
  (filter: tenant/kanal/status/kategori), kostnadssummering (SMS öre → kr/mån),
  prefs-/push-adoption per tenant (plan 020-frö). Kräver läs-RPC:er (migration
  0092: `platform_outbox_summary` + `platform_outbox_rows`, security definer,
  service/platform-gated).
- **1b Drift-hälsa** (ny Plattform-undersida "Drift"): pg_cron-jobbens senaste
  körningar (läs-RPC mot `cron.job_run_details`), outbox-köstatus, senaste
  cron-svepens resultat. Ärliga HealthPills (SPEC-mönstret).
- **1c Juridik-fält**: skrivbart org-nr/moms i kundkortet (Drift-fliken) +
  kund-adminens Företag-kategori. Action mot settings.legal-seamen (finns).
- **1d Domänpanelen**: tänd flaggan (validator + two-phase + re-assert finns och
  är FX-14-härdade) → kundkortets Integrationer får fungerande domänhantering.

### Etapp 2 — Mönster-paritet (samma system-känsla)
> Zivar 2026-07-18: gäller ÄVEN mobil — superadmin ska ha samma mobilnivå som
> kund-adminen (FAB/flikar/dock-mönstret), inte bara desktop-paritet. (2g)
- **2a Inställningar-workspace** för platform: kategorinav-mönstret från
  kund-adminen. Kategorier: Plattformsbranding (global PlatformBrandingForm),
  Säkerhet, Fakturering (läs + prismodell-defaults), Flaggor, Juridik-defaults.
- **2b Genvägsrad** för platform-toppbannern (Ny kund · Slutkunder · Loggar ·
  Fakturering) + låsta navposter-mönstret där det är relevant.
- **2c PII-hygien**: PiiReveal + maskPhone/maskEmail i Insyn/Slutkunder + kundkortets
  Kunder-flik.
- **2d Bekräftelse-svep**: tvåstegs-arm som standard i alla platform-mutationer.
- **2e Statistik-paritet**: no_show + Stat/tomlägen i kundkortets Översikt.

### Etapp 3 — IA-svängen (sist, störst brytrisk)
- **3a** `/salonger`→`/kunder`, `/kunder`→`/slutkunder`, `/salonger/ny`→`/kunder/ny`;
  permanenta redirects; nav-etiketter; ⌘K-paletten.
- **3b** Terminologi-svep (kod-kommentarer/etiketter; branschvakten gäller).

### Parkerat (medvetet)
- Fakturagenerering/Stripe-debitering av tenants (betal-rails-beslutet §14.2).
- Full sidbyggare, mall-katalog-import, kundportal-hub (egna spår).
- Adoption-dashboard fullt ut = plan 020 (1a lägger fröet).

## Beslut (Zivar 2026-07-18)
- Ordning: **1 → 2 → 3** enligt ovan.
- Domänpanelen: **PÅ** (1d).
- Kundkortet: **byggs om till master–detalj** (listan = master, kortet = detalj) —
  flikinnehållet och alla funktioner BEVARAS inuti detaljen. Läggs som **2f**
  (störst ombyggnad i etapp 2). SPEC-regeln omtolkad: innehållet är heligt,
  layoutskalet får bytas.

## Regler för genomförandet
- ⭐ **Partner-modellen är slutmålet** (Zivar 2026-07-18, kanon:
  `1-Planering/01-arkitektur/partner-modellen.md`): superadmin v2 är ytan som
  framtida utlandspartners driver SIN verksamhet i — helt utan Zivar/backend.
  Därför: servern bestämmer alltid tenant-listan (aldrig "alla" i UI-logik),
  ingen ny funktion får kräva SQL för normal drift, kostnader aggregeras via
  tenant_id (per-partner imorgon), leverantörer hårdkodas inte i UI.
- Kundkortets flikstruktur är HELIG (SPEC) — inga flik-omflyttningar.
- Återanvänd `components/portal/ui/*`; nya delade mönster flyttas DIT, inte kopieras.
- Kund-adminen får inte försämras: delade komponenter ändras bakåtkompatibelt,
  `pnpm test` + typecheck grönt per etapp, prod-rök efter deploy.
- Säker logik stannar i server actions/RPC med behörighetskontroll — frontend får
  aldrig egna regler (UI-gating är kosmetik, servern är sanningen).
- Branschvakt: inga hårdkodade branschord i nya ytor.

## Sessionsplan
Körbar plan per etapp (S1–S6, fil:rad-konkret): `goal-72-sessionsplan.md`.

## Status
- [ ] Etapp 1a Kommunikationscenter
- [ ] Etapp 1b Drift-hälsa
- [x] Etapp 1c Juridik-fält — LIVE v1.37.3 (2026-07-18; v1.37.2 föll på
      parallellsessions-kontaminering, de-kontaminerad i 4557376)
- [x] Etapp 1d Domänpanelen tänd — VAR REDAN PÅ i prod (wrangler.jsonc:60, sedan
      2026-06-06, CF-secrets satta). Inventerings-agentens "AV" kom från en stale
      kodkommentar i DomainPanel.tsx.
- [ ] Etapp 2a–2e Mönster-paritet
- [ ] Etapp 3 IA-svängen
