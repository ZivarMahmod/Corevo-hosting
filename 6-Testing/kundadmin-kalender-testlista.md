# Testlista — kund-admin: skal + kalender (goal-65 + goal-66)

**Detta är det som INTE går att verifiera mekaniskt.** Enhetstester (933) och bygget täcker
logiken; det här täcker det bara ögon och fingrar ser: tangentbord, zoom, pekskärm, riktiga
enheter.

> ⚠️ **Kör migration `0060_booking_cancel_audit.sql` FÖRST.** Utan den misslyckas varje
> avbokning (koden skriver `cancelled_at`/`cancelled_by` som inte finns än).
> `cd 5-Kod && npx supabase db push`

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
