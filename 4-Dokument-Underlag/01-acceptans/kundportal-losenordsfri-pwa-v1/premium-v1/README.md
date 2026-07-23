# Handoff: Corevo Kundportal — lösenordsfri PWA (designriktning v1)

> **Integrationsregel:** Detta paket styr den nya visuella premiumlooken.
> Funktioner, routes, säkerhet och kundsynlig copy styrs av
> `../00-VISUELL-KANON-PREMIUM.md`. Prototypens notifieringar, interna
> ombokning och lokala PIN-knappsats är demonstrationsinnehåll och ska inte
> implementeras.

## Overview
Slutkundens portal ("Mina sidor" / `mina.corevo.se`) i Corevo Booking — den white-label,
multi-tenant boknings-SaaS:en. Portalen är ett **vardagsverktyg** för salongskunder, inte en
marknadsföringssida: första skärmen visar omedelbart kundens nästa relevanta handling
(nästa bokning), med snabb väg till om-/avbokning, ny bokning, notiser, profil samt
lösenordsfri säkerhet (engångslänk + betrodd enhet/PIN) och PWA-installation.

Denna leverans är en **ny visuell riktning** — en varm, skandinavisk, diskret premiumkänsla —
som ersätter den tidigare mörkgröna kundportal-looken. Signaturelementet är
nästa-bokningens **datumlockup**: ett stort serifdatum i dämpad koppar på en grafitmörk yta.

## About the Design Files
Filerna i detta paket är **designreferenser skapade i HTML** — en klickbar prototyp som visar
avsedd look och interaktion, **inte produktionskod att kopiera rakt av**. Uppgiften är att
**återskapa designen i Corevo-projektets befintliga miljö** (Next.js / React, se
`5-Kod/apps/web` i repot `ZivarMahmod/Corevo-hosting`) med dess etablerade mönster, routing,
datalager, ikonbibliotek och PWA-arkitektur.

`Corevo Kundportal Premium.dc.html` är en Design Component (Corevo:s interna DC-format,
`x-dc` + inline-styles). Läs den som **spec**, inte som byggartefakt. All demo-data
(namn, tider, priser) är påhittad — koppla mot riktiga API-data och behåll befintliga
säkerhetsregler; låt alltid appens verkliga funktioner vinna över prototypens data.

> **Viktig regel från Zivar (paritet):** mobil = exakt desktop-funktioner, bara omplacerade.
> Design = exakt kopia av looken; döda ingen funktion. Ta inte bort, förenkla eller simulera
> bort någon befintlig funktionalitet.

## Fidelity
**Hi-fi.** Slutliga färger, typografi, spacing, radier och interaktioner är bestämda och ska
återskapas pixel-nära med kodbasens befintliga komponenter och tokens. Där prototypens data
är platshållare (bokningar, notiser) gäller riktiga data.

---

## Screens / Views

Portalen har **tre primära vyer** delade mellan mobil (bottennav) och desktop (vänsterspalt),
plus overlays (sheets/dialoger). Samma navigationsmål och samma innehåll på båda ytorna.

### 1. Översikt (`/` — start)
- **Syfte:** visa det viktigaste inför nästa besök direkt.
- **Layout mobil:** vertikal scroll under sticky topbar (wordmark + notis-ikon), fast bottendock.
  Ordning: hälsning → nästa-boknings-kort → "Vad vill du göra?" (2 action-kort) → install-kort.
- **Layout desktop (≥780px):** vänster sidebar (250px, grafit) + huvudyta. Två kolumner:
  `minmax(0,1.3fr)` bokningshero + `minmax(280px,.7fr)` genvägar/install.
- **Komponenter:**
  - **Hälsning:** eyebrow (dagens datum, koppar, versalt) + serif H1 ("God morgon, Elin." / "Hej, Elin.") + intro (muted).
  - **Nästa bokning (signaturkort):** grafitmörk yta (`--ink`), radialglow uppe till höger.
    Datumlockup = serifsiffra (mobil 66px, desktop 78px, `--copper-lt`) | vertikal linje |
    veckodag + tid. Streckad avdelare, sedan behandling + "Med Sofia Lind · 90 minuter".
    Statuschip "Bekräftad" (salvia). Mobil har biljett-perforering (två cream-cirklar i kanterna);
    desktop har koncentriska ringar nere till höger. Knappar: "Visa bokning" (koppar-fylld) +
    "Omboka" (outline på mörk).
  - **Tomvy (om ingen bokning):** cream-kort, serif "Ingen tid inbokad" + "Boka en tid"-knapp.
    Styrs av `harBokning`. **Ingen tom stor kortyta** — visa handlingsbar tomvy.
  - **Action-kort (mobil):** 2 st, "Boka ny tid" + "Betrodd enhet", copper-soft ikonruta.
  - **Genvägar (desktop):** samma två som horisontella kort.
  - **Install-kort:** visas endast när relevant (`visaInstall`). Mobil: mörkt kort. Desktop: sandfärgat.

