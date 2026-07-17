# Goal 71 — Zivars testlista för Inställningar och Frisöradmin

Kör före produktionsdriftsättning. Paket 05 Kundportal ska inte testas i detta mål.

## Förberedelse

- Ha ett ägarkonto och ett aktivt personalkonto i samma testverksamhet.
- Öppna ett vanligt fönster för ägaren och ett privat fönster eller en annan
  webbläsarprofil för personal om båda ska vara inloggade på `booking` samtidigt.
- Låt en andra vanlig flik vara reserverad för `minbooking`.

## 04 — Inställningar

- [ ] Logga in som ägare på `https://booking.corevo.se/login` och öppna
      `https://booking.corevo.se/admin/installningar`.
- [ ] Kontrollera mörk tvåkolumnsvy på dator och kategorilista → detalj → tillbaka på mobil.
- [ ] Sök på `öppettider`, `pris`, `semester` och `behörighet`; rätt kategori ska öppnas.
- [ ] Byt mellan kategorier, använd webbläsarens bakåt/framåt och kontrollera att
      `?kategori=` följer valet.
- [ ] Kontrollera att endast riktiga varningar har statusprick och att inga okända
      integrationer påstås vara kopplade.
- [ ] Öppna Roller & behörigheter och sätt en testperson till PLATSCHEF.
- [ ] Slå på/av vart och ett av de fyra individuella tilläggen och ladda om sidan;
      valen ska ligga kvar.

## Behörighetsgränser

- [ ] Logga in som platschefen. Kalender, kunder, tjänster och scheman ska gå att öppna.
- [ ] Ändra en tjänst och en schematid på platschefens tillåtna plats; spara och ladda om.
- [ ] Försök öppna Personal, Inställningar, ekonomi och roller; de ska nekas.
- [ ] Kontrollera att platschefen inte kan skapa, aktivera, flytta eller radera personal.
- [ ] Om verksamheten har flera platser: platschefen ska inte kunna ändra en otillåten plats.
- [ ] Ge en FRISÖR endast `Redigera sidan`; Sida ska öppnas, men tjänster/schema ska
      fortfarande vara stängda.

## 06 — Frisöradmin på booking

- [ ] Logga in med personalkontot på `https://booking.corevo.se/login`.
- [ ] Kontot ska landa på `/personal`, inte `/admin` och inte på minbooking.
- [ ] Kontrollera mörk mobilkalender, dagbyte och bottennavet Kalender/Min profil.
- [ ] Öppna en riktig bokning; sheeten ska visa rätt kund, tjänst och tid.
- [ ] Skapa en walk-in i den egna kalendern och kontrollera att den syns efter omladdning.
- [ ] Kontrollera att walk-in inte erbjuds när en kollegas kalender visas.
- [ ] Utan kalendertillägget ska bara egen kalender kunna väljas.
- [ ] Med `Se allas kalendrar` ska tillåtna kollegor visas och valt namn ligga kvar vid dagbyte.
- [ ] Öppna Min profil: kontrollera konto, arbetspass, frånvaro och de tre notisreglagen.
- [ ] Ändra notisreglagen, ladda om och kontrollera att valen ligger kvar.
- [ ] Öppna Kontosäkerhet och kontrollera att länken stannar under `/personal/konto`.

## Parallell minbooking-flik

- [ ] Öppna `https://minbooking.corevo.se/login` i en separat flik och logga in.
- [ ] Fliken ska landa på `https://minbooking.corevo.se/personal` och visa samma data.
- [ ] Växla flera gånger mellan booking- och minbooking-flikarna; ingen ska loggas ut.
- [ ] Logga ut från en av värdarna och kontrollera att den andra värdens session finns kvar.
- [ ] Bekräfta att ingen redirect, 404 eller DNS-ändring har tagit bort minbooking.

## Godkännande

- [ ] 04 godkänd av Zivar.
- [ ] 06 godkänd av Zivar.
- [ ] Parallell booking/minbooking godkänd av Zivar.
- [ ] Klar för migration först och därefter webbdeploy.
