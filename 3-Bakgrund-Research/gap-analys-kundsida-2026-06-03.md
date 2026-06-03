# Gap/opportunity-analys — KUND-SIDAN (hemsida · bokning · kundupplevelse)
Datum: 2026-06-03 · Källa: research-runda (web) vägd mot Corevos faktiska bygge.

> Syfte: vad gör hemsida + bokningsflöde + kundupplevelse bäst-i-klass, så hela plattformen hänger ihop och konverterar. Bara det som passar salong + mobil-först + white-label.

## ✅ Det vi redan gör bra (behåll)
- **Redaktionell storefront** + 5 temalayouter + ägar-uppladdade riktiga bilder (R2) → slår platta konkurrenter.
- **Inbäddad in-page-bokning** (wizard V3 + snabb V4, mobil bottom-sheet) → ingen utkastning till extern portal (slår Voady/Wavy på just den punkten).
- **Realtids-tillgänglighet** (riktiga slots i wizarden) · **mobil-först** (44px touch) · **gäst-bokning** + gäst-avboka.
- **Lojalitet-grund** (ledger, favoriter, rebook-länk) · **Google-recensions-nudge** (efter completed) · **mejl-bekräftelse + påminnelse**.

## 🟢 SNABBA VINSTER (hög effekt, låg insats)
1. **Visa betyg/recensioner PÅ sidan + vid Boka-knappen.** Research: flytta bevis (betyg, before/after, personalfoto) intill första boknings-CTA → minskar tvekan exakt där beslutet tas. Vi *nudgar ut* till Google men *visar* inte 4.9★/137 på storefronten. → hämta + visa rating i hero + i bokningssteget.
2. **Klicka-för-att-ringa i sticky nav (mobil).** Research: prominent telefonnummer + tap-to-call höjer konvertering. FreshCut har tel (073-876 71 44) — lägg den klickbar i nav.
3. **Rebook vid checkout** — research: den STARKASTE retention-spaken. Erbjud nästa tid innan kunden går. Vi har rebook-länk, men trigga den i rätt ögonblick (personal föreslår vid utcheckning + kund får nudge).
4. **Bekräfta längd + lokal tid före submit** — otydlig tid = avhopp + supportärenden. Visa tjänstens duration + tz tydligt sista steget.

## 🔵 FLÖDE / KONVERTERING
5. **Minimera fält i första steget.** Varje extra fält −3–5% completion (mobil värst). Samla bara det nödvändiga för att boka, resten EFTER bekräftelse. → granska wizardens fält.
6. **Återhämtning av avbrutna bokningar.** ~70% cart-abandonment; retargeting-mejl till "påbörjad men ej slutförd" återvinner 15–20%. Vi har inget. Kopplar till övergiven-pending-frågan (WF-03 VÅG 2).
7. **Prestanda-budget <3s mobil.** 53% lämnar sidor som tar >3s. Vi kör Workers/OpenNext (snabbt) men sätt en budget + mät (LCP/TTFB) per tema.

## 🟣 KUNDUPPLEVELSE / RETENTION
8. **Post-visit-uppföljning** ("Hur gick det?" + feedback + subtil nästa-bokning). Vi har Google-nudge; bredda till tack + feedback-loop (in-app rating FÖRST, route till Google vid högt betyg).
9. **Lojalitet bortom poäng** — perks: prioriterad bokning, gratis add-on, exklusiv access. Vi bygger intjäning (0013); lägg redemption + perk-UX. (Lojala kunder spenderar ~67% mer än förstagångare.)
10. **Personalisering** — använd klientkort/preferenser (M5 finns) för att hälsa vid namn + maintenance-tips. Ytan finns, surfa den mot kunden.
11. **Before/after-galleri** — research lyfter just before/after för salong. Vi har galleri; rama in en before/after-sektion.
12. **Väntelista** — "meddela mig vid tidigare tid" fyller luckor + höjer upplevd service. (Finns även i admin-gap-listan.)

## Hur detta möter nuläget
- #6 (avbruten-bokning) hänger ihop med WF-03 VÅG 2 (pending-expiry) — bygg recovery ovanpå.
- #3/#8/#9 (rebook/post-visit/lojalitet) bygger på lojalitet-intjäningen (WF-03 VÅG 2) → naturlig fortsättning EFTER baseline.
- Resten = egna kund-sida-kort, planeras separat (inte in i WF-03).

## Källor
- [Online booking optimization — Rework](https://resources.rework.com/libraries/beauty-center-growth/online-booking-optimization) · [Booking landing pages 2026 — Unicorn Platform](https://unicornplatform.com/blog/best-booking-landing-page-examples-in-2026/) · [UX principles & conversion — UXmatters](https://www.uxmatters.com/mt/archives/2026/03/ux-design-principles-that-improve-conversion-rates.php)
- [High-converting local business website — Synup](https://www.synup.com/en/how-to/create-high-converting-local-business-website) · [Trust signals — Best Version Media](https://www.bestversionmedia.com/why-trust-signals-are-the-missing-link-on-most-local-business-websites/) · [Service business website design — Mobile Giant](https://www.mobilegiant.net/website-design-service-businesses/)
- [Salon retention — Meevo](https://www.meevo.com/blog/salon-spa-client-retention-tips/) · [Salon customer experience — Kitomba](https://www.kitomba.com/business-guides/salon-customer-experience/) · [Click to chair / client journey — Mya](https://joinmya.com/blog/from-click-to-chair-optimizing-the-client-journey-for-higher-retention-and-reviews)
- [Fresha vs Booksy UX — Goodcall](https://www.goodcall.com/appointment-scheduling-software/fresha-vs-booksy) · [Booking UI inspiration — Mobbin](https://mobbin.com/explore/mobile/flows/booking-reserving)
