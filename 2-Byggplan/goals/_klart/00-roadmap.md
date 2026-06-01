# Roadmap — Corevo Booking Platform

> Byggs i VÅGOR, inte faser. En våg = så många Claude Code-instanser
> som kan köra SAMTIDIGT utan att röra varandras filer.
> Hur-man-gör (worktrees, branch per goal, merge-ordning):
> se `1-Planering/01-parallell-exekvering.md`.
> (Finns den inte än — skapa den innan Våg 1 startar. Tills dess:
> en branch per goal, merge i våg-ordning, kör `pnpm build` efter varje merge.)

```
+===========================================================+
|  DOMÄN-REGEL  (gäller HELA bygget)                        |
|                                                           |
|   - INGEN riktig kunddomän rörs.                          |
|   - INGEN CNAME / custom hostname skapas.                 |
|   ...förrän ZIVAR säger OK.                               |
|                                                           |
|   Tills dess: localhost + preview-subdomän.               |
|     Dev:     freshcut.localhost:3000                      |
|     Preview: *.workers.dev (ev. *.preview.corevo.se)      |
|   Tenant löses via subdomän-på-localhost ELLER            |
|   ?tenant=freshcut / /t/freshcut (se G01).                |
+===========================================================+
```

---

## Vad det är

Corevo = multi-tenant, white-label boknings-SaaS för salonger.
Freshcut = första tenant. Ny salong = ny tenant + config, aldrig ny kod.

**All kod bor i ETT Next.js-projekt:** `5-Kod/` (App Router, egen git).
INGEN monorepo, inga `packages/*`. Revir = mappar/route-grupper INNE i `5-Kod/`.

**Stack:** Next.js (App Router, TS, pnpm) · Supabase (Postgres + Auth + RLS)
· Cloudflare (OpenNext → Workers + R2) · Stripe Connect Express.

---

## Vågor (max parallellitet)

```
VÅG 0  — FUNDAMENT          (1 instans, seriellt)
+-----------------------------------------------------------+
|  G01 scaffold  -->  G02 db + rls                          |
|  Lägger projektskelett + delade filer + hela DB-schemat.  |
|  EFTER våg 0: delade filer + schema FRYSES (se fryslista).|
+-----------------------------------------------------------+
        |
        v
VÅG 1  — KÄRNA              (3 instanser samtidigt)
+-----------------------------------------------------------+
|  [A] G03 publik web   [B] G04 bokmotor   [C] G08 platform |
|  Olika route-grupper / lib-mappar. Noll fil-krock.        |
+-----------------------------------------------------------+
        |
        v
VÅG 2  — PORTALER + PENGAR  (4 instanser samtidigt)
+-----------------------------------------------------------+
| [A] G05 kundportal  [B] G06 personal  [C] G07 salon-admin |
|                     [D] G09 stripe/betalning              |
|  Var sin route-grupp / eget lib-område. Bygger på G04.    |
+-----------------------------------------------------------+
        |
        v
VÅG 3  — HÄRDNING           (1-2 instanser)
+-----------------------------------------------------------+
|  G10 säkerhet/compliance/ops   -->   G11 e2e + deploy     |
|  Rör tvärsöver allt -> körs sist, lugnt, ej parallellt.   |
+-----------------------------------------------------------+
```

| Våg | Vad | Instanser samtidigt | Goals |
|-----|-----|---------------------|-------|
| 0 | Fundament | **1** (seriellt) | G01 → G02 |
| 1 | Kärna | **3** | G03, G04, G08 |
| 2 | Portaler + pengar | **4** | G05, G06, G07, G09 |
| 3 | Härdning | **1–2** | G10 → G11 |

Max samtidiga instanser i en våg: **4** (Våg 2).

---

## FIL-REVIR-KARTA (vem äger vilka mappar i `5-Kod/`)

Regel: en mapp/route-grupp har EN ägare per våg. Två parallella goals får
ALDRIG skriva i samma mapp. Måste du röra någon annans revir -> vänta på
nästa våg, eller be om en delad fil i Våg 0.

Alla sökvägar är under `5-Kod/`.

