# goal-55 — Storefront UX-omtag: toppen, webshoppen, flödena, kundkonto

> Zivars order 2026-07-11 (efter goal-54): "gå igenom design/layout/CSS/UX igen —
> knappar där uppe som bara är där, dubbla saker, webshoppen beter sig konstigt
> (sidopanel), tänk ut en ny webshop-idé, särskilj blogg/shop/bibliotek/kurser,
> hur går handel till med mejl, ska kunden kunna logga in, presentkort funkar inte."

## AUDIT-FYND (kod-verifierade, fil:rad i audit-rapporten)

### Toppen ("knappar som bara är där")
- U1. Utility-strippen säger "Drop in eller boka online" — salong-språk, ej klickbar,
  ej ägar-redigerbar. Missvisande ram på en butiks-tung sajt.
- U2. Global "Boka tid"-CTA i nav är hårdkodad text och finns dessutom i hero +
  closing + varje prisrad → samma handling 5+ gånger på hemmet. Om booking ej live
  leder den till en tom /boka-sida.
- U3. Konto-ikonen visas bara när customerAccountsEnabled — ser slumpmässig ut.

### Dubbletter (samma vy)
- D1. Varje modul har BÅDE nav-länk OCH pelare/band/teaser på hemmet (butik ×3,
  offert ×2, presentkort ×2, kurser: nav + pelare + "Se allt vi gör"→/tjanster).
- D2. "Tjänster" i nav är ogatad och överlappar Kurser (floristens tjänster ÄR
  numera kurser + konsultation).
- D3. InlineBooking-varianten kan lägga en FJÄRDE bokningsyta på sidan.

### Webshoppen ("sidopanel som beter sig konstigt")
- W1. Varukorgen = flytande boll nere till höger som är OSYNLIG tills något lagts i
  korgen; öppnar höger-drawer. Ingen varukorgs-ikon i nav.
- W2. Kassan byter värld: /shop ligger i (public) med nya temade naven, men
  /butik/kassa + /butik/bekraftelse har EGEN layout med legacy-nav (pickNav) —
  två olika sajter mitt i köpet.
- W3. Kassans summering visar hårdkodat "Frakt 0 kr" / "Moms Ingår" — platshållare.
- W4. AddToCart ger bara 1,6 s knapptext-feedback — lätt att missa att något hände.
- W5. Mejl: kunden får INGET mejl vid lagd order (pending) — först när floristen
  sätter Bekräftad/Redo/Slutförd. Ingen orderbekräftelse direkt = otrygghet.

### Presentkort
- P1. "Köp presentkort" är en död knapp ("Köp öppnar snart") — modul utan funktion,
  MEN med nav-länk + band som lockar dit. Antingen köpflöde eller tona ned ytan.

### Kundkonto (svaret på "ska kunden kunna logga in?")
- K1. Konto-infra FINNS byggd: /login + /konto (bokningar, lojalitet, orderhistorik;
  checkout länkar redan ordern till inloggad kund). Gated per tenant via
  customerAccountsEnabled.
- K2. Men ytan är salong-formad (rebook, favorit-frisör); shop-ordrar är en
  undanskymd länk. Integritet/namn är read-only-stub.

## FÖRSLAG — NY WEBSHOP-UPPLEVELSE (beslutsunderlag)
1. **En värld:** flytta kassa + bekräftelse in i (public)-skalet → samma tema-nav
   hela köpet. /butik-rutterna behålls som redirects.
2. **Varukorg i naven:** ikon med antal-badge ALLTID synlig när shop-modulen är på
   (0 = tom ikon), klick → samma drawer. Flytande bollen bort.
3. **Add-feedback:** mini-toast/flyout "Tillagd — Gå till kassan" + korg-ikonen
   pulsar. Kunden ska aldrig undra om det funkade.
4. **Orderbekräftelse-mejl direkt** vid lagd order (pending) med orderrader +
   "betalas vid leverans/upphämtning" tills Stripe är på; sen kvitto via Stripe.
5. **Kassa-ärlighet:** ta bort platshållar-raderna Frakt/Moms tills riktiga regler
   finns (frakt/moms-konfig per kund = egen punkt).
6. **CTA per bransch:** navens huvud-CTA styrs av vertical (florist → "Beställ
   blommor" → /shop; salong → "Boka tid"). Utility-copy per bransch/tema.
7. **Av-dubbla hemmet:** nav = vägvisare, hemmet = skyltfönster. Pelarna behålls
   (de är sidans ryggrad) men band-CTA:er som pekar dit nav redan pekar rensas
   (offert-pelare räcker, presentkort-band räcker → bort ur nav? NEJ — nav kvar,
   bandet görs mindre); "Tjänster" döljs i nav när tjänstelistan är tom/ersatt av
   kurser. Boka-CTA visas EN gång (hero) + navens CTA — prisradernas Bookable kvar
   (de är funktionella), closing-CTA följer bransch-CTA:n.

## KUND-INLOGGNING — rekommendation
JA för handel, MEN lätt: gäst-köp förblir default (email räcker); "Skapa konto/logga
in" erbjuds i kassan + bekräftelsen så kunden KAN se sina ordrar/anmälningar på
/konto. Konto-ytan får en butik-vinkel (ordrar först när shop är på). Tvinga aldrig
inloggning för köp. (Kund-portal-fördjupning = fortfarande SIST, per tidigare order.)

## KÖRNINGAR (efter Zivars godkännande)
- **Körning 7 — Webshop-omtaget:** förslag 1–5 + P1-beslutet (presentkort: göm
  köp-CTA:n bakom modul-config tills köpflöde finns).
- **Körning 8 — Toppen & av-dubbling:** förslag 6–7 (bransch-CTA, utility-copy,
  nav-städ, dubblett-rensning per tema).
- **Körning 9 — Kundkonto för handel:** rekommendationen ovan (om Zivar säger ja).

Status: VÄNTAR PÅ ZIVARS BESLUT (webshop-idén, presentkort-vägen, kundkonto ja/nej).
