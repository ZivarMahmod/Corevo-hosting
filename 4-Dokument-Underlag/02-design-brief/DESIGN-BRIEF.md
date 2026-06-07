# DESIGN-BRIEF — Corevo Booking (för Claude Design)

Du designar ett white-label boknings-SaaS för salonger. Den här mappen (`kopia-till-design/`) är allt du behöver. Du kör ett PARALLELLT design-spår med egen miljö — du stör inte kod-bygget. Code bygger funktionen; du sätter utseendet, känslan och flödet.

## Vad du ska leverera
Designa ALLA skärmar/lager nedan så att man kan **klicka igenom allt, testa knappar och se varje sida**. Visa states (hover, klick, laddar, tomt, fel, lyckat). Leverera **slides + klickbar HTML + ett handoff-dokument** med detaljer (färg, spacing, komponenter, states) som Code kan implementera.

## Vad produkten är (positionering — viktigt)
Varje salong får sin EGNA bokningssida — egen brand, egen domän, eget verktyg. Corevo är **INTE en marknadsplats/nätverk** (till skillnad från Bokadirekt, Voady, Wavy där salongen blir en listning bland många). Målgrupp = salonger som vill ha sitt eget verktyg på sin egen sida, inte ligga i någons nätverk. Ingen påtvingad "Corevo"-branding mot slutkunden.

## ⛔ TVÅ HELT SEPARATA CSS-VÄRLDAR — blanda ALDRIG ihop
Detta är den viktigaste regeln. Storefront och back-office delar INTE stil. Corevo-dashboard-looken får ALDRIG läcka in i storefronten — då ser kundens sida ut som en admin-panel. Separata CSS, separata tokens.

1. **STOREFRONT (kundens salongssida) = PRODUKTEN. Viktigast.** Detta är det som levereras och säljs — salongens ansikte utåt. Ska se ut som riktiga svenska salongssajter: studio22.se, studioleander.se, zigges.se, kreateamfrisor.se. Elegant, foto-drivet, redaktionellt. **Per-tenant tema** (varje salong egen färg/logga/font). INGEN Corevo-grön/guld här — det är salongens egen identitet.

2. **BACK-OFFICE (dashboards: super admin, salong-admin, personal) — också viktig, egen stil.** Corevo-systemets look: skogsgrön `#1F4636` + guld `#f5a623` på kräm `#FAF8F4`, Playfair + Inter, mörk sidebar. Ägaren jobbar här varje dag → den ska vara riktigt bra, tydlig och skön att jobba i. Bara en annan värld än storefronten.

**Båda ska vara snygga.** Skillnaden är bara att de har olika stil och aldrig delar CSS. Storefronten är högsta prioritet (det är den som säljs/levereras), men admin ska inte kännas som en eftertanke.

(Detaljerade storefront-referenser: se `design-referens-storefront.md` i denna mapp.)

---

## LAGREN / SKÄRMARNA — designa alla

### 1. STOREFRONT — kundens salongssida (per-tenant tema, storefront-språk)
- **Hem/landing:** foto-hero (team eller salong) + serif-rubrik + "Boka tid"-CTA · om salongen · populära tjänster · våra frisörer (team m. foto) · inspirationsgalleri · plats + öppettider + karta · kontakt · footer
- **Tjänster/behandlingar:** full lista m. namn, beskrivning, tid, pris
- **Boka tid — INBÄDDAD wizard** (öppnas IN-PAGE, samma nav/brand, kunden lämnar aldrig sidan): steg 1 välj tjänst → 2 välj personal → 3 välj dag/tid (fina tidschips) → 4 dina uppgifter → 5 bekräftelse (kvitto-känsla). Kvalitet som Voady men inbäddat.
- **Kund-konto:** logga in / registrera · Mina tider · profil · av-/omboka

### 2. SUPER ADMIN / plattform (booking.corevo.se, Corevo-look)
- **Översikt:** alla salonger + KPI (antal salonger, aktiva, pausade, bokningar totalt)
- **Salonger:** lista, sök, status (aktiv/pausad), öppna en salong
- **Skapa/onboarda ny salong:** stegvis — namn, subdomän, välj temamall, branding, roll
- **Fakturering:** underlag per salong (antal bokningar/månad)

### 3. SALONG-ADMIN — ägaren (Corevo-look)
- **Dashboard:** dagens/veckans bokningar, nyckeltal
- **Bokningar/kalender:** se & hantera bokningar
- **Tjänster:** lägg till / ändra (namn, pris, tid, kategori)
- **Personal:** lägg till / ändra, koppla tjänster till person
- **Scheman & öppettider**
- **Varumärkes-editor:** logga, färg, bild, TEXT → ändring syns direkt på storefronten
- **Stripe-koppling** (enkel — knapp + status)
- **Inställningar:** kund-konton på/av m.m.

### 4. PERSONAL — frisören (Corevo-look)
- **Mitt schema** (idag / vecka)
- **Dagens bokningar**
- **Frånvaro** (anmäl ledigt)

### 5. (Valfritt) iPad "framme-vy"
- En-gångs-inloggning, dagens bokningar i stor tydlig vy, håller sig inloggad (för disken i salongen)

---

## Design-riktning (känsla + navigation, inte hårda regler)
- **Storefront:** foto först, stor serif-hero, "Boka tid"-pill, eleganta tjänstekort, team m. foto, galleri. Ge **3 distinkta temamallar** (inte kopior) så en ny salong kan välja stil.
- **Bokningen inbäddad:** "Boka tid" öppnar wizarden in-page (drawer/sektion/tab) — samma header/brand syns hela tiden. Voady-kvalitet, inte Wavy.
- **Back-office:** ren dashboard, mörk skogs-sidebar, guld-accenter, tydliga kort/tabeller, knappar med states.
- Varje skärm: visa knappar + interaktioner så flödet går att känna på.
- Mobil + iPad + desktop. 60%+ av bokningar sker på mobil — mobil först.

## Vad du INTE behöver göra
- Betalflödet på djupet (Stripe) — bara en enkel kopplings-knapp/status.
- Backend/logik — det är Codes jobb. Du gör utseende + flöde + handoff.
