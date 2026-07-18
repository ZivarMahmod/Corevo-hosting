# goal-72 — Sessionsplan (implementationssessioner S1–S7)

> Skriven 2026-07-18 efter fil:rad-inventering av båda världarna. Varje session
> = ett körbart pass: mål, exakta filer, steg, verifiering. Exekutorn ska aldrig
> behöva gissa. Ordning per Zivars beslut 1→2→3, MEN S2–S5 är oberoende av
> Codex-migrationerna — drar hans pass ut startar vi där i stället för S1.
>
> Stående regler (gäller varje session): inga hårdkodade branschord; delade
> komponenter ändras bakåtkompatibelt; nya delade mönster → `components/portal/ui/`;
> servergrindar är sanningen (UI-lås = kosmetik); `pnpm test` + typecheck grönt
> före commit; commit → push → v-tagg → prod-rök. I delad arbetsyta: läs VARJE
> hunk före commit (se minnet parallell-session-kontaminering).

## Återanvändningskartan (spanarnas fynd — bygg ALDRIG om dessa)

| Mönster | Var | Nyckelfakta |
|---|---|---|
| SettingsWorkspace | `components/admin/SettingsWorkspace.tsx:11` | `{ categories, currentCategory, children }` — datadriven, INTE admin-låst |
| Kategorikartan | `lib/admin/settings-map.ts:55` | `SettingsCategory` m. id/group/href/label/hint/icon/keywords + `warning?` |
| PiiReveal + mask | `components/portal/ui/PiiReveal.tsx:36` | `{ phone, email, label?, note? }`; maskPhone/maskEmail exporterade |
| Tvåstegs-arm | `components/admin/CustomerDangerZone.tsx:20` | ad hoc `useState(armed)` → knappgrupp; INGEN generisk komponent (behåll ad hoc) |
| Stat/Sparkline/EmptyState | `components/portal/ui/{Stat,Sparkline,EmptyState}.tsx` | drop-in |
| Master–detalj | `app/(admin)/admin/kunder/layout.tsx:24` + `components/admin/KunderBoard.tsx` + `kunder-v2.module.css:6` | layout hämtar listan EN gång; `.board { grid-template-columns: 400px 1fr }`; `[id]` = children i panen |
| Genvägsraden | `components/portal/Topnav.tsx:46` (typ) + `PortalShell.tsx:290` (seam) | platform får `undefined` idag — byt till egen lista |
| Låsta navposter | `Topnav.tsx:43,298` + `admin-navigation.ts:44` | `TopnavArea.locked` — samma kontrakt för platform |
| Mobilnav-kontraktet | `Topnav.tsx:52` + `PortalShell.tsx:273` + `admin-navigation.ts:102` | `{ tabs, more, action }`; `adminMobileNavigation(areas)` = förlagan |

## S1 — Kommunikationscenter + Drift-hälsa (etapp 1a+1b)

⛔ **Blockerad tills**: Codex-kroppen committad + migrationer 0092–0105 applicerade
+ min `0106_platform_insyn_rpcs.sql` applicerad (RPC:erna `platform_outbox_summary()`
+ `platform_cron_health()`, båda SECURITY DEFINER med `private.is_platform_admin()`-grind).

**Mål**: outbox/utskick + cron-hälsa synligt i frontend — slippa SQL.

1. **Utskick** — NY route `app/(platform)/utskick/page.tsx` (nav-post i Insyn-gruppen,
   `PortalShell` areas-listan): per-tenant-tabell ur `platform_outbox_summary()`
   (sent/failed/skipped 30d, SMS-kostnad öre→kr, prefs-/push-adoption). Stat-rad
   överst (totaler). EmptyState när outboxen är tom. INGEN ny tabellkomponent —
   samma tabellmarkup som `KunderView`.
2. **Drift-hälsa** — BEFINTLIG sida `app/(platform)/drift-och-logg/page.tsx` får
   hälsosektion överst (ponytail: ingen ny route): pg_cron-jobbens senaste körning
   ur `platform_cron_health()` — jobbnamn, schema, status, starttid. Status som
   `Badge` (`portal/ui`) tone success/danger — INGEN ny HealthPill-komponent
   (finns ingen idag; Badge räcker).
3. Server-side: anrop via befintlig platform-supabase-klient; `requirePlatformAdmin`-
   gaten som övriga platform-sidor.