| Goal | Modul | Våg | ÄGER (skriver i) | Får BARA LÄSA / rör ej |
|------|-------|-----|------------------|------------------------|
| G01 | scaffold | 0 | hela skelettet + alla delade rotfiler | — |
| G02 | db + rls | 0 | `supabase/`, `lib/database.types.ts` | resten (skelett från G01) |
| G03 | publik web (M2) | 1 | `app/(public)/**`, `lib/cms/**`, `components/public/**` | bokmotor, platform, db |
| G04 | bokmotor (M3) | 1 | `app/(booking)/**`, `lib/booking/**`, `app/api/booking/**`, `components/booking/**` | publik, platform, db |
| G08 | platform-admin (M7) | 1 | `app/(platform)/**`, `lib/platform/**`, `app/api/platform/**` | publik, bokmotor, db |
| G05 | kundportal (M4) | 2 | `app/(portal)/**`, `lib/portal/**`, `components/portal/**` | bokmotor-internals, övriga portaler |
| G06 | personalportal (M5) | 2 | `app/(staff)/**`, `lib/staff/**`, `components/staff/**` | övriga portaler, bokmotor-internals |
| G07 | salon-admin (M6) | 2 | `app/(salon)/**`, `lib/salon/**`, `components/salon/**` | övriga portaler, bokmotor-internals |
| G09 | stripe/betalning (M8) | 2 | `lib/payments/**`, `app/api/stripe/**`, `app/api/webhooks/stripe/**` | portaler, bokmotor-internals |
| G10 | säkerhet/ops | 3 | tvärsnitt: headers, rate-limit, logg, RLS-revision | (körs ensam) |
| G11 | e2e + deploy | 3 | `e2e/**`, `wrangler.*`, CI-config, deploy-script | (körs ensam) |

> Bokmotorn (G04) är KÄRNAN. Den är klar och fryst innan Våg 2 startar.
> Portalerna (G05/G06/G07) och Stripe (G09) IMPORTERAR från `lib/booking/`
> men SKRIVER bara i sina egna revir. Behöver de en ny funktion i bokmotorn
> -> lägg en TODO, ta det seriellt efter vågen (rör ej G04:s filer parallellt).

### Snabbkoll: route-grupp -> ägare

```
app/(public)   ......... G03   (våg 1)   publik salongssajt
app/(booking)  ......... G04   (våg 1)   boka-flöde + tider
app/(platform) ......... G08   (våg 1)   Corevo intern-admin
app/(portal)   ......... G05   (våg 2)   kundens sida
app/(staff)    ......... G06   (våg 2)   personalens arbetsyta
app/(salon)    ......... G07   (våg 2)   salongsägarens admin
app/api/stripe ......... G09   (våg 2)   betalning + webhooks
supabase/      ......... G02   (våg 0)   [FRYST efter våg 0]
```

---

## FRYSTA filer (rör ej efter Våg 0)

Läggs EN gång i Våg 0. Parallella goals i Våg 1–2 får INTE ändra dem.
Behöver något ändras här -> stoppa, fråga Zivar, gör det seriellt mellan vågor.

```
[FRYST]  package.json  +  pnpm-lock.yaml      (deps läggs seriellt)
[FRYST]  tsconfig.json  /  eslint  /  prettier
[FRYST]  next.config.*  /  open-next.config.ts  /  wrangler.*
[FRYST]  middleware.ts  +  lib/supabase/*      (session + tenant-resolution)
[FRYST]  lib/tenant.ts                          (tenant-lookup, alla litar på den)
[FRYST]  supabase/migrations/*  +  RLS          (DB-kontraktet ALLA bygger mot)
[FRYST]  lib/database.types.ts                  (genereras av G02)
[FRYST]  .env.example                           (nya nycklar = lägg TILL, ta ej bort)
[FRYST]  components/ui/*                         (delat UI om/när det skapas)
```

Varför: om två instanser ändrar t.ex. `package.json`, `middleware.ts`
eller DB-schemat samtidigt -> merge-konflikt + trasigt bygge.
Frys = noll krock, varje instans kan merge:as oberoende.

> Undantag: behöver Våg 1/2 en NY delad dep eller ett NYTT schema-fält?
> Pausa, lägg till det seriellt (en instans), commit, sen kör vidare parallellt.

---

## Beroendegraf

```
G01 scaffold
   |
G02 db + rls               (fundament — allt vilar på detta)
   |   <<< delade filer + schema FRYSES här >>>
   |
   +-------------+-------------+
   |             |             |
 VÅG 1  (3 parallellt):
 G03 publik    G04 bokmotor   G08 platform
   |             |             |
   |        (G04 fryst före våg 2)
   |             |
   +-------+-----+-----+------------+
   |       |           |            |
 VÅG 2  (4 parallellt):
 G05      G06          G07          G09
 kund     personal     salon-adm    stripe
   |       |           |            |
   +-------+-----+-----+------------+
   |
 VÅG 3  (seriellt):
 G10 säkerhet/ops  -->  G11 e2e + deploy
```

