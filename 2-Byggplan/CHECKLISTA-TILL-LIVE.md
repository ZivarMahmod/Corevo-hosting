# CHECKLISTA TILL LIVE — Corevo

> Din följbara väg från nuläge → allt på plats → publik launch → riktig kund #1.
> Härledd ur `ROADMAP.md` + oberoende kod-verifiering 2026-06-19. **Frisör = en bransch, aldrig projektet.**

---

## Sanningen om var du står (verifierat, inte påstått)

- **Skelettet är ÄKTA och LIVE.** `booking.corevo.se` (login funkar) + `corevo.se` (POS) svarar. Schema komplett, sajtbyggaren deployad, 5 ytor renderar. **Du är längre än det känns.**
- **Men onboarding funkar inte just nu** — en saknad secret dödar invite-mailet + 3 flöden till. Det är W0, det fixas först.
- **"Tusentals saker i sidorna" = två spår:** template-bron (W2) + moduler end-to-end (W3). Identifierat, inte mystiskt.
- **Betalning är ej kopplad** (Stripe = stubs) → blockerar webshop/presentkort/fakturering tills rail vald.

## Spelregeln (din egen)

**En sak → bevisa LIVE → nästa.** "Klart" = bevisat på riktig deploy, aldrig "kod committad".
Bygg mot **allt** — men bevisa varje våg med en **testsalong du äger**, aldrig blint. Riktig kund #1 = sista steget.

### ✅ Låsta beslut (2026-06-19)
- **Scope = maximalt** — alla moduler + flera branscher klara FÖRE kund #1.
- **Betal-rail = Stripe Connect** — ⚫ compliance-gate (SCA/3DS, dispute-webhooks, refund-paritet) före riktig charge.
- **Licens = behåll credit i footern** — alla ~102 CC-BY-mallar körbara NU med credit kvar (köp bort per mall senare). Mall-utrullning ej längre MIT-begränsad.
- **Tempo = allt bakom flagga, noll kund till slut** — bevisa varje våg på en staging-testtenant (ej publik, ej riktig kund) så vi aldrig bygger blint (06-15-lärdomen). Riktig kund #1 = steg #23.
- **Super-admin (superbooking.corevo.se)** löper genom HELA listan — det är din cockpit. Egen v2-design = steg #21 (goal-45, design-paket FÖRST).

Börja på **#1**.

---

## W0 · Lås grunden + bevisa att onboarding funkar alls
*NU, dagar. Utan detta kan INGEN kund in — inte ens en testkund.*

**1. Sätt `SUPABASE_SERVICE_ROLE_KEY` som worker-secret i prod** · _~10 min · goal-42 spår A_
→ Varför: utan den dör 4 flöden tyst — invite-mail, kund-signup, påminnelse-cron, GDPR-radering.
✓ Bevis: alla 4 svarar 200 (ej 500/no-op); ett riktigt invite-mail landar i en inkorg.

**2. Fixa orphan-salong-buggen** · _liten · `lib/platform/actions.ts:222_`
→ Varför: failar inbjudan mitt i skapandet blir en halv salong kvar i DB:n (ingen rollback idag).
✓ Bevis: provocera invite-fail → 0 spök-salonger kvar.

**3. Invite-/verifieringsmail med tenantens namn** · _liten_
→ Varför: idag Supabase-defaultmall — mailet säger "Corevo", inte salongens namn.
✓ Bevis: skapa testsalong → mail med rätt avsändare/namn → admin loggar in.

**4. Verifiera laglig ångerfunktion** · _verify, ev. liten fix · LAGKRAV fr 2026-06-19 (idag)_
→ Varför: kund måste kunna avboka själv utan att ringa. Flödet finns (`/avboka/[id]`) — bekräfta att knappen syns i /konto + bekräftelsemejl.
✓ Bevis: testkund avbokar själv hela vägen.

**5. Onboarda EN testsalong du själv äger — end-to-end från noll**
→ Varför: detta bevisar att maskinen tar en kund ALLS. Din testkund, inte din riktiga.
✓ Bevis: salong skapad → admin inloggad → storefront live → en testbokning genomförd.

---

## W1 · Beta av de öppna besluten
*1 pass. Blockerar allt nedan — utan dessa gissar vi.*

**6. Sätt ett beslutspass med mig → klubba ~15 öppna beslut**
→ Varför: betal-rail, licens, scope, booking-kapacitet (bord/slot), café-lojalitet m.m. styr allt i W2–W5.
✓ Bevis: besluten inskrivna i ROADMAP/canon (chatten glömmer). Jag har reko på de flesta — du klubbar.

---

## W2 · Template-bron — det stora spåret
*Det här är "sidorna" du känner saknas. Storefront är 5 hårdkodade layouter idag — gör om till riktiga mallar du väljer fritt. Design-känsligt (18h-fällan) → render-verify 0 FAIL + oberoende verify.*

**7. Wire:a skin-loadern → storefront läser DB-template-slots** · _`lib/storefront/skin/load-skin.ts` (ligger död)_
→ Varför: sektioner + ordning är låsta i kod idag; flytta dem till DB så du kan välja/ändra fritt.
✓ Bevis: en mall byter sektion via DB → syns live utan deploy.

**8. Ta bort `parseTheme`-allowlisten** · _`lib/tenant-data.ts:26`_
→ Varför: idag tystas okända teman ner till "leander" — DB-mallnycklar (restoran/foody…) får aldrig renderas.
✓ Bevis: en icke-frisör-mall renderar som sig själv, inte downgrade.

**9. Editorn skriver `content_slots` + funkar för ALLA teman + TipTap**
→ Varför: idag skriver SiteEditor till `tenant_settings`, är SALVIA-only, och är en textarea (v0).
✓ Bevis: redigera valfritt tema → spara → live; rich-text funkar.