**Verifiering**: RPC-svar mot demo-tenantens outbox-rader (0091-seedad);
failed-rad renderas röd; sidan 200 utan platform-roll → redirect (grinden).
**Risk**: RPC-kolumnnamn ändras om Codex 0092–0105 rör outbox-schemat →
kör `select * from platform_outbox_summary() limit 1` FÖRE bygget.

## S2 — Inställnings-workspace + genvägsrad (etapp 2a+2b)

**Mål**: platform-inställningarna = samma workspace-känsla som kund-adminen;
genvägsraden i platform-toppbannern.

1. **NY `lib/platform/settings-map.ts`**: `platformSettingsCategories()` — samma
   `SettingsCategory`-typ. Kategorier (BARA de med innehåll — flaggor/juridik-defaults
   YAGNI tills innehåll finns): `varumarke` (PlatformBrandingForm, finns),
   `fakturering` (billingUnderlag, läs), `sakerhet` (lösenord/session-info + länk
   personal-plattform).
2. **Bygg om `app/(platform)/installningar/page.tsx`** → `SettingsWorkspace`
   med kategorirutter `installningar/[kategori]` (mönstret från admin:
   en page.tsx per kategori, workspace-wrappern runt).
3. **Genvägsraden**: `PortalShell.tsx:290` — ersätt `isPlatform ? undefined` med
   4 platform-genvägar: Ny kund (`/salonger/ny`, icon plus), Slutkunder (`/kunder`),
   Loggar (`/drift-och-logg`), Fakturering (`/fakturering`). Ikoner ur befintliga
   `IconName` (css.gg-språket i `Icon.tsx`).
4. **Låsta navposter för platform**: HOPPA ÖVER (alla platform-användare är
   plattformsadmin idag — ingen nivåskillnad att låsa på; flagga återbesök när
   plattformsroller differentieras i `/roller`).

**Verifiering**: alla gamla inställningsvärden nås via nya kategorier (inget
innehåll tappat); genvägarna klickbara på desktop; kund-adminens genvägsrad
OFÖRÄNDRAD (delad Topnav — kontraktstest `admin-topbanner` grönt).

## S3 — PII-hygien + tvåstegs-arm + statistik-paritet (etapp 2c+2d+2e)

**Mål**: Insyn slutar visa rå PII; farliga platform-mutationer kräver arm-steg;
kundkortets Översikt får ärliga siffror.

1. **2c PiiReveal**: `components/platform/kunder/KunderView.tsx:241` — e-post
   rå idag → `maskEmail` + `PiiReveal`-avslöjning (samma som kund-adminens
   CustomerContactCard). Samma svep i kundkortets Kunder-flik (innehållet i
   `salonger/[id]/page.tsx` Kunder-noden) om kontaktfält visas rått där.
2. **2d arm-mönstret** (ad hoc `useState(armed)`, kopiera CustomerDangerZone-formen)
   på de DESTRUKTIVA/utåtriktade: `setTenantStatus` (paus — `status.ts`),
   `removeCustomDomain` (`domains.ts`). `savePlatformBranding` HOPPAS ÖVER
   (reversibel, inte destruktiv — arm vore friktion utan skydd).
3. **2e statistik**: kundkortets Översikt-nod (i `salonger/[id]/page.tsx`) får
   `Stat`-rad (bokningar, genomförda, no_show, personal) + `EmptyState` där
   data saknas — samma komponenter som `admin/statistik`. no_show =
   förstklassig status (finns i DB sedan goal-67).

**Verifiering**: Insyn-tabellen visar maskerad e-post, avslöjning loggas som i
kund-adminen; paus-knappen kräver två klick; Översikt-flikens siffror matchar
`admin/statistik` för demo-tenanten.

## S4 — Kundkortet → master–detalj (etapp 2f, Zivars beslut)

**Mål**: `/salonger` = listan (master) som aldrig byts om; `/salonger/[id]` =
detaljpanen. ALLT flikinnehåll bevaras (SPEC: innehållet heligt, skalet får bytas).

1. **NY `app/(platform)/salonger/layout.tsx`**: hämtar tenant-listan EN gång
   (dagens `salonger/page.tsx`-data), renderar ny `SalongerBoard` + `{children}`
   — exakt kunder-v2-skelettet (`layout.tsx:24`-mönstret).
