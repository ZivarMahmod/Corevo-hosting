# Corevo Booking — Kund-sidan: prioriterad, källbelagd gap-/förbättringsanalys
*Datum: 2026-06-03 · Fokus: storefront · bokningsflöde · kundupplevelse/retention · salong + mobil-först + white-label, svensk marknad*

## TL;DR
- Corevos största orealiserade hävstänger är (1) att **VISA** socialt bevis (betyg/recensioner) direkt vid Boka-knappen — inte bara nudga ut till Google — och (2) att **trigga rebooking i checkout-ögonblicket**; båda bygger på funktioner ni redan har och är de billigaste vägarna till högre konvertering och retention.
- En viktig korrigering av gap-analysen: punkt 8 ("in-app rating FÖRST, route till Google vid högt betyg") är **review gating** — uttryckligen förbjudet av Google och olagligt enligt FTC:s regel som trädde i kraft 21 oktober 2024. Gör i stället en neutral feedback-loop som skickar **alla** kunder till Google.
- För svensk marknad är **Swish** den avgörande betalmetoden för deposition/no-show-skydd (91% av de svarande i Riksbankens undersökning har använt Swish senaste månaden) — kort-only deposit som hos Fresha/GlossGenius konverterar sämre i Sverige.

## Key Findings (prioriteringsöversikt)
**QUICK WINS:** Visa betyg vid CTA · Tap-to-call sticky · Rebook i checkout · Bekräfta längd+tid+pris före submit
**KONVERTERING:** Minimera fält steg 1 · Cart-recovery av avbrutna bokningar · Prestandabudget ≤2,5s LCP · Swish-deposit som no-show-skydd
**RETENTION:** Korrekt feedback-loop (ej gating) · Lojalitet bortom poäng · Personalisering via klientkort · Before/after-galleri · Väntelista

---

## Details

### QUICK WINS (hög effekt, låg insats)

**1. Visa betyg/recensioner på sidan + vid Boka-knappen.**
- *Forskningsfynd:* NN/g visar att tredjepartsrecensioner är ett av de starkaste trovärdighetssignalerna och att social proof påverkar beslut även hos användare som påstår att de inte bryr sig om andras åsikter ("another example of why we should base design decisions on what users do rather than what they say"). Northwestern University Spiegel Research Center/PowerReviews ("How Online Reviews Influence Sales", 2017): *"The purchase likelihood for a product with five reviews is 270% greater than the purchase likelihood of a product with no reviews"* — och upp till +380% för högre-prissatta varor. Rework (salongspecifikt) säger uttryckligen: *"Review snippets ('4.9 stars, 280 reviews on Google'), before-and-after photos, and staff photos visible at the booking stage reduce abandonment from hesitant new clients."*
- *Mappning till Corevo:* Ni nudgar redan ut till Google efter completed booking men visar inte 4.9★/137 på storefronten. Beviset finns — det visas bara inte där beslutet tas.
- *Minsta rimliga implementation:* Hämta Google-rating via Places API (cacha dygnsvis i Workers KV) och rendera ett statiskt betygsmärke i hero + intill primär Boka-CTA + i bokningssteget. Lägg personalfoto + ev. before/after intill stylist-valet.

**2. Klicka-för-att-ringa i sticky nav (mobil).**
- *Forskningsfynd:* Google: 70% av mobilsökare har använt click-to-call. För lokala tjänster konverterar telefonleads ofta 3–10x bättre än formulär. Best practice: sticky knapp i header/footer på mobil med `tel:`-länk i internationellt format och åtgärdsinriktad text.
- *Mappning till Corevo:* Mobil-först redan på plats (44px touch). Saknas: prominent tap-to-call.
- *Minsta rimliga implementation:* `<a href="tel:+46...">` i sticky bottom-nav, **endast mobil** (frustrera ej desktop), spåra som konvertering i analytics. Visa bredvid Boka-CTA, inte i stället för.

