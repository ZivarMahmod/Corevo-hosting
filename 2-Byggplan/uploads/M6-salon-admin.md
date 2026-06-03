# M6 — Salon Admin (målbild + gap)

**Datum:** 2026-06-02
**Status:** Spikad i planeringspass med Zivar.
**Ersätter:** den gamla `1-Planering/moduler/M6-salon-admin.md` (för-bygge-spec, "v1 vs v2"). Lägg detta dok i dess ställe.
**Läs först:** `HANDOFF.md` + `CLAUDE.md`. POS-guardrail på corevo.se gäller. `private.tenant_id()`, `staff`/`staff_id`, build-once-never-delete.

> **Röd tråd:** M6 är **datanavet** — äger tenant, tjänster, personal, schema, settings. Alla andra moduler läser härifrån. Mycket "live"-beteende (avbokning → tid tillbaka, auto-klar) *bor i M3* och *visas* i M6. M6-doket re-specar aldrig M3-logik — det refererar den.

---

## 0. Vad modulen ÄR

Salongsägarens kontrollcenter. Inte en plikt-yta — ett **kontrollverktyg** man *vill* vara i för att det är enkelt att filtrera, se vad som hänt och hur det gått. Den ska inte tvinga frisören till adminpyssel för att kunna fokusera på klippet. Allt ägaren gör här ska kunna göras **utan kod** och slå igenom mot storefront/bokning automatiskt.

---

## 1. Tabell-verklighet (stale-fix — gör tyst, ingen ny diskussion)

Gamla specen är fel på namn. Riktiga tabeller (från migrationerna):

| Gammal spec | Verkligt namn |
|---|---|
| `salons` | **`tenants`** |
| `salon_settings` | **`tenant_settings`** |
| `staff_schedules` | **`working_hours`** |
| `staff_time_off` | **`time_off`** |
| (saknades) | **`locations`** finns redan (byggt i G04) |
| `barber_id` | **`staff_id`** |

"Salong" = "tenant" genomgående. Multi-location-lagret finns i datamodellen redan; allokering byggs senare (se §8).

---

## 2. Ytor — byggt / stale / saknas

| Yta | ✅ Byggt | ⚠️ Stale/halvt | ❌ Saknas |
|---|---|---|---|
| **Dashboard** `/admin` | finns | tunn — bara enkla mått | rik vy (§3.8) + "se din sida"-länk |
| **Bokningar** `/admin/bokningar` | lista + statuskontroll | — | filter, tjänstedetalj, live-koppling-visning (§3.2) |
| **Tjänster** `/admin/tjanster` | CRUD | — | visa *vart på storefront* tjänsten hamnar (§3.3) |
| **Personal** `/admin/personal` | CRUD | tunn på info | mer frisör-info + spegla verklig dag (§3.4) |
| **Schema** `/admin/scheman` | finns | visar **fasta arbetstider**, ej bokbara tider | explicit-slot-modell (§5) |
| **Varumärke** `/admin/varumarke` | BrandingForm + R2-bilduppladdning | ingen live-preview, oklar undo | live-preview + undo + spara-utan-deploy (§3.6) |
| **Inställningar** `/admin/installningar` | SettingsForm | risk för "döda toggles" | varje toggle sann-kopplad (§3.7) |
| **Kunddatabas** | — | — | **hela ytan — ny** (§3.1 + §4) |

Komponenter som finns: `StaffManager`, `ServicesManager`, `SettingsForm`, `BrandingForm`, `StorefrontMediaForm`, `ScheduleManager`, `BookingStatusControl`, `StripeConnectCard`, `StaffPicker`.

---

## 3. Spikade beslut (M6)

### 3.1 Kunddatabas — JA, den byggs (inte "kanske")
Frisör + admin känner igen återkommande kund. Lojalitet (M4) byggs ovanpå. Det finns ingen snygg väg till "frisören känner igen dig år efter år" + lojalitet utan en stabil kundrad. Detaljmodell i **§4**.

### 3.2 Bokningar = kontroll-nav, inte plikt
- Filtrerbart, sökbart. Status syns: **gjord / avbokad / klar**. Tjänstedetalj + när bokningen gjordes.
- **Live-kopplat:** avbokning → status avbokad **och** tiden tillbaka till storefront/bokning (logiken bor i M3, visas här).
- Frisören tvingas **inte** spara dagens händelser eller ändra bokningar om de inte måste. Funktionen finns — men aldrig som tvång.
- **Auto-klar:** bokning markeras klar när tiden passerat *om* frisören inte själv gjort det — bokningen **försvinner inte**.
- ⚠️ **Aldrig falskt "klar + betald".** När betalning-vid-bokning är på får en sen kund / no-show inte auto-markeras klar+betald. Completion-regeln låses här, betalningsbeteendet bor i M8 (§8).

