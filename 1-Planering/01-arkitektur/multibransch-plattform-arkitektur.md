# Plattforms-arkitektur — multi-bransch (Corevo)

> ⭐ KANON — produktdefinitionen för hela Corevo (LÅST med Zivar 2026-06-14/15). Vid konflikt mellan denna fil och någon "booking/salong/frisör"-framing i CLAUDE.md/HANDOFF/minnen: **DENNA fil vinner**. Frisör = ETT exempel; plattformen är multi-bransch.
>
> Fastställd 2026-06-14 med Zivar. Detta är **grunddokumentet** för hela plattformen — den modell allt annat byggs mot. Tas till nästa planeringssession (DB → hela vägen → storefront).

## 1. Syfte / vision
EN plattform, EN databas, EN kodbas — där Zivar (super-admin) klick-klick:ar fram en färdig kundsida för **vilken bransch som helst** (frisör, verkstad, florist, butik, …). Aldrig 20 repon, aldrig bygga om från noll. Varje bransch har samma grund men egen anpassning. Nya branscher tillkommer över tid genom att kopiera närmaste preset + anpassa.

## 2. Grundprincip (LÅST)
**EN motor, konfigurerad — aldrig en fork per bransch.**
Admin + storefront är *en* kodbas som **renderar utifrån vilka moduler en kund har på (och i vilket läge)**. Ny bransch = ny **preset** (+ ev. ny **modul**), ALDRIG ett nytt repo eller bygge från noll.

## 3. Lagermodellen
1. **Super-admin (Zivar)** — `superbooking.corevo.se`. Skapar kunder, väljer bransch, togglar moduler, ändrar kundbilder.
2. **Bransch (vertical/preset)** — frisör / verkstad / florist / butik. Ett *paket*: default-moduler + default-mall + regler/terminologi.
3. **Moduler (à la carte)** — Bokning · Webshop · Offert · Fordon · Betalning · Lojalitet … Branschen sätter *defaults*, men varje modul togglas **per kund** (Zivars röda tråd). En frisör kan slå på shop-modulen utan att byta bransch.
4. **Tenant (kunden)** — 1 rad: pekar på bransch + sina modul-states + mall + ev. egen domän.
5. **Renderas som** — **Kund-admin** (visar bara på-moduler) + **Storefront** (visar bara *live*-moduler), `<slug>.boka.corevo.se` eller egen domän.

## 4. Moduler — register + LIVSCYKEL (kärnan)
Varje modul (t.ex. webshop) har ett **per-kund-läge** (state machine), inte bara på/av:

| Läge | Betyder | Syns i kund-admin | Syns publikt (storefront) |
|---|---|---|---|
| **off** | Kunden har inte modulen | Nej | Nej |
| **draft** (på, ej live) | Påslagen + för-konfigurerad med defaults; kunden fyller i innehåll | Ja | **Nej** |
| **live** (publicerad) | Aktiv och publik | Ja | **Ja** |
| **paused** | Publik yta stängd för *nya* åtgärder (inga nya ordrar/bokningar); befintlig data + historik kvar | Ja | Ja, men "stängd"-läge |

**Övergångar:**
- `off → draft` — aktivera modulen (kunden får en orörd, för-konfad yta). *Vem: se roller (ev. bara super-admin = uppsälj-kontroll).*
- `draft → live` — publicera. *Kunden själv (om hen kan) ELLER Zivar.*
- `live → paused` — kund tar paus (t.ex. shop full av ordrar). *Kunden eller Zivar.*
- `paused → live` — återöppna.
- `live/draft → off` — stäng av (data behålls / arkiveras — aldrig tyst radering, jfr append-only-reglerna).

**Exempel (Zivars ord):** Kund vill ha webshop → Zivar går in på kundbilden, togglar webshop `off→draft` → kunden får en orörd för-konfad shop i sin admin → kunden fyller i → "sätt live" (kunden själv under inställningar, eller Zivar) → `draft→live` → syns på riktiga sidan. Kund vill pausa → `live→paused` → inga nya ordrar, allt sparat.

## 5. Tenant-modellen ("kundbilden") — DB-form
En kund = `tenants`-rad + relaterad config:
- `tenants.vertical_id` → branschen.
- **`tenant_modules`** (NY, bärande): rad per (tenant × modul) → `state` (off/draft/live/paused) + `config` (jsonb, modul-specifik). Detta är livscykeln + per-kund-toggle.
- `tenant_settings` → tema/mall, branding, boknings-läge (extern länk vs Corevo), m.m.
- Domän: subdomän (slug → `<slug>.boka.corevo.se`) + ev. egen domän (`tenant_domains`).

