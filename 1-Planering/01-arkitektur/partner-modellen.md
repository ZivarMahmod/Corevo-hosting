# Partner-modellen

Partnern använder samma plattformsyta som Corevo-operatören, men är server- och
RLS-skopad till sina egna kunder. Globala kataloger, partnerhantering och pris är
root-only. Det är samma produkt med ett extra auktoritetslager, inte en separat
partnerapp.

## Modellen

**Corevo distribueras utanför Sverige via partners.** En partner (t.ex. i
Grekland) är en super-admin-användare som driver sin egen verksamhet på Corevo:

- Partnern gör ALLT Zivar gör — sätter upp kunder, konfigurerar, driftar — men
  bara för SINA kunder, i SITT land, **utan att Zivar behöver göra något**.
- Partnern jobbar 100 % i frontend. Ingen databas, ingen backend, ingen risk.
  Därför måste superadmin vara komplett: varje lucka som kräver SQL = ett
  supportärende till Zivar = modellen bruten.
- Kedjan är rekursiv: Zivar → partner → partnerns kunder (tenants) → kundernas
  slutkunder. Varje nivå ser och styr bara sitt. Partnerns kunder får hela
  paketet (bokning, lojalitet, webshop, kundinlogg …).

## Affärsmodellen

- **Licens:** root väljer valfri summa per partner och aktiv licensmånad.
  50,00 är bara formulärets förslag, aldrig ett fast systempris. Partnern kan
  läsa men inte ändra sitt eget pris.
- **Månadssanning:** aktiv någon gång i partnerns lokala månad ger hel månad.
  Paus/avkoppling tar inte bort kvalificeringen; aktiv flytt A→B ger hel månad
  hos båda. Pris-/kundändringar räknar om den öppna månaden, medan stängda
  månader är DB-immutabla.
- Partnern prissätter fritt mot sina egna kunder — mellanskillnaden är deras.
- **Kostnadsisolering:** rörliga kostnader (främst SMS) landar på PARTNERN,
  aldrig på Zivar. Utomlands används partnerns lokala SMS-tjänst (billigare än
  att skicka svenskt). Per-partner-providerkonfigurationen är byggd; den globala
  fysiska grinden `SMS_DELIVERY_MODE=off` ligger kvar tills separat canarybeslut.

## Branscher × partners

När Zivar färdigoptimerar en bransch (frisör → florist → ateljé …) får
partnern den automatiskt — och kan börja söka sådana kunder i sitt land.
Branschmotorn (EN kodbas, moduler à la carte) är alltså också partnerns
tillväxtmotor. Se `multibransch-plattform-arkitektur.md` (kanon).

## Implementerad arkitektur

1. **Partner-scoping i DB:** tenants ägs av en partner (partner-organisation
   ovanför tenant). RLS/server-grindar filtrerar allt platform-UI per partner.
   Zivar = "partner noll" som ser allt.
2. **Roll-nivå mellan platform och ägare:** partnern är platform-admin för sin
   delmängd — aldrig för andras.
3. **Kostnadsattribution:** `notifications_outbox` fryser partner, kostnad och
   valuta när raden köas och aggregerar per partner. Providerkonfiguration och
   hemlighetsreferenser är partnerbundna; hemligheter ligger i Vault.
4. **Licensräkning:** append-only kvalificeringsledger + öppen månadsledger
   per partner. Öppen månad synkas vid skrivning/läsning och timsvep; stängda
   rader skyddas mot update/delete i DB.
5. **Isolerade ytor:** partnerns admin ser bara sina kunder, sina kostnader,
   sin fakturering. Ingen läcka mellan partners.

## Regler

- **Servern bestämmer listan.** UI:t får aldrig anta "alla tenants" — det
  frågar servern vilka tenants som finns. Då blir partner-filtret en
  server-ändring, ingen UI-omskrivning.
- **Ingen ny funktion får kräva SQL/CLI för normal drift.** Varje sådan lucka
  bryter partner-löftet.
- **Kostnads-/leverantörs-seams hålls öppna:** kostnad fryses via tenant och
  partner per outboxrad; hårdkoda aldrig leverantör i UI.
- **Säker logik i server actions/RPC med behörighetsgrind** (redan lag) — det
  är exakt det som gör att en partner kan släppas in utan backend-risk.