**3. Rebook vid checkout — den starkaste retention-spaken.**
- *Forskningsfynd:* Boulevard (25M+ bokningar): förstagångskunder som bokar online återkommer ~78% mot ~39% för walk-ins. Branschsnitt för rebooking ~40–45%, toppsalonger 69–80%+ (Kitomba/Lockhart-Meyer). Simple Salon: kunder som rebookar inom 24h vid checkout har mätbart högre långsiktig retention. Rework: *"'Would you like to book your next appointment now?' outperforms 'Let us know when you'd like to come back' by a 3:1 margin."*
- *Mappning till Corevo:* Ni HAR rebook-länk + favoriter + points ledger. Saknas: att TRIGGA den i rätt ögonblick.
- *Minsta rimliga implementation:* Direkt på bekräftelsesidan (och i bekräftelsemejlet): "Boka din nästa tid nu" med förifylld stylist/tjänst och föreslagen intervall (t.ex. "din färg brukar behöva fräschas upp om 8 veckor — vill du lägga samma tid?"). Bygg på befintlig rebook-länk + favoriter.

**4. Bekräfta längd + lokal tid + pris före submit.**
- *Forskningsfynd:* Baymards checkout-studie (2024): 48% av användare anger *"extra costs like shipping, taxes, and fees that weren't visible earlier"* som avhoppsorsak — den enskilt största och mest åtgärdbara. Pristransparens är "non-negotiable". Voady bygger hela sitt värdeerbjudande på att tid+pris stämmer ("rätt bokning"). NN/g: upfront disclosure (tid, pris, ev. avgifter) är en kärntrovärdighetsfaktor.
- *Mappning till Corevo:* Realtids-tillgänglighet finns. Saknas: tydlig sammanfattning av total tid + exakt klockslag + pris i sista steget före submit.
- *Minsta rimliga implementation:* Sammanfattnings-block i bottom-sheet före submit: tjänst, total längd, datum + klockslag (lokal tid), pris, stylist. Eliminerar avhopp + supportärenden.

### KONVERTERING

**5. Minimera fält i första steget.**
- *Forskningsfynd:* Baymard: *"Completion rates drop 4-6% for every field beyond the eighth"*; optimal checkout är 7–8 formulärfält (snittet i Baymards benchmark-databas är 23,48 formulärelement, 14,88 om endast formulärfält räknas). Rework salongspecifikt: *"Each additional required form field in a booking flow reduces completion rates by 3-5%."* Mobil värst — 73% av beauty-bokningstrafik är mobil. Baymard: tvångsregistrering är näst största avhoppsorsaken (26%).
- *Mappning till Corevo:* Gäst-bokning finns redan (ingen tvångsregistrering). Wizard V3 + fast V4 finns.
- *Minsta rimliga implementation:* Steg 1 = bara namn (ETT fält, ej för-/efternamn separat) + mobilnummer. E-post/notiser efteråt. Single-column, inline-validering, auto-format på telefonnummer. Erbjud kontoskapande EFTER bokning, inte före.

**6. Återhämtning av avbrutna bokningar (cart recovery).**
- *Forskningsfynd:* Baymard: ~70% cart-abandonment. Rework: retargeting-mejl på påbörjade-men-ej-slutförda bokningar återvinner typiskt 15–20%. Shyft: första recovery-meddelandet inom 60 min ger upp till 40% högre konvertering. Zoca lyfter att de flesta bokningsplattformar saknar denna data helt — en konkret edge.
- *Mappning till Corevo:* Ni äger flödet in-page (ingen utkastning) → ni KAN fånga abandonment-data som Voady/Wavy (externa portaler) inte ser lika lätt.
- *Minsta rimliga implementation:* Logga påbörjad bokning (vald tjänst + tid) när mobilnummer/e-post angetts; om ej slutförd inom X min, skicka ett mejl/SMS: "Du var nästan klar — din tid [X] hålls i N min." Workers + KV/D1 räcker.

**7. Prestandabudget ≤2,5s LCP mobil.**
- *Forskningsfynd:* web.dev: LCP-mål ≤2,5s, INP ≤200ms, CLS ≤0,1 vid 75:e percentilen. Google: bounce-sannolikhet ökar 32% när laddtid går 1→3s, 90% vid 5s. Endast ~48% av mobilsajter klarar alla Core Web Vitals (2024) — en konkurrensfördel. CrUX-fall: Renault −14% bounce/+13% konv. vid 1s snabbare LCP.
- *Mappning till Corevo:* Cloudflare Workers/OpenNext = redan snabb stack och edge-cache. Bilder i R2.
- *Minsta rimliga implementation:* Sätt budget: LCP ≤2,5s, INP ≤200ms, CLS ≤0,1. Servera R2-hero som AVIF/WebP med `fetchpriority="high"` + explicit width/height (mot CLS); preconnecta booking-API; lazy-load icke-kritiskt. Övervaka CrUX i Search Console månadsvis.

