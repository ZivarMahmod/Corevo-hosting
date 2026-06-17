# MASTER-LISTA — allt på bordet

> Allt Zivar kastat ut + allt som behöver gås igenom, på ETT ställe. Uppdaterad 2026-06-16.
> Markörer: ✅ klart · 🟡 pågår · ⬜ kvar · 🔎 kolla om byggt · ⚠️ viktigt · ⏸ parkerad
> Detaljer: `1-Planering/06-sajtbyggare`, `07-efter-sajtbyggaren`, `08-fakturering` + `2-Byggplan/goals/`.

## A. Grunden (nu)
- ✅ Fas A — live + inloggning (du är inne)
- ⬜ Lås custom-domän i `wrangler.jsonc` (annars tappas test-barber vid deploy)
- ⬜ Stäng Fas A formellt (goal-30 → klart + HANDOFF)
- ⬜ Bugg: savePlatformBranding-clobber
- ⬜ Bugg: personal-"Idag"-krasch
- ⬜ R2-toggle-koll + städa testdata på prod

## B. Sajtbyggaren (Code bygger nu)
- 🟡 S0 — bevisa render-bron + välj motor (kör nu)
- ⬜ S1 — importera mallar troget (ser ut som originalet)
- ⬜ S2 — redigeraren (text/font/färg/bild → publicera)
- ⬜ S3 — moduler som block + bygg ut (sida/knapp)
- ⬜ S4 — galleri (bläddra/byt alla mallar)
- ⬜ S5 — finish (bild-optimering, licens, fler mallar)
- ⬜ Verify-script i varje steg (vaktar att det blev rätt)
- ⚠️ Override-kaskad (Universal→Bransch→Kund + badge + promote) — bakas in i S1

## C. Modulerna på riktigt (efter sajtbyggaren)
- ⬜ Kund-admin — varje modul-yta funkar på riktigt
- ⬜ Storefront — alla moduler end-to-end
- 🔎 Avbokning/ombokning (modell finns — kolla om byggd)
- 🔎 Kund-konto (login, bokningar, lojalitet — funkar brett?)
- ⬜ Bokning per bransch (arketyp-profil på EN motor)

## D. Notiser & innehåll
- 🔎 Påminnelser SMS + mail (live frisör — funkar alla brancher?)
- ⬜ Mail-mallar — välj mall, per bransch+kund (samma kaskad)
- ⬜ Statistik på salongens admin (toggle på/av, Cloudflare Analytics)

## E. Pengar
- ⬜ Fakturering i plattformen (super→salong, Swish-QR, Godkänn, 399 platt)
- ⬜ Webshop-betalning (deras rail ELLER Stripe) — av-pausa

## F. Drift & trygghet (före riktiga kunder)
- 🔎 Data-isolering: kan salong A se salong B? (RLS-test — kärnan i multi-tenant)
- ⬜ Övervakning / larm om prod krånglar
- ⬜ Backup / återställning
- ⬜ Säkerhetsgenomgång före launch
- 🔎 Personal-portal + frånvaro → omfördela dagens bokningar

## G. Tillväxt (framtid)
- ⬜ SEO för storefronts (synas på Google)
- ⬜ Onboarding self-serve (12-mån kontrakt / 14 dgr uppsägning) — manuell nu, rätt så
- ⬜ Auto-domän/cert (goal-23 dormant — slå på när budget finns)

## H. Juridik (litet)
- ✅ Radera kund på begäran (finns redan i koden)
- ⬜ Kort integritets-text per salong
- ⏸ Ångerknapp-lagen — parkerad tills shoppen tar betalt
