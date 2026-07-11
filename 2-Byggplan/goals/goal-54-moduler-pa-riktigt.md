# goal-54 — Moduler på riktigt: kundens verktyg + kundkortets kontroll + temats kärlek

> Zivars order 2026-07-11 (florist-dagen): "modulerna är för kunden att kunna arbeta där
> och lägga upp och ta bort saker — det är hela poängen. De ska vara kundens verktyg.
> Samtidigt som storefront behandlar dem som sin äkta kärlek." Allt nedan är hans
> punkter från dagens session, samlade som byggplan. Bakgrund: Hantverksfloristerna
> (florist.corevo.se) = pilotkund för hela modulkedjan.

## Princip (röd tråd)
En modul = TRE ytor som alltid hänger ihop:
1. **Kundens verktyg** (kund-admin, booking.corevo.se) — där ägaren lägger upp/tar bort/ändrar.
2. **Zivars kontroll** (super-admin **KUNDKORTET** `/salonger/[id]` — ALDRIG sidopanelen på
   superbooking) — samma yta, samma data, för att hjälpa kunden "som att jag är i deras
   inlogg men ändå inte". Gäller AUTOMATISKT för varje kund där modulen är på.
3. **Storefrontens kärlek** — varje TEMA väver in modulens sektioner i sitt eget formspråk
   (flora = facit: valv-kort "Ur butiken", blogg-kort, presentkort-rad), och varje modul
   har sin EGEN publika sida (/shop, /blogg, /offert, /presentkort) + plats i menyn.
   Aldrig generiska klisterlapps-sektioner staplade under layouten.

## KLART idag (v1.7.16–v1.7.20, prod-verifierat)
- [x] Flora-tema (bohemiskt, modulärt) + florist-bransch + florist.corevo.se med deras
      riktiga innehåll (texter/foton/priser). FreshCut orörd.
- [x] Modulernas egna sidor + modulstyrd nav (Butik/Blogg i menyn när modulen är på).
- [x] Startsidan: teasers/invävda sektioner istället för stapel; flora äger sina moduler.
- [x] Logik-städning florist: buketter = webshop (köps), kurser/konsultation = bokning
      (bokas), bröllop/begravning = offert. Ingen dubblett längre.
- [x] Offert: ämnes-chips ur modul-config (config.subjects — kund/bransch-styrt, aldrig
      hårdkodat). Florist: Bröllop/Begravning/Event & företag/Övrigt.
- [x] Bildbibliotek-utredning: media_assets ÄR enda bildkällan (shop/blogg väljer via
      ImagePicker, inga egna uploads). UI-fixar: picker säger "Bilderna kommer från ditt
      Bildbibliotek", "0 B"-death-metric dold.
- [x] Zivars arbets-inlogg i floristens admin: admin@florist.corevo.se / Florist123!

## ATT BYGGA (Zivars punkter, i ordning)

### 1. Kundkortet = modul-kontrollrummet (STÖRST, först)
För VARJE kund, för varje modul som är PÅ, får kundkortet `/salonger/[id]` en flik som är
samma verktyg som kundens egen admin:
- [ ] **Webshop-flik**: produkter (lägg till/ändra/ta bort, pris, lager, bild ur kundens
      bildbibliotek), ordrar. Återanvänd ShopAdmin (837 rader) + BloggAdmin (476) med
      tenantId-prop; actions refactoras från adminCtx → sidaCtx-mönstret (dual-guard i
      lib/platform/guard.ts — platform_admin väljer tenantId ur FormData, salon_admin
      tvingas ur JWT). Data-lagret tar redan tenantId.
- [ ] **Blogg-flik**: inlägg (skriv/publicera/avpublicera/ta bort, omslagsbild).
- [ ] **Offerter-flik**: inkomna förfrågningar (med ämne), status, svar/anteckning.
- [ ] **Bildbibliotek-flik**: kundens media_assets (ladda upp åt kunden).
- [ ] **Bokning/Kurser**: tjänste-fliken finns — komplettera med kurs-perspektivet (se §3).
- [ ] Flikarna visas ENDAST när modulen är på (samma modulstyrning som kund-admin-navet).
- [ ] Ersätt/pensionera gamla "Hjälp salongen"-knappen (stub som bara loggar).

### 2. Modulernas beteende per modul (genomgång "deras blogg är deras blogg")
- [ ] **Blogg**: inläggs-detaljsida på storefronten (/blogg/[slug] — idag visas bara
      listan, ingen läs-vy för hela inlägget) + publicerings-flöde i admin.
- [ ] **Webshop**: kategori/sortering när sortimentet växer; produktdetalj?; lager-logik
      (nu "Tillfälligt otillgänglig"-status — verifiera varför den visas trots stock>0).
- [ ] **Offert**: admin-vyn visar subject; svara-på-förfrågan-flöde (mejl?); ev. fler
      config-fält (datum för event, budget-spann) — config-first, aldrig if(bransch).
- [ ] **Presentkort**: köp-flödet är "öppnar snart" — koppla mot betal-rails när de öppnar.

### 3. KURSER som riktigt koncept (bokningsmodulen möter floristens flöde)
Deras kurser är EVENT med datum + platser (5–15 pers), inte löpande enmanstider:
- [ ] Utred minsta vägen: tjänst av typ "kurs/event" med fasta tillfällen (datum/tid,
      max platser, anmälningsavgift 150 kr) — var läggs tillfällen in i admin, hur bokar
      flera personer samma tillfälle, hur ser "Boka kurs" ut på storefronten.
- [ ] Tills det finns: kurserna ligger som bokningsbara tjänster (funkar, men 1 person/tid).
- [ ] Boka-sidans rubrik/terminologi per bransch ("Vad vill du ha?" → branschens ord).

### 4. Betalningar per kund (Stripe/Zettle i kundbilden)
- [ ] Integrationer-fliken i kundkortet: koppla KUNDENS Stripe/Zettle-konto →
      webshop-köp, presentkort och kursavgifter landar hos kunden, inte hos oss.

### 5. Tema × moduler (mall-fabriken fortsätter)
- [ ] Varje befintligt tema (salvia/leander/zigge/linnea/edit) får äga sina modul-
      sektioner som flora gör (invävda, inte stapel) — en i taget.
- [ ] Nya bransch-teman (FAS 4-batchen: noir/terra/pärla/smak/klara/verk/bris/atelje)
      byggs modul-medvetna från start.

### 6. Städskulder (från utredningarna)
- [ ] Branding/sajtbyggar-uploads skriver R2 MEN inte media_assets → osynligt tredje
      bildspår; migrera till media_assets med source-tagg.
- [ ] Kund-portal-spåret (konto/lojalitet/handla med poäng) — SIST, per Zivars order.

## Ordning
1 → 2+3 parallellt → 4 → 5 → 6. Kundkortet först: det låser upp "jag hjälper kunden
överallt" för allt som kommer efter.
