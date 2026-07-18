# Partner-modellen — varför superadmin ska klara ALLT utan backend

> Zivar 2026-07-18 (muntligt, strukturerat här; skärpt samma dag). Sekvensen:
> **(1) superadmin maxas för Zivar först** (goal-72), **(2) partner-rollen
> läggs direkt därefter** — den ska INTE vänta. Partnern får nästan identisk
> yta som Zivars superadmin, bara isolerad till sina kunder (ev. något mindre
> behörigheter — diskuteras när rollen byggs). Zivar ser och följer partnerns
> data. Samma produkt, ett scoping-lager till.

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

- **Licens:** ~50 kr/mån per AKTIV kund i partnerns admin → faktureras partnern.
- Partnern prissätter fritt mot sina egna kunder — mellanskillnaden är deras.
- **Kostnadsisolering:** rörliga kostnader (främst SMS) landar på PARTNERN,
  aldrig på Zivar. Utomlands används partnerns lokala SMS-tjänst (billigare än
  att skicka svenskt). Kräver per-partner-providerkonfiguration (senare).

## Branscher × partners

När Zivar färdigoptimerar en bransch (frisör → florist → ateljé …) får
partnern den automatiskt — och kan börja söka sådana kunder i sitt land.
Branschmotorn (EN kodbas, moduler à la carte) är alltså också partnerns
tillväxtmotor. Se `multibransch-plattform-arkitektur.md` (kanon).

## Vad detta kräver av arkitekturen (byggs som etapp 4 i goal-72, efter v2)

1. **Partner-scoping i DB:** tenants ägs av en partner (partner-organisation
   ovanför tenant). RLS/server-grindar filtrerar allt platform-UI per partner.
   Zivar = "partner noll" som ser allt.
2. **Roll-nivå mellan platform och ägare:** partnern är platform-admin för sin
   delmängd — aldrig för andras.
3. **Kostnadsattribution:** `notifications_outbox` bär redan kostnad öre per
   tenant → aggregeras per partner. SMS-provider blir per-partner-konfig
   (46elks får inte hårdkodas djupare som enda väg).
4. **Licensräkning:** "aktiv kund"-definition + månadsaggregat per partner
   (billingUnderlag-seamen är fröet).
5. **Isolerade ytor:** partnerns admin ser bara sina kunder, sina kostnader,
   sin fakturering. Ingen läcka mellan partners.

## Regler för allt som byggs NU (goal-72 m.fl.)

- **Servern bestämmer listan.** UI:t får aldrig anta "alla tenants" — det
  frågar servern vilka tenants som finns. Då blir partner-filtret en
  server-ändring, ingen UI-omskrivning.
- **Ingen ny funktion får kräva SQL/CLI för normal drift.** Varje sådan lucka
  bryter partner-löftet.
- **Kostnads-/leverantörs-seams hålls öppna:** per-tenant idag, per-partner
  imorgon — aggregera alltid via tenant_id, hårdkoda aldrig leverantör i UI.
- **Säker logik i server actions/RPC med behörighetsgrind** (redan lag) — det
  är exakt det som gör att en partner kan släppas in utan backend-risk.
