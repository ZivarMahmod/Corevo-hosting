# Wavy Business live — funktionsparitet och riktning för Corevos kund-admin

> **Beslutsstatus 2026-07-14:** Liveobservationerna och kodgapen i rapporten gäller fortfarande. Den tidigare rekommendationen att kalendern ska vara hela kund-adminens startsida är ersatt efter Zivars produktbeslut. Gällande målbild finns i `00-LAS-MIG-FORST.md` och dokumenten `01`–`06` i denna mapp: Översikt är startsidan, Kalender öppnar det kompletta bokningsarbetsbordet direkt och den globala toppnavigationen ligger kvar.

**Datum:** 2026-07-13  
**Placering:** `3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/`  
**Typ:** Sanitiserad konkurrentresearch, inte designspecifikation  
**Mål:** Förstå hur en kund som är van vid Wavy kan börja arbeta i Corevo utan utbildning, samtidigt som Corevo blir snyggare, tydligare, mer tillgängligt och multi-bransch.

## 1. Beskedet i en mening

Corevo ska inte kopiera Wavys utseende. Corevo ska bevara Wavys **arbetssekvens, rumsliga minne och låga antal beslut**, men ersätta dess visuella, semantiska och tekniska skuld med ett modernt, tillgängligt och moduldrivet gränssnitt.

Den säkraste produktstrategin är därför **bekant arbetsflöde, förbättrat skal**:

- översikten är kund-adminens entré och kalendern nås med ett tydligt klick;
- när Kalender öppnas är den hela den operativa arbetsytan för bokningsarbetet;
- personal/resurser ligger stabilt i kolumner;
- tjänst → person/tid → kund → bekräfta förblir huvudsekvensen;
- inställningar är grunda och igenkännbara;
- branschens preset byter terminologi, standarder och synliga moduler, inte motorn;
- Corevo tillför bättre status, förhandsvisning, tillgänglighet, mobil/PWA och säkra rättelseflöden.

## 2. Metod och säkerhetsgräns

Livegranskningen gjordes i användarens redan inloggade Chrome-flik. Följande lästes:

- kalenderns synliga struktur och tillgänglighetsträd;
- behandlingsoverlayn;
- ett osparat bokningsutkast från en ledig cell;
- Presentation, Personal, Behandlingar, Öppettider, Bokningsbarhet, Statistik, Konton & säkerhet och Om Wavy;
- installerbarhetsmetadata och användarens skärmbild av Wavy som Windows-app.

Säkerhetsutfall:

- ingen befintlig bokning öppnades, flyttades eller avbokades;
- bokningsutkastet avbröts och efterkontroll visade noll synliga dialoger och noll sparåtgärder;
- inga inställningar ändrades eller publicerades;
- inga meddelanden, betalningar, integrationer eller exporter utlöstes;
- inga personuppgifter eller verksamhetsspecifika statistikvärden sparas i detta dokument;
- inga cookies, tokens eller sessionshemligheter inspekterades.

## 3. Vad som faktiskt gör Wavy enkelt

### 3.1 I Wavy är arbetsytan produkten

Wavy öppnar direkt i dagkalendern. Användaren behöver inte gå genom en dashboard för att nå dagens arbete. Kalendern svarar utan klick på:

- vem arbetar;
- vad händer nu;
- vilka tider är bokade;
- var finns luckor;
- var är tiden blockerad;
- vilken tjänst och kund hör till besöket.

Detta är viktigare än Wavys färger, typografi eller gamla visuella uttryck. För en migrerande kund är kalenderns startposition och geometri själva muskelminnet.

### 3.2 En bokning byggs genom igenkänning

Liveverifierad huvudsekvens:

1. **Välj behandling** — en tydlig primär handling i kalendern.
2. **Välj konkret tjänst** — längd och pris visas redan i listan.
3. **Välj ledig cell** — personal kommer från kolumnen och starttid från cellen.
4. **Välj befintlig kund eller fyll i en ny** — förslag visas direkt.
5. **Lägg till** — start och längd är redan förifyllda.

Det kritiska är att systemet frågar efter endast den information som ännu inte kan härledas. Person, datum, tid, tjänstelängd och ofta kund återanvänds från kontext eller standardvärden.

