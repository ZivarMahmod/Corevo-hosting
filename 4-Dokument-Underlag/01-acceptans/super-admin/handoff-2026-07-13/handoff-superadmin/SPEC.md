# SPEC — Corevo Superadmin (ny UX, bygger på verklig kod från ZivarMahmod/Corevo-hosting)

## Källa: verklig funktionalitet som SKA finnas (från repo-läsning)

### Nav idag (13 poster, sidopanel) → NY IA (toppnav, 5 destinationer)
1. **Översikt** (/)
2. **Kunder** — kundlista (f.d. /salonger) + kundkort + Ny kund (onboarding)
3. **Ekonomi** — Fakturering (flöde 2, manuellt underlag)
4. **Insyn** (undertabbar): Slutkunder (cross-tenant kundsök) · Personal (cross-tenant + bjud in) · Loggar (audit)
5. **Plattform** (undertabbar): Branscher · Integrationer · Domäner · Roller · Inställningar
Topbar höger: ⌘K-sök · + Ny kund · bell (inert m. dot) · tema-switch · Zivar-avatar (superbooking@corevo.se, logga ut)

### Översikt
- Health-pills ×4 (API-uptid/Workers/DB-pool/Köade SMS) — ÄRLIGT "— · ej kopplad"
- KPI ×4: Kunder (tot, X aktiva) · Aktiva · Bokningar {månad} + 12-mån sparkline · Underlag {månad} (flöde 2 · manuell fakturering)
- Tabell "Alla kunder" (Kund m. färgdot, Subdomän, Stad, Skapad, Bokningar, Status) → Hantera-länk
- "Senaste händelser" audit-feed (ikon per ton, action-label, tenant · Zivar, tid "idag 09:14")
- Accentkort "Premium utan kod" m. snabbknappar (Lösenordsreset → Slutkunder, Onboarda personal)

### Kundlista (f.d. Salonger)
- Sök (kund/ägare/subdomän) + filterpills Alla/Aktiv/Pausad/Onboarding + Kort/Lista-switch (persistent) + Exportera CSV (riktig) + Onboarda ny kund
- Kort: mark-avatar (färg), namn, slug.corevo.se, statusbadge, kebab→Ta bort (2-steg mjuk delete), KV Bokningar/Personal/Senast, chips: tema · variant · Nivå 1-3 (guld vid 3), knappar Öppna + Storefront↗
- Lista: tabell samma data

