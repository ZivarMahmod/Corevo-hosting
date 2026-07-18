# goal-72 — Sessionsplan (implementationssessioner S1–S6)

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

## S6 — IA-svängen: Salonger→Kunder (etapp 3, SIST)

**Mål**: `/salonger`→`/kunder` (tenants = kunder), `/kunder`→`/slutkunder`,
`/salonger/ny`→`/kunder/ny`. Inga döda länkar.

1. **Ordningen är ALLT** (krock): först `app/(platform)/kunder` → `app/(platform)/slutkunder`
   + redirect `/kunder`→`/slutkunder` — SEDAN `app/(platform)/salonger` →
   `app/(platform)/kunder` + redirect `/salonger/:path*`→`/kunder/:path*`.
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

## S7 — Partner-rollen (etapp 4, skiss — designas när S1–S6 landat)

**Mål**: ny roll som ger en partner Zivars superadmin fast isolerad till sina
kunder. Samma yta — ett scoping-lager, ingen ombyggnad (S1–S6 bygger redan
"servern bestämmer listan").

1. Migration: partner-tabell + `tenants.partner_id` + RLS-scoping av alla
   platform-läsare; Zivar = partner noll (ser allt).
2. Behörighetsgrind: `requirePlatformAdmin` får partner-scope; varje RPC/action
   i `lib/platform/actions/*` filtrerar på scopet (server, aldrig UI).
3. Partnervy för Zivar: lista partners, deras aktiva kunder (licensunderlag
   ~50 kr/mån × aktiv kund), deras SMS-kostnader (outbox-aggregatet per partner).
4. Per-partner SMS-leverantör (46elks = default; partnerns lokala = konfig).

◆ ÖPPNA FRÅGOR till Zivar när S7 startar: exakta behörighetsskillnader
partner vs Zivar (hans ord: "lite mindre behörigheter kanske eller något vi
diskuterar det sen"); "aktiv kund"-definitionen för licensen; hur partnern
onboardas (inbjudan?).

## Körordning + beroendekarta

```
Codex migrationslandning ──▶ S1 (1a+1b)
                              │
S2 (2a+2b) ── oberoende ──────┤ kan köras NÄR SOM HELST
S3 (2c+2d+2e) ── oberoende ───┤
S4 (2f master–detalj) ────────┤
S5 (2g mobil) ── efter S4 ────┤
                              ▼
S6 (IA-svängen) ── SIST, efter att S1–S5 landat
```

En session = en commit-serie + en v-tagg + prod-rök. Zivar granskar visuellt
efter varje session (mobilen i simulatorn för S5).
