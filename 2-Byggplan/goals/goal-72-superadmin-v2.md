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

### Etapp 4 — Partner-rollen (direkt efter etapp 1–3, ska INTE vänta)
> Zivar 2026-07-18: superadmin byggs för honom maxad FÖRST — sen läggs en ny
> roll som ger partners en isolerad, nästan identisk kopia av samma yta.
- **4a Datamodell**: partner-entitet + `tenants.partner_id`; Zivar = "partner
  noll" (ser allt, inkl. partnerdata — kan följa deras verksamhet).
- **4b Server-scoping**: ALLA platform-läsare/actions/RPC:er filtrerar på
  inloggad användares partner-scope (RLS + grindar) — UI:t är redan byggt att
  fråga servern om listan, så ytan behöver inte byggas om.
- **4c Rollen**: ny nivå mellan platform-full och tenant-ägare; exakta
  behörighetsskillnader mot Zivars = ◆ DISKUTERAS med Zivar när 4 startar
  (hans ord: "lite mindre behörigheter kanske eller något vi diskuterar").
- **4d Kostnads-/licensvyn**: partnerns SMS-kostnader + aktiva kunder synligt
  per partner (licens ~50 kr/mån × aktiv kund); per-partner SMS-leverantör.
- Kanon: `1-Planering/01-arkitektur/partner-modellen.md`.

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
- [x] Etapp 1a Kommunikationscenter — serverfiltrerad, PII-fri utskicksledger,
      sann 30-dagarssummering, SMS-kostnad och preferens-/push-adoption är byggda
      och testade (2026-07-18; 0110 + sanningsrättning 0112).
- [x] Etapp 1b Drift-hälsa — serverläst pg_cron-hälsa, PII-fria
      outbox-köaggregat och Cloudflare-schedulerns heartbeat är byggda med ärliga
      tom-/partial-/fellägen (2026-07-18; 0113-runtimeprovet körs i CI eftersom
      lokal Supabase CLI/Docker saknas).
- [x] Etapp 1c Juridik-fält — LIVE v1.37.3 (2026-07-18; v1.37.2 föll på
      parallellsessions-kontaminering, de-kontaminerad i 4557376)
- [x] Etapp 1d Domänpanelen tänd — VAR REDAN PÅ i prod (wrangler.jsonc:60, sedan
      2026-06-06, CF-secrets satta). Inventerings-agentens "AV" kom från en stale
      kodkommentar i DomainPanel.tsx.
- [ ] Etapp 2a Inställningsworkspace — delat workspace med verkliga
      Säkerhet-/Faktureringsytor är klart; global branding saknar fortfarande en
      sann global datakälla och är därför inte fejkat eller avbockat.
- [x] Etapp 2b Genvägsrad och låsta navmönster (2026-07-18).
- [x] Etapp 2c PII-hygien — initiala kundmodeller/CSV innehåller bara
      servermasker; reveal är tenantverifierad, driftfönstergatad, PII-fritt
      auditerad, fail-closed och auto-maskeras vid serverägd expiry (2026-07-18).
- [x] Etapp 2d Bekräftelse-svep — paus och domänborttagning kräver två steg,
      auto-avväpnas och behåller korrekt fokus/pending-beteende (2026-07-18).
- [x] Etapp 2e Statistik-paritet — delade Stat/EmptyState, aktiv personal och
      tenant-scopad exakt `no_show`; count-fel degraderas inte till falska nollor
      (2026-07-18).
- [x] Etapp 2f Kundkortets master–detalj — beständig kundlista, URL-neutral
      route-group, bevarade flikar/modulgates och race-säker tvåstegsradering;
      oberoende review utan kvarvarande P0–P2 (2026-07-18).
- [x] Etapp 2g Mobilparitet för superadmin — fyra plattformsflikar, scope-gatad
      Ny kund-FAB, komplett Mer-ark, separat mobil aktiv-route, bottenark och
      320 px-overflowhärdning; Fable/Codex-review utan P0–P2 och full test/build
      grön (2026-07-18; autentiserad prod-rök efter deploy).
- [x] Etapp 3 IA-svängen — tenant-master/detalj är kanonisk på `/kunder`,
      tvärtenant slutkundsinsyn på `/slutkunder`, alla href/revalidate/nav/E2E-kontrakt
      är flyttade och kund-adminens `/admin/kunder` är orörd. Gamla
      `/salonger/:path*` får host-scopead 308 i prod och preview; den gamla exakta
      `/kunder`-betydelsen kan inte redirectas eftersom URL:en nu är den nya kanoniska
      kundytan. Fable-review utan P0–P2; oberoende Codex-reviewns preview-fynd är
      åtgärdat och regressionstestat (2026-07-18).
- [ ] Etapp 4 Partner-rollen (4a–4d — direkt efter 1–3)
