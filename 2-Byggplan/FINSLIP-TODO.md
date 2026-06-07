# FINSLIP-TODO — master-lista (omsorterad 2026-06-07)

Arbetssätt (Zivars beslut): allt listas EN gång → sorterat **absolut lättast → svårast** → Nörden skriver ALLA briefs i förväg → körs en i taget med verifiering. Små poster, inga klumpar.

Taggar: `(du)` = Zivar gör/beslutar · `(fix)` = bugg · `(verify)` = testa/bekräfta · `(städ)` = docs/data · `(röd-tråd)` = byggt men vagt/ingen genomtänkt kedja — behöver klargöras INNAN ev. bygge · `(bygg)` = ny kod

---

## ✅ KLART (logg)
- [x] goal-23 stängd (DomänPanel ögonkollad PASS 2026-06-07)
- [x] De "3 okommitterade" committade + pushade
- [x] Repo-strukturen: 6-Testing + 1-Planering per del + RYTMEN i CLAUDE.md

---

## MASTER — absolut lättast först, svårast sist

### ⚡ Minuter (1–15 min styck)
- [ ] 1. `.probe.md`-skräpet i 1-Planering — bort? (städ)
- [ ] 2. Version-ID-rutin — en rad i deploy-runbook (städ)
- [ ] 3. Test-domäner `kvikta.se`/`demo.corevo.se` bort ur tenant_domains? (du + städ)
- [ ] 4. Auth-hook-togglen i Supabase Dashboard (du)
- [ ] 5. Leaked-password-togglen i Supabase Dashboard (du)
- [ ] 6. Cron-triggers på? — reminders + pending-expiry, kolla CF-dashboard (verify)
- [ ] 7. "SPÄRRAD"-texten onboarding-steg 5 — spegla flaggan (fix, 1 rad + deploy)
- [ ] 8. Exportera-knappen på Salonger — riktig eller skal? (verify)
- [ ] 9. Notis-klockan + ⌘K — vad täcker de faktiskt? (verify)

### 🕐 Timme-klassen
- [ ] 10. demo.corevo.se-referenser i runbooks — städa (städ)
- [ ] 11. ROADMAP stale → uppdatera mot dagens läge (städ)
- [ ] 12. TESTA-DETTA stale → uppdatera (städ)
- [ ] 13. Testdata-purge prod — purge-SQL finns, kräver ditt OK (du + städ)
- [ ] 14. Mejl end-to-end — boka → bekräftelse landar, SPF/DKIM (verify)
- [ ] 15. Seed bokningar (ditt OK) → Bokningar-ön visuellt (verify)
- [ ] 16. Realtime 2 flikar — boka i storefront, admin uppdaterar live (verify)
- [ ] 17. Lösenordsreset-knappen (plattform) — vad händer? mejl? länk? (röd-tråd)
- [ ] 18. Kundregistrering `/registrera` — service-role-beroende, aldrig live-verifierad (röd-tråd + verify)
- [ ] 19. HANDOFF bantas — 336 rader → arkivera gamla block (städ)
- [ ] 20. Deploy-runbook EN fil — robocopy→env-guard→grep→smoke→version-ID (städ)
- [ ] 21. TESTA-DETTA-03 köras — dina 6 tester (du, efter 12)

### 📋 Beslut — snabba att TA, jobbet kommer sen (du)
- [ ] 22. Reveal-on-scroll — behåll eller bort (canon säger bort)
- [ ] 23. DNS för nord/barberco/leander/zigge — ska de finnas?
- [ ] 24. Per-location-pris — bygga eller platt OK?
- [ ] 25. Redeem-poäng — när? (revoke måste byggas FÖRE)
- [ ] 26. Deposition-toggle — parkerad, bekräfta att den får ligga
- [ ] 27. Betal-rails-valet — ES kassasystem / Swish / Stripe / fler (störst beslut, låser policy-motorn)

### 🔍 Röd-tråd-klargöranden — byggt men VAGT, prata igenom före ev. kod
- [ ] 28. SMS (46elks) — "Plattformsbred kö" är en badge; finns riktig sändning? hela SMS-kedjan klargörs
- [ ] 29. Lojalitetsnivåer — BRONS/poäng visas men nivåREGLER finns inte (earn finns, nivålogik/förmåner = ?)
- [ ] 30. Fakturering (plattform) — "underlag räknas manuellt", ingen motor: vad är flödet månad för månad?
- [ ] 31. RBAC-matrisen — `/roller` redigerbar men enforce:as BARA på Branding-save; resten är display → vilken yta ska lyda matrisen och när?
- [ ] 32. Onboarda salong end-to-end — har flödet körts på riktigt från noll? (ny tenant, invite, första login)
- [ ] 33. Gäst → konto-koppling — gäst bokar, skapar konto sen: claimas historiken? (contact_hash-dedup har känd lucka från goal-22)
- [ ] 34. Kund-consent/integritet på /konto — ärliga statiska indikatorer, inga save-actions: ska kunden kunna ändra? GDPR-kedjan
- [ ] 35. Öppettider (salong) vs working_hours (personal) — två system, relationen aldrig uttalad (vad vinner vid konflikt?)
- [ ] 36. Storefront riktigt innehåll — logo/foton/copy är ditt; + template-katalogen (dump → licens → val)

### 🔧 Buggfixar — felsök + fix (medel)
- [ ] 37. Personal-Idag-kraschen (fix)
- [ ] 38. Branding-clobber savePlatformBranding (fix — rotorsak obekräftad; repro: seeda media → ta bort bild → spara)
- [ ] 39. Refund-paritet gäst-avboka — `cancelByToken` refundar ej; MÅSTE före betalning på (fix)
- [ ] 40. Poäng-revoke vid completed→cancelled (fix, före redeem)

