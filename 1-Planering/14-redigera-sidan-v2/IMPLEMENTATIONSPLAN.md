# Implementationsplan — Redigera sidan v2

## Kanon och avgränsning

Kanon är hela `03-redigera-sidan-v2`-paketet. Nuvarande `SidaStudio`, dess fält och storefrontens
live-tabeller återanvänds. Arbetet får inte införa en separat kundeditor eller branschfork.

## Ordning

### R01 — Lås acceptanskontraktet (RED)

- Skapa Playwright-spec och `probe.mjs` i paketets acceptansmapp under `5-Kod/e2e/acceptans/`.
- Lås direkt entry, stabila `data-accept`-hooks, geometri, tokens, manifestflikar, realtime-preview,
  `Visa var`, smutsig lämna-vakt, mobil pane-toggle och riktiga utkast/publiceringar.
- Separera readonly-kontroller från muterande stagingtest. Ingen dold produktionsmutation.
- Kör kontraktet mot nuläget och dokumentera förväntade FAIL innan produktionskod ändras.

### R02 — Ett revisionslager

- Lägg en migration efter 0079: `site_revisions` med snapshot, status, lock-version och metadata.
- Högst ett utkast per tenant; publicerade revisioner är historik.
- RLS och grants för tenantägare/plattformsadmin; ingen anon-åtkomst.
- Publicerings-RPC låser revisionen och skriver endast site-ägda fält atomiskt till `tenants`,
  `tenant_settings` och primär `locations`-adress. Personal/tjänster förblir hämtad data.
- Kasta utkast raderar bara utkastet. Återställning klonar en publicerad revision till nytt utkast.

### R03 — Serverkontrakt och snapshot

- Definiera ett typat `SiteSnapshot` som täcker alla befintliga editorfält.
- Läs publicerad snapshot och lägg beständigt utkast ovanpå i kund- och plattformsloadern.
- Server actions: spara utkast, kasta, publicera, lista historik och återställ.
- Återanvänd befintlig parsning/validering; editorflödet får inte anropa live-actions före publicering.
- Invalidera storefrontcache först efter lyckad publicering.

### R04 — En kontrollerad editor

- Koppla alla befintliga barnkort till samma editor-state utan att ta bort fält.
- Varje fält, toggle och bildval uppdaterar preview direkt.
- Spara hela snapshoten med optimistic locking. Visad status speglar verklig state.
- Implementera persisted draft-banner, discard/continue, versioner och återställ publicerad version.
- Implementera `beforeunload` och intern nav-vakt med designens tre val.

### R05 — Exakt design och manifest

- `/admin/sida` monterar redigeraren direkt; legacy-rutten `/admin/sida/redigera` redirectar dit.
- Behåll delad topnav, ta bort extra `PageHead`, och gör editorn full-bleed under topnav.
- En toolbar; 470 px panel; kant-till-kant-preview; desktop/mobil-enhetsval.
- Mobil admin visar Panel/Förhandsvisning och fast Publicera med minst 44 px träffyta.
- Använd exakta färger, typsnitt, radier och avstånd från kanon.
- Flikar/sektioner hämtas från aktivt Kalla/Snitt-manifest. Ingen template-picker eller teknisk malltext.
- Färgfält använder endast kurerade swatches.
- Team-, tjänste-, betygs-, blogg- och butikskort visar data och länkar till ägande yta; de skriver inte.

### R06 — Verifiera och leverera

- Unit- och DB-kontraktstest för tenantgräns, locking, draft, publish, discard och restore.
- Readonly acceptans på desktop och mobil; muterande flöde endast lokal disposable/staging med cleanup.
- `probe.mjs` rapporterar `PASS|FAIL`, räknar fel och returnerar exit 1 vid FAIL.
- Kör typecheck, full unit suite och build med dev-servern stoppad.
- Oberoende verifierare granskar diff, säkerhet och paketets hela kravlista.
- Deploy via repoets godkända releaseflöde och gör readonly prod-smoke.
- Flytta goal och designpaket till `klart` först efter allt ovan är grönt.

## Ponytail-beslut

En tabell och ett snapshotkontrakt räcker. Ingen shadow-tabell per live-tabell, ingen localStorage som
sanning och ingen sekventiell låtsaspublicering via de gamla live-actionsen.
Publicerade bildobjekt behålls så att historik kan återställas; referensmedveten media-GC är separat.
