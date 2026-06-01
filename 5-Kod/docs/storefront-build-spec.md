# Storefront build-spec — editorial, photo-driven salongssajt

Härledd från LIVE-studie (Playwright) av ribban: Studio22, Studio Leander, Tofifi (eget feel-ref) + Voady-bokningsflödet (bokning.voady.se/ziggesfrisorer). Detta är det GEMENSAMMA vinnande mönstret, inte en kopia av en sajt.

## Gemensam DNA (uppmätt, cross-validerad)
- **Varm off-white/cream-bg, ALDRIG ren vit.** Leander `rgb(248,247,242)`, Tofifi `rgb(244,236,222)`. Pure white = platt admin-känsla (gapet mot Studio Nord).
- **Serif display-rubriker.** Studio22 + Leander = Playfair Display; Tofifi = Tenor Sans/Trajan (versal, letter-spacing ~3px). Brödtext = ren sans (Montserrat/Inter) eller varm serif (Cormorant Garamond hos Tofifi).
- **Full-bleed riktig fotografi i hero** med mörk gradient-overlay för läsbarhet. Alla tre. Detta är största gapet att stänga.
- **Dämpad pastell/jordnära accent, en per tenant.** Leander lavendel `rgb(164,164,252)`, Studio22 svart/salvia, Tofifi guld på near-black `rgb(21,17,13)`. Voady/Zigges = teal + coral.
- **CTA "Boka tid" som pill (radius ~32px, Leander) ELLER skarp rektangel (radius 0, Tofifi).** Skillnaden är en mall-distinktionsaxel.
- **Numrerad redaktionell tjänstmeny (01–05)**, inte boxar. Tofifi: eyebrow "— TJÄNSTER" → display-H2 → italic-fras → numrerad lista (nr / NAMN / italic-beskrivning / "[PRIS] — KR") med tunna divider-linjer.

## Voady-bokningsflöde (uppmätt steg-rytm — kvalitetsribban)
location-kort → tjänstkategorier (ikon-kort) → tjänstlista (rader m. cirkulär ikon-badge) → multi-select kundvagn (vald = teal check-badge + sticky botten-drawer "1 VALD TJÄNST" + cirkulär pil-FAB) → consultation (ikon-kort-attribut: hårlängd/hårtyp) → summary → **tid+utförare i ETT steg** ("Hitta din tid och utförare"): utförar-toggle "Vem som helst"/"Välj utförare" (cirkel-kort, coral aktiv ring) + Vecka/Månad-flikar. Månad = kalendergrid m. datum+pris/dag. **Vecka = 7-dagars kolumngrid, varje kolumn en lodrät lista med tid+pris ("13:00 / 460 kr"), otillgängliga dagar "Inga lediga tider".** Branded header + sticky drawer genom HELA flödet. Footer = "Voady" (= bristen vi tar bort).