## 6. Skapa en kund (onboarding) — flödet + alla val
1. Super-admin → **Onboarda ny kund**.
2. **Välj bransch** → laddar branschens preset (default-moduler, default-mall, regler).
3. **Namn + subdomän** (`<slug>.boka.corevo.se`).
4. **Välj mall** (filtrerad till branschens mallar).
5. **Moduler** för-ifyllda från preset — kan justeras direkt (state per modul).
6. (ev.) **Ägar-info** → ägar-login (magic link).
7. **Skapa atomiskt** (tenant + settings + tenant_modules + ägarroll i ett svep — som dagens `createTenant`, utökat med bransch + moduler).
→ Kund finns i DB, subdomän funkar direkt (wildcard, goal-28), admin + storefront renderar branschens moduler i sina default-lägen.

## 7. Ändra en kund (kundbilden i super-admin) — vad Zivar kan göra
- **Toggla moduler genom lägen** (off/draft/live/paused).
- **Byt/justera mall + branding.**
- **Domän:** lägg/byt subdomän eller egen domän.
- **Konton:** hantera ägare + personal (inbjudningar/roller).
- **Pausa/återaktivera hela kunden.**
- (ev.) **Byt bransch** (sällan — byter preset-defaults; öppen fråga hur moduler/data hanteras).

## 8. Roller — vem får toggla vad
- **Super-admin (Zivar)** — allt, cross-tenant, från kundbilden. Kan alltid toggla moduler/live/paus åt kunden.
- **Kund-admin (ägare)** — sin egen tenant: fyller innehåll, ser bokningar/ordrar/kunder, och (om tillåtet) togglar `draft↔live↔paused` på sina moduler. *Öppen fråga: får kunden själv göra `off→draft` (aktivera ny modul) eller är det Zivar/uppsälj?*
- **Personal** — `minbooking.corevo.se`: sitt eget schema.
- **Slutkund** — kundens storefront (egen domän/subdomän): bokar/handlar/begär offert.

## 9. Storefront — vad som visas
Storefront renderar **endast `live`-moduler** (draft syns bara i admin). `paused` = modulen syns men är stängd för nya åtgärder. Mall/tema + branding styr utseendet. Samma motor för alla branscher.

## 10. Domäner
- **`<slug>.boka.corevo.se`** — gratis, automatiskt per kund via wildcard (goal-28). Ingen CF-handpåläggning, överlever deploys.
- **Egen domän** (freshcut.se) — Cloudflare for SaaS / custom hostname, kunden pekar sin DNS mot plattformen, mappas till tenant i DB. (Senare aktivering.)
- POS (`corevo.se` + dess subdomäner) är en separat zon-granne — rörs aldrig.

## 11. Mallar (templates)
Mallar **taggas per bransch** → onboarding visar rätt mallar för vald bransch. Råmallar i `4-Dokument-Underlag/03-template-katalog/` konverteras till plattform-mallar (eget spår), en i taget.

## 12. DB-grund som måste byggas (nästa session)
- `verticals` — bransch-preset (namn, default-moduler, default-mall, regler/terminologi).
- `tenants.vertical_id`.
- `modules` — modul-register (nyckel, namn, vilka ytor/tabeller modulen äger).
- **`tenant_modules`** — (tenant × modul) → state + config (bär livscykeln + toggle).
- **Modul-specifika tabeller byggs när modulen byggs** (shop → products/orders/…; verkstad → vehicles/quotes/parts/…; gatade av `tenant_modules.state`).
- Mallar taggade per vertical.

## 13. Idag vs ska byggas
- **Idag:** de facto en "frisör"-bransch; bokningsmodul; tenants/users/customers/bookings/services/tenant_settings finns; admin/storefront delvis modul-omedvetna. Dörrar (goal-27) + wildcard (goal-28) på plats.
- **Ska byggas:** vertical+modul-lagret (tabeller + flaggor) → admin/storefront blir modul-drivna → moduler byggs en i taget (shop, offert, fordon) → onboarding utökas (bransch-val + modul-states) → mallar taggas/konverteras.

## 14. Beslut — LÅSTA 2026-06-15 (med Zivar)
*(Var öppna frågor; nu fastställda. Formar DB-grunden.)*

