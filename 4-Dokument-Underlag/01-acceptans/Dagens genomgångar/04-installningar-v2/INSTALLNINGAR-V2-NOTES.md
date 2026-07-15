# Kundadmin · Inställningar v2 — handoff-beskrivning

Fil: `Kundadmin Inställningar v2.dc.html` (interaktiv designprototyp, mörkt tema). Toppnav = universal banner.

## ⚠ VIKTIGT till dig som kodar (Claude Code)
Designmockup — visar SKALET och mönstren. Vilka inställningar som finns/tillkommer/försvinner ägs av er (Zivar + Claude Code) — mappa BEFINTLIGA sidor in i det här skalet (jfr goal-67 C-01: nio kategorier, ingen funktionsomdesign). Tre kategorier är fullbyggda som mönsterexempel (Bokningsregler, Tjänster & priser, Konto & säkerhet); övriga visar sina rader som stub — dagens innehåll behålls rakt av.

## Layout
Vänsternav 308px (kategorier i grupper + sök) · höger innehållsyta (max 760px). Kategori = ikonruta + namn + en beskrivande rad. Aktiv = mörkare bg. Grupper: VERKSAMHET (Tjänster & priser, Personal, Scheman & frånvaro, Platser) · BOKNING (Bokningsregler, Bokningsflöde) · PENGAR (Betalning) · KOMMUNIKATION (Påminnelser & utskick, Integrationer) · KONTO (Konto & säkerhet, Sekretess & GDPR).

## Mönster (detta är designleveransen)
1. **Sök i inställningar** (fältet under rubriken): fritextindex över poster + synonymer ("öppettider", "pris", "semester", "lösenord"…) → träfflista med namn + VAR den bor → klick hoppar dit. Koppla samma index till globala Ctrl K.
2. **Dubbelboende data får ⓘ-hänvisning, aldrig dubblering.** Ex: öppettider — visning redigeras i Redigera sidan → Kontakt, bokningsbara tider styrs av Scheman. Bokningsregler-panen har ⓘ-rutan som förklarar + länkar. Använd mönstret överallt där något bor på två ställen.
3. **Lägen istället för tekniska toggles** (C-03): Onlinebokning = tre radiokort På/Pausad/Av med KONSEKVENSTEXT ("Pausad: sidan visas men bokningen är stängd — 'Ring oss' visas istället"). Vald = grön ram + tonad bg.
4. **Radmönster för inställningar**: kort med rader (titel + förklaringsrad vänster, kontroll höger — select-pill, toggle, knapp eller ›). Mono-etiketter för grupprubriker.
5. **Statusprickar i navet = BARA varningar** (gul/röd), aldrig gröna prickar på allt. Ex: Betalning har gul prick "Utbetalningar väntar" (Stripe-verifiering ej klar). Syns utan att leta.
6. **Ärliga chips**: PÅ/AKTIVT/KOPPLAD (grön) · VÄNTAR (gul) · KOMMER (grå — t.ex. SMS som kräver avtal) · LÅST (schemalåset, grönt = tryggt med backup). Påstå aldrig mer än systemet kan bevisa.
7. **Konto & säkerhet** (C-04): Byt lösenord + senast ändrat, inloggnings-e-post, aktiva sessioner per enhet (DENNA ENHET-chip, plats + senast aktiv, Logga ut per rad) + röd "Logga ut alla andra enheter".

## Innehåll per kategori (mappning mot befintligt)
- **Tjänster & priser**: radlista (namn, vilka frisörer, min, pris, POPULÄR-chip, ⋯-meny), + Ny tjänst, dra-för-ordning. "Ändringar syns direkt på din sida."
- **Personal**: medarbetare (foto, roll, plats), visa på sidan-toggle, ta bort med tvåstegsbekräftelse.
- **Scheman & frånvaro**: veckoschema (personal × dagar), frånvaro-CRUD, grundtider med schemalås (lås upp → automatisk säkerhetskopia + återställ).
- **Platser**: adresser + tidszon; >1 plats aktiverar platsväljaren i toppraden.
- **Bokningsregler**: På/Pausad/Av + bokningsfönster (90 dagar) + avbokningsgräns (24 h) + "nya kunder får boka själva" (default för self_book, per kund på kundkortet).
- **Bokningsflöde**: befintliga /admin/bokning (bokningssätt, picker, avatarläge, färger, live-preview).
- **Betalning**: Stripe-kontostatus, Ta betalt vid bokning-toggle, utbetalningsstatus.
- **Påminnelser & utskick**: bekräftelse (PÅ), påminnelse dagen innan (PÅ), SMS (KOMMER — kräver avtal).
- **Integrationer**: Google-recensioner (KOPPLAD).
- **Sekretess & GDPR**: export per kund, radera kund (anonymisering), biträdesavtal (PDF).

## Roller & behörigheter (NY kategori under KONTO — fullbyggd i mockupen)
Detta är ÄGARENS admin — den har alltid allt. Anställdas egen admin är en SEPARAT, låst yta som designas senare. Här styr ägaren vad andra får:
- **Tre roller**: ÄGARE (allt — betalning, roller, GDPR; flera ägare går bra), PLATSCHEF (vardagsdriften: kalender, kunder, tjänster, scheman), FRISÖR (sin egen kalender och sina bokningar).
- **Individuella tillägg per person utöver rollen** (toggles under "Anpassa"): Ser alla kalendrar · Hanterar kundregistret · Redigerar sidan · Ser dagens siffror. Så kan två frisörer ha olika behörigheter.
- **Aktivitetslogg**: allt loggas på personligt konto ("Ali avbokade Erik Lund 15:30", "Vera ändrade priset…") — spårbart vem som gjorde vad. Därför: aldrig delade inloggningar; fler ägare = fler konton med ÄGARE-roll (+ Bjud in-knapp).
- Behörigheterna ska enforc:as SERVERSIDE (RLS/actions), inte bara dölja menyer.

## Rekommendationer utöver mockupen
- **Farozon-mönster (finns i mockupen)**: destruktiva åtgärder samlas alltid längst ner i kategorin i ett rödramat FAROZON-kort (röd mono-rubrik, ram `#5A3532`, röd ghost-knapp med …) + noten "Allt härinne kräver en extra bekräftelse." Exempel byggda: Ta bort medarbetare (Personal), Radera kund (Sekretess), Logga ut alla andra enheter (Konto).
- **Mobil/PWA**: navet blir egen sida (kategorirader + sök överst), kategori öppnas som egen vy med ←. Nås via "Mer" i bottennav.

## Tokens
Samma som övriga v2: bg `#121210` · yta `#1C1C18`/`#25251F`/`#2E2E28` · linje `#33332C`/`#4A4A41` · text `#F0F0EA`/`#C8C8BD`/`#96968C` · grön `#2F5F47` · ok `#8FD6A6` · warn `#D6AC6A` · röd `#D68F85`. Typ: Instrument Sans + IBM Plex Mono. Kort radie 14, kategorival radie 10, chips 99.