**10. Bygg ut mallarna (goal-36) — hela katalogen** · _LÅST: behåll credit_
→ Varför: ~94 byggbara mallar; CC-BY körs med författar-credit kvar i footern (köp bort per mall senare). Inga licens-blockerare nu.
✓ Bevis: varje mall render-bevisad 0 FAIL innan nästa.

---

## W3 · Moduler "på riktigt" — HALV → hel
*Admin finns för alla. Köp/läs-flödet fattas. Det här gör dem end-to-end.*

**11. Kund-dedup / en identitet (goal-41) — FÖRE pengar**
→ Varför: samma person via gäst/manuell/bokning = en rad. Splittrad historik = fel lojalitet/fel klientkort när pengar slås på.
✓ Bevis: tre vägar in → en kundidentitet; RLS-isolering orörd.

**12. Koppla Stripe Connect (betal-rail)** · _⚫ compliance-gatad · LÅST 2026-06-19_
→ Varför: webshop-checkout, presentkort-köp och fakturering kan inte bli "klara" utan den (Stripe = bara stubs idag). ⚫ advisor-consult på webhook→confirmed + refund-paritet + SCA/3DS FÖRE riktig charge (goal-42 spår B).
✓ Bevis: en riktig (test)betalning går igenom + återbetalning fungerar.

**13. Webshop end-to-end** · _ROADMAP C_
→ Varför: kundvagn → checkout → betalning → `shop_orders` → orderhistorik i /konto. Idag fattas hela köp-rälsen.
✓ Bevis: köp en produkt som kund → order syns i /konto.

**14. Presentkort (publikt köp + inlösen) · Lojalitet (poäng-inlösen)**
→ Varför: presentkort kan bara utfärdas i admin idag; lojalitet kan tjäna men inte lösa in.
✓ Bevis: köp+lös presentkort som kund; lös poäng→rabatt i en bokning.

**15. Blogg-läsesida `/blogg/[slug]` · Offert-notis**
→ Varför: bloggen visar bara teaser (ingen läs-mer); offert saknar mejlnotis + belopp tillbaka till kund.
✓ Bevis: öppna en artikel med full text + SEO; en offertförfrågan mejlar dig.

---

## W4 · Bredd — bevisa multi-bransch
*🔀 Hur långt detta går styrs av scope-beslutet (#6).*

**16. Booking bransch-medveten (goal-40) → onboarda 1 riktig icke-frisör**
→ Varför: enda riktiga nybygget i modul-lagret (bord/slot/drop-off via `verticals.rules`). En restaurang som tar bordsbokningar live = beviset att Corevo inte bara är frisör.
✓ Bevis: en icke-frisör-tenant tar en riktig bokning live.

**17. Nya moduler i prio (alla 9) — LÅST: maximal scope** · _fordon → recurring → meny → portfolio → orderstatus → …_
→ Varför: 9 namngivna moduler ej byggda. Scope = maximalt → alla byggs (togglingsbara) FÖRE kund #1.
✓ Bevis: per modul — togglingsbar per kund, end-to-end, render-bevisad.

---

## W5 · Fakturering + drift + slut-verifiering FÖRE riktig kund #1

**18. Billing 399 kr/mån (goal-39)** · _Swish-QR v1, semi-manuell_
→ Varför: super-admin→salong-faktura, användningsräknare, moms 25 %. Så du faktiskt får betalt.
✓ Bevis: skicka en faktura → "betald"-flödet grönt hos båda.

**19. Kända buggar** · _savePlatformBranding-clobber · personal-"Idag"-krasch · poäng-revoke completed→cancelled_
→ Varför: småbuggar som biter en riktig kund.
✓ Bevis: var och en reproducerad → fixad → verifierad.

**20. Onboarding-v2 (UX)**
→ Varför: bransch=start (ej bur), fri tema-val, live-helsides-preview, modul av/på i wizard, färre steg.
✓ Bevis: skapa en salong i nya wizarden snabbare + snyggare än idag.

**21. Robusthet + design** · _slot-holds (goal-43) · observability live (goal-44) · admin v2 (goal-45)_
→ Varför: concurrency-skydd, riktig logg-sink (ej fabricerade siffror), v2-design på super-admin.
✓ Bevis: två sessioner krockar inte; ett provocerat fel landar i loggen; admin v2 godkänd mot design-paket.

**22. Beta av VERIFY-SKULDEN live** · _byggt men aldrig bevisat_
→ Varför: mejl end-to-end · **RLS-isolering salong A↔B** · cron-triggers · SMS-kedja · realtime 2-flikar. Inget av detta är "klart" förrän bevisat live.
✓ Bevis: varje punkt grön på riktig prod.

**23. SLUT-GO: onboarda din FÖRSTA RIKTIGA KUND**
→ Varför: allt ovan grönt = "allt på plats". Nu väljer du allt, och vi kör.
✓ Bevis: en betalande salong live, end-to-end, inget rött kvar.

---

## Snabböversikt

| Våg | Vad | Tid (grov) |
|---|---|---|
| **W0** | Lås grunden, onboarding funkar alls | dagar |
| **W1** | Beta av öppna beslut | 1 pass |
| **W2** | Template-bron (riktiga mallar) | det stora spåret |
| **W3** | Moduler end-to-end + betalning | veckor |
| **W4** | Multi-bransch + ev. nya moduler | 🔀 scope |
| **W5** | Billing, buggar, verify, kund #1 | innan launch |

*Varje numrerat steg → en goal-brief till Code, en i taget → verify → `2-Byggplan/klart/`. Jag skriver dem på din signal.*
