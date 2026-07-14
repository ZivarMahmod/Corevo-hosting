# Granskning — Claude ⇄ Codex: kundportal, PWA & kommunikation

**Datum:** 2026-07-14
**Vad detta är:** Claudes granskning av Codex två dokument (`00-DESIGN` + `IMPLEMENTATIONSPLAN`) mot sitt eget `goal-68`. Båda spåren fick samma ursprungsprompt. Mål: bekräfta att vi bygger samma sak — och lösa var vi skiljer oss innan kod skrivs.

---

## Kortversion

Vi är **på samma spår**. Codex två dokument är starka, grundade mot verklig kod och exekveringsklara. På **tre punkter var Codex vassare** än mitt goal-68-utkast — jag ger honom rätt på alla tre. Det finns **två saker du (Zivar) behöver låsa** innan host-steget. Inget blockerar att bygget startar (F1/U0 = analys).

---

## Där vi är överens (samma spår, redan grundat)

Båda landade oberoende på detsamma — stark signal att grundningen är rätt:

- **"business" = befintliga `tenants`.** Ingen ny businesses-tabell. `tenant_id` är isoleringsnyckeln.
- **Företagsspecifik kundpost = befintliga `customers`** (utökas additivt, ingen parallell tabell).
- **Återanvänd dagens `/konto`** (`app/(kund)/konto/*`) — bygg inte en portal från noll.
- **Återanvänd befintlig signerad länk** (`lib/booking/cancel-token.ts`) — hårdna scope/livslängd/revoke.
- **Återanvänd e-post-lagret** (`lib/notifications/*`, mallar, cron-påminnelser, tenant-branding).
- **PWA:n återanvänder admin/personal-mönstret** — ingen andra PWA, ingen kodfork per tenant.
- **SMS byggs som interface + avstängd mock nu**, riktig leverantör sist.
- **`customer_multi_business_hub` byggs i datalagret men är av** — ingen väljare, ingen katalog.
- **Bokningen commitas före kommunikation**; kommunikationsfel rullar aldrig tillbaka en bokning.
- **Ingen automatisk merge vid tvetydighet** (delad familjemejl/telefon) — separata rader behålls.
- **RLS + explicita grants + negativa tenant-tester** på varje ny tabell; ingen authz från `user_metadata`.

## Där Codex var vassare — jag ger honom rätt

1. **`customer_accounts` behövs INTE i våg 1.**
   Mitt goal-68 sa "bygg en ny global kontonivå". Codex visar att det är överbyggt: `customers.auth_user_id` är redan unik per `(tenant_id, auth_user_id)` — alltså kan **samma auth-användare redan ha kundrelationer hos flera tenants**. En central portal läser bara `customers where auth_user_id = auth.uid()` över tenants. En egen `customer_accounts`-tabell tillför inget förrän vi behöver global verifiering/enhetshantering som inte hänger på en kundrad. **Codex rätt — skjut upp tabellen.**

2. **Host: `minbooking.corevo.se` är PERSONALENS yta, inte kundportalen.**
   Ursprungsprompten (från en GPT-diskussion) påstod `minbokning = slutkundens konto`. Codex läste plattformskanon och korrigerade: `minbooking` är personalytan. Kundportalen ska ligga på en **ny host** (`CUSTOMER_PORTAL_HOST`, t.ex. `mina.corevo.se`/`konto.corevo.se`). Mitt goal-68 tog prompten rakt av. **Codex rätt — och detta är ett beslut du behöver bekräfta (nedan).**

3. **Asynkron leverans = Postgres-outbox, inte köinfrastruktur ännu.**
   Codex föreslår en transaktionell outbox i bokningens egen transaktionsgräns, dränerad av den **befintliga cron-routen** med lease/lock + retry + dead-letter — och flyttar till Cloudflare Queues först när volym motiverar det. Mitt goal-68 sa bara "köer och retries". Codex är leanare och ger atomisk bokning→event gratis. **Codex rätt.**

## Där goal-68 tillför — behåll som addendum

Mitt dokument är inte en konkurrerande plan; dess värde är grundnings-kontrollen:

- **Explicit namn-mappnings-tabell** (business→`tenants`, business_customers→`customers`, business_branding→`tenant_settings.branding`, feature flags→`modules`/`tenant_modules`, lojalitet→`loyalty_ledger`). Gör "återanvänd, bygg inte parallellt" omöjlig att missa.
- **Skarpa nulägeslås** som Codex-planen håller lösare: nästa migrationsnummer **≥ 0065** (`0064` är skriven men **EJ applicerad** — idempotens-fixen väntar ditt ok), DB-projekt **`clylvowtowbtotrahuad`** (aldrig `ygieacwrpevytghdxecd`), all bokning via `create_public_booking` med **EXCLUDE-constraint** som auktoritativt krockskydd, **deploy-frysen**.
- **Kund-matchningens exakta mekanik**: `public.customer_contact_hash` (tenant-saltad) + `merged_into`-tombstone + append-only-vakten på `loyalty_ledger` (från goal-41). Codex säger "konservativ matchning"; addendumet säger *hur*.

## Att LÅSA — en sanning, annars driftar bygget

Där dokumenten säger olika ska EN vinna. Rekommendation:

- **Flaggnamn → använd Codex set:** `customer_central_portal_enabled`, `customer_pwa_enabled`, `customer_web_push_enabled`, `customer_multi_business_hub`, `communication_ledger_enabled`, `communication_cost_dashboard_enabled`, `sms_enabled`. Släng goal-68:s alternativa namn.
- **Attempt-statusar → använd Codex fulla kedja:** `created → scheduled → queued → processing → provider_accepted → succeeded|failed|expired|cancelled`, med `clicked` som separat observerad interaktion.
- **Flagg-mekanismen → inventeras i F1/U0:** Codex U1 säger bara "där feature flags idag läses". goal-68 gissar `modules`/`tenant_modules`. Skriv ut den faktiska platsen i U0-beviset så ingen bygger ett andra flaggsystem.

## Zivar beslutar ◆ (blockerar inte start; lås före U7/host-aktivering)

1. **Kundportalens host/subdomän.** Codex rek: nytt namn (`mina.corevo.se` eller `konto.corevo.se`), **inte** `minbooking`. Vilket namn vill du ha? (Tills du väljer används platshållaren `CUSTOMER_PORTAL_HOST` — bygget stannar inte.)
2. **SMS-leverantör/ekonomi** — redan parkerat till U13/sista goal. Ingen åtgärd nu; nämns så det inte tappas.

## Rekommenderad väg framåt

- **Kanon-spec = Codex `00-DESIGN`. Kanon-plan = Codex `IMPLEMENTATIONSPLAN` (U0–U13).**
- **goal-68 = grundnings-addendum** (name-mapping + nulägeslås), inte en parallell plan. Jag kan slimma den till exakt den rollen om du vill.
- **Exekvera via Codex 6-goal-split**, en goal i taget, verifiera efter varje (goal-brief-loopen). Splitten är exakt den jag föreslog dig — vi tänkte lika.
- **Loopen halvvägs:** jag har granskat Codex. Nästa varv: låt Codex granska `goal-68` + denna fil, sen är "en runda var" klar som du sa.

---

## Versionshistorik

| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-07-14 | Första granskning. Claude läste Codex `00-DESIGN` + `IMPLEMENTATIONSPLAN`, stämde av mot goal-68, konsoliderade tre punkter till Codex fördel, två lås-punkter och två Zivar-beslut. |
