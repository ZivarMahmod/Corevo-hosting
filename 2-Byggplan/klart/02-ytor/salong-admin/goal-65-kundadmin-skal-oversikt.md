# Goal 65 — Kund-admin: superadmin-skalet + ny Översikt (L1)

**Plan:** `1-Planering/10-kundadmin-bokningsarbetsbord/IMPLEMENTATIONSPLAN.md` (L1, A-04 → A-11)
**Beslut:** `3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/codex/00-LAS-MIG-FORST.md` (låst 2026-07-14)
**Status:** pågående

## Målet i en mening

Kund-adminen byter det mörkgröna sidofältet mot superadminens ljusa toppnav — samma produktfamilj,
kundens egen roll och navigation — och får en Översikt som orienterar istället för att administrera.

## Facit (ingen mockup — koden är facit)

Zivar valde bort designpaketet för den här delen. Facit är därför **superadminens kod**:

- `components/portal/PlatformTopnav.tsx` + `PlatformTopnav.module.css` — skalets komposition
- `app/portal-global.css` — tokens (`--c-*`), typografi, radier, fokusring
- `components/portal/ui/` — CommandPalette, Icon, Toast, m.fl.

**Regeln som ersätter designtroheten:** varje färg, radie, avstånd och typsnittsvärde **lyfts ur dessa
filer**. Noll nya hex, noll nya px-skalor, noll nya komponentvarianter. Behövs något som saknas
(kalendergrid, drawer — kommer i goal 66) byggs det av befintliga tokens, aldrig av nya värden.

Superadminens utseende ska vara **oförändrat** efteråt. Regressionstest bevisar det.

## Scope

### A-04 — Generalisera toppnaven

`PlatformTopnav` är hårdkodad mot superadminens fem områden (`PLATFORM_AREAS`), sitt eget varumärke
("Corevo / Superadmin") och sin egen primärknapp ("Ny kund" → `/salonger/ny`).

Gör den rolldriven: områden, subnav, varumärkestext, primärhandling, extra topbar-slot (platsväljare)
och kontextlänk kommer in som props. Superadmin skickar exakt det den har idag → pixelidentiskt resultat.

- `components/portal/PlatformTopnav.tsx` → generaliseras (behåll filnamnet, byt inte ut CSS-modulen)
- `components/portal/platform-navigation.ts` → superadminens områden ligger kvar här, orörda

### A-05 — Kund-adminens navigation

Nytt: `components/portal/admin-navigation.ts` — samma form som `platform-navigation.ts`.

```text
Översikt · Kalender · Kunder · [aktiva moduler] · Redigera sidan · Inställningar
```

- **Översikt** `/admin`
- **Kalender** `/admin/bokningar` (blir arbetsbordet i goal 66 — routen behålls, innehållet byts)
- **Kunder** `/admin/kunder`
- **Moduler** — de aktiva modulposterna ur `nav-items.ts` (`module`-nyckel + `activeModuleKeys`).
  Gatingen finns redan och är rätt: **återanvänd den, bygg ingen ny.** Zivars beslut 2026-07-14:
  aktiva moduler blir egna toppnavposter (kund utan moduler ser exakt fem val).
- **Redigera sidan** `/admin/sida`
- **Inställningar** `/admin/installningar` med **subnav** = de nio kategorierna
  (`codex/00` §5). Subnav-mönstret finns redan i `PLATFORM_SUBNAV` — kopiera formen.
  Tjänster/Personal/Platser/Scheman flyttar **in i subnaven** (sidorna är samma kod, de byter bara plats
  i navet — ingen sida byggs om i den här goalen).

`nav-items.ts` förblir enda källan för modulnycklar och ⌘K-paletten. Ingen andra sanning.

### A-06 — Skalet byts i layouten

`PortalShell` (`components/portal/PortalShell.tsx`): admin-grenen slutar rendera `PortalSidebar` och
renderar toppnavskalet med adminens områden. Personal-portalen (`portal="personal"`) rör vi inte —
den behåller sidebaren.

Krav: alla befintliga adminsidor renderar utan att gå sönder. Ingen sida får ha två globala navsystem.

### A-07 — Topbar-innehåll (rollanpassat)

- Varumärke: **verksamhetens namn** + "via Corevo" — aldrig "Superadmin"
- ⌘K: `paletteFromNav('admin', activeModuleKeys)` — bara egen tenant, aldrig cross-tenant
- Platsväljare: `LocationSwitcher`, endast vid >1 aktiv plats (logiken finns i `PortalShell`, behåll den)
- Tema-switch, avatarmeny, "Öppna min sida ↗" (`tenantStorefrontUrl` — finns redan)
- Primärhandling: **"+ Ny bokning"** → öppnar kalendern i skapa-läge (fram till goal 66: länk till `/admin/bokningar`)

### A-08 — Rollgräns (säkerhet, inte stil)

- Kund-admin ser aldrig superadminfunktioner i nav eller ⌘K
- ⌘K träffar aldrig annan tenant (superadminens `listTenantNavOptions` får inte nå admin-grenen)
- `requirePortal('admin')` ligger kvar — skalet ändrar presentation, aldrig auktorisation

### A-09 — Ny Översikt

`app/(admin)/admin/page.tsx` ersätts. Innehåll (`codex/00` §2 + SPEC):

- Datum + verksamhetsnamn, primärknapp **"Öppna kalendern"**
- Dagens rad: bokningar idag (varav obekräftade) · nästa besök · beläggning
- Kommande idag — kompakt lista (~6 rader + "Visa alla i kalendern"), radklick → kalendern på den bokningen
- Kräver uppmärksamhet — obekräftade/ändrade, **en konkret åtgärdsknapp per rad**. Tomt läge = ärligt tomt
- Personal idag — namn + arbetstid + status
- Driftvarningar — **bara vid verkligt problem** (t.ex. "Publik bokning är pausad"). Ingen rad med döda system
- Publiceringsstatus för publika sidan → länk till Redigera sidan

**Får inte innehålla:** en andra kalender · inställningsfält · KPI:er för moduler kunden inte har ·
flera knappar som gör samma sak.

All data är **verklig** (befintliga DAL-läsningar). Inga mockade siffror.

### A-10 — Sidebaren bort ur adminvärlden

`PortalSidebar` finns kvar för `portal="personal"`. Test som bevisar att admin-routes inte renderar den.

### A-11 — Verifiering

- Regressionstest: superadminens skal oförändrat (snapshot/DOM-test på `(platform)`)
- Navtest: fem val utan moduler; modulpost dyker upp när modulen aktiveras; ingen post för inaktiv modul
- Rollgränstest (A-08)
- Tangentbord: hela navet + ⌘K + avatarmeny nåbara, synligt fokus
- 200 % zoom och mobil: aktuell yta alltid namngiven, primärhandling nåbar
- Zivars manuella testlista → `6-Testing/`

## Uttryckligen INTE i denna goal

- Kalenderarbetsbordet (goal 66 — `/admin/bokningar` behåller sitt nuvarande innehåll så länge)
- Omdesign av inställningssidorna (de flyttar bara i navet)
- Sajtbyggarens editor-UI
- SMS, TOTP, PWA

## Definition of done

1. Alla tester gröna, inklusive superadmin-regressionen.
2. Oberoende verifierare — byggaren rättar inte sin egen läxa.
3. Tillgänglighet: tangentbord, synligt fokus, 200 % zoom, status aldrig enbart via färg.
4. Tenant-/rollgräns testad.
5. Zivars manuella testlista avbockad.
6. Goal → `2-Byggplan/klart/02-ytor/`.