### 2. Mina bokningar / Bokningar
- **Syfte:** kommande och tidigare bokningar, separerade.
- **Layout:** rubrik + "Kommande" lista + "Historik/Tidigare" lista (senare med `opacity:.72`).
- **Rader:** mini-datum (dag serif + månad), titel, undertext (tid · frisör · salong), status/chevron.
  Kommande #1 har statuschip "Bekräftad". Rad = klickbar (öppnar detaljer på mobil, toast/detalj desktop).
  **Krav:** tangentbordsnavigerbara rader; svensk locale + faktisk tidszon för datum/tid;
  bevara pagination/infinite-load om det finns; status som **både text och färg**.

### 3. Profil & säkerhet
- **Syfte:** konto, kontakt, notisinställningar, lösenordsfri säkerhet.
- **Komponenter:** profil-hero (grafit, avatar-initialer i koppar) → "Inställningar"
  (Kontaktuppgifter, Notifieringar, Betrodd enhet & PIN — sistnämnd med grön "Aktiv"-status) →
  **säkerhetsnotis** (salvia-kort: "Lösenordsfri och säker — engångslänk, PIN lämnar aldrig enheten") →
  "Corevo" (Installera appen, Logga ut i danger-färg).

### Overlays
- **Bokningsdetaljer** (mobil bottom-sheet / desktop trigga detalj): datum-hero, 2×2 detaljrutor
  (Behandling, Frisör, Salong, Pris), "karta"-knapp, "Lägg i kalender" + "Omboka".
- **Notifieringar** (mobil sheet / desktop centrerad dialog): rader med oläst-prick (koppar) →
  läst (linje). "Markera alla som lästa" nollar oläst-räknaren i topbaren. Oläst/läst tydligt.
- **PIN / betrodd enhet:** 4 prickar + numeriskt tangentbord (serifsiffror), Rensa/Radera.
  Fylls 1–4; vid 4 verifieras (stäng + toast). **Prototypens knappsats är endast visuell riktning** —
  använd befintlig säkerhetsimpl., systemtangentbord/autofyll, maskerad PIN, aldrig i klartext,
  aldrig i localStorage/loggar/analytics. Hantera fel-PIN, spärr/timeout, glömd PIN, återkallad enhet, offline.
- **Omboka / Ny bokning** (mobil sheets): tjänsteval (selected = koppar-ram + inner-shadow) +
  tidrutnät (selected = grafit-fylld). Bekräfta → toast.
- **Toast:** grafit-pill uppe, salvia check-ikon, auto-hide ~2.4s, `aria-live="polite"`.

---

## Interactions & Behavior
- **Navigation:** mobil fast bottennav (3 mål) med `aria-current="page"` och koppar-indikator;
  desktop vänsterspalt med samma mål + aktiv bakgrund. Bevara bakåtknapp, deep links, routing.
- **Notiser:** ikon i topbar med oläst-räknare (badge desktop / prick mobil).
- **Animationer** (respektera `prefers-reduced-motion`):
  - Sidbyte: `cpPage` fade+translateY(8px) ~0.3–0.35s.
  - Bottom-sheet: `cpSheet` translateY(100%→0) 0.4s `cubic-bezier(.22,1,.36,1)`.
  - Dialog: `cpDialog` fade+scale 0.28s. Overlay-backdrop: `cpFade` 0.2–0.25s.
  - Toast: `cpToast` fade+translateY 0.35s.
- **Stäng:** klick på backdrop + `Escape`. Korrekt dialogfokus, fokusfälla, fokusåterställning.