### KUNDKORT (kritiskt — får inte brytas)
Header: crumb (← Kunder / slug), mark, namn, statusbadge, meta (slug-länk, skapad), actions: Öppna storefront↗ · Lösenordsreset (kräver ägar-epost, annars ärlig varning) 
Flikar: Översikt · Tjänster · Kunder · Personal · [Kurser] · [Webshop] · [Blogg] · [Offerter] · [Bildbibliotek] · Sida · Integrationer · Drift (modulflikar BARA när modul på)
- **Översikt**: Launch-banner (redo/saknas: Tjänster/Personal/Öppettider → "aktivera i Drift"), stats ×4 (Bokningar, Genomförda m. %, Kunder, Personal), Onboarding-stege 6 steg (done/todo/locked: ✓ Klart / ● Att göra / 🔒 Spärrad), Snabbfakta (Bransch/Tema/Bokningsvariant/Moduler live x av y/Kontakt/Live-URL), Prismodell FLÖDE 2 (BillingForm: modell per_booking|flat_monthly, startavgift, avgift/bokning, fast/mån → Spara), Ägare (avatar, namn/"Företagsägare", Aktivt konto/Inbjuden, roll, e-post), Anpassningsnivå 1/2/3-kort
- **Tjänster**: grupperade tjänster (kategori), rad: namn, pris, längd, aktiv-toggle, redigera, ta bort; Lägg till tjänst; "ändringen slår igenom direkt på bokningen"
- **Kunder**: stats ×4 (Kunder/Med bokning/Återkommande/Nya denna månad), expanderbara rader (namn, Återkommande-badge, meta "X bokningar · Y genomförda · senast…", kontakt) → bokningshistorik-tabell (Datum/Tjänst/Personal/Status/Pris), förfrågningar, kontaktinfo
- **Personal**: rader (namn, titel, aktiv, bokningsbar, veckoschema), lägg till, ge inlogg; "öppettider härleds ur schemana"
- **Webshop**: produkter (namn, pris, lager, aktiv, bild) + ordrar (nr, kund, summa, status) + leveranssätt
- **Blogg**: inlägg (titel, status utkast/publicerad, datum) + skriv nytt + publicera/avpublicera
- **Offerter**: inkorg (ämne, kund, status Ny/Granskas/Offererad/Accepterad/Avböjd, anteckning, prisuppskattning)
- **Bildbibliotek**: grid + lagringsanvändning (X av 500 MB) + ladda upp
- **Sida (SidaStudio)**: sid-flikar = SIDANS struktur: Allmänt (Mall·färger·typsnitt) / Hem (Hero·bilder) / [Butik] / Tjänster / [Kurser/Blogg/Offert/Presentkort] / Om oss / Kontakt / Bokning (bokningssätt·tider·bilder). Höger: sticky live-preview (host + path, mall-badge, Ladda om, Öppna live↗, desktop/mobil). Flik-byte → preview hoppar till sidan. Allmänt: mallväljare (förhandsvisa≠publicera), Företagsnamn, Varumärke (färger+typsnitt, "syns direkt i previewen", live-dot), Sidfot-tagline. Hem: hero-eyebrow/rubrik/ingress, om-text-hem, hero-bilder, galleri. Tjänster: eyebrow/rubrik/intro + "själva tjänsterna redigeras i Tjänster-fliken". Om: om-rubrik/text/kursiv fras, om-bild, avslutningsbild, team (eyebrow/rubrik/ingress + riktig personal, foto+synlighet), avslutningssektion. Kontakt: rubriker, kontakt/adress/sociala medier, öppettider. Bokning: bokningssätt, tidväljare (kalender/lista), personal-avatarer (initialer/foto — foto låst tills profilbild finns). Fält: "Mallens text" som default + "Visa var"-flash-idé.
- **Integrationer**: Stripe Connect-kort (koppla konto/fortsätt onboarding/status charges/payouts/details + Betalning vid bokning-toggle, DIRECT charges till kundens konto), Google-recensioner (URL + spara), Zettle (Planerad), SMS 46elks (Plattformsbred), Domän-panel (slug.corevo.se aktiv + egen domän)
- **Drift**: Moduler-livscykel (av→utkast→live→pausad, aktivering super-admin-spärrad, per rad: namn+badge+key+aktiverad-datum+state-select+Spara / Aktivera-knapp om ingen rad), Kund-konton-toggle (settings.customer_accounts_enabled), Status & riskzon (Pausa kund/Aktivera igen + Ta bort = mjuk, 2-steg, build-once-never-delete), Audit-logg per kund

### Onboarding (Ny kund) — SKA kännas som samma app (ej egen värld)
Samma toppnav kvar. 3 faser/6 steg (StepRail): Grunden (1 Bransch req, 2 Namn & subdomän req → slug.corevo.se, 3 Temamall req — förvald av bransch) · Innehåll (4 Moduler — förvalda per bransch) · Klart (5 Ägare & inbjudan — magic-link, 6 Granska & lansera req). Steg-done-checkmarks härleds ur cfg. • = krävs. Höger: live-preview av vald mall. Lansera → pending-overlay "Lanserar… skapar tenant, moduler, ägar-konto, subdomän" → Resultat: grön banner "X är skapad", kort: Öppna & hantera kunden → kundkort · Publika adressen (RESERVERAD, kopplas separat) · Ägarens admin (booking.corevo.se magic-link) · Nästa steg-lista · Onboarda nästa kund
Bransch-presets: styr mall-förval, modul-förval, terminologi (Personal kallas "frisörer"/"florister")

### Fakturering: månadsnav (← juni | juli 2026 | aug →), tabell Kund(code slug)/Prismodell/Genomförda/Avgift/Underlag, totalrad, hint "startavgift faktureras separat". FLÖDE 2-förklaring.
### Slutkunder: stats (total/med konto/gäster/salonger), sök + salong-dropdown, tabell m. kund/salong/kontakt/bokningar, lösenordsreset per kund (kräver service-role), export
### Personal (plattform): sök + statuspills, tabell (namn, salong, titel, aktiv), Bjud in personal (drawer: salong + namn + e-post → magic-link)
### Loggar: health-pills, sök + aktörspills (Alla/Zivar/System/Kund), audit-rader (ton-ikon, label, entity · tenant, aktör, tid), Exportera logg CSV (filtrerat set), "audit_log · build-once-never-delete"-chip
### Branscher: kort per vertical (namn, X kunder, modul-chips m. state, default-mall, 'Personal kallas "frisörer"'), detalj = terminologi + modul-förval (KOPIA vid onboarding) + default-mall — redigerbart förslag
### Integrationer: grid (Stripe Connect X/Y anslutna + Aktiv-badge, Google recensioner X/Y, Domäner X/Y, SMS 46elks Plattformsbred utan badge, E-post/Resend Plattformsbred, Zettle Planerad), flow-chip per kort
### Domäner: "re-asserteras vid varje deploy — deploy kan aldrig ta ner kundsida", Fasta infra-hosts (corevo.se, booking.corevo.se, api.corevo.se · Infra·alltid), Kunddomäner (slug.corevo.se + namn + Hanteras·deploy / Cert väntar / Pausad)
### Roller: vänster rollista (badge vem + namn + antal användare, — där oseedat), höger valt-roll-kort + Behörighetsmatris (områden × Full/Egen/Läs/— cykla vid klick), super_admin LÅST m. shield, legend, dirty-savebar "N ändringar att spara · Återställ · Spara"
Områden: Kunder & bokningar · Tjänster & priser · Personal & scheman · Sidans innehåll · Moduler · Ekonomi/underlag · Loggar · Plattformsinställningar
### Inställningar: ärlighets-callout, Säkerhet: Audit-guard mot radering (Aktiv, låst toggle "Skyddat i koden"), Fakturering: Modell manuell flöde 2 (Aktiv-badge)

## MOCKDATA (kunder = de 12 riktiga mallarna)
kalla=Källa Hårspa (salong, Göteborg, FULL sample: ägare Maja Lindqvist maja@kallahar.se, tema kalla, moduler: booking live, shop live, blogg live, offert live, presentkort live, media live, lojalitet av, kurser av; bokningar 214/genomförda 187, personal 4, slutkunder 96, nivå 2, per_booking 12 kr, skapad 2 feb 2026)
snitt=Snitt Svart Studio (salong, Sthlm), siluett=Siluett (salong, Malmö, ONBOARDING), aurora=Aurora Blomsterstudio, calytrix=Calytrix, eloria=Eloria, onyx=Onyx (PAUSAD), blomstertorget=Blomstertorget, ateljevinter=Ateljé Vinter (ONBOARDING), sivsav=Siv & Säv, lunaria=Lunaria, solsalt=Sol & Salt (florister). Städer/ägare/siffror rimliga.
Källa tjänster (ur mallen): Ritualer: Källritualen 1 450 kr·90 min, Hårbotten-ritual 850 kr·45; Klipp: Klipp & form 745·60, Luggputs 195·15; Färg: Färgritual 1 895·150, Slingor 1 595·120; Vård: Olje-kur 495·30. Personal: Vera Holm (Grundare/terapeut), Ines Falk, Noor Sand, Alma Öst. Butik "Apoteket": Hårolja No 3 345 kr, Salt-spray 245, Träkam 195, Siden-scrunchie 145. Blogg "Anteckningar": 3 inlägg. Offert "Privat & grupp": Bröllopsmorgon/Möhippa/Företag-förfrågningar.
Preview i Sida-fliken: RIKTIG embed av "Källa - Hårspa.dc.html" via dc-import, skalad (desktop 1360px × scale, mobil 390px), klickbar.

## NY DESIGN
- Typ: Instrument Sans (UI+display) + IBM Plex Mono (num/kod). Aldrig Inter.
- Ljus: bg #F4F4F1, yta #FFFFFF, yta2 #EDEDE9, ink #17201C, ink2 #46524C, ink3 #79847E, linje #E3E3DD, linjeStark #CFCFC7
- Mörk: bg #101512, yta #171D19, yta2 #1E2621, ink #E8ECE8, ink2 #AEB8B1, ink3 #75807A, linje #262E29, linjeStark #333D37
- Accent (prop, kurerad): grön #1E7A5F (default) / bläckblå #33518F / grafit #4A5568. on-accent #fff. Tints via color-mix.
- Semantik: success #2E7D5B, warning #B0802B, danger #B3403C, info #3B6EA8 (+ -bg tints via color-mix)
- Radius 10/8/999. Skuggor mjuka låga. Fokus-ring 2px accent.
- CSS-vars i helmet (body + body[data-theme=dark]); ALLT annat inline.
- Toasts nere till höger. ⌘K-palett. Tema-switch persistent (localStorage corevoAdminTheme; theme läses i componentDidMount).
- Densitet: 13–14px UI-text, 24px sidtitlar, tabellrader 44px+.

## Bygghållpunkter
- En DC: "Corevo Superadmin.dc.html". Route i state (+ hash-sync). sc-if per sida, hint bara Översikt true.
- Logic: full data + handlers i första dc_write; template appendas sektionsvis.
- Props: accent (color, 3 kurerade), startRoute (enum).
- CSV-export: riktiga Blob-downloads. Ta bort/pausa: uppdaterar mockstate + toast + auditrad läggs till.
