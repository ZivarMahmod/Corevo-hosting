# Riktning — "super-kaka": ta det goda från alla, gör det på Corevos sätt

> Detta är INTE en executor-plan — det är beslutsunderlag för Zivar. Grundat i
> (a) konkurrent-gap-analys mot Bokadirekt/BokaMera/Planday/Crona/Smoobu/Multisoft,
> (b) Wavy-researchen i `3-Bakgrund-Research/`, (c) superadmin-SPEC:en i
> `4-Dokument-Underlag/01-acceptans/super-admin/`, (d) vad Corevo-koden faktiskt gör
> idag (80 migrationer, 459 filer skannade). Skrivet mot commit `6cdd690`, 2026-07-17.

## Kärninsikten

Corevo är redan **starkt** där konkurrenterna är siloade: bokning + storefront +
betalning-online + lojalitet + multi-tenant + sajt/domän/tema i EN kodbas. De
etablerade gör en sak var: Bokadirekt = salongsbokning, Planday = personalschema,
Crona = lön, Smoobu = uthyrning-autopilot, Multisoft = företagsbokning. Ingen av dem
kan byta bransch utan att byta system. **Det är Corevos oair.**

Gapen är därför inte "bygg ikapp" — de är "plocka de 4-5 mekanismer de etablerade
bevisat att kunder vill ha, och gör dem tvärmodul eftersom vi har EN motor."

## Din kund-admin-vision (som jag läser den ur SPEC + research)

> ➡️ **Full flesh-out + körplaner:** `DIREKTION-engagemangsmotor.md` (2026-07-17) +
> plan 013–020. Detta avsnitt är strategisk kontext; motorn (identitet → samtycke/
> kanalrouting → push → reko) är grundad mot faktiskt schema där.

Superadmin-SPEC:en + Wavy-researchens spår 2 pekar på samma sak, och jag tror det är
din "galna tanke":

**Idag:** kundens konto är per-tenant — en slutkund som bokar hos tre Corevo-salonger
har tre separata konton på tre subdomäner med tre teman.

**Visionen:** EN global kundidentitet över alla Corevo-verksamheter — en "Mina Företag"-hub
(`konto.corevo.se`) där slutkunden ser alla sina salonger/verksamheter, alla bokningar,
all kommunikation, på ett ställe. Verksamheten behåller sitt varumärke i sin egen yta,
men kunden får EN ingång till hela Corevo-ekosystemet.

Researchen har redan **löst de tre svåraste arkitekturbesluten** åt dig
(`3-Bakgrund-Research/.../GRANSKNING-claude-av-codex-2026-07-14.md`):
1. **Ingen `customer_accounts`-tabell behövs i våg 1** — `customers.auth_user_id` räcker
   för att länka en auth-user till kundrader hos flera tenants.
2. **Portalen ligger på NY host** (`konto.corevo.se`), inte `minbooking` (som är
   personalytan) — annars krockar dörr-isoleringen.
3. **Postgres-outbox räcker** — ingen köinfra (Redis/SQS) behövs för
   kommunikationsledgern.

Det gör visionen mycket billigare än den låter. Men den bör byggas EFTER
lanseringsgrindarna — den är tillväxt, inte lansering.

## Var vi ska ta "det goda från alla"

| Från | Mekanismen | Hur Corevo gör den BÄTTRE |
|---|---|---|
| **Smoobu** | "På autopilot" — regler som kör automatiskt vid händelser | Regelmotor ovanpå `lib/notifications/events.ts` som är TVÄRMODUL: `no_show → avgift + omboka-länk`, `6v efter klippning → påminn`, `lågt lager → pausa produkt`. Siloade system når aldrig bokning↔webshop↔lojalitet i samma regel. |
| **Bokadirekt/BokaMera** | Väntelista, återkommande bokningar, klippkort, recensioner på sidan | Bygg som **moduler** — bara de tenants som vill får dem, priset följer modulen |
| **Planday** | Personalschema → tidsstämpling → löneunderlag | Corevo har redan roller/arbetstider/frånvaro/personal-PWA. Lägg **stämpling + lönegrundsexport** ovanpå → bokning+schema+löneunderlag i ETT, vilket varken Bokadirekt eller Planday ger ensamt |
| **Crona** | Löneunderlag/bokföringsexport | SIE/Fortnox/Visma-export från de arbetade timmarna + Stripe-intäkterna |
| **Multisoft** | Renodlad resurs-/rumsbokning | Generalisera `resource` bortom personal (rum, utrustning) — motorn stödjer det redan konceptuellt |

## Rangordnad möjlighetslista (värde ÷ ansträngning)

### Snabbvinster (dagar — högst hävstång)
1. **SMS-provider** — plan 006 (46elks). Dispatchen finns; en fetch. Störst kundnytta/timme.
2. **Aktivera no-show-avgiften** — logiken finns redan men är dormant
   (`lib/booking/no-show-refund.ts`, "future/when Zivar activates"). Koppla till charge.
3. **Rapportexport (CSV/PDF)** — `lib/admin/stats.ts` räknar allt, renderar bara i UI.
   Lägg export. Efterfrågas av varje etablerat system.
