# Kundadmin · Kunder v2 — handoff-beskrivning

Fil: `Kundadmin Kunder v2.dc.html` (interaktiv designprototyp, mörkt tema). Toppnav = samma chrome som Översikt/Kalender v2.

## ⚠ VIKTIGT till dig som kodar (Claude Code)
Designmockup — visar UX-mönster, layout och tokens. Befintlig funktionalitet på Kunder-sidan/kundkortet (goal-67: `hidden_at`, `self_book`, kundsök, klientkort m.m.) behålls fullt ut och får bara den nya stilen. Fält/åtgärder som finns idag men inte syns i mockupen försvinner INTE — de sorteras in under rätt sektion eller ⋯-menyn.

## Placering: egen flik, INTE under Inställningar
Rekommendation: behåll Kunder som egen flik. Skäl: (1) kundregistret är operativ vardagsdata (ring, boka, klientkort) — Inställningar är konfiguration; (2) Goal 68 gör kunder till ett kärnobjekt (kundkonton, portal, kommunikation, lojalitet) — det ska växa, inte gömmas; (3) snabbvägen från Kalender (bubbla → Öppna → Profil) och Ctrl K-sök landar här. Kompromiss om ni ändå vill slimma navet: länka registret även från Inställningar, men URL/yta är densamma.

## Idé: master–detalj = snabbast åtkomst
Lista till vänster (400px), kundkort till höger — klick byter kund UTAN sidnavigering. Sök + filter alltid synligt. Detta ÄR "snabbknappen": 1 klick från lista till uppgifter, ✆ Ring och Boka in alltid överst på kortet.

## Struktur
**Vänster (lista):**
- Rubrik + monorad ("10 kunder · 2 nya i juli · 1 dold") + grön `+ Ny kund`.
- Stort sökfält (namn ELLER nummer — matchar sifferstrip, fungerar i prototypen).
- Filterchips: Alla / Nya / Stamkunder / Inaktiva (>3 mån) / Dolda (fungerar i prototypen).
- Kundrad: initial-avatar, namn + tagg (NY gul / STAM grå / DOLD röd), nummer (mono), höger: senaste besök + kontoprick + antal besök. Vald rad = mörkare bg + grön kantlinje. Dolda kunder nedtonade, syns bara under filtret Dolda.

**Höger (kundkort):**
1. Header: stor avatar, namn + chips, tel · e-post · "kund sedan" (mono). Åtgärder: `✆ Ring` (bara om nummer finns) / `Boka in` (grön, primär) / `⋯` (Dölj kund, Exportera, GDPR).
2. Nyckeltal 4 kort: besök · totalt bokat · avbokningar · lojalitetspoäng.
3. NÄSTA-rad: kommande bokning + frisörprick + "Visa i kalendern →", eller tomt läge med Boka in-knapp.
4. KLIENTKORT: fritext-anteckning (färgrecept, önskemål, allergier), autosparas. = `customer_notes`, en per kund.
5. FAVORITER: favoritfrisör (färgprick) + favorittjänst. = `customer_favorites`.
6. KONTO & KOMMUNIKATION (förberett för Goal 68, ärligt om nuläget):
   - Kundkonto: Gäst (grå prick, "Bjud in") / Inbjuden (gul, "Skicka länk igen") / Aktivt konto (grön). Mappar mot portalens kontolänkning.
   - "Kan boka själv online" — toggle (= `customers.self_book`, finns idag).
   - Påminnelser: kanalstatus i mono — `E-POST ✓ · PUSH 2 ENHETER` (SMS visas först när provider finns; påstå aldrig mer än systemet kan bevisa).
7. BESÖKSHISTORIK: datum (mono) · tjänst · frisörprick · pris. Avbokade rader ligger kvar: genomstruket + "— avbokad" + rött streck-pris. "Visa alla N →".
8. SENASTE UTSKICK (= Goal 68:s communication_events, per kund): datum · titel (Bokningsbekräftelse/Påminnelse/erbjudande) · kanalchip (E-POST/PUSH/SMS) · status LEVERERAD ✓ (grön) / SKICKAD (grå) / MISSLYCKAD ✗ (röd + "Skicka igen"). Tomt läge: "Inga utskick — kunden nås manuellt." Ägaren ser SANN status — visa bara vad ledgern bevisar (DoD #9).
9. Marknadsföring-rad i Konto & kommunikation: samtyckesstatus JA — SAMTYCKE / NEJ (kanalpolicyn skiljer transaktionellt från marknadsföring — DoD #8).
10. manual_attention-ytan: kund utan digitala kanaler får gul varningsrad "⚠ Inga digitala kanaler — påminnelser hanteras manuellt" på kortet (och ska räknas in i Översiktens Kräver uppmärksamhet när policyn är live).

## Koppling till Goal 68 (framtidssäkring, inget låtsas-bygge)
- Konto-statusen (gäst/inbjuden/aktiv) är frisörens verktyg att hjälpa kunden igång med portalen (lojalitetspoäng, historik, ombokning på mina.corevo.se): Gäst → "Bjud in" skickar aktiveringslänk (token-flow U5), Inbjuden → "Skicka länk igen".
- En kund = EN identitet (goal-41 dedup): listan visar aldrig merge-tombstones (`merged_into is null`), historik/poäng summeras över merge-kedjan.
- Export i ⋯-menyn = härledbart underlag (Goal 68 DoD #9). GDPR-radering via befintlig erase-path.

## Snabbvägar in till en kund
- Ctrl K-sök (global) → kund → kortet.
- Kalendern: klick på bokning → bubbla → Öppna → "Profil →".
- Översikten: klick på rad i Kommande idag (bygga: länka till kundkortet).

## PWA / responsivt
- **≥1200**: lista + kort sida vid sida.
- **iPad**: samma, lista 320px.
- **Mobil/PWA**: listan är sidan; kundkortet öppnas som egen vy med ←-tillbaka (eller bottom sheet för snabbtitt). Sök överst, `+ Ny kund` = FAB. ✆ Ring använder `tel:`-länk direkt. Touch ≥44px, safe-areas.

## Tokens
Samma som Översikt/Kalender v2: bg `#121210` · yta `#1C1C18`/`#25251F`/`#2E2E28` · linje `#33332C`/`#4A4A41` · text `#F0F0EA`/`#C8C8BD`/`#96968C` · grön `#2F5F47` · ok `#8FD6A6` · warn `#D6AC6A` · röd `#D68F85`. Frisörfärger: Hilal `#8FB4E3`, John `#8FD6A6`, Ali `#5FC7B2`, Aziz `#C0A5F0`. Typ: Instrument Sans + IBM Plex Mono. Radie: kort 16, knappar 10, chips 999.
