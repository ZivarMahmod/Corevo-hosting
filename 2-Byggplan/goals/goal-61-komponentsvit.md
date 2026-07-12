# goal-61 — Komponentsviten (uiverse-anatomin in i hela Corevo)

Efterföljare till goal-60 (som dödade viruset: 255 inline-stilar → 14). goal-60 gjorde det
MÖJLIGT för ytor att ha tillstånd. goal-61 ger dem faktiskt innehåll: riktiga knappar, riktiga
kvitton, riktiga tillstånd — hämtade ur Zivars uiverse-dump.

**Källunderlag:** `4-Dokument-Underlag/uiverse-komponentbibliotek.md` (126k tecken, klistrat
2026-07-12, återvunnet ur transkriptet efter compact).

## Regeln som styr allt

**Vi kopierar ANATOMI, aldrig kod.** uiverse-komponenterna bär exakt de vices vi just utrotade:
hårdkodade hex, `transition: all`, id-selektorer, magiska px, hover-only-affordances, noll
`prefers-reduced-motion`. En rå inklistring återinför viruset i en ny skepnad.

### Porterings-checklistan (varje komponent, utan undantag)
1. Hex → `--sf-*`-token med **mörkt** fallback-ink (vitt på plattform-guld = 2.41:1; mörkt = 6.4:1).
2. `transition: all` → namngivna properties. Aldrig `all`.
3. Sex lägen: rest · hover · active · focus-visible · disabled (**aldrig via opacity**) · loading.
4. `prefers-reduced-motion` nollar **`transform` OCH `animation`**, inte bara `transition`
   (en `transition: none` gör transformen *ögonblicklig*, inte borta).
5. 44px touch-golv. Hover-reveal måste även visas på `:focus-visible` och touch — annars är
   åtgärden osynlig för tangentbord och mobil (uiverse-fällan nr 1).
6. Kontrast MÄTS, gissas aldrig. Golv 4.5:1 (3:1 stor text).
7. Inga `-*`-mönster inuti CSS-blockkommentarer (`*/` stänger kommentaren mitt i meningen —
   bröt bygget två gånger i goal-60). PostCSS-parsa ny CSS **innan** build.

## Komponent → yta (kartan)

| uiverse-komponent | Yta i Corevo | Vad vi lånar |
|---|---|---|
| Cart-loader (fallande varor i korg) | Kassans pending-läge, bokningens "bekräftar…" | Rörelse-idén: laddaren berättar VAD som händer. Skalas via `--loader-scale`. |
| "Added to cart!"-toast | Ersätter dagens tunna `.added`-flyout i AddToCart | Kvitto-anatomi: ikon + text + väg vidare, reser sig ur knappen |
| Cart/coupon/checkout-kortsviten | **/varukorg + /kassa** (fortfarande visuellt trasig) | Rad-anatomi, kupong-fältet, totalsummans hierarki |
| Glass-/flip-kort | Mall-galleriet (super-admin) + kundkort | Vändning = "baksidan har mer info" (aldrig dekor) |
| Tooltip/hint-sviten | Admin — där vi idag har **noll** tooltips | Förklaring vid fältet, inte i en manual |
| Kontextmeny-kortet | Admin-radens åtgärder | Destruktiv åtgärd får semantisk hover, inte samma grå som "Ändra" |
| Toggle/checkbox-switchar | Admin-inställningar (moduler på/av, Drift-fliken) | Tillståndet syns från andra sidan rummet |
| Settings-knapp m. snurrande ikon | Admin-headerns inställningar | Ikonen rör sig **för att** något laddar |
| Social-ikonknappar | Storefront-footer | Hover som avslöjar identitet, med focus-paritet |
| Fil-uppladdningskortet | Bild-uppladdning (produkter, logotyp, mall-media) | Drop-zonens tillstånd: idle · dragover · uppladdning · klar |
| Hover-reveal-knappar | Storefront-produktkort ("Snabbvy") | **Kräver focus-paritet** innan de får finnas |

**Förkastat (medvetet):** 3D-roterande karusellen (bryter reduced-motion, tvingar perspective på
scroll-container, funkar inte med tangentbord), moln-/måne-dekoren i dark-toggle (ren dekor),
batteri-/klock-loaders (berättar inget om vår väntan). "Använd brett" ≠ använd allt — Zivar sa
*rätt saker på rätt plats*.

## Faser (Zivars ordning: mallar → super-admin → kund-admin → bokning → FreshCut)

### Fas 1 — MALLAR
**1a. Varukorgen först.** Den är fortfarande trasig och Zivar har klagat två gånger. Mätta defekter:
produktbilden kollapsar i sin platta · rad-/panel-baslinjer 16px isär (405 vs 421) · 8 klickytor
under 44px (footer-länkar 22px). Fixarna är anatomi-nivå → delad modul; formen förblir per-mall
via tokens.
**1b. Toast + loader** in i köp-/boknings-rälsen.
**1c. Produktkortets hover-lager** (snabbvy, hjärta) — med focus-paritet.
Mallarna får komponenterna som **opt-in-anatomi, inte en blank omstilning**: EN delad anatomi med
`--sf-*`-hakar; var och en av de 13 `theme.ts` bestämmer uttrycket. En likformig uiverse-skin över
13 mallar återskapar exakt den skelett-konvergens goal-58 slogs mot.
→ Deploy som vanligt (v*-tagg) så Zivar ser det live.

### Fas 2 — SUPER-ADMIN
Ingen token-indirektion: admin har **ett** utseende → direkta värden i CSS-moduler, samma
sex-lägen-/kontrast-disciplin. Tooltips, kontextmeny på rader, toggles, fil-drop.

### Fas 3 — KUND-ADMIN (booking.corevo.se)
Samma som fas 2. **Under lokalt-först-regeln: commit/push ja, INGEN v*-tagg förrän Zivar säger
"deploy".** Ingen agent taggar mitt i fasen.

### Fas 4 — BOKNINGSFLÖDET (minbooking / boka)

### Fas 5 — FRESHCUT (levande kund, sist)
Minsta möjliga diff. Redan funna brott: closing band 2.73:1 · nav-CTA 2.73:1 · piller-vs-fyrkant-
motsägelsen. Mät före och efter.

## Hård begränsning: admin ändras BARA till utseendet
Mekaniskt kontrollerbart: diffen får röra `className` och CSS — **inga** handlers, ingen state,
ingen DOM-ordning. vitest stannar på 868. 5-agents-rundan byter i admin-faserna ut en lins mot en
**funktionell-identitets-granskare** som läser diffen och fäller allt som rör logik.

## Verifierings-ritualen (varje steg, ingen genväg)
tsc + vitest + `next build` gröna **OCH Playwright öppnar sidan och RÄKNAR** (kontrast, klickytors
storlek, fokusring närvarande). Sessionens värsta fel var *"allt blev grönt och ingen öppnade sidan"*.
Att öppna sidan är ett **steg i listan**, inte en vana man hoppas på.
