# FreshCut — exakt-kopia-spec (källa: freshcut.se, hämtad 2026-07-06)

> LAG: live-storefronten för FreshCut ska bli en EXAKT kopia av freshcut.se — samma text, layout, fonter, färger, bilder. Bokningsknappen ("BOKA TID" → wavy.nu) byts mot VÅR bokningsmodul. Inget improviseras.
> Kund: **FreshCut** — barbershop, herrklippning, centrala Linköping. Byggd på misssite.com-builder (basekit "barber"-mall). Slug: `freshcut` → `freshcut.corevo.se`.

## Design-tokens (computed, verbatim)
- **Rubrik-font:** `"Playfair Display", serif`, weight 700
- **Body-font:** `"Source Sans Pro", sans-serif`, weight 400, 19px
- **Guldaccent (knapp/border):** `#B59775` (rgb 181,151,117)
- **Rubrik-mörk:** `#252525` (rgb 37,37,37)
- **Hero-rubrik:** vit `#FFFFFF` på mörkt foto
- **Storlekar:** h1 ~59px · h2 ~32px · h4 ~27px · body 19px
- **BOKA TID-knapp:** transparent bg, 1.6px solid #B59775, text #B59775, **border-radius 0** (skarpa hörn), versaler + letter-spacing. Hover = fylls (verifiera).
- Sektionsavdelare: `row--divider-wave` (wave-SVG) mellan sektioner.

## Sidkarta
Två sidor: **/** (hem) och **/priser**.

### Header (båda sidorna)
- Logo vänster: "FreshCut" (Playfair, mörk)
- Nav höger: "Priser" (→ /priser) · "BOKA TID" (outline-knapp → **vår bokning**, ej wavy.nu)

### Hem (/)
1. **Hero** — fullbredd mörkt barberfoto, vit serif-rubrik.
   - Bakgrund: `https://basekit-product.s3-eu-west-1.amazonaws.com/Image+Sets/localBusiness/barber/default/barber_image-4.jpg`
   - H1: "FreshCut"
   - Under: "Barbershop i centrala Linköping"
2. **Sektion "Mer än bara en frisörsalong."**
   - H4: "FreshCut gör dig nöjd."
   - Body: "I våra fräscha lokaler mitt i Linköping City känner du dig väl omhändertagen av våra barberare, som har mångårig erfarenhet inom herrklippningar. Oavsett om du vill snygga till ditt skägg, ögonbryn eller håret hjälper vi alltid till att göra dig helt nöjd med din klippning."
   - Galleri (4 bilder):
     - `//files.builder.misssite.com/34/48/34485c07-5c42-4885-a16b-1af9cb0642c0.png`
     - `//files.builder.misssite.com/70/62/70620da8-4855-4366-b606-b6dd0af61070.png`
     - `//files.builder.misssite.com/21/5b/215bb75f-000e-49a0-bd9c-39bb82810440.png`
     - `//files.builder.misssite.com/e0/a6/e0a602fa-ac66-4d84-9bb8-bbd4f478b263.png`
3. **Sektion "Varför Oss?"**
   - H4: "Välj den bästa. Såklart."
   - Body: "Fresh Cut är en utmärkt val för herrklippning av flera anledningar. För det första är våra frisörer mycket erfarna och kunniga när det gäller att klippa herrhår, vilket garanterar en hög kvalitet på klippningen. För det andra använder Fresh Cut endast de bästa produkterna för att se till att varje klippning resulterar i ett snyggt och välvårdat hår. Slutligen har Fresh Cut en avslappnad och trevlig atmosfär, vilket gör det till en bekväm och avkopplande plats att besöka för en klippning."
   - Knapp: "Boka tid" → **vår bokning**

### Priser (/priser)
- H1: "Priser. Som tål att jämföras."
- **Prislista** (= tjänstekatalog för bokningsmodulen):
  | Tjänst | Pris |
  |---|---|
  | Herrklippning | 369 kr |
  | Herrklippning Student | 329 kr |
  | Herrklippning, långt skägg, varm handduk | 459 kr |
  | Herrklippning kort skägg, varm handduk | 419 kr |
  | Pensionärsklippning | 329 kr |
  | Barnklippning (upp till 8 år) | 299 kr |
  | Skäggtrimning | 229 kr |
- Punktlista "Hos oss på Fresh Cut": Trevlig miljö · Grymma barberare · Gör dig alltid nöjd
- **"Våra barberare."** + body (se freshcut-priser-index) + 2 bilder:
  - `//files.builder.misssite.com/32/05/3205e743-9c23-415f-acc1-fb8f577de3b6.png`
  - `//files.builder.misssite.com/a2/6c/a26c5e7e-27a1-453b-8595-dc0291cfbb7a.jpg`
- **"Boka tid!"** + body → knapp → **vår bokning**

### Footer (båda)
- "FreshCut"
- "© 2020. A RAKEDO BUSINESS."
- **Kontakta Oss:** info@freshcut.se · 073 876 71 44
- **Adress:** Bokhållaregatan 2, Linköping, 582 24
- **Sociala medier:** Instagram [@freshcut.lkpg](https://instagram.com/freshcut.lkpg)

## Vad som ändras vs källan
- Alla "Boka tid"-knappar → VÅR bokningsmodul (idag → `wavy.nu/se/freshcut-linkoping`).
- Bilder hotlänkas från misssite/basekit-CDN initialt; Zivar byter mot egna i admin senare.
- Öppettider: EJ på nuvarande sajt → Zivar matar in i admin (bokningsmodulen behöver dem).

## Bygg-ordning (Zivars sekvens)
1. Skapa tenant FreshCut → `freshcut.corevo.se`
2. Storefront = exakt kopia (denna spec) — VERIFIERA render (0 FAIL) innan vidare
3. Öppettider + tjänster (prislistan ovan) + personal in
4. Admin-inlogg för FreshCut (bara det de behöver)
5. Bilder/innehåll in
6. Testa hela bokningssystemet e2e
7. Påminnelser + mail
