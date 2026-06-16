# Agenda — efter Sajtbyggaren (modul-djup + anpassning)

> Fångat 2026-06-16 ur Zivars kravbild (tänkte högt). Detta är **EFTER S0–S5**
> (sajtbyggaren = utseende + placering). Här blir varje modul *verkligt
> funktionell* + per-kund/bransch-anpassning. Inget byggs förrän sajtbyggar-grunden
> står — MEN en sak (override-kaskaden) måste **designas in i S1 redan nu** (se ⚠️).

## Vad som ska finnas (Zivars punkter — fångade)
1. **Kund-admin — samma djup-genomgång.** Efter sajtbyggaren: gå igenom kundens admin (salong-admin) modul för modul så varje yta funkar på riktigt, inte bara finns.
2. **Storefront — funktions-genomgång.** Den publika sajten: varje modul GÖR det den ska, end-to-end (boka, shop, offert, blogg, lojalitet, presentkort).
3. **Webshop-betalning.** Kunden tar betalt via sitt **befintliga betalsätt** ELLER får **Stripe** av Zivar. Rail-agnostisk adapter. (Betal-rails pausade idag → av-pausas här.)
4. **Bokning per bransch.** Den universella bokningen ska smälta in i hur branschen funkar (mekaniker ≠ florist ≠ restaurang). → Reko nedan.
5. **Override per kund + bransch-promotion.** Ändra EN kunds sida/bild av mallen, märkt med **badge "modifierad (ej standard)"**, bara för den kunden. När många i branschen vill samma → lyft till hela branschen. → Reko nedan.
6. **"Det kommer finnas massa sådana saker."** — fler per-bransch-varianter dyker upp löpande. Modellen nedan ska tåla det utan ny kod varje gång.
7. **Mail-mallar (notiser).** Idag går allt på mail. Salongen ska kunna **välja mail-mall** (bekräftelse, påminnelse, avbokning…) — anpassad per bransch + kund. → Reko nedan.
8. **Statistik.** Universal bas + Zivar togglar **på/av vad som visas** för salongen i deras admin (per bransch/kund) så det inte blir för mycket. Data: Cloudflare Analytics.
9. **Onboarding.** NU = **manuell/personlig** (Zivar tar kunderna själv — relationsbygget ÄR poängen). FRAMTID = self-serve: gå in på sajten → prenumerera → bygg sida → **12-mån kontrakt / 14 dgr uppsägning** → aktivera hemsidan → instruktion att peka domän mot subdomän.

## Reko (Nörden) — så jag skulle tänka

### Bokning per bransch = EN motor, "boknings-profil" per arketyp (inte N system)
Bygg **inte** ett bokningssystem per bransch. Bygg en motor med en **profil per arketyp/bransch**:
- **Ren config** (lätt, per vertical): termer (bord/stol/plats/tid), fält, regler. Mekaniker, frisör, nagel, klinik = SAMMA motor, olika config. Grunden finns: `verticals.rules.booking` (restaurang = `{object: table}`) + `terminology`.
- **Arketyp** (motor-läge): VAD man bokar — person (A) vs objekt/bord (B). Mer jobb, men byggs EN gång och återanvänds av alla brancher i samma arketyp.
- **Ny arketyp** = riktigt bygge (sällan). Florist: bokar hen konsultation? → arketyp A. Säljer mest? → shop-modulen, inte bokning.
→ Matchar din "branch = config"-princip. **Din instinkt stämmer**; ramen är "profil per arketyp", inte "ett system per bransch". Det gör att en ny bransch oftast = config, inte kod.

### Override = 3-nivå-kaskad + härkomst-badge + promote
- **Universal → Bransch → Kund.** En kunds sida ärver branschens default, som ärver universal. Ändrar du bara för kunden = en **override** ovanpå — universal/bransch orörda.
- **Badge/härkomst:** varje sektion/fält vet om den är `standard` eller `modifierad (kund)`. Badgen visar det direkt → du ser vad som är pillat på, och att det gjordes med kunden.
- **Promote:** ser du att många i en bransch vill samma → lyft kund-overriden till **bransch-nivå** → blir standard för branschen, badgen släcks.
- ⚠️ **Måste designas in i S1:s datamodell** (mall/layout per tenant), inte bolt:as på sen. Retrofitta en kaskad efteråt = dyrt. Lägg in det som hård design-regel när S1 skrivs.

### Mail-mallar = samma kaskad + branschens ord
- Sändningen funkar **redan** (one.com SMTP live). Det här är **mallväljar-lagret ovanpå** — inte ny plumbing.
- Bygg som **samma override-kaskad**: universal-mall → bransch-variant → kund väljer/ändrar (badge "modifierad").
- Mallarna använder **branschens terminologi automatiskt** (bord/stol/behandling) → mailet smälter in per bransch, precis som bokningen.
- Typer: bekräftelse, påminnelse, avbokning/ombokning (+ kvitto/presentkort senare). Variabler: kundnamn, tid, tjänst, salong, avboknings-länk.

### Tillväxt & onboarding
- **Statistik = samma toggle-mönster** (universal → av/på per bransch/kund). Data från Cloudflare Analytics.
- **Manuell onboarding nu = rätt.** Bygg INTE self-serve före du har kunder — personlig försäljning ger dig kunderna + lär dig vad de behöver. Self-serve byggs när det finns volym att automatisera.
- **Auto-domän/cert (framtid):** koden finns REDAN, dormant (goal-23 DomänPanel + CF for SaaS, bakom flagga `DOMAIN_PROVISIONING_ENABLED`). När budget finns = slå på + sätt secrets. Inget nybygge — det väntar. Tills dess: manuell Custom Domain i CF (bevisat funkar).
- **Övervakning** (enda riktiga drift-hålet): verify-script + schemalagt larm som pingar om prod krånglar.

## Sekvens
- **Sajtbyggaren S0–S5 FÖRST** (utseende + placering + redigering).
- **Sen denna agenda:** kund-admin-djup → storefront-funktion → bokning-per-bransch → betalningar.
- **Override-kaskaden:** DESIGNAS in i S1 nu, BYGGS ut här.

## Öppna frågor (beslutas när vi når hit — blockerar inte S0)
- Vilka brancher i v1 (utöver de 5 i DB)?
- Betal-rails: vilka "befintliga betalsätt" blir adapters (Swish? kassasystem-API? Stripe)?
- Promote-flödet: manuellt ("gör till bransch-standard"-knapp) eller föreslås automatiskt vid N kunder?

## Juridik — håll det litet (avgjort 2026-06-16, Zivar)
Inte ett eget spår. DB i Sverige (EU) = på rätt sida från start. Det enda som faktiskt gäller:
- **Radera en kund på begäran** — finns REDAN (erase/anonymisering i koden). Inget att bygga.
- **Kort integritets-text per salong** (vi sparar namn/mejl/telefon för bokning) — liten copy-grej.
- **Ångerknapp-lagen** = bara produkter/presentkort när de tar betalt → **parkerad** tills shoppen tar pengar.
Obs: bokningar lagrar namn/mejl/telefon = personuppgifter (litet, men det stämmer att vi "har" sånt). Inget mer än ovan behövs nu.