### 3.3 Blockering använder samma mentala modell

“Blockera tid” ligger bredvid tjänsterna och skapar ett kalenderobjekt på samma tidsaxel. Användaren behöver inte förstå en separat schemamotor för att lägga rast, frånvaro eller annat hinder. Live-DOM visar dessutom stöd för:

- start och sluttid;
- beskrivning;
- återkommande blockering;
- ändring av endast denna eller även framtida blockeringar;
- borttagning.

Corevo bör behålla den gemensamma kalenderinteraktionen men använda tydligare orsaker och domänobjekt där rapportering eller behörighet kräver det.

## 4. Liveverifierad funktionskarta

| Wavy-yta | Funktioner användaren är van vid | UX-egenskap att bevara | Corevo-konsekvens |
|---|---|---|---|
| Kalender | Dag, personalkolumner, bokningar, luckor, blockeringar, datumbyte | All drift i en blick | Bokningsmodulen bör landa i kalender/arbetsbord |
| Behandlingsväljare | Kategorier, tjänst, längd, pris, blockera tid | Domänspråk före formulär | Preset-terminologi + tjänstmetadata nära valet |
| Bokningsutkast | Start, längd, befintlig/ny kund, mobil för SMS | Kontext förifyller nästan allt | Inline/drawer med härledda värden och tydlig notifieringsstatus |
| Bokningsdetalj | Kund, besök, anteckning, SMS-historik, tider, favorit/status, avbokning | Besöket samlat i en yta | En detaljdrawer för se, ändra, flytta, avboka och historik |
| Blockerad tid | Beskrivning, start/slut, återkommande, framtida instanser | Undantag nära normalflödet | Gemensam kalenderinteraktion med typ/orsak |
| Presentation | Kundapp-preview, bild, SMS-avsändare, kontaktuppgifter, bokningslänk | Ändring nära konsekvens | Live-preview med mobil/desktop och sparat/utkast/live |
| Personal | Lägg till, namn, beskrivning, e-post, aktiv/bokningsbar | Kort och grund lista | Universal `staff`, branschtermer via preset |
| Behandlingar | Kategori, namn, pris, längd, lägg till | Hela katalogen skannas snabbt | Universal services/products med variantfält |
| Öppettider | Veckotider, stängd dag, gemensam bokningsbarhet, minsta framförhållning | En gemensam bas, undantag i kalender | Bas-schema + per-person/resurs-undantag på arbetsbordet |
| Bokningsbarhet | Publik/befintliga kunder/av, horisont, avbokningsgräns, kundmeddelande | Tre begripbara verksamhetslägen | Modulstate + publikhetsläge ska visas som mänskliga val |
| Statistik | Bokningsfrekvens och årsval | Låg komplexitet | Sammanfattning först, fördjupning progressivt |
| Konton & säkerhet | Kontakt, inloggningspersoner, kassaanslutning, CSV-export | Sällanarbete samlat | Roller, integrationer och export med tydlig risk/status |
| Om/support | Hjälp, villkor, integritet, GDPR, version | Support i kontext | Mindre hjälppanel, versions-/driftinfo och sök |
| Installerad app | Fristående fönster, aktivitetsfält, snabb start | Systemet känns som ett arbetsverktyg | Installerbar kund-admin-PWA, inte bara personal-PWA |

## 5. Inställningsmodellen — varför den känns enkel

Wavy har åtta stabila kategorier i en permanent vänsterspalt. Nästan allt följer samma mönster:

1. välj kategori;
2. se alla relevanta fält på en sida;
3. ändra;
4. publicera ändringar.

Det ger stark igenkänning, men den globala publiceringsknappen gör statusen oklar: är värdet lokalt sparat, ett utkast eller redan publikt? Corevo bör behålla den grunda navigeringen men skilja på tre tillstånd:

- **Sparat internt**;
- **Opublicerade ändringar**;
- **Publicerat/live**.

För operativa inställningar som schema bör Corevo spara direkt med tydlig återkoppling. För publik presentation bör utkast och publicering vara explicita.

## 6. Wavys appmodell