### 🏗️ Byggen — tyngst sist
- [ ] 41. Anon prisconfig stängas — kolumn-vy/RLS före multi-tenant-launch (bygg)
- [ ] 42. DomänPanel skarp-test — riktig kunddomän CNAME:as hela vägen till cert (verify + ops)
- [ ] 43. MFA för super_admin (bygg)
- [ ] 44. Audit-logg-UI — din tvärs-vy + salongens egen (bygg)
- [ ] 45. DPA-mall + accept i onboarding (du + bygg)
- [ ] 46. Policy-motor avbokning/återbetalning — specen LÅST i `1-Planering/03-avbokning/`, rail-agnostisk, EFTER beslut 27 (bygg, störst)
- [ ] 47. Frisör-frånvaro → auto-omfördelning (bygg, ny feature ur avbokningsspecen)
- [ ] 48. Dela plattform-admin från salong-admin — egen route/worker (bygg, stort)

### 📚 Zivars dump 2026-06-07 — kunskap/ekonomi (research → dokument till dig)
- [ ] 49. CF-EKONOMI-SKOLAN — free plan i verkligheten: vad ÄR en request, 100 samtidiga bokare, gränser, metrics förklarade, när kostar det (research → doc)
- [ ] 50. Kostnadskalkyl per kund — exakt utgift vid 3/6/10/20/40 kunder, CF+Supabase+domäner, marginalskydd (research → kalkyl)
- [ ] 51. Domän/NS-modellen — Miss Hosting äger domän+NS idag: hur funkar det med kunder, vem betalar, NS4.SIMPLY-frågan (egen NS-infra?) (research → doc)
- [ ] 52. SUPABASE-SKOLAN — vad Pro 250kr klarar, "1 GB used" förklarat, storage Supabase vs R2, skalningströsklar, knivvassa oanvända funktioner (research → doc)
- [ ] 53. Bokningsdata-livscykel — radstorlek, retention, vad händer när DB fylls, arkiveringsstrategi (research → doc)
- [ ] 54. Workers/Pages oanvänt — funktioner vi borde använda men inte gör (queues, cron, KV, analytics?) (research → doc)
- [ ] 55. Uptime mot kund — "hur vet kunden att det funkar": status-upplägg, redundans, aldrig fattig sida (röd-tråd + senare bygg)
- [ ] 56. Multi-bransch-arkitekturen — bilverkstad som kund: samma DB? vertikal-toggles? vad ändras? (beslut + röd-tråd)

### 💰 Zivars dump — kassasystem/marknad
- [ ] 57. Kassasystem-research — 10 vanligaste i SE: priser, API:er, policyn, pluggbarhet (research → doc)
- [ ] 58. Konkurrent-research — Bokadirekt/Fresha/Timma + hostingtjänster: vad får kunden, vad tar de, kan vi paketera billigare (research → doc)
- [ ] 59. ES öppna API — vattentät integration (lyssna/skicka), Stage 0-mejl till api@eskassa.se (bygg-förberedelse)
- [ ] 60. Bytes-playbook — hur vi approachar salong som "har allt": migrering åt dem, gratis flytt (process-doc)
- [ ] 61. Marknadsundersökningen — enkät LIVE (surveymonkey.com/r/VTJ9L67) → analys när svar finns (du + Nörden)

### 🎨 Zivars dump — produkt/plattform
- [ ] 62. Inloggsflytt — ditt platform-login BORT från booking.corevo.se → egen subdomän (admin.corevo.se?) (bygg; del 1 av #48)
- [ ] 63. Flik-för-flik-genomgång — varje flik unik, perfekt för sitt jobb, röd tråd; kan sidan förenklas MER? (röd-tråd, stor)
- [ ] 64. Microcopy-svep — alla små klickbeskrivningar/tooltips/tomma states (bygg, efter 63)
- [ ] 65. Terms & Conditions + användarpolicy + integritetspolicy (doc + bygg accept-flöde; hänger ihop med DPA #45)
- [ ] 66. Template-motorn — 30 templates Corevo-brandade, demo-visningsläge, bransch-varianter (bilverkstad: boka tvätt) (bygg, stor; bygger på #36)
- [ ] 67. Shop + Klarna + Instabox — köpflöde → kvitto-print → pickup-koppling: unik postdel, "solder proof" (framtidsuttag, störst; väcker ångerknapp #🔭)
- [ ] 68. ZIVARS ARBETSMANUAL — hur du gör ditt jobb: vilka nycklar var, DB↔CF-kopplingen, vanliga åtgärder steg-för-steg (doc till 5-Kod/docs/ops/)
- [ ] 69. Tankekarta HTML — N8n-stil systemkarta: noder, färg per kategori, kopplingar in/ut, rutnät (Nörden bygger, sparas separat)

### 🔭 Bevaka (blockerar inget nu)
- Ångerknapp-lagkravet 19 juni — gäller presentkort/produkter, triggas när shop byggs
- Produkt-shop per salong som toggle (Instabox/Klarna) — parkerad i avbokningsspecen

---

## C. ZIVARS LISTA (dumpa här — ostrukturerat är fint, Nörden sorterar in i MASTER)

- _(tomt — dumpa allt ur huvudet)_

---

## Ordningslogg
| Datum | Vad | Status |
|---|---|---|
| 2026-06-07 | Listan skapad (A+B), C väntar på Zivar | öppen |
| 2026-06-07 | Dedupad + omsorterad lättast→svårast, röd-tråd-sektion tillagd (9 nya klargöranden) | öppen |