**8. Betalning/prepayment som konverteringspunkt (svensk vinkel).**
- *Forskningsfynd:* GlossGenius: ~40% av kunder bokar långa tider och avbokar sent → deposit/card-on-file som no-show-skydd. Fresha ramar prepay som **valfri** "payment policy" (deposit ELLER lagrat kort) på service-nivå — alltså inte tvång som dödar completion. Men: kort-only deposit passar dåligt i Sverige — Riksbankens Betalningsrapport 2026 (Svenska folkets betalningsvanor): *"91 procent av de svarande [har] använt Swish den senaste månaden, vilket är en ökning från 82 procent 2023"* (att jämföra med 85% som betalat med fysiskt debetkort). Swish är ett av de två vanligaste betalsätten vid internetköp, ger realtidsavveckling och lägre avgift än kort.
- *Mappning till Corevo:* Payment-modulen är en separat parkerad modul — här bara konverteringsvinkeln.
- *Minsta rimliga implementation:* När payment-modulen byggs: gör deposit/prepay **VALFRITT per tjänst** (default av; aktivera för högvärda/nya kunder/högtryckstider) precis som Fresha/GlossGenius. Prioritera **Swish** som depositionsmetod i Sverige före kort. Visa depositionsbeloppet tydligt i sammanfattningssteget (punkt 4) så det inte blir "sticker shock".

### RETENTION

**9. Post-visit-uppföljning — KORREKT feedback-loop (kritisk korrigering).**
- *Forskningsfynd:* Gap-analysens "in-app rating FÖRST, route till Google vid högt betyg" är **review gating**. FTC:s "Trade Regulation Rule on the Use of Consumer Reviews and Testimonials" (16 CFR Part 465), i kraft 21 oktober 2024, medger *"civil penalties of up to $51,744 per violation"* och förbjuder uttryckligen att *"selectively display only positive reviews while suppressing or removing negative ones"*. Google förbjuder också gating (risk för ranking-straff/profil-suspension). TrueReview (salongspecifikt): de två högkonverterande recensionsfönstren är "spegelögonblicket" (när caped tas av) och nästa-dags-SMS; SMS slår e-post kraftigt.
- *Mappning till Corevo:* Ni har redan Google-review-nudge efter completed booking + mejl-infrastruktur.
- *Minsta rimliga implementation:* Skicka **ALLA** kunder till Google (neutral formulering, inom 24h, helst SMS + direktlänk). Vill ni fånga privat feedback: erbjud den PARALLELLT (alla kan alltid också lämna publik recension) — inte som filter. Be om specifik tjänst i texten (SEO-guld för local ranking).

**10. Lojalitet bortom poäng — perks.**
- *Forskningsfynd:* Återkommande kunder spenderar ~67% mer (BIA Advisory; Bains data visar 67% högre spend i månad 31–36 vs 0–6). 81% av salongs-/spa-gäster säger att känslan av att bli igenkänd håller dem lojala (Zenoti). Aktiva lojalitetsmedlemmar spenderar 3,1x mer än icke-redeemers.
- *Mappning till Corevo:* Points ledger + favoriter finns redan som grund.
- *Minsta rimliga implementation:* Lägg minst en icke-monetär perk ovanpå poängen: prioriterad bokning (tidig access till nya tider), gratis add-on vid N:e besöket, eller exklusiv access. Trigga via befintlig ledger.

**11. Personalisering via klientkort/preferenser.**
- *Forskningsfynd:* Simple Salon: en rebooking-prompt grundad på faktisk historik ("din färg brukar behöva fräschas om 8 veckor") slår en generisk prompt kraftigt. McKinsey/Segment: 76% av konsumenter säger personlig kommunikation påverkar varumärkesval. GlossGenius/Fresha lagrar preferenser, allergier, before/after i klientprofil.
- *Mappning till Corevo:* Favoriter + rebook-länk finns; klientdata finns delvis.
- *Minsta rimliga implementation:* Hälsa återkommande kund vid namn, förifyll senaste stylist/tjänst, och skicka maintenance-tips/rebook-fönster baserat på senaste tjänst. Bygg på favoriter + bokningshistorik.

