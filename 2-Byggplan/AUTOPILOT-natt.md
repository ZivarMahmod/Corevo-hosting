# AUTOPILOT — nattkörning (autonomt till slutet)

Zivar sover. Kör vidare autonomt genom ALLA delar. Stanna bara vid en VERKLIG blockerare (säkerhet, datadestruktion, saknad secret, beslut bara Zivar kan ta). Lämna durabla commits hela vägen.

## Ordning
1. Slutför pågående FAS 3: de 13 kod-fixarna + diff-review + **Wire G** notiser (review-nudge + rebook + prefs).
2. Build + deploy + live-verifiera. Uppdatera HANDOFF.
3. SEN: **Design-implementering** (nästa stora steg, se nedan).
4. När allt är klart: uppdatera HANDOFF + skriv en "testa detta"-lista för Zivar.

## Design-implementering (efter Wire G)
Implementera Claude Design-handoffen i den riktiga Next.js-stacken. Källa: `kopia-till-design/` (DESIGN-BRIEF.md + design-referens) + själva handoff-bundlen Zivar lagt i projektet — **följ dess README: återskapa PIXEL-PERFEKT, kopiera inte prototypens interna struktur**.
- Kör som **workflow med agent-flotta** (samma sätt som FAS 1): en agent per yta, disjunkta filägor, frozen files solo, diff-review efter.
- Handoffen = **facit för utseendet**. FAS 1-bygget = grunden den kläs på. INTE två konkurrerande storefronts — ersätt/uppgradera den platta versionen.
- **5 storefront-stilar** (Atelier / Brass / Lera / Kontur / Blom) som riktiga tema-presets på tenant-kontraktet.
- **Bokning:** Variant 3 (steg-för-steg) som default + Variant 4 (kompakt) som snabbboka, **inbäddat in-page** (#11, bekräftelse i drawern — ingen router.push bort).
- **Två världar separerade** — storefront-CSS läcker aldrig in i back-office eller tvärtom. **Guld tenant-överstyrbart på storefront** (#12), fryst i back-office.
- **Foto-strategi:** starka default-bilder per stil + uppladdning i onboarding (annars blir storefronten tom som Studio Nord).
- **⭐ Ägaren byter sina bilder (lucka — design missade detta):** salong-admin → Varumärke MÅSTE låta ägaren ladda upp/byta storefront-bilderna (hero, galleri, team-foton), inte bara logga/färg/text. Bilderna sparas per tenant (R2) och syns direkt på storefronten via live-previewn. Utan detta står och faller hela storefronten.
- Back-office kläs i Corevo-look enligt handoffen.

## Vad som MÅSTE funka (Zivars krav — verkliga scenarier)
Det viktigaste: alla delar funkar på riktigt, och Zivar kan styra det mesta via **inställningar, inte kod**. Bygg funktioner som finns men kan slås på/av per salong (build-once / toggle — aldrig ny kod per kund). Målet är att minimera kodande efter lansering.

**Bokning (kärnan — verifiera hela kedjan live):**
- Bokar en kund en SPECIFIK frisör → bokningen hamnar i den frisörens schema, och salong-admin ser den. Testa att det stämmer hela vägen.
- Har salongen flera frisörer/ställen → kunden får först välja "var/vilken salong vill du boka på?" (som Voady/Zigges). Finns bara ett ställe → hoppa över valet.

**Google-recension:**
- Har salongen en Google-sida: review-nudgen efter besöket länkar till deras Google-review-URL. URL:en sätts i ett fält i admin — inte i kod.
- Saknar de Google-sida: enkelt för Zivar att lägga in/aktivera senare, utan kodändring.

**Nya salonger / onboarding (enkelt, utan kod):**
- Zivar ska kunna sätta upp en ny salong själv i plattform-admin, steg för steg.
- Domän: äger salongen en domän → koppla den. Äger de ingen → ett tydligt sätt för Zivar att ordna/köpa en åt dem. (Skarp custom-domän/DNS = gated, rör aldrig POS utan Zivars OK.)

**Inloggning (enkel + får aldrig brytas):**
- Både back-office- och kund-login ska vara enkla och stabila. Kundens login-sida: minimal och självklar.
- Inga trasiga flöden — verifiera login för alla roller + kund efter ändringar.

**Toggles per salong (utan kod — nyckeln):**
- Zivar slår på/av funktioner per salong från admin, utan att koda.
- Exempel: kund-konton + poäng/lojalitets-system. Vill en salong inte ha det → toggla av; funktionen finns kvar i koden men syns inte för den salongen.
- Allt konfigurerbart = en inställning (DB/toggle), aldrig en kodändring per kund.

**Verkliga scenarier att täcka (kör med i natt):**
1. **Lediga tider speglar verkligheten** — en frisörs frånvaro (sjuk/ledig) + stängda öppettider blockerar slots. Verifiera: en frånvarande frisörs tider går INTE att boka. Aldrig boka någon som är borta.
2. **Gäst hanterar sin bokning utan konto** — avboka/omboka via länk i bekräftelse-mejlet, eller "hitta min bokning" via telefon+kod. Alla skapar inte konto.
3. **Avboknings-fönster + länk** — avboka-knapp i bekräftelsen; per-salong-inställning för hur sent man får avboka (inställning, inte kod).
4. **Cookie-banner på storefront** — enkel EU-consent. Alla riktiga svenska salongssajter har det (lagkrav).
5. **SMS-notiser som AVSTÄNGD toggle (bygg uttaget nu, koppla leverantör sen)** — bygg krok + per-salong-toggle för SMS bekräftelse/påminnelse, men ingen leverantör inkopplad än. Zivar väljer leverantör + slår på senare utan omkodning. (Mejl-notiser finns redan.)

## Context — maxa ALDRIG
När din context blir hög (lite utrymme kvar): kör **`/compact`** för att frigöra plats, fortsätt sedan direkt. Komprimera i god tid så du kan jobba klart alla delar utan att slå i taket.

## Om du kör fast
Använd din advisor för svåra avvägningar och stress-test av egna slutsatser. Är det en VERKLIG blockerare (säkerhet / secret / Zivar-beslut / live-DNS / pengar) → stanna och vänta på Zivar. Annars: lös det och kör vidare.

## Guardrails (gäller hela natten)
- POS orörd (corevo.se apex/www/admin/superadmin/kiosk/dev). Bara booking/demo/tenant-hostar.
- Tenant-isolering + roll-medveten RLS — aldrig kringgå.
- Build-once, ASCII-byggväg (ö-buggen). En agent per revir.
- **Städa löpande:** klara goals/briefs → flytta till `2-Byggplan/goals/_klart/`. Ta bort tillfälliga filer när de gjort sitt. Mapparna ska alltid vara rena — pågående framme, klart undanstädat. Strukturen får inte växa igen.
- **Vänta inte på Zivar.** Du har hela konceptet — lös och bygg vidare. Stanna bara vid en verklig blockerare.