### 3.3 Tjänster → synlig storefront-koppling
När en tjänst läggs in/redigeras ska det synas *vart på hemsidan* den hamnar. UI-ändring i admin → storefront utan kod. (Koppling M6→M2.)

### 3.4 Personal — mer info + spegla verklig dag
Personal-ytan visar mer om frisören (roll, bio, specialiteter) **och** speglar deras *verkliga* dag (samma bokningar som i M5 personalportalen). Inte bara CRUD.

### 3.5 Schema — ägaren sätter, Zivar bootar
Ägaren äger schemat. Zivar sätter upp ett initialt åt dem (från deras nuvarande system) som de tweakar. **Lågt manuellt arbete** är ett krav. Modell i **§5**. (Löser M6↔M5-överlappet: ägaren är auktoritet, M5 speglar/visar.)

### 3.6 Varumärke — live-preview, spara-utan-deploy, undo
- **Live-förhandsvisning** på sidan som ändras när de ändrar/sparar.
- Byt **bild / färg / font / text utan ny deploy** — färg/font måste läsas som runtime `tenant_settings`, **inte** build-inlinat. (Bilder kör R2 redan.)
- **Bunden frihet:** de ska känna "jag fick en plattform, inte bara en hemsida" — men inte så mycket frihet att de förstör.
- Tydligt **vilken knapp ändrar vad** + **undo/tillbaka** på ändringar.
- Om full live-render inte går: en **preview-knapp** (som i Corevo-POS) som öppnar deras sida så de snabbt ser ändringen — inget annat brus.

### 3.7 Inställningar — inga döda toggles
Varje toggle är **sann**. Slår de på bokningsbekräftelse → funktionen funkar på riktigt. Vill de inte → ta bort den. En toggle som inte gör något får inte finnas.

### 3.8 Dashboard — kontrollcenter
Inte bara dagens bokningar. Visar:
- Kommande bokningar
- Tjänste-mix (vilka tjänster säljs)
- Dagens topptimmar (när flest kunder)
- Antal bokningar
- Nya lojalitetskunder
- **"Se din sida"-länk** till live-storefront

Drill-down finns, men tyngdpunkten hänger i Bokningar. **Ingen trafik-/klick-analytics i v1** (struket — det var en feltolkning; ersatt av "se din sida"-länk).

---

## 4. Kundmodell — identitet vs PII (ny, arkitektonisk)

Skilj **identitet** från **kontakt-PII**. Det är det som gör att frisören får en bra databas *och* kunden får skydd — för att de är olika lager, inte samma fält.

```
IDENTITET (bestående, intern)        KONTAKT-PII (minimerad, tidsbunden)
  • stabil kund-rad                     • telefon / mejl
  • frisör känner igen återkommande     • syns bara i drift-fönstret kring
  • lojalitet (M4) byggs HÄR              bokningen
  • visningsnamn kunden själv väljer    • maskas / gallras efter (GDPR-vägen
    (valt namn / initial)                 finns redan i M10-ops)
```

**Krav:**
- `customers`-tabell (eller motsv.) med stabil id. Inloggad kund → kopplad till auth-user. Gäst → stabil nyckel (t.ex. kontakt-hash) så återkommande gäst känns igen.
- Bokningar länkas till kund-id (idag ligger gästkontakt i `note` — den sömmen ska bort/ersättas).
- **PII-synlighet tidsbunden:** telefon/mejl visas för frisör/admin i operativt fönster kring bokningen, maskas/gallras därefter enligt GDPR-retention.
- **Kund styr visningsnamn:** kan visa valt namn / initial istället för fullt namn.
- Lojalitetsbandet bygger på identiteten, aldrig på exponerad PII.

> Detta korsar M4 (kundportal/lojalitet) och M10-ops (GDPR export/erase, redan byggt). M6 äger ägarens *vy* av kunddatabasen; identiteten delas.

---

## 5. Schema-modell (explicit slots)

Gamla schemat visar **fasta arbetstider** — fel modell.

**Rätt modell:**
- Frisören/ägaren definierar **explicita bokningsbara starttider** per dag — t.ex. 12:30, 13:05, 14:00 … **Ojämna intervaller tillåtna.** De väljer själva.
- **Service-längden styr passets längd**, inte ett fast raster.
- Tider kan auto-föreslås från service-längd men ska vara manuellt justerbara.
- **Baseline vid uppsättning:** spegla salongens nuvarande mönster (Zivar bootar upp från deras befintliga system, t.ex. wavy). Första kunden = referens, sen justeras per salong.
- Schemat ska **alltid hålla rätt tider uppe** med minimalt manuellt arbete.