## State Management
- `tab`: 'oversikt' | 'bokningar' | 'profil' (delad mellan ytor).
- `mSheet`: null | detaljer | notiser | pin | install | omboka | nyboka (mobil).
- `dSheet`: null | notiser | pin (desktop).
- `pin` (0–4), `pinSurf` ('m'|'d'), `read` (notiser lästa), `selService`/`selOmboka`/`selNyboka`, `toastMsg`/`toastSurf`.
- **Datakrav:** nästa bokning, lista kommande/tidigare, kundprofil, notiser (läst-status),
  auth/magic-link, betrodd-enhet/PIN-status. Behåll tom-/laddnings-/fel-/offline-/inloggnings-/utloggningstillstånd.

## Design Tokens
```
--ink        #191a17   (grafit, identitet / mörka ytor)
--ink2       #25261f   (mörkt sekundärt)
--paper      #f3efe6   (varm benvit bakgrund)
--card       #fffdf8   (kortyta)
--card2      #faf7f0   (input/sekundär yta)
--tx         #20211d   (brödtext)
--muted      #74736b   (dämpad text)
--muted2     #99968d   (extra dämpad / tidsstämpel)
--line       #ddd7ca   (linjer/kanter)
--line2      #cbbca9   (starkare kant)
--copper     #a97141   (accent — text/aktiv, sparsamt)
--copper-lt  #deb68d   (koppar på mörk yta, datumlockup)
--copper-soft#ead5bf   (ljus kopparruta bakom ikoner)
--sage       #466a57   (status "bekräftad/aktiv")
--sage-lt    #dce9e0   (salvia säkerhetsnotis-yta)
--danger     #9d4a42   (logga ut / avboka)

Radier:   kort 19–26px · sheets 28px topp · pill 999px · ikonruta 12–14px
Skuggor:  0 18–20px 50–55px rgba(24,22,16,.12–.22)   (mjuka, återhållsamma)
Ease:     cubic-bezier(.22,1,.36,1)
Tryckyta: min 44×44px · safe-area-inset topp/botten på mobil
Brytpunkt: ~780px (bottennav → vänsterspalt)
```

## Typography
- **Serif — Spectral** (Google Fonts, vikt 500): ENBART stora rubriker + datumlockup.
  H1 mobil ~40px / desktop ~46px, letter-spacing −.035em. Datumsiffra 66–78px, −.05em.
  Prototypens systemreferens: Iowan Old Style / Baskerville — matcha en varm old-style-serif i kodbasen.
- **Sans — Instrument Sans** (Corevo:s befintliga sans): all funktionell text, 400/500/600/700.
  Eyebrows/kickers: ~10–11px, vikt 700, letter-spacing .12–.14em, versalt, färg `--copper`.
- Använd projektets befintliga typvariabler om de finns; annars lägg till dessa två familjer.

## PWA
Bevara/verifiera manifest (192/512 + maskable), `display`/`start_url`/`scope`/`theme_color`
(`#191a17`)/`background_color`, SW-registrering + uppdateringsnotis, offline-fallback utan att
cacha privat kunddata osäkert, faktisk `beforeinstallprompt` där den stöds + iOS "Lägg till på
hemskärmen"-instruktion, dold install-CTA när appen körs standalone/ej kan installeras.
Cacha ALDRIG PIN, magic links, access tokens eller känsliga profilsvar i runtime-cache.

## Accessibility (WCAG 2.2 AA)
Semantiska landmärken + rubrikordning, synlig fokusmarkering, full tangentbordsnav, korrekt
dialogfokus/fokusfälla, Escape stänger, `aria-live` för bekräftelser/fel, färg aldrig enda
statusbärare, kontrast ≥4.5:1, `prefers-reduced-motion`, riktiga labels + `aria-describedby` för fel.

## Assets
Inga bildassets — alla ikoner är inline-SVG (1.8px stroke, round caps/joins: hem, kalender, user,
bell, chevron, close, edit, plus, shield/lock, download, pin, map, scissors, mail, check, clock).
Byt mot kodbasens befintliga ikonbibliotek. Logotyp = "C" i serif (grafit cirkel / koppar på mörk).

## Files
- `Corevo Kundportal Premium.dc.html` — huvudprototyp (mobil + desktop, alla vyer, sheets, PIN, toast).
- `corevo-kundportal-mobile-premium.html` — fristående mobil-referens (öppnas direkt i webbläsare).
- `corevo-kundportal-prototyp.html` — fristående responsiv referens (mobil + desktop).
- `corevo-claude-design-prompt.md` — fullständig produkt-/design-/PWA-/a11y-spec (facit).