**12. Before/after-galleri.**
- *Forskningsfynd:* Crazy Egg (via sammanställning): before/after-bilder kan höja konvertering med upp till 25%. Rework + TrueReview lyfter before/after specifikt för salong. NN/g: äkta, representativa bilder bygger trovärdighet bättre än stockfoto.
- *Mappning till Corevo:* Ni har redan ägar-uppladdade riktiga bilder i R2 + redaktionell storefront — unik fördel mot platta konkurrenter (Voady/Wavy).
- *Minsta rimliga implementation:* Lägg ett before/after-block (per stylist om möjligt) på storefront + intill stylist-val i bokningen. Återanvänd R2-pipeline.

**13. Väntelista — "meddela mig vid tidigare tid".**
- *Forskningsfynd:* Booksy/GlossGenius/Boulevard har alla väntelista: kund anmäler sig på fullbokad tid, får SMS när lucka öppnas (first-come, ej förbokat). Fyller avbokningsluckor + höjer upplevd service. Booksy: *"all clients from the Waitlist will receive a text message with a direct link... Available time slots are not pre-booked."*
- *Mappning till Corevo:* Realtids-tillgänglighet finns (vet exakt när lucka öppnas). Notisinfra (mejl) finns. Voady har redan väntelista — paritet behövs.
- *Minsta rimliga implementation:* "Meddela mig om en tidigare tid blir ledig"-knapp vid fullbokade dagar; vid avbokning trigga SMS/mejl till väntelistan med direktlänk (first-come, som Booksy).

## Recommendations (stegvis)

**Steg 1 (sprint 1, lägst insats/högst effekt):** Punkt 1 (betyg vid CTA), 2 (tap-to-call), 3 (rebook-trigger i checkout), 4 (sammanfattning före submit). Alla bygger på befintliga funktioner. **Tröskel som ändrar prioritet:** om Google-rating <4,3★ — fixa servicekvalitet/feedback-loop före du exponerar betyget brett.

**Steg 2 (konvertering + juridik):** Punkt 9 (korrigera feedback-loopen — gör **OMEDELBART**, juridisk risk via FTC + Google), 5 (fältminimering steg 1), 7 (prestandabudget). Mät completion-rate per steg före/efter.

**Steg 3 (när data finns):** Punkt 6 (cart-recovery — kräver abandonment-loggning), 13 (väntelista), 11 (personalisering), 12 (before/after-galleri), 10 (perks).

**Steg 4 (parkerad payment-modul):** Punkt 8 — bygg deposit/prepay som valfritt per tjänst, **Swish först**. **Tröskel:** aktivera no-show-deposit först om no-show-rate >10% på en tjänst (Booksy uppskattar ~10% avbokningar som branschnorm).

**KPI:er att spåra:** booking completion-rate (per steg), first→second retention (mål 60–70%+), rebooking-rate vid checkout (mål 60%+), LCP@p75 (<2,5s), recovery-rate på avbrutna bokningar (mål 15–20%).

## Caveats
- **Review gating (gap-punkt 8) måste ändras** — juridisk (FTC, upp till $51 744/överträdelse) + plattformsrisk (Google), inte bara best practice. Detta är den enda punkten med direkt risk om den lämnas orörd.
- Riksbankens siffra avser **"91 procent av de svarande"** i deras betalningsvaneundersökning — inte en folkräkning. Den är ändå den mest citerbara primärkällan för Swishs närmast universella penetration; Getswish-baserade användarsiffror (8,5–8,8M) kommer via sekundärkällor.
- Många enskilda konverteringssiffror (t.ex. "before/after +25%", "click-to-call 70%") kommer från sekundära/marknadsföringskällor. Baymard, NN/g, web.dev, FTC och Riksbanken är de mest robusta primärkällorna — behandla enskilda lyft-procent som riktning, inte garanti.
- Salongspecifika retentionssiffror (Boulevard 78% vs 39%, rebooking 69–80%) kommer från leverantörers egen data — konsekvent riktning men inte oberoende reviderad.
- Spiegel-siffran (+270%) avser e-handelsprodukter, inte bokningstjänster specifikt; mekanismen (recensioner sänker tvekan vid beslutspunkten) är dock direkt överförbar och bekräftas av salongspecifika källor (Rework).