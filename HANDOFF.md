# HANDOFF — Corevo (multi-bransch-plattform)

> Färsk handoff (2026-06-19). Full historik t.o.m. 2026-06-18 (464 rader, alla daterade entries) arkiverad → `2-Byggplan/HANDOFF-arkiv-2026-06-19.md`. Behöver du ett gammalt worker-/version-id eller en äldre beslutsnotis → leta där.

## ⭐ VAD ÄR COREVO (stående, ej historik)
Corevo = EN multi-bransch-plattform: en motor, en databas, en kodbas. Super-admin klickar fram en färdig kundsida för **vilken bransch som helst** (frisör, verkstad, florist, butik, restaurang, klinik, café …). **Frisör = EN bransch (preset), aldrig "projektet".** Aldrig en fork per bransch.
- **Moduler à la carte** per kund (`off→draft→live→paused`): bokning · webshop · offert · blogg · lojalitet · presentkort · media + 9 namngivna ej byggda.
- **Sajtbyggaren** = visuella huben där sidan byggs; bokning är en modul den väver in.
- **KANON (produkt):** `1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`.
- ▶️ **ENDA ROADMAPEN:** `2-Byggplan/ROADMAP.md` — rak väg till launch + scope kvar + öppna beslut + lagkrav. Läs den för nästa steg.

## 📍 NULÄGE — prod
- **Prod-worker `bokningsplatformen` v `dd0e8902-6d6e-4831-bad5-58171bbed6cf`.** Rollback: `wrangler rollback 16735d4f --config 5-Kod/apps/web/wrangler.jsonc` (pre-sajtbyggare) + flippa `SAJTBYGGARE_ENABLED`→"false".
- **Sajtbyggaren (S1+S2+S3) LIVE i prod**, flagga `SAJTBYGGARE_ENABLED="true"`. S2 självservice = `booking.corevo.se/admin/sajtbyggare`. S3 onboarding = `superbooking.corevo.se/salonger/ny` → steget "Designa sidan". Kvar = Zivars inloggade klick-genomgång (spara→live känns rätt).
- **Alla 5 ytor "real"** (super-admin · kund-admin · personal · kund · storefront). Per-yta-status + största gap: ROADMAP §NULÄGE. Stora spåret kvar = **template-bron** (storefront → DB-template-slots, ROADMAP §B).
- **Supabase prod:** `clylvowtowbtotrahuad`. **POS = `corevo.se`** (egen zon, rör ALDRIG). 3 fasta hostar (booking/superbooking/minbooking) + kund-domäner `<slug>.corevo.se` (committade i `wrangler.jsonc` → deploy-säkra, kan ej detachas).
- **Deploy:** `v*`-tag → CI kör `scripts/deploy-prod.mjs` (re-asserterar domäner, har CF-token). ⛔ bare `wrangler deploy` detachar domäner. `git push main` deployar INTE prod. POS + 3 fasta hostar får ALDRIG gå ner vid deploy.

## 🔴 LAGKRAV (ROADMAP §LAGKRAV)
- **In-app självservice-avbokning lagstadgad fr 2026-06-19.** Avboka-flödet finns (`/avboka/[id]`, `cancelByToken`) → **verifiera att kravet uppfylls** (knapp syns i /konto + i bekräftelsemejlet).
- Övrigt: distansavtalslagens 14-dagars ångerrätt (deposit/no-show), GDPR Art.28 DPA per kund, SCA/3DS + dispute-webhooks vid betalning, review-gating olagligt (FTC).

## 🐞 KÄNDA BUGGAR (ROADMAP §E)
`savePlatformBranding`-clobber · personal-"Idag"-krasch · lojalitet poäng-revoke (completed→cancelled FÖRE redeem) · onboarding orphan-salong vid invite-fail · onboarding Auth-verifieringsmail funkar ej. (De två onboarding-buggarna FÖRST i onboarding-v2.)

## 🧾 VERIFY-SKULD — byggt men ej live-bevisat (ROADMAP §VERIFY-SKULD)
mejl e2e (boka→bekräftelse + SPF/DKIM) · realtime 2-flikar · `/registrera` · **RLS-isolering salong A↔B** · cron-triggers (reminders + pending-expiry) · SMS-kedja (46elks) · onboarda salong från noll e2e.

## 🔧 GATES / CI
`pnpm typecheck` (0) · `pnpm test` (vitest, grön) · `pnpm build` · CI = `.github/workflows/ci.yml` (PR-gate: `lint · typecheck · unit · build`; Playwright e2e gated på `E2E_ENABLED`).
- ⚠️ **`pnpm lint` är trasig under ESLint 9** (eslint-config-next + `@rushstack/eslint-patch` ⊄ flat-config). Lint-steget körs FÖRST i `ci.yml` → faller → typecheck/test/build körs ALDRIG i CI. **PR-gaten är de facto nere.** Fix = nedgradera ESLint 8 / uppdatera eslint-config-next (egen åtgärd).

## 📋 AUDIT 2026-06-19 (improve-skill, READ-ONLY — inga plan-filer skrivna)
Oberoende kod-audit (4 read-only-svep, alla fynd vettade mot kod + ROADMAP). **Plan-filer EJ genererade** (denna körning var housekeeping). Re-run `/improve` för att skriva planerna till `2-Byggplan/advisor-plans/`. 8 vettade fynd (leverage-ordning):
1. lint/CI-gate trasig (se GATES ovan) — högst leverage.
2. Öppen redirect i login `next` — `app/(auth)/actions.ts:95` (`startsWith('/')` släpper `//host`).
3. Stripe-webhook otestad (cross-account-fence + state) — `app/api/stripe/webhook/route.ts`, 0 test.
4. N+1 på admin bokningslista — `app/(admin)/admin/bokningar/page.tsx:53-56,108-110`.
5. Refund-fel sväljs tyst (ingen ops-signal) — `lib/stripe/refund.ts:46`.
6. `vitest <3.2.6` dev-advisory (+ vite) — en bump fixar båda.
7. `adminCtx()` duplicerad ×6 admin-action-filer.
8. Dubblett-kvittomejl vid webhook-retry.
- **Redan spårat (ej dubblerat):** actions-split = goal-44 · slot-race = goal-43 · refund-paritet = fix-26 · stripe-golive/SCA = goal-42.

## 🧭 Spelregler
- En sak → verify → `klart/`. "Klart" = bevisat live, aldrig "kod committad".
- Universal motor + variant per bransch — **ALDRIG fork.** Build once, activate per kund.
- POS `corevo.se` + 3 fasta hostar ALDRIG nere vid deploy. Deploy-first: bevisa innan mer byggs.
- **Filplacering:** aldrig i roten (se CLAUDE.md). Branches: rensade till **main-only** 2026-06-19 (1 kvar att besluta: `claude/bold-euler-M86py`, ej merge:ad).