2. **NY `components/platform/SalongerBoard.tsx`** + `salonger-v2.module.css`:
   kopiera `.board`/`.list`/`.pane`-skelettet ur `kunder-v2.module.css` (400px|1fr).
   Listraderna = dagens kortfält (namn, slug, ägare, status-badge, senast) —
   `SalongerClient`s kort|lista-ViewSwitcher ersätts av listan i mastern.
3. **`salonger/page.tsx`** (index utan vald kund) → tomläge i panen
   ("Välj en kund") — kunder-v2-mönstret.
4. **`salonger/[id]/page.tsx`** (954 rader): INNEHÅLLET RÖRS INTE — sidan
   renderas som pane-children; `TenantDetailTabs` (14 flikar) lever kvar inuti
   panen. Bara yttre wrappern/rubriknivån justeras till `.paneInner`.
5. **`salonger/ny`**: renderas också i panen (layouts children) — acceptera;
   mastern synlig bredvid skapandeflödet (samma som kunder v2 hanterar detaljen).

**Verifiering**: alla 14 flikar fungerar identiskt (klicka igenom mot demo +
freshcut); listan scrollar inte om vid kortbyte; `/salonger/ny` skapar kund;
inga regressioner i modul-flikarna (delade komponenter med kund-adminen).
**Risk**: störst ombyggnad — egen commit + egen v-tagg, rollback = revert.

## S5 — Superadmin-mobilen (etapp 2g)

**Mål**: platform-portalen får kund-adminens mobilnivå — bottenflikar, FAB, Mer-ark.

1. **NY `platformMobileNavigation()`** (i platform-navigationens fil, spegla
   `admin-navigation.ts:102`): tabs = Översikt, Kunder(salonger), Insyn, Drift;
   FAB-action = Ny kund (`/salonger/ny`); resten → Mer-arket.
2. **`PortalShell.tsx:273`**: `isPlatform ? undefined` → `platformMobileNavigation(...)`.
3. **Mobil-CSS-svep** över platform-sidorna: `Topnav.module.css`-kontraktet
   (safe-area, z-25, FAB 46px) är delat och GÄLLER redan — passet är att
   verifiera att platform-sidornas egna gridar (SalongerBoard! 400px|1fr) viker
   till en kolumn under 767px + att master–detalj blir list→detalj-navigering
   på mobil (kunder-v2:s @media-block som förlaga).

**Verifiering**: kontraktstesterna `admin-mobile` + `calendar-mobile-v2` GRÖNA
(kund-adminen oförändrad); iPhone-simulator: bottenflikar på alla platform-ytor,
kundkortet nåbart, ingen vågrät scroll. Körs EFTER S4 (mobilviket byggs mot
den nya master–detaljen, inte dagens grid).

**Status 2026-07-18**: lokalt klar. Fyra serverlistederiverade flikar + FAB +
fullständigt Mer-ark är inkopplade; mobilens aktiva route är separerad från
desktop-IA:n. Drawers är bottenark och de verifierade 320 px-overflowpunkterna i
kundkort, onboarding, drift, integrationer, branscher och domänrader är härdade.
Fable 5 + oberoende Codex-review: inga kvarvarande P0–P2. `pnpm test` 243/2 013,
typecheck och produktionsbuild gröna; autentiserad enhets-/prod-rök körs efter deploy
(den lokala browsern saknade en inloggad superadminsession).

## S6 — IA-svängen: Salonger→Kunder (etapp 3, SIST)

**Mål**: `/salonger`→`/kunder` (tenants = kunder), `/kunder`→`/slutkunder`,
`/salonger/ny`→`/kunder/ny`. Inga döda länkar.

1. **Ordningen är ALLT** (krock): först `app/(platform)/kunder` → `app/(platform)/slutkunder`,
   SEDAN `app/(platform)/salonger` → `app/(platform)/kunder` + redirect
   `/salonger/:path*`→`/kunder/:path*`. Den planerade beständiga redirecten
   `/kunder`→`/slutkunder` kan inte finnas i slutläget: den skulle kapa den nya
   kanoniska tenant-rutten på samma URL. Kollisionen är låst med negativt kontraktstest.
   Redirects permanenta i `next.config` (host-scopade till platform-dörren om
   config-nivån kräver — verifiera mot middlewarens host-split först).
