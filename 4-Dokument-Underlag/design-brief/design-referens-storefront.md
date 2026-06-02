# Design-referens — storefront (kundens salongssida)

**Varför:** Code:s första demo-storefront var för platt (hero + 3 kort). Den ska byggas till en **redaktionell, påkostad salongssajt** — referens-nivån nedan. Agent A (M2 storefront) + 3-mallarna bygger till DENNA klass, inte enklare.

## 🎯 POSITIONERING (varför inbäddat + eget — driver alla designbeslut)
Corevo är INTE en marknadsplats/nätverk. Bokadirekt, Voady, Wavy drar in kunden i SITT nätverk — salongen blir en listning bland många. **Corevos målgrupp = salonger som INTE vill vara i ett nätverk.** De vill ha sitt EGNA verktyg, sin egen brand, sin egen domän — bokning på SIN sida, inte hos en plattform.

Konsekvenser för bygget:
- Bokningen MÅSTE vara inbäddad i salongens egen sida (eget brand/domän) — det är värdeerbjudandet, inte bara estetik.
- Ingen "Corevo"-branding påtvingad kunden (till skillnad från Voady-footern). Sidan är salongens, inte Corevos.
- Varje tenant är fristående och unik — inga nätverks-listningar, inga kopia-sidor.

## ⛔ TVÅ HELT SEPARATA CSS-VÄRLDAR — blanda ALDRIG ihop
Viktigaste regeln. Storefront och back-office delar INTE stil/tokens. Corevo-dashboard-looken (grön/guld) får ALDRIG läcka in i storefronten — då ser kundens sida ut som en admin-panel.
- **Storefront** (kundens sida: `demo.corevo.se`, `frisorN.corevo.se`) = PRODUKTEN, viktigast. Vacker salongssajt enligt referenserna. **Per-tenant tema** (salongens egen färg/logga/font) — INGEN Corevo-grön/guld här. Det är salongens identitet, inte Corevos.
- **Back-office** (`booking.corevo.se`: dashboard, admin, personal, platform) = också viktig, egen stil. Corevo-POS-look (skogsgrön + guld) i `design-system.md`. Ägaren jobbar här dagligen → ska vara riktigt bra. ALDRIG samma CSS som storefronten.
- **Båda ska vara snygga.** Storefronten är högsta prioritet (det säljs), men admin är inte en eftertanke — bara en annan stil-värld.

## Referenser (studera live)
- **Egna exempel (känsla/struktur):** https://zivarmahmod.github.io/Fris-ren/ ("Tofifi") + freshcut.se.
- **Bokningsflöde:** https://book.wavy.nu/ (rendera live med Playwright/Chrome — JS-app). Studera stegen, bygg minst lika rent.

## 🏆 RIBBAN — riktiga Linköpings-salonger (Zivars val, studera live)
Detta ÄR nivån. Riktiga, professionella svenska salongssajter — FreshCuts faktiska marknad/konkurrenter. Inte platt (Studio Nord), inte över-animerade Awwwards-konstverk. Elegant, foto-drivet, rent.

**Anchor-referenser (bygg i denna klass):**
- **Studio22** — studio22.se (full-bleed foto-hero, elegant display-logga, salvia-grön accent)
- **Studio Leander** — studioleander.se (team-foto-hero, centrerad serif-rubrik, lavendel-accent, Boka-pill)
- KREAteam — kreateamfrisor.se
- Salong Brännpunkt — salongbrannpunkt.se
- Hårfixarna — harfixarna.se
- Zigges Frisörer & Barberare — zigges.se (frisör + barberare, relevant för FreshCut)
- Mjärdevi Hårcenter — mjardeviharcenter.se

> Code: studera HELA setet live, extrahera det gemensamma vinnande mönstret, bygg till den nivån. Det finns gott om bra svenska salongssajter — det här är poolen att mäta mot.

**Gemensam DNA (bygg dessa):**
- **Full-bleed riktig fotografi i hero** (teamet eller salong-i-aktion), mörk overlay för läsbarhet. ← STÖRSTA gapet: Studio Nord saknar foto helt.
- Centrerad **serif-rubrik** ("Din frisör i Linköping"-stil) + kort välkomst + **"Boka tid"-pill** i salongens accentfärg.
- Elegant **script/display-logga** som wordmark.
- Nav-sektioner: Behandlingar · Bröllop/special · **Våra frisörer** (team m. foto) · **Portfolio/galleri** · Prislista · Om oss · Kontakt · Boka tid.
- Dämpad, sofistikerad accentfärg (varje salong sin egen — salvia, lavendel ...).
- Sektioner nedåt: tjänster, team-spotlights m. foto, inspirationsgalleri, prislista, om oss, kontakt + karta, Instagram/FB.

