# Testlista — kund-admin: skal + kalender (goal-65 + goal-66)

**Detta är det som INTE går att verifiera mekaniskt.** Enhetstester (1 132) och bygget täcker
logiken; det här täcker det bara ögon och fingrar ser: tangentbord, zoom, pekskärm, riktiga
enheter.

> ⚠️ **Kör migration `0061_block_series_customer_flags.sql` FÖRST** (0060 är redan körd).
> Utan 0061 failar blockeringar, Kunder-sidan och kundsök. Klistra in filens innehåll i
> Supabase SQL Editor och kör — den är ofarlig att köra två gånger.

Logga in som `info@freshcut.se`.

---

## A-10 · Skalet (toppnav ersätter sidomenyn)

- [ ] Den mörkgröna sidomenyn är **borta** i hela `/admin`. Kvar finns ett vitt toppnav —
      samma som superadmin.
- [ ] Navposterna: Översikt · Kalender · Kunder · [aktiva moduler] · Redigera sidan ·
      Inställningar. Inga döda länkar.
- [ ] **Översikt** är markerad som aktiv BARA på `/admin` — inte på `/admin/kunder`
      (`/admin` är prefix till allt annat; buggen fanns och är lagad).
- [ ] Ingen `/salonger`-post läcker in från superadmins nav.
- [ ] **Tangentbord:** Tab genom hela toppnavet. Varje post får synlig fokusring. Enter
      navigerar. Ingen fokusfälla.
- [ ] **200 % zoom** (Ctrl + `+` ×4): toppnavet viker sig, inget klipps bort, ingen
      horisontell scroll på sidan.
- [ ] **Mobil (portrait):** navet blir nåbart, ingen text överlappar.

## A-11 · Skalet på riktiga enheter

- [ ] iPad **liggande** och **stående**.
- [ ] Mobil **liggande** och **stående**.
- [ ] Sidan scrollar aldrig i sidled. (Blocken får scrolla inuti sin egen yta — sidan får inte.)

## Del 01 · Mobil acceptans (dagens genomgång)

- [ ] Kontrollera bredderna **390, 768, 1024, 1199 och 1440 px**. Under 1200 px visas
      bottennavet som fem textetiketter: Översikt · Kalender · Kunder · Min sida · Mer.
      Inga navigationsikoner visas; aktiv etikett har den lilla pricken under sig.
- [ ] Den gröna mittknappen `+` öppnar Ny bokning. Kalenderns samtliga resurskolumner
      ryms i bredd på mobil utan sidscroll; resurschipsen kan svepas men visar ingen scrollbar.
- [ ] Direktlänk `?ny=1` öppnar Ny bokning en gång och städar URL:en. Samma länk/
      plusknapp ska kunna öppna dialogen igen utan sidladdning. `?blockera=1` öppnar Blockera;
      om båda finns vinner Ny bokning.
- [ ] Dagens dagvy centreras automatiskt kring aktuell tid. Scrolla sedan manuellt och skapa/
      uppdatera en bokning: kalendern får **inte** hoppa tillbaka. Byt dag och tillbaka till idag:
      då ska den centreras igen.
- [ ] Mobilknappen **Blockera** ligger bredvid datumstegen. Dag/Vecka/Månad ligger på en
      egen fullbreddsrad. Bokningsblock har personens svaga färgton plus tydlig vänsterkant.
- [ ] Öppna **Mer**, välj en länk: arket stängs. Byt tema i mobilvyn och bredda sedan
      fönstret: temaikonen i desktopnavet visar samma val.
- [ ] Öppna en bokning på mobil → **Omboka**. Flytta datum/tid och byt person. En ledig
      tid sparas; en krock nekas och originalbokningen ligger kvar oförändrad.
- [ ] iPhone/iPad med safe areas: inget hamnar under kameraön/notchen eller hemstrecket,
      varken toppnav, kalender, Mer-ark eller dialog utan footer.

---

## Kalendern — arbetsbordet

### Vyer
- [ ] Dag / Vecka / Månad byter vy utan sidladdning. URL:en följer med (`?vy=&datum=`) —
      kopiera länken, öppna i ny flik: samma vy, samma dag.
- [ ] "Idag" hoppar tillbaka. Pilarna stegar en dag/vecka/månad.
- [ ] Kalendern fyller skärmen (ingen tom yta i kanterna) men toppnavet är kvar.

### Boka
- [ ] Klick på en ledig ruta → dialog **framför** (ingen sidopanel), med person och tid
      redan ifyllda.
- [ ] Välj tjänst → lediga tider dyker upp. Skriv kundnamn → sökträffar. Ingen träff:
      det går ändå att spara (kunden skapas).
- [ ] **Klickbudget: högst 5 klick** från tom kalender till sparad bokning. Fler = FAIL.
- [ ] Notisraden säger sanningen: väljer du e-post ska mejlet faktiskt komma fram.
      Saknar kunden adress ska det stå det — inte "skickat".

### Flytta
- [ ] Dra en bokning till ny tid → tiden växer fram medan du drar. Släpp → bekräfta.
- [ ] Dra till en **annan person** → hamnar i rätt kolumn.
- [ ] Dra till en tid som redan är tagen → **stoppas**, bokningen ligger kvar där den var.
- [ ] **Klickbudget: högst 2 klick** att flytta.

### Avboka + ångra  *(kräver migration 0060)*
- [ ] Avboka en bokning → försvinner ur kalendern.
- [ ] ↩-knappen i verktygsraden → "Avbokade tider, senaste 30 dagarna". Bokningen står där.
- [ ] Raden säger **när** den avbokades och **av vem** ("Avbokad här i adminen").
- [ ] Avboka som KUND (kundportalen) → raden säger "Kunden avbokade själv". *Detta är
      testet som visar att loggen inte gissar.*
- [ ] **Återställ** → bokningen är tillbaka i kalendern som bekräftad.
- [ ] Boka något annat på samma tid, försök sedan återställa → ska **vägras** med
      "Tiden krockar…", och den avbokade ska ligga kvar i loggen.
- [ ] En tid som redan passerat visar "Tiden har passerat" — ingen Återställ-knapp.
- [ ] **Klickbudget: högst 3 klick** att avboka.

### Blockera tid
- [ ] Blockera en timme (Rast/Frånvaro/Möte) → randig ruta i kalendern.
- [ ] Den blockerade tiden går **inte** att boka — varken här eller på den publika sajten.
      *(Testa båda. Det är hela poängen med "en sanning".)*
- [ ] Klick på blockeringen → ta bort → tiden går att boka igen.

### Info på blocken *(nytt)*
- [ ] Blocket visar **tjänsten** även på en 30-minuterstid (t.ex. "Herrklippning").
- [ ] Blocket visar kundens **telefonnummer** i dagvyn (på tider ≥45 min).
- [ ] Klick på bokningen → i dialogen är numret en **knapp**. Tryck på iPad/mobil →
      telefonappen öppnas med numret ifyllt. *Detta måste testas på riktig enhet —
      desktop visar bara en dialog.*
- [ ] En **avbokad** tid visar inget nummer (man ska inte ringa någon som avbokat).

### Sök *(nytt)*
- [ ] Skriv ett kundnamn i sökrutan → bokningar dyker upp (30 dagar bak, ett år fram).
- [ ] Klick på en träff → kalendern hoppar till den dagen och öppnar bokningen.
- [ ] En avbokad träff är märkt "AVBOKAD" — inte gömd.
- [ ] Esc stänger. Klick utanför stänger.

### Realtid
- [ ] Öppna kalendern i **två** flikar. Boka i den ena → syns i den andra utan omladdning.
- [ ] Samma sak för en blockering.

### Hjälp
- [ ] ⓘ i verktygsraden → sju frågor. Ingen tour tar över första gången.

### Återkommande blockering *(nytt — kräver 0061)*
- [ ] Blockera tid → välj "Varje dag" → spara. Meddelandet säger hur många tillfällen som lades in.
- [ ] Kalendern visar rasten imorgon och nästa vecka också.
- [ ] Klicka en förekomst → "Ta bort endast denna" → bara den dagen försvinner.
- [ ] Klicka en annan → "Ta bort denna och alla framåt" → framtiden rensas, gårdagens ligger kvar.

### Resursfilter + veckohopp *(nytt)*
- [ ] Väljaren i verktygsraden visar en person — kalendern smalnar till den kolumnen, i alla tre vyer.
- [ ] "+4 v" hoppar till samma veckodag fyra veckor fram (ombokning: "kom tillbaka om en månad").

### Dölj kund + självbokning *(nytt — kräver 0061)*
- [ ] Kundkort → Styrning → "Dölj" → kunden borta ur Kunder-listan OCH kundsöket i kalendern.
- [ ] Kunder-sidan visar länken "Dolda kunder (N)" → kunden finns där → "Visa igen" tar tillbaka hen.
- [ ] Kundens bokningshistorik fanns kvar hela tiden (inget raderades).
- [ ] Stäng av "Får boka själv" → logga in som kund → ombokning nekas med hänvisning att ringa.
- [ ] Ägaren kan FORTFARANDE boka åt kunden i kalendern (vakten gäller bara kundens egna flöden).

### Feltillstånd *(nytt)*
- [ ] Stäng av nätverket (flygplansläge) → ladda om kalendern → felsida med "Försök igen",
      toppnaven kvar. Nätet på → Försök igen → kalendern laddar. ALDRIG en tom kalender vid fel.

---

## PWA — "spara på hemskärmen"

*Måste testas på riktig enhet. Kräver HTTPS → testa på prod, inte localhost.*

- [ ] iPhone/iPad: Safari → Dela → Lägg till på hemskärmen.
- [ ] Ikonen på hemskärmen är Corevo-ikonen (mörk platta, kalender, guldblock) — inte en
      suddig skärmdump av sidan.
- [ ] Öppna från hemskärmen: **inget adressfält, inga flikar**. Ska kännas som en app.
- [ ] Den öppnar direkt i **dagens kalender** — inte på översikten.
- [ ] Android: långtryck på ikonen → genvägar till Kalender / Översikt / Kunder.
- [ ] Ingen del av gränssnittet hamnar under mobilens "hak" eller hemstreck.
