# Goal 89 — beslut och krav

## Status

Detta är underlaget för Goal 89. Ingen kod ingår i detta dokument.

## Mål

Publik storefront och superadminens preview ska använda samma modulkontrakt,
samma navigationsregler och samma läsare. En mall ska bara bestämma placering
och utseende. Modulens data och beteende ägs av modulen.

## Ska byggas

1. En React-fri katalog som beskriver varje moduls publika route, etikett,
   nåbarhet och tillåtna mallslots.
2. En gemensam läsning av modul-teasers för publik sida och preview.
3. Fasta mallslots med generisk fallback när vald mall saknar en specialvy.
4. Samma CTA- och navigationsgating i preview och publik storefront.
5. En kompatibilitetskontroll före publicering eller mallbyte.
6. Bevarande av tenantens publicerade innehåll och verksamhetsdata vid mallbyte.

## Ingår inte

- Nya affärsmoduler.
- Blogg-, kurs- eller gallerifunktionalitet end-to-end; det är Goal 90.
- Presentkort eller lojalitetsinlösen; det är Goal 91.
- Ny fri drag-and-drop-editor.
- Ny databasmodell för verksamhetsdata.
- Produktionsdeploy eller produktionsmigration.

## Moduler och gränser

Goal 89 använder befintliga modulstates och befintliga loaders. Minst följande
moduler ska kunna beskrivas av katalogen utan hårdkodning i varje mall:

`booking`, `shop`, `blogg`, `kurser`, `offert`, `presentkort`, `lojalitet` och
`galleri`.

En modul får visas publikt endast enligt befintligt livscykelkontrakt:

- `live`: publik modul och nya åtgärder tillåtna när övriga readinessgrindar är gröna.
- `paused`: publik modul kan visas men nya åtgärder är stängda.
- `draft` eller `off`: publik modul ska inte nås.

## Hårda beslut

- `corevo.se` är aldrig tenant-storefront.
- Tenantgränser och RLS ändras inte i Goal 89.
- Preview får inte skriva publicerat innehåll.
- Ett mallbyte får inte skriva över bokningar, kunder, produkter, artiklar,
  presentkort, lojalitetsdata eller media som tillhör tenantens verkliga innehåll.
- Saknad specialvy ska ge en definierad generisk modulvy eller en säker dold vy,
  aldrig en trasig länk eller en exception.
- Goal 89 får återanvända befintliga helpers. Nya abstraheringar ska endast
  skapas där samma kontrakt annars dupliceras mellan preview och publik sida.

## Klart när

Alla punkter i `6-Testing/goal-89-storefront-preview-mallslots-testlista.md`
är gröna på samma branch, med fokuserade tester, full webbtest, typecheck,
lint och build. Därefter uppdateras roadmap och Goal 89 flyttas till `klart/`.