**Mått:** matcha eller slå dessa. De är ribban kunden jämför FreshCut mot.

## Vad som gör dem "maxade" (stjäl detta)
- **Full-bleed hero** med riktig foto/video + stor redaktionell typografi (inte liten hero + 3 kort).
- **Scroll-driven motion** — reveal-animationer, parallax, mjuka övergångar. Det är det som känns premium.
- **Stark art direction:** konsekvent palett, mycket whitespace, raffinerad serif+sans-parning.
- **Riktig fotografi** — frisörer, lokalen, före/efter. (Använd högkvalitativa platshållare tills tenanten laddar upp egna.)
- **Stylist-spotlights**, tjänstemeny med hantverkskänsla, omdömen/testimonials, Instagram-feed.
- **Sticky nav + tydlig Boka-knapp.** Mobil-först (60%+ av bokningar sker på mobil).

## Storefront-anatomi (bygg dessa sektioner)
1. **Topp-utility-bar:** liten rad, t.ex. "Drop in eller boka online".
2. **Sticky nav:** salongsnamn/logga · Tjänster · Om oss · Plats · prominent **Boka tid**-knapp. Mobil: hamburger-meny.
3. **HERO:** stor djärv rubrik (versal, serif — t.ex. "SKARPT KLIPPT. SKÖNT MOTTAGEN."), kort tagline, Boka-CTA, **bild-karusell** (3 bilder). Generös whitespace.
4. **Tjänster:** eyebrow-etikett "— Tjänster", rubrik, **numrerade tjänster (01–05)** med namn + kort beskrivning + pris. Elegant, inte tråkiga boxar. (Här kopplas riktiga tenant-tjänster in.)
5. **Italic-accentfraser** för värme ("*Varje stol är en stund för sig själv.*").
6. **Om salongen:** bild + copy + **stat-trio** (t.ex. "8+ år", "5★", "100% hantverk").
7. **Plats & öppettider:** adress + öppettider-tabell + **inbäddad karta** (OpenStreetMap).
8. **Avslutande CTA-sektion:** "Redo för en ny stil?" + Boka.
9. **Footer:** namn, tagline, plats, kontakt, Instagram, "Designad med omsorg".

## Kvalitetskrav
- Redaktionell magasinskänsla: stor whitespace, raffinerad typografi (Playfair-rubrik + Inter-brödtext), lugn rytm.
- Riktiga states + responsivt (mobil/iPad/desktop). Karusell, hover, mjuka övergångar.
- **3 temamallar = 3 DISTINKTA redaktionella stilar** på denna nivå — INTE 3 platta varianter. Bevisa att två tenants ser genuint olika ut.
- Per-tenant tema-kontrakt kvar (`--color-primary/-bg/-fg/-font-body`) så branding-editorn styr utseendet.

## Bokningsverktyget (Agent B) — INBÄDDAT, inte en extern portal

**⭐ KÄRNKRAV (Zivar):** hela bokningsverktyget ska ligga INNE i salongens egen sida. Tryck "Boka tid" → wizard öppnas DÄR, i storefrontens shell (samma nav, logga, färg, font). Kunden lämnar ALDRIG sidan, känner att hen bara är "inne i sidan". Ingen redirect till en separat portal.

**🟢 Voady = kvalitetsribban (det NICE exemplet):** bokning.voady.se/ziggesfrisorer (Zigges använder det — "av frisörer för frisörer"). Rent, branded (salongens logga genom HELA flödet), location-picker som fina kort, mycket whitespace, tydliga steg. Matcha denna kvalitet. ENDA bristen: Voady öppnar en SEPARAT flik/domän — det gör Corevo bättre genom att bädda in samma kvalitet IN-PAGE.

**🔴 Wavy = anti-mönstret (gör INTE såhär):** book.wavy.nu slänger ut kunden till en generisk, fattig extern portal (gråa staplar, tidsrutor, ingen salongs-känsla). Stegen okej, men exekveringen är allt vi inte vill vara.

**Bygg istället:**
- "Boka tid" öppnar bokningen in-page — inline-sektion, tab eller slide-ov