# Avbokning & återbetalning — kravmodell (DRAFT, under diskussion)

> ⚠️ STATUS: DRAFT. Ej för bygge än. Fakta-research om svensk konsumenträtt +
> konkurrenters policy pågår. Lagfärdighet avgör vilka val som ens är tillåtna.
> Detta dokument fångar Zivars krav som de beskrevs 2026-06-06.

## Grundprincip
- Schema där kund bokar olika frisörer. Hur långt fram (4 / 15 / 30 dagar) spelar ingen roll.
- Betalar man vid bokning → rätt till återbetalning. Skälet: enda sättet att få tjänsten är att
  faktiskt gå på besöket (inget skickas/levereras).
- **Full återbetalning om avbokning ≥ 24h innan besöket** (24h + 1 min innan = pengar tillbaka).
  (Öppen fråga: är 24h-fönstret fast eller konfigurerbart per salong?)

## Tidstolerans (grace-marginal)
- Delay/error gör tider stökiga. Exempel: besök kl 12:00, kund avbokar 11:59 dagen innan, men
  DB registrerar 12:00 → får INTE leda till utebliven återbetalning.
- Krav: en rimlig felmarginal runt cutoffen, alltid till kundens fördel.
- (Öppen fråga: exakt marginal — t.ex. avrunda X min till kundens fördel.)

## Sen avbokning (utanför fönstret) = salongens policy
Per-salong konfigurerbart av Zivar utifrån ägarens önskemål. Olika vald policy → olika text,
som visas tydligt vid betalning OCH i bekräftelsemailet. 3 val:

- **Val 1 — inget tillbaka.** Avboka i fel tidsspann → 0% åter.
- **Val 2 — delvis.** En procent ägaren väljer (intervall 10–99%).
  - ✅ LÅST: procenten = vad KUNDEN FÅR TILLBAKA. 0% = Val 1.
- **Val 3 — inget tillbaka, men räddas via flytt.** Avboka i fel tidsspann → 0% åter, MEN
  avboka-knappen erbjuder: "avbokar du nu = inga pengar tillbaka, men du kan flytta din
  bokning." Salongen behåller pengarna, klippningen sker en annan dag.

## Flytt (ombokning) + loophole-skydd — gäller ALLA 3 valen
- **Flytten ÄR bokningen.** Ingen extra betalning, ingen extra/separat återbetalning vid flytt.
  Om ägaren valt 50% och kund flyttar → ingen 50% betalas in eller ut; bokningen bara flyttas.
- **Får flytta EN (1) gång.** Därefter → ring frisören för manuell hjälp om pengar berörs.
- **Återbetalningsrätt kan bara FÖRSÄMRAS, aldrig förbättras, via flytt.** Vid flytt "låses"
  nuvarande policy-utfall (t.ex. 50% / 20% / vad ägaren valt). Avbokar man EFTER en flytt, även
  inom rimligt fönster → fortfarande bara det låsta utfallet (t.ex. 50%), aldrig 100%.
- **Stängd loophole:** får INTE gå att boka/flytta långt fram → avboka direkt → få full
  återbetalning via ett "nytt ångerfönster". Exempel som måste blockeras: bokar 5 dgr innan →
  avbokar (ingen refund) → flyttar 14 dgr → försöker få pengar. Sådant routas till frisör-hjälp.

## Transparens
- Reglerna (vald policy) visas tydligt INNAN betalning och följer med i bekräftelsemailet.
- Kunden godkänner reglerna vid betalning → de gäller.

## Goodwill
- Utöver lag/policy finns goodwill-utrymme (research ska visa hur andra hanterar detta).

## Legal (research pågår — INGA gissningar)
- Frågor: gäller 14-dagars ångerrätt (distansavtalslagen) en betald, tidsbokad frisörtid, eller
  är den undantagen? När faller ångerrätten (tjänst påbörjad m. samtycke)?
- Är det lagligt att behålla del/hela beloppet vid sen avbokning (oskäliga avtalsvillkor)?
- Jämförelse med Bokadirekt, Fresha, Treatwell, Square Appointments, m.fl.
- → Resultat med källor läggs till här innan bygge.

## Relaterad kö-punkt (kom ihåg)
- **Kassasystem** — egen punkt att diskutera INNAN bygget av avbokningsmodellen. (Tillagd i kön.)
- Zivar nämnde "3 punkter att diskutera innan bygge" — fånga vilka.

## Låsta beslut (2026-06-06)
- Avbokningsfönster: KONFIGURERBART PER SALONG (default-förslag 24h).
- Val 2-procent: = vad KUNDEN FÅR TILLBAKA (10–99%). 0% = Val 1.
- No-show (avbokade aldrig, dök ej upp) på betald tid: ALLTID 0% tillbaka. Egen fast regel, ej
  ägar-konfigurerbar — de tog tiden + blockade någon annan.
- Återbetalning: AUTOMATISKT enligt policy när kund avbokar, MEN (a) loggas som händelse,
  (b) notis (vad/varför) till salong + kund, (c) tydligt för kunden att/hur det sker.
- Samtycke (research): villkoret visas + kryssas i AKTIVT före betalning, loggas (tidsstämpel +
  villkorsversion); + tydlig info att 14-dagars ångerrätt saknas för bokad tid.