> Detta matar M3 (slot-generering = working_hours/slots + service-längd − existerande bokningar). `working_hours` behöver stötta explicita slot-definitioner, inte bara öppen/stäng.

---

## 6. Röd tråd — kopplingar ut (ingen dubbel-spec)

| Koppling | Vad M6 gör | Var logiken bor |
|---|---|---|
| **M6 → M2** | tjänst läggs in → syns på storefront; varumärke-preview | M2 renderar |
| **M6 → M3** | schema/slots matar lediga tider; avbokning → tid tillbaka | M3 äger slot-logik |
| **M6 → M5** | ägaren sätter schema (auktoritet); personal-vy speglar verklig dag | M5 är frisörens egen vy |
| **M6 → M4** | kund-identitet + visningsnamn; lojalitet byggs på id | M4 äger portal/lojalitet |
| **M6 → M8** | completion-status; "ej falskt klar+betald" | M8 äger betalning |

---

## 7. Bygg-items (vad Code faktiskt gör i M6)

**Rör INTE** (byggt & live): grund-CRUD för personal/tjänster/settings, StripeConnectCard, R2-bilduppladdning. Frysta filer (`packages/db`, `packages/auth`, `middleware.ts`, `lib/tenant*.ts`, root-config) endast i solo-fas.

1. **Kunddatabas (ny):** `customers`-tabell + identitet/PII-split (§4) + ägarens kunddatabas-vy (återkommande, historik, antal besök). Migrera bort gäst-i-`note`-sömmen.
2. **Bokningar-nav:** lägg filter + sök + tjänstedetalj + "gjord/avbokad/klar"-status synlig; visa live-koppling (avbokning → tid tillbaka). Auto-klar-visning utan att bokning försvinner. Completion-gate mot betalning (princip; M8 äger beteendet).
3. **Schema → explicit-slot-modell (§5):** byt fast-arbetstid mot bokbara starttider, ojämna intervaller, service-längd-styrd. Boot-import från nuvarande mönster. Lågt manuellt arbete.
4. **Tjänster → storefront-placering:** visa/styr vart på storefront tjänsten hamnar.
5. **Personal → mer info + spegla verklig dag** (samma bokningar som M5).
6. **Varumärke → live-preview + undo + spara-utan-deploy** (färg/font som runtime `tenant_settings`). Preview-knapp-fallback som POS.
7. **Inställningar → sann-koppla varje toggle.** Ta bort döda toggles.
8. **Dashboard → rik vy (§3.8) + "se din sida"-länk.** Ingen analytics.

---

## 8. Parkerat (planerat, byggs inte först)

- **Chatt mot bokning** → kundens meddelande landar som **notering** på frisörens/admins bokningsrad (inte mejltråd). Krok planeras nu, byggs senare.
- **Dubbla salonger / staff-allokering per period:** frisör delad per vecka (v23 salong 1, v24 salong 2). Bokningssidan visar "Erik är då i salong 2" som tydlig reminder när kund bläddrar. Får aldrig krocka med befintliga bokningar. Påverkar datamodellen (staff↔location↔period). `locations` finns. Planeras, byggs inte först. Håll enkelt men var inte begränsad.
- **Betalnings-medveten completion (detalj):** completion får inte slutföra betalning på no-show. Princip låst här, beteende bor i M8.
- **Rapporter** `/admin/reports` = senare.

---

## 9. Cross-modul-principer (födda i M6, gäller hela plattformen)

1. **Inga döda toggles** — varje kontroll är sann-kopplad eller borttagen.
2. **Sidor menar vad de heter** — "Bokningar" är till för bokningar, inget brus.
3. **Live-koppling / röd tråd** — en ändring på ett ställe slår igenom överallt den rör (avbokning → tid tillbaka; tjänst → storefront).
4. **Bunden frihet + undo** — ägaren känner "plattform, inte hemsida", men kan inte förstöra; ändringar går att ångra.
5. **UI, inte kod** — allt ägaren gör sker i UI och slår igenom utan deploy.
6. **Kontroll utan plikt** — verktyget ska kännas värt att vara i, aldrig som tvångsadmin.

---

## 10. Öppet kvar

Inget blockerande. Detaljnivå (exakta dashboard-widgets, exakt PII-retention-fönster i dagar) finputsas vid bygge mot demo-data.