4. **Flerstegs-påminnelser** (24h + 2h) — `reminders.ts` kör enkelt schema idag.
5. **"Boka igen om X veckor"-uppföljning** — återanvänd review-nudge-rälsen.

### Medelstora byggen (moduler — säljbara)
6. **Väntelista** (kö på fullbokad tid + notis vid lucka) — ny modul.
7. **Återkommande kundbokningar** ("var 4:e vecka").
8. **Klippkort/paket** (class-pass) — mycket vanligt i salong/hälsa.
9. **Rabatt-/kampanjkoder** + segment-utskick (kräver samtyckesregister för SMS/mejl).
10. **Automation-regelmotorn** (Smoobu-mönstret, tvärmodul) — bär punkt 2, 5 och mer.

### Stora spår (strategiska satsningar)
11. **Mini-Planday inbakat**: tidsstämpling → tidrapport → **löneunderlag/SIE-export**.
    Största HR-gapet; gör Corevo till bokning+schema+lön i ett.
12. **Global kundportal / Mina Företag-hub** (din vision) — kräver
    kommunikationsledger + host-routing först; arkitekturbesluten redan tagna.
13. **Fysisk POS/kassa** (kassaregister, kvittoskrivare) — stort, egen bransch-fråga.

## Rekommenderad ordning

1. **Först lanseringsgrindarna** (plan 001–006 + juridik) — inget av ovanstående
   spelar roll om en kund inte kan onboardas lagligt och driftas utan handpåligg.
2. **Sedan snabbvinsterna 1–5** — mest kundnytta per timme, låg risk.
3. **Sedan automation-regelmotorn (10)** — den låser upp no-show, rebook, och blir
   Corevos signatur-"autopilot" tvärmodul.
4. **Parallellt: mini-Planday-spåret (11)** om HR-kunder är målgruppen.
5. **Kundportal-visionen (12) sist** — störst, men researchen har gjort den billig; ta
   den när tillväxt > lansering.

## Konkret från Zivars inloggade vyer (skärmdumpar 2026-07-17)

Live-recon via Chrome kunde inte köras (tillägget ej anslutet), men två skärmdumpar
bekräftar gap-analysen med exakt funktionsvokabulär:

**Planday (Inställningar) — HR/lön-spinen Corevo saknar helt:**
- **Stämpelklocka (Punch Clock)** — tidredovisning/närvaro.
- **Arbetspasstyper** — "justerar lönenivåerna automatiskt" + spårar oregelbundenheter
  (sjukdom/träning). Dvs pass-typ → lönenivå-mappning.
- **Raster / Rastregler** — automatiska rastscheman → korrekt lönelista.
- **Kontraktsregler / Arbetstidsregler** — schemalägg utifrån varje medarbetares avtal.
- **Byte och tillgänglighet** — passbyten + tillgänglighet från personal.
- Toppnav: Schema · Frånvaro · Medarbetare · Rapporter · **Tidrapporter** · **Lön**.
- Notifikationer: automatiska meddelanden + **SMS till arbetsledaren** vid ledighetsansökan.
→ Detta ÄR "mini-Planday"-spåret (punkt 11). Corevo har redan schema/roller/frånvaro/
personal-PWA; det som fattas är exakt: stämpelklocka, pass-typ→lönenivå, rastregler,
kontraktsregler, passbyte, tidrapport, löneexport.

**BokaMera (dashboard) — bokningsdelen Corevo redan matchar + två idéer:**
- **Mina resurser** som egen förstaklassare (resurs-/rumsbokning bortom personal) —
  Corevos `resource` är idag personal-bunden; generalisera.
- **Spiris Bokföring & Fakturering** inbäddad i navet — bokförings-/fakturaintegration
  som modul (jfr punkt: SIE/Fortnox-export).
- **Godkännande-gate**: "skicka in ditt företag för godkännande innan kunder kan boka"
  — en kvalitets/trygghets-grind före publicering (Corevo har onboarding-studio men
  ingen explicit godkännande-gate).
- Dashboard = 4 stat-tiles (bokningar denna vecka/nyskapade/nya kunder/avbokade) +
  7-dagarsgraf + meddelandepanel — Corevos översikt v2 matchar redan detta.
- "Uppgradera"-prompt = freemium-modell (jfr Corevos modul-à-la-carte, punkt 2).

## Öppna trådar värda att veta om (från research-svepet)

- `2-Byggplan/goals/goal-68-kundportal-pwa-kommunikation.md` refereras i researchen men
  finns inte längre i repot (raderad i städningen) — master-planen för kundportalen bor
  bara i git-historiken nu.
- **Öppettider ⇄ publik bokbar tid**: `lib/admin/actions.ts:844` säger att redigering
  av öppettider "does NOT yet change the public bookable times" — en latent
  förvirringsbugg (ägaren ändrar öppettider, bokningen påverkas inte). Värd ett eget
  fynd/plan.
- PayPal är helbyggt men gatead på nycklar; egen kunddomän och pris-per-modul är
  medvetet parkerade (arkitekturkanon §10/§14.2).