1. **Vem aktiverar modul (`off→draft`)? → Bara super-admin (Zivar).** Aktivering = uppsälj-/avgiftsmoment (påverkar kundens månadsavgift). Kunden gör själv `draft↔live↔paused` på moduler hen redan har. Varje modul har preset-val/mallar som Zivar väljer per kund; missnöjd kund → byt mall/variant i admin → spara ev. ny variant i katalogen för nästa kund.
2. **Pris per modul? → PARKERAT** (betal-rails pausade). `tenant_modules` får pris-/faktureringshook nu; faktisk prissättning beslutas när rails öppnas. *(Compliance-flagga: rör pengar.)*
3. **`paused`-beteende → Generellt kontrakt låst:** publik yta stängd för *nya* åtgärder (inga nya ordrar/bokningar), befintlig data + historik orörd, storefront visar "stängt"-läge. Exakt per-modul-detalj sätts när modulen byggs.
4. **Byta bransch? → Bransch = startpreset, inte bur.** Valfri modul kan slås på för valfri kund (Zivar togglar) — moduler är *inte* låsta av bransch. `tenants.vertical_id` är mutabel (mjuk default), men något särskilt "byt bransch"-flöde byggs inte i V1.
5. **Config vs kod → CONFIG-FIRST (låst grundprincip).** En vertical = ren data (terminologi, default-moduler, default-mall, regler). Beteende-skillnader byggs som **varianter inuti en modul**, aldrig `if (bransch)` i motorn. Ex: webshop = en modul med `fulfilment`-varianter (posta / hämta inom X dgr / beställ-hem-och-hämta); branschens preset väljer default-variant.

**Konsekvens för DB-grunden:** `modules` bär varje moduls variant-/config-schema; `tenant_modules.config` (jsonb) håller vald variant + inställningar per kund; **template-katalog** (helsida + per modul) taggad bransch + modul, fritt mixbar — dit ~100 mallar sorteras.

## 15. Mall-modell: skelett vs skin (LÅST 2026-06-15)

**Skelett vs skin (bärande princip).** Skelettet = moduler + databas; bestämmer VAD som funkar, samma för alla. Skinnet = mallen (templaten); bara HUR det ser ut. **Mallen anpassar sig till skelettet — aldrig tvärtom.**
- Funktioner/knappar bor i MODULEN, inte i mallen. Saknar mallen t.ex. boka-knapp men kunden vill boka → motorn lägger dit den (bokning-modulen äger den).
- Mall har element utan data bakom → kopplas inte / tas bort.
- Toggle på/av per modul (`tenant_modules.state`) → skinnet visar bara det som är live. "Glas & vatten": skelettet är glaset, mallen vattnet.

**Mall → plattform-mall = TOKEN + SEKTIONER (Q1, låst).** En rå HTML/Bootstrap-mall konverteras INTE genom rå-hosting (smälter ej med DB) och INTE genom hel React-omskrivning per mall (stelt, dyrt). I stället: mallens design (färger, typsnitt, layout) lyfts till **tokens** + mallen bryts i **sektioner som mappar mot moduler**. Då smälter skinnet in i skelettet, blir komponerbart och redigerbart. Heterogen JS/Bootstrap per mall spelar ingen roll — bara extraherad design + sektioner lever vidare.

**Super-admin = visuell hub (mål: full fri redigering).** Super-admin ska visa en ÄKTA preview av kundens sida (ej bara färger), där Zivar klickar en bild/text-slot → byter den på kundens skarpa deploy-sida. v1-fundament = sektion/slot-redigering; målet = full sidbyggare (drag/släpp), byggs ovanpå sektion-modellen.

**Innehåll/assets.** Varje mall har content-slots (vad visas var). Agent auto-upptäcker slots (bilder/rubriker) → Zivar godkänner. Bilder i Cloudflare R2; varje kund får X inkluderat, **bildbibliotek = betald toggle** (mer lagring = mer betalt; storage-billing-hook i `tenant_modules`).

**Licens.** Bootstrap-licensen täcker bara Bootstrap; varje mall har egen skapare/licens. Privat repo ≠ fri kommersiell resale (kundsidor är publika). Agenten läser VARJE malls riktiga licens och taggar den (fri / kräver kredit / kräver köp / förbjuder resale) → Zivar beslutar per data. *(Ej juridisk rådgivning.)*

**Admin-mallar.** Katalogen blandar storefronts + admin-paneler. Admin-mallar = skinn-kandidater för kund-admin, ej skräp. Storefronts först; meningslösa mallar rensas vid kategorisering.

**Katalog (~112 mallar, verifierat 2026-06-15).** Brett bransch-spann (restaurang, fastighet, vård, bygg, e-handel, utbildning, välgörenhet, finans, event, foto, hosting, admin …) = råmaterial för 20+ branscher. Taggas: bransch, typ (storefront/admin/landing/e-handel), stil, färg, licens, scope (helsida/sektion).

## Kopplingar
goal-27 (dörrar) · goal-28 (wildcard) · `1-Planering/04-hosting-onboarding/` · template-katalog · "toggle per kund = röd tråd". Denna fil = paraplyet de alla hör under.