## Betalnings-/återbetalnings-rail (PARKERAT — kassasystem-punkten)
Rail ej bestämd. Kandidater: ES kassasystem (öppet API, första kunden kör ES — Zivar kollar terminal),
Swish Företag (kan kopplas in → vidare mot ES; återbetalning ~2 sek, landar direkt hos kund), Stripe,
PayPal, Klarna, Swedbank Pay. → Bygg policy-MOTORN rail-agnostisk: en adapter (uttag) för
betala/återbetala. Kontrollenheten ska se allt. Återbetalningstid: VISAS DYNAMISKT per vald rail
(Swish ~sekunder; kort 5–10 bankdagar) — inget generiskt löfte. Diskuteras i kassasystem-punkten
EFTER goal-23.

## Parkerat — framtida bygge (kom ihåg, ej nu)
- Produkt-shop per salong (toggle on/off): togglas on i kundens inställningar → shop + betalning +
  kanal startar direkt. Order digitalt i admin ELLER papper via label-skrivare (Instabox API → label +
  fraktsedel vid godkänd order om i lager). Ev. Klarna i betal-alternativen. NÄR detta byggs →
  presentkort/produkter HAR 14-dagars ångerrätt → kräver lagstadgad ångerknapp + mottagningsbevis.

## Låsta beslut, runda 2 (2026-06-06)
- Grace-marginal: **15 min**, alltid till kundens fördel (23h 45min räknas som 24h).
- Val 1 (0%): tillåts, men ägaren ser **varningstext** om juridisk risk + att partiell/flytt är tryggare.
- Val 2-procent: **ett värde per salong** (ej per tjänst).
- Hjälp efter förbrukad flytt: **båda** — telefon PRIMÄRT, in-app-begäran som spår/medlare.
- **Salong-override i admin (nytt krav):** frisören kan manuellt (a) trigga FULL återbetalning
  (goodwill, oavsett policy), (b) omboka åt kunden — "kom den här dagen istället, det är betalt
  och klart" (betalningen följer bokningen).

## Låsta beslut, runda 3 (2026-06-06)
- **Salongen avbokar förbetald bokning → ALLTID 100% tillbaka** (eller frisören ringer och kommer
  överens om annat — men avbokas det, är det alltid allt tillbaka).
- **Frisör sjuk/borta — primärt flöde: byt FRISÖR, inte tid.** Dagens bokningar omfördelas till
  övriga frisörer automatiskt (rimligaste/snabbaste fördelning). Krock OK — 2 bokningar på samma
  slot tillåts, reds ut på plats. Kund som bara vill ha SIN frisör → ombokas i admin/på plats;
  inga betalfel triggas (betalningen följer bokningen).
- **NY FEATURE — frisör-frånvaro:** salongen markerar "frisör X ej här [dag]" → systemet sköter
  omfördelningen av den dagens bokningar automatiskt. Inget extra schema att klippa/klistra.
- **Obetalda bokningar:** samma fönsterregler (inga pengar att flytta). Ägaren markerar "dök ej
  upp" → spårning per kund.
- **Anti-missbruk (förslag, trösklar TBD runda 4):** mönster per kund (mail/telefon) hos salongen —
  återkommande no-shows / sena avbokningar / boka-avboka-loopar → flagga i admin med mönstret
  synligt → salongen väljer åtgärd: kräv förskott ELLER kräv godkännande. Toggle-bart. Per salong
  (ej plattformsbrett — GDPR-rent).
- **Påminnelser:** SMS-påminnelse + mail-bekräftelse (redan planerat upplägg).
- **"3 punkterna" = betal-rails-diskussionen** (ES kassasystem, Stripe, PayPal, Klarna, Swedbank
  Pay m.fl.) — tas EFTER goal-23 + denna planering, i kassasystem-punkten.

## Låsta beslut, runda 4 (2026-06-06)
- Anti-missbruk-tröskel: **2 no-shows eller 3 sena avbokningar / 6 mån; boka-avboka 3 ggr / 30 dgr**
  → flagga i salongens admin (mönstret synligt) → ägaren väljer åtgärd (förskott / godkännande).
- Notis vid automatiskt frisörbyte: **per salong-toggle**.
- Kunden avbokar/flyttar: **både /konto (Mina sidor) OCH säker länk i bekräftelsemailet** (utan login).
- Återbetalningstid: **dynamiskt per rail** — texten visar valda railens faktiska tid.

## Låsta beslut, runda 5 (2026-06-06) — MODELLEN KOMPLETT
- Policyn ställs in av **enbart Zivar (platform)**. Ägaren säger önskemål; kan begära ändring en
  gång (kommuniceras ej aktivt). Ägare ska inte pilla på saker utanför sin verksamhet/risknivå.
- Villkorstexter: **auto-genererade ur valen.** I bokningsflödet, INNAN betalmetod/uppgifter:
  (a) tydlig inline-sammanfattning av det viktigaste (t.ex. "Vid avbokning senare än 24 h innan
  besöket återbetalas endast 50 % av kostnaden — se villkor och policy nedan"), (b) "läs våra
  villkor"-länk i botten till fullständig beskrivning, (c) **obligatorisk kryssruta** = godkännande
  (loggas med tidsstämpel + villkorsversion).
- Flytt: **obegränsat framåt i tid** — skyddet ligger i låsningen + max 1 flytt.
- Deposition/anbetalning: **parkerad som framtida toggle**; datamodellen förbereds för delbelopp.

## Status
Kravmodellen LÅST (frågerundor 1–5, 2026-06-06). Nästa ordning: (1) goal-23 klart, (2) betal-rails-
diskussion (kassasystem-punkten: ES, Swish, Stripe, PayPal, Klarna, Swedbank Pay), (3) goal-brief
för bygget av policy-motorn (rail-agnostisk).