2. **Intern href-svep**: grep `'/salonger` + `'/kunder` över `app/(platform)` +
   `components/platform` + navigationsfilerna + ⌘K-paletten — byt alla.
3. **Nav-etiketter + terminologi**: "Salonger" → "Kunder" i areas-listan;
   Insyn-gruppens etikett "Slutkunder". Branschvakten: inga nya salongord.
4. **S1-vyn** (`/utskick`) + S2-kartan + S4-filerna byggdes mot gamla paths —
   svepet tar dem samtidigt (därför SIST).

**Verifiering**: gamla bokmärken följer redirect (curl -I 308); alla navlänkar
200; render-probe på nya rutterna; kund-adminens `/admin/kunder` ORÖRD
(annan dörr — bara platform-routes byter).

**Status 2026-07-18**: lokalt klar. `/kunder` äger tenant-master/detalj/ny,
`/slutkunder` äger slutkundsinsyn och `/salonger/:path*` får permanent host-scopead
308 i prod samt preview-motsvarighet med bevarad query. Alla interna hrefs,
cacheinvalidations, nav-/palettposter och berörda E2E-rutter är flyttade;
`/admin/kunder` är kontraktslåst orörd. Full Vitest före sista preview-fixen:
245 filer/2 026 tester gröna; fixens 38 riktade tester och typecheck gröna.
Fable: inga P0–P2. Codex-reviewns enda P2 (preview-legacy-404) är åtgärdad.

## S7 — Partner-rollen (etapp 4 — komplett och live)

**Mål**: ny roll som ger en partner Zivars superadmin fast isolerad till sina
kunder. Samma yta — ett scoping-lager, ingen ombyggnad (S1–S6 byggde redan
"servern bestämmer listan").

1. Migration 0114–0117: partner/member-modell, `tenants.partner_id`, append-only
   pris-/tenantledger, öppen licensmånad, fryst SMS-kostnadsägare, partner-RLS och
   service-role-grants. Zivar/root = exakt global `super_admin` nivå 8; partner =
   exakt aktiv `partner_admin` nivå 7 + aktiv DB-medlemskapspartner.
2. Behörighet: partner kan arbeta med översikt, kunder/onboarding/detalj,
   slutkunder, personal, utskick, scoped drift och fakturering för sina tenants.
   `/partners` och globala branscher/integrationer/domäner/roller/inställningar
   är root-only i både navigation och servergrind/RLS.
3. Onboarding: root skapar partnern och mejlar exakt en ägarinbjudan. Partnern
   kan inte skapa sin organisation, bjuda fler partnermedlemmar eller ändra sitt
   licenspris. Tvetydiga Auth-fel reconcileras innan kompensation.
4. Licens: root väljer valfri icke-negativ summa per partner (50,00 är bara
   formulärförslag). Aktiv någon gång i partnerns lokala månad ger hel månad;
   paus/avkoppling tar inte bort historiken; aktiv A→B-flytt ger hel månad hos
   båda. Pris-/kundändringar räknar om öppen månad, stängda månader är
   DB-immutabla.
5. SMS: root kan konfigurera valfri partner, partner bara sig själv. Corevos
   standard-46elks eller partnerägd 46elks stöds; hemligheter ligger i Vault,
   kostnadsägare/valuta fryses per outboxrad. `SMS_DELIVERY_MODE=off` är fortsatt
   fysisk grind — inget dry-run/live-anrop ingick.

**Status 2026-07-18**: live från `main` SHA `88d59b5`, migration 0117 och
Worker-version `5613f4bb-a4ed-4665-bb6a-b5175ce7cae3`. Deploy-run
`29662607124`, release proof, 7 domäner, login och oautentiserade host-/route-
redirects är gröna. Zivars autentiserade root-/partneracceptans återstår.

## Körordning + beroendekarta

```
Codex migrationslandning ──▶ S1 (1a+1b)
                              │
S2 (2a+2b) ── oberoende ──────┤ kan köras NÄR SOM HELST
S3 (2c+2d+2e) ── oberoende ───┤
S4 (2f master–detalj) ────────┤
S5 (2g mobil) ── efter S4 ────┤
                              ▼
S6 (IA-svängen) ── SIST, efter att S1–S5 landat ──▶ S7 partnerrollen
```

En session = en commit-serie + en v-tagg + prod-rök. Zivar granskar visuellt
efter varje session (mobilen i simulatorn för S5).
