# 08 — v2.0 ULTRA MAX · kartläggning + roadmap

> Skapad 2026-06-15. Punktvis: vad FINNS, vad SAKNAS, och faserna för att sy ihop allt till v2.0 — super-maxat + korrekt. Styr nästa schema. Ingång: `00-plan-index.md` · plan: `07-maxad-byggplan.md` · logg: `LOG.md`.

## A. NULÄGE — vad FINNS (verifierat på prod idag)
**Databas (LIVE på prod `clylvowtowbtotrahuad`):**
- `verticals`: 5 branscher — frisör, barbershop, nagelstudio, restaurang, generell.
- `modules`: 7 — booking, media_library, shop, blogg, offert, lojalitet, presentkort.
- `tenant_modules` (state-maskin off→draft→live→paused + super-admin-vakt).
- `templates`: 27 aktiva · `template_slots`: 249 (19 mallar) · `content_slots`: 0 rader än · `media_assets`.
- RLS: **0 tabeller utan RLS**; anon-läs-buggen fixad (0037).
- Tenants: 1 (`corevo-system`, deleted) → **ingen aktiv publik storefront än**.

**Kod (BYGGD, men ej deployad/committad):**
- Bransch-först onboarding-wizard · storefront modul-gating · super-admin modul-kort.
- Kund-admin för **alla 7 moduler** (shop/blogg/offert/lojalitet/presentkort/bildbibliotek).
- Preview-redigerare: **text + bild**-slots · bild-väljare (media_assets→produkt/blogg) · offert-intake (anonym→admin-inbox).

## B. VAD SAKNAS för v2.0 ultra max (punktvis)
1. **Allt är odeployat** — inget syns live. → Fas 0
2. **RENDER-VÅGEN saknas** (keystone): storefront-layouterna läser INTE `content_slots`/skin → text/bild man redigerar **syns inte live**. Editorn är hollow tills detta görs. → Fas 1
3. **Mall-katalogen halv:** 27 av ~100 mallar; 4 av 5 presets (edit/leander/linnea/zigge) saknar sektioner. → Fas 2
4. **Full sidbyggare** (preview v3, drag/släpp) saknas — din "MAIN hub" fullt ut. → Fas 3
5. **R2/assets** ej end-to-end live-verifierat (bucket + gratis-tier-koll). → Fas 4
6. **Terminologi per bransch** ej genomförd överallt (labels). → Fas 4
7. **Polish + riktig `next build`-verifiering + säkerhets-koll + EN riktig tenant live + end-to-end-test.** → Fas 5
8. **Parkerade beslut (dina):** licens-strategi (htmlcodex-krediter), betal-rails, CI auto-deploy.

## C. ROADMAP v2.0 — faser
Legend: ✅ klart · 🤖 schemat bygger autonomt · 👁️ med Zivar (ögonkoll/maskin)

- **✅ FAS A — grund + bredd** (DB live, 7 moduler, admin-ytor, preview-editor, offert, bildbibliotek).
- **👁️ FAS 0 — LÅS + LIVE:** deploy + commit + grönt `next build` + CI grön → FreshCut oförändrad. *(din maskin)*
- **👁️ FAS 1 — RENDER-VÅGEN (keystone):** layouterna konsumerar skin/`content_slots` → editorn blir ÄKTA (det man redigerar syns live). *Design-känsligt → 18h-fällan → render-verify MED dig, aldrig blint.*
- **🤖 FAS 2 — KATALOGEN KLAR:** importera resterande mallar (token+sektion), licens-gate, sektioner för de 4 presetsen, fyll väljaren fullt.
- **🤖→👁️ FAS 3 — VISUELLA HUBEN v3:** full sidbyggare (drag/släpp sektioner). Bygg autonomt, finputs med dig.
- **🤖 FAS 4 — ASSETS + SPRÅK:** R2 end-to-end, bildbibliotek live, terminologi per bransch överallt.
- **🤖→👁️ FAS 5 — POLISH + QA + GÅ-LIVE:** onboarding-polish, `next build`/tester/säkerhet, onboarda EN riktig tenant, end-to-end rök-test.
- **⏸ PARKERAT (dina beslut):** licens-linje · betal-rails · CI auto-deploy.

## D. Så kör schemat (ärligt)
Schemat maxar **🤖-faserna autonomt** (2, 4 + autonoma delar av 3/5): bygg + verifiera + applicera additiv DB + logga, tills den autonoma roadmapen är klar — då skriver det "KLAR" och slutar.
**TVÅ saker gör schemat ALDRIG blint:** (a) **deploy** (kräver din maskin/nycklar), (b) **render-vågen/design-känslig layout** (kräver din ögonkoll — så vi inte upprepar 18h-fällan). Dem förbereder + flaggar det; vi tar dem tillsammans.