Live-sidan länkar ett manifest för fullskärms/fristående app och markerar Apple-webbappstöd. Användarens skärmbild verifierar att Wavy Business kan installeras/pinnas som ett eget Windows-program med egen titel och ikon.

Det ger fyra viktiga effekter:

- ett klick från aktivitetsfältet till arbetsdagen;
- mindre webbläsarbrus;
- tydligare “detta är mitt kassasystem/arbetsverktyg”-känsla;
- användaren behöver inte förstå skillnaden mellan webbapp och installerad app.

Corevo har i dag ett PWA-manifest för **personalportalen**, men ingen motsvarande verifierad installerbar **kund-admin**. För Wavy-migrering är det ett tydligt paritetsgap. Kund-admin bör kunna installeras separat med tenantens/Corevos namn, rätt start-URL, fristående visning och säkra uppdaterings-/offline-tillstånd. Offline får inte låtsas att en bokning är sparad.

## 7. Tillgänglighets- och kvalitetsskuld i Wavy

Livegranskningen visar att enkelhet för musanvändaren inte automatiskt är god tillgänglighet:

- flera globala ikonknappar saknar begripligt tillgängligt namn;
- klickbara tjänståtgärder är delvis `div`/`span` utan knappsemantik eller tangentbordsfokus;
- obligatoriska fält förlitar sig på placeholders snarare än beständiga labels;
- dolda dialoger ligger monterade i DOM och förorenar rubrik- och skärmläsarordningen;
- kalenderkomponenten exponerar ett mycket stort offscreen-träd;
- färg och dekorativa personalnamn bär för mycket identitet;
- hjälpwidgeten kan täcka arbetsytan;
- långa tjänstenamn trunkeras.

Detta är en möjlighet för Corevo: samma korta flöde kan bli objektivt bättre genom riktiga knappar, labels, fokusåterställning, tangentbordsstöd, robust kontrast, 44-pixels touchytor och en virtualiserad/semantiskt begränsad kalender.

## 8. Corevos nuläge jämfört med Wavy

Kodgranskningen visar att Corevo redan har mycket av systemgrunden:

- gemensamt portal-skal och modulstyrd navigation;
- dashboard med riktiga boknings-, kund-, tjänste- och betaldata;
- bokningslista med sök, statusfilter, vecka/lista och detaljdrawer;
- helskärms bokningsvy med personalkolumner, lediga tider och dagbläddring;
- tvåtrycksflöde för drop-in;
- schema, frånvaro, tjänster, personal, kunder, platser och publika sidinställningar;
- universal multi-branschmodell med `verticals`, terminologi och modulstates;
- PWA för personalportalen.

Men i relation till målet “Wavy-kunden arbetar utan omlärning” finns betydande gap.

### 8.1 Kritiska gap

| Prioritet | Gap | Varför det bryter Wavy-vanan |
|---|---|---|
| P0 | Kalenderingången leder inte direkt till ett komplett skapa/ändra/flytta/blockera-arbetsbord | Användaren kan nå bokningsdata men inte utföra hela vardagsarbetet i samma kontext |
| P0 | Vanlig kundbokning kan inte skapas i admin | Användaren skickas till den publika sajten; personal/tid/kund-kontext går förlorad |
| P0 | Helsskärmsvyn visar en kronologisk kortström, inte tidsgeometrisk dagkalender | Luckor och varaktighet avläses annorlunda än i Wavy |
| P0 | Befintlig bokning kan statusändras men inte fullt ändras/flyttas i samma drawer | Rättelseflödet är svagare än skapandet |
| P1 | Översikt och Kalender har inte tillräckligt tydligt skilda ansvar | Översikt ska orientera; Kalender ska genomföra arbetet |
| P1 | Kund-admin saknar eget PWA-manifest | Snabbstart och appkänsla för ägare/reception saknas |
| P1 | Navigationen innehåller fler moduler och nivåer | Plattformens styrka kan upplevas som komplexitet om modulgating/gruppering inte är hård |
| P1 | Publikhets-/sparstatus är spridd | Wavy-vanan “ändra → publicera” behöver en tydligare Corevo-motsvarighet |
| P2 | Frisörord förekommer fortfarande i admin-kod och hjälpcopy | Bryter kanon om Corevo som generell plattform |

