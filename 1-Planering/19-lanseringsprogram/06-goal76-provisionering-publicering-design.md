# Goal 76 — design: provisionera, kontrollera, publicera

## Problem

`createTenant` skapar först en säker `provisioning`-rad men byter därefter alltid
till `active`, även när ägare, tjänst, personal, tjänstekoppling, arbetstid eller
bekräftade öppettider saknas. Samtidigt byggs publika länkar både som
`<slug>.corevo.se` och `<slug>.boka.corevo.se`.

Det ger två falska gröna signaler: **aktiv** kan betyda obokningsbar och
**publik adress** kan peka på fel domänkontrakt.

## Vald lösning

Behåll det befintliga skapandeflödet men flytta publicering till en separat
databasägd övergång:

```text
createTenant
  -> tenants.status = provisioning
  -> konfigurera befintliga adminytor
  -> tenant_launch_readiness(tenant_id)
  -> publish_tenant(tenant_id)
  -> tenants.status = active
```

### Databassanning

En privat readiness-funktion räknar saknade nycklar. En publik, scopead
read-funktion lämnar tillbaka:

- `ready`,
- `booking_required`,
- `canonical_host`,
- `missing`.

`publish_tenant` låser tenant-raden, kontrollerar samma privata funktion och gör
statusbytet i samma transaktion. En trigger använder samma kontroll för varje
annan övergång till `active`; appkod kan alltså inte gå runt grinden.

Funktionerna är `security definer`, har tom `search_path`, fullt kvalificerade
relationer och explicit `EXECUTE` endast för `authenticated` och
`service_role`. Åtkomst kräver `private.can_access_tenant()` eller service-role.

### Modulstyrning

Grundkraven gäller alla tenants. Bokningskraven läggs bara till när
`tenant_modules` har `module_key='booking' AND state='live'`. Det gör modellen
generell för framtida rena butik-, offert- eller innehållstenants.

### Kanonisk host

`tenantStorefrontUrl` och `tenantStorefrontHost` är enda builder för standardhost:

```text
<slug>.boka.corevo.se
```

Verifierad `tenant_domains`-host får fortsatt prioritet. Backoffice kan använda
en separat lokal URL till `http://localhost:<port>/?tenant=<slug>` utan att ändra
vilken host som visas som kanonisk.

Wildcard-routen är redan committad och POS-isolerad. Nya tenants ska därför inte
göra ett eget Cloudflare-attach. Befintliga root-hostar behandlas bara som
legacyalias och får inte skapas automatiskt.

### Admin

`provisioning` visas som **Under konfiguration**. Kundkortets översikt visar en
kort readiness-lista med exakt saknade punkter och en **Publicera kund**-knapp.
Knappen är spärrad tills DB-sanningen är grön. Befintlig paus/återaktivera-väg
använder samma DB-grind när den sätter `active`.

Onboardingens resultatsida säger att kunden är skapad och ska konfigureras; den
påstår inte att sidan är live.

## Avgränsning

- Ingen automatisk demotion av befintliga aktiva tenants.
- Ingen ny ägar-/personal-/tjänsteeditor; befintliga kundkortsytor återanvänds.
- Ingen produktionsdeploy, DNS-mutation eller Cloudflare-mutation.
- Ingen full release-E2E; det hör till senare releasegoal.
- Ingen ombyggnad av bokningsmotorn; första bokningen är bara lokal acceptans.

## Felbeteende

- Saknad readiness ger en stabil domänfelsignal och lämnar status oförändrad.
- Okänd/otillåten tenant ger samma generiska appfel och ingen informationsläcka.
- Upprepad publicering av redan aktiv tenant returnerar samma aktiva status utan
  ny transition.
- Readiness-läsfel visas som fel; UI får aldrig anta grönt.