Beroenden i klartext:
- G02 kräver G01.
- G03, G04, G08 kräver G02 (fryst fundament).
- G05, G06, G07 kräver G04. G09 kräver G04.
- G10 kräver G05+G06+G07+G09. G11 kräver G10.

---

## Goal-tabell

| Goal | Modul | Våg | Äger mappar (i `5-Kod/`) | Beror på | Status |
|------|-------|-----|--------------------------|----------|--------|
| G01 | infra/scaffold | 0 | hela skelettet + rotfiler | — | ☐ |
| G02 | M9 db + rls | 0 | `supabase/`, `lib/database.types.ts` | G01 | ☐ |
| G03 | M2 publik web | 1 | `app/(public)`, `lib/cms`, `components/public` | G02 | ☐ |
| G04 | M3 bokmotor | 1 | `app/(booking)`, `lib/booking`, `app/api/booking` | G02 | ☐ |
| G08 | M7 platform-admin | 1 | `app/(platform)`, `lib/platform`, `app/api/platform` | G02 | ☐ |
| G05 | M4 kundportal | 2 | `app/(portal)`, `lib/portal`, `components/portal` | G04 | ☐ |
| G06 | M5 personalportal | 2 | `app/(staff)`, `lib/staff`, `components/staff` | G04 | ☐ |
| G07 | M6 salon-admin | 2 | `app/(salon)`, `lib/salon`, `components/salon` | G04 | ☐ |
| G09 | M8 stripe/betalning | 2 | `lib/payments`, `app/api/stripe`, `app/api/webhooks/stripe` | G04 | ☐ |
| G10 | säkerhet/compliance/ops | 3 | tvärsnitt (headers, rate-limit, logg) | G05,G06,G07,G09 | ☐ |
| G11 | e2e + deploy-pipeline | 3 | `e2e/`, `wrangler.*`, CI, deploy-script | G10 | ☐ |

**Status-legend:** ☐ ej börjad · ◐ pågår · ☑ klar

---

## Tvärgående regler (gäller ALLA goals)

- **Multi-tenant:** varje tenant-tabell har `tenant_id`. RLS PÅ överallt.
  Ingen query utan tenant-scope.
- **White-label:** inga hårdkodade varumärken på tenant-sidor. Tema från DB.
- **Auth:** Supabase Auth + `@supabase/ssr` (cookie-baserad). RLS är sista
  försvarslinjen — lita aldrig bara på app-lagret.
- **Env:** hemligheter i `.env.local` (dev) + Cloudflare secrets (prod).
  Aldrig i git. `.env.example` committas.
- **DoD per goal:** `pnpm build` grön, lint grön, goal-briefens DoD verifierad.
- **Domän:** se DOMÄN-REGEL högst upp. Localhost + preview tills Zivar godkänner.

---

## Hur kör jag flera instanser? (kort)

1. **Våg 0:** kör G01 ensam, verifiera DoD. Sen G02 ensam, verifiera RLS-test.
   Commit. Nu är fundamentet fryst.
2. **Våg 1:** öppna 3 worktrees/branchar — en per goal (G03, G04, G08).
   Varje instans rör BARA sitt revir enligt kartan. Merge in en i taget,
   `pnpm build` efter varje, sen nästa.
3. **Våg 2:** samma sak med 4 instanser (G05, G06, G07, G09).
4. **Våg 3:** G10 ensam, sen G11 ensam.

Detaljerad steg-för-steg (worktree-kommandon, merge-ordning, konflikt-skydd):
**`1-Planering/01-parallell-exekvering.md`**.

---

## Beslutslogg

| Datum | Beslut | Varför |
|---|---|---|
| 2026-05-31 | OpenNext (`@opennextjs/cloudflare`) på Workers, ej Pages | 2026-rek. för Next App Router på CF |
| 2026-05-31 | `@supabase/ssr` cookie-auth i App Router | Kanoniskt Supabase + Next-mönster |
| 2026-05-31 | Dubbelbokningsskydd via Postgres EXCLUDE (`btree_gist`) | DB-garanti, ej bara app-logik |
| 2026-05-31 | Auth = Supabase Auth + egna tabeller, `tenant_id` JWT-claim, RLS via `auth.tenant_id()` | ADR 01 §4 |
| 2026-05-31 | Stripe Connect Express + direct charges + `application_fee` per tenant | Pengaflöde 03 |
| 2026-05-31 | Domän per tenant via Cloudflare for SaaS — SENARE, spärrad tills Zivar OK | Onboarding 02 + domän-regel |
| 2026-05-31 | Roadmap i VÅGOR + fil-revir-karta (route-grupper i `5-Kod/`) | Max parallella Code-instanser, noll fil-krock |
