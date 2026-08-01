# Superadminens kundarbetsyta — designbeslut

## Kanon

Kanon är Codex Design-paketet:

`4-Dokument-Underlag/01-acceptans/super-admin/handoff-2026-07-13/handoff-superadmin/`

Särskilt `design/Corevo Superadmin.dc.html`, skärmen `Kundkort` och fliken `Sida`.
Skärmbilden från Zivar visar nulägesfelet men är inte en alternativ design.

## Beslut

1. Ett valt kundkort är en egen fullbreddsyta inom superadminens kanoniska
   `1320px`-huvudyta. Den gamla permanenta kundlistan ska inte ligga bredvid
   kundkortet och pressa ihop innehållet.
2. `← Kunder` är vägen tillbaka till listan. Alla befintliga kundflikar,
   åtgärder och serverfunktioner behålls.
3. Kundflikarna får brytas till flera rader. Ingen horisontell miniatyrräls
   ska dölja flikar.
4. Sida-studion följer paketets exakta bärande layout:
   `minmax(400px, 1fr) minmax(480px, 1.15fr)`, `16px` gap och `align-items:start`.
5. Previewkolumnen är sticky på `top:78px`. Previewkroppen är
   `height:calc(100vh - 220px)`, `min-height:420px` och `overflow:auto`.
6. När de två minimikolumnerna inte ryms ska studion staplas till en kolumn.
   Funktioner tas inte bort för att nå responsivitet.

## Avgränsning

- Ingen produktionsdeploy eller produktionsmigration.
- Ingen omskrivning av kundfunktionerna.
- Ingen ny visuell stil utanför paketets fastställda mått och beteende.
- Goal 74:s pågående filer ska bevaras och får inte följa med i Goal 80-commit.