### 8.2 Styrkor Corevo inte ska kasta bort

- modulnavigation visar endast aktiverade moduler;
- detaljer och status har tydligare badges och säkrare state transitions;
- avbokning raderar inte historik;
- betalstatus speglas från verklig källa;
- multi-location finns;
- kommandopalett och sök kan ge snabb åtkomst för expertanvändare;
- tillgänglighetsarbete som labels, reduced motion och touchmål finns redan i komponentbiblioteket;
- Corevo kan uttrycka branschskillnader som data, inte kundunika forkningar.

## 9. Rekommenderad målmodell

### 9.1 En entré, ett arbetsbord och en kontrollnivå

**Nivå 1 — Entrén:** Översikt visar dagens viktigaste information, nästa kunder, varningar och en tydlig väg till Kalender.

**Nivå 2 — Arbetsdagen:** Kalender innehåller lediga tider, bokningar, blockeringar, snabb kundbokning och drop-in. När användaren är här ska hela bokningsarbetet kunna genomföras utan sidbyte.

**Nivå 3 — Hantera, konfigurera och publicera:** kunder, verksamhetsinställningar och Redigera sidan nås från den globala toppnavigationen och kontextlänkar.

Översikten ska vara den obligatoriska entrén men får inte bli en andra kalender. Kalendern ska vara exakt ett tydligt klick bort och öppnas direkt i arbetsläge.

### 9.2 En gemensam bokningsdrawer

Samma drawer ska användas för skapa, läsa och rätta:

- kontext: datum, tid, personal/resurs och plats;
- tjänst(er), längd och pris;
- befintlig kund-sök eller snabb ny kund;
- intern anteckning och kundmeddelande separerade;
- notifieringsrad: exakt vad som skickas eller inte skickas;
- konfliktkontroll före spara;
- efter spara: tydlig status och möjlighet att ångra där domänregler tillåter;
- vid befintlig bokning: Ändra, Flytta, Avboka, Uteblev, Historik.

### 9.3 Multi-bransch utan att förlora enkelhet

Kalendern ska använda universella objekt men branschens språk:

| Motorobjekt | Frisörpreset | Exempel andra presets |
|---|---|---|
| `staff/resource` | Frisör/personal | Mekaniker, behandlare, bord, rum |
| `service/offering` | Behandling | Tjänst, konsultation, aktivitet |
| `booking.object` | Kundbesök/tid | Fordon, bord, uppdrag, klassplats |
| `block/time_off` | Blockerad/rast | Reserverad, ej tillgänglig, underhåll |

Ingen vy ska innehålla `if (frisör)`. Preset anger etiketter, ikoner, standardfilter, valda moduler och bokningsvariant.

## 10. Paritetsdefinition — vad “samma funktioner” bör betyda

Paritet ska mätas på **användarens mål**, inte identisk placering av varje knapp.

### Måste vara bekant vid migrering

- se hela dagen och luckorna direkt;
- stabila personal-/resurskolumner;
- skapa bokning från kalendern;
- tjänst med längd/pris före bekräftelse;
- återanvänd befintlig kund;
- skapa ny kund snabbt;
- blockera/återkommande blockera tid;
- ändra, flytta och avboka;
- konfigurera personal, tjänster, öppettider och bokningsbarhet;
- hantera inloggningar, integrationer och export;
- installera admin som app/snabbstart.

### Får förbättras och flyttas

- gammal grå visuell stil;
- oetiketterade globala ikoner;
- jättelik behandlingsoverlay;
- global oklar publiceringsknapp;
- canvas-baserad enkel statistik;
- supportwidget som täcker arbetet;
- färg som enda personalidentitet;
- osynlig semantik och placeholders som labels.

### Corevo-funktioner som ska introduceras progressivt

- webshop, offert, blogg, lojalitet, presentkort och framtida moduler;
- multi-location;
- mer avancerade betalnings- och publiceringsstatusar;
- branschvarianter och tenant-konfiguration.

De ska vara dolda när de är `off`, grupperade när de är aktiva och aldrig störa den dagliga bokningsvägen.

## 11. Mätbara acceptanskriterier för en Wavy-migrering

Följande bör senare bli testbara mål, inte bara designåsikter:

1. En erfaren Wavy-användare hittar dagens kalender utan instruktion med ett tydligt klick från Översikt.
2. Vanlig kundbokning från synlig kalenderlucka kräver högst fyra meningsfulla beslut när kund och standardtjänst finns.
3. Datum, personal/resurs och starttid behöver inte matas in efter klick i en cell.
4. Användaren ser före spara om SMS/e-post skickas.
5. Flytt och avbokning nås från bokningsdetaljen utan sidbyte.
6. Alla kärnflöden fungerar med tangentbord och 200 % zoom.
7. Bokning och blockering kan särskiljas utan färg.
8. Kund-admin kan installeras och öppnas direkt i arbetsdagen.
9. En tenant ser endast aktiverade moduler.
10. Terminologin i kalendern kommer helt från preset/variant och fungerar för minst tre olika branscher utan kodfork.
11. Ingen osparad lokal handling får se sparad ut vid nätverks- eller konfliktfel.
12. Migreringstest med fem Wavy-uppgifter mäter tid, fel, hjälpbehov och återhämtning.

## 12. Tre möjliga produktstrategier

### A. Visuell Wavy-kopia

Snabb igenkänning, men kopierar gammal skuld, begränsar multi-bransch och gör Corevo till en efterföljare. Rekommenderas inte.

### B. Bekant arbetsflöde, förbättrat skal — rekommenderad

Behåller kalendergeometri, ordningsföljd och grundnavigation men använder Corevos designsystem, modulmodell och tillgängliga komponenter. Ger lägst migrationsrisk och högst långsiktig hävstång.

### C. Dashboard-only admin

En dashboard som även försöker vara bokningsarbetsyta tvingar Wavy-kunder att lära om och gör den operativa vardagen sekundär. Rekommenderas inte. Corevos låsta Översikt ska orientera och leda vidare; den ska inte ersätta Kalender.

## 13. Beslut låsta av Zivar 2026-07-14

1. Kund-admin öppnar på Översikt.
2. Kalender är ett tydligt huvudval och öppnar det kompletta arbetsbordet direkt.
3. Kund-admin använder superadminens ljusa designspråk, med kundens egen navigation och roll.
4. Redigera sidan är en egen huvudfunktion och ersätts inte av en duplicerad Presentationsinställning.
5. E-post/lösenord och beständig session behålls. SMS-inloggning införs inte.
6. E-post är standardnotis. SMS är ett senare fakturerbart tillval.
7. Fullständig planeringskanon finns i `00-LAS-MIG-FORST.md` och dokumenten `01`–`06` i denna mapp.

## 14. Rekommenderad ordning om riktningen godkänns

1. Ta fram exakt designunderlag för det ljusa kund-adminskalet.
2. Bygg toppnavigation och ny Översikt.
3. Förena Corevos kioskdata med en tidsgeometrisk dagvy som öppnas direkt via Kalender.
4. Bygg gemensam skapa/läsa/ändra/flytta/avboka-drawer.
5. Lägg notifierings- och konfliktstatus före bekräftelse.
6. Bygg kalendernära blockeringar och schemaundantag.
7. Mappa Wavy-inställningarna mot Corevos befintliga sidor utan duplicering och behåll Redigera sidan.
8. Kör migreringstest med Wavy-vana användare.
9. Kontrollera samma motor med minst två icke-frisörpresets.
10. Bygg SMS som separat senare tillval; först därefter polish och avancerade genvägar.

## 15. Slutsats

Wavys verkliga konkurrensfördel är inte att systemet är vackert eller tekniskt modernt. Det är att användaren känner att kalendern **är verksamheten** och att nästan varje nytt objekt ärver sin kontext från platsen där det skapas.

Corevo har redan en starkare plattformsmodell, säkrare dataflöden och fler riktiga moduler. Den största risken är därför inte funktionsbrist i stort, utan att plattformens rikedom läggs framför den dagliga uppgiften. Om Corevo gör kalendern till arbetsbord, bevarar Wavys beslutsekonomi och gömmer allt som inte är aktivt eller relevant kan produkten bli både lättare att byta till och tydligt bättre att växa med.
