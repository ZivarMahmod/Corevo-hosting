# 02 — START HÄR: paste-färdiga prompts till Claude Code

> Kopiera en ruta → klistra i en Claude Code-session. Inget mer.
> **Ordning är allt.** Runda 1 måste vara klar + mergad INNAN Runda 2. Annars krockar de.

---

## ⛔ Läs först (30 sek)

- Fundamentet (G01+G02) byggs **ensamt först**. Det lägger delade filer som alla andra importerar. Bygger 3 sessioner detta samtidigt → krock garanterad.
- Parallellt (3 sessioner) kör vi i **Runda 2**, när fundamentet är fryst.
- Varje session får **EN goal**. När den är klar → stäng den. Starta ny session för nästa goal. (Sparar context — en session ska aldrig dra två goals.)
- Koden bor i `5-Kod/`. Worktree-setup för parallellt: se `01-parallell-exekvering.md`.

---

# RUNDA 1 — Fundament (1 session i taget, INTE parallellt)

Kör i `5-Kod/` direkt (ingen worktree behövs än, det är solo).

## ▶️ Session 1A — G01 Scaffold

```
Du är Claude Code. Bygg Goal 01 (projektscaffold) för Corevo Booking Platform.

LÄS FÖRST, i denna ordning:
1. C:\Users\Zivar-PC\Desktop\firsör-sas\2-Byggplan\goals\goal-01-scaffold.md   ← din uppgift, följ exakt
2. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\ADR\01-tenant-och-tema-arkitektur.md
3. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\04-domanstrategi.md
4. C:\Users\Zivar-PC\Desktop\firsör-sas\2-Byggplan\01-parallell-exekvering.md  ← monorepo-struktur (avsnitt 1)

ALL kod skapas i: C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod\

REGLER:
- Bygg EXAKT det som står i goal-01. Inget mer, inget mindre.
- Följ monorepo-strukturen i 01-parallell-exekvering.md avsnitt 1 (pnpm workspaces + turbo, en apps/web).
- ⛔ DOMÄN: ingen riktig kunddomän, ingen CNAME. Tenant via subdomän-parse (frisorN.corevo.se) + localhost-fallback. Wildcard *.corevo.se förbereds i config men ingen DNS körs.
- Verifiera DoD: pnpm build grön, pnpm lint grön, pnpm dev startar.
- När DoD är grön: committa "G01 scaffold", skriv en kort KLAR-rapport (vad byggdes, vad är fryst), STANNA. Starta inte G02.
- Fastnar du eller måste gissa något viktigt → fråga mig, gissa inte.
```

→ När 1A rapporterar KLAR: kolla att `pnpm build` är grön, committa/merga. Sen kör 1B.

## ▶️ Session 1B — G02 Databas + RLS

```
Du är Claude Code. Bygg Goal 02 (databas, schema, RLS) för Corevo Booking Platform.

LÄS FÖRST, i denna ordning:
1. C:\Users\Zivar-PC\Desktop\firsör-sas\2-Byggplan\goals\goal-02-db-rls.md   ← din uppgift, följ exakt
2. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\01-DB-schema.md          ← hela schemat
3. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\ADR\01-tenant-och-tema-arkitektur.md  ← auth §4, tema §3, avgift §5
4. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\03-pengaflode-stripe.md  ← avgiftsfälten

KONTEXT: G01 är klar (Next.js + Supabase-klienter + monorepo finns i 5-Kod/). Supabase-projektet är tomt och kopplat (URL+nycklar i env).

ALL kod i: C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod\

REGLER:
- Bygg EXAKT goal-02. Multi-tenant schema, RLS på ALLA tenant-tabeller, auth.tenant_id()-helper, dubbelbokningsskydd (EXCLUDE-constraint), seed, genererade TS-typer.
- Auth = Supabase Auth + egna tabeller (users.id = auth.users.id), tenant_id som JWT-claim i app_metadata. INGEN egen auth.
- tenant_settings MÅSTE ha: branding jsonb, settings jsonb, service_fee_type, service_fee_value.
- Verifiera DoD: migrations kör rent, RLS-test bevisar att tenant A INTE ser tenant B:s data, pnpm build grön.
- Detta är FUNDAMENTET. När klart fryses: packages/db, packages/auth, middleware.ts. Skriv i din KLAR-rapport exakt vilka filer som är frysta.
- När DoD grön: committa "G02 db+rls", rapportera KLAR, STANNA.
- Fastnar du → fråga, gissa inte.
```

→ När 1B KLAR: **merga till main. Nu är fundamentet fryst.** Sen Runda 2.

---

# RUNDA 2 — Kärna (3 sessioner PARALLELLT)

Först: skapa 3 worktrees (en per session) så de inte rör samma mapp.

```bash
cd C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod
git worktree add ../wt-g03-web      -b goal/g03-publik   main
git worktree add ../wt-g04-booking  -b goal/g04-booking  main
git worktree add ../wt-g08-platform -b goal/g08-platform main
code ../wt-g03-web
code ../wt-g04-booking
code ../wt-g08-platform
```

→ Starta EN Claude Code i varje fönster. Ge den dess ruta nedan.

## ▶️ Session 2A — G03 Publik webbplats (i wt-g03-web)

```
Du är Claude Code. Bygg Goal 03 (publik webbplats, M2) för Corevo Booking Platform.

LÄS FÖRST:
1. C:\Users\Zivar-PC\Desktop\firsör-sas\2-Byggplan\goals\goal-03-publik-webbplats.md  ← din uppgift
2. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\moduler\M2-publik-webbplats.md
3. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\ADR\01-tenant-och-tema-arkitektur.md  ← tema-lagret §3
4. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\04-domanstrategi.md

DU JOBBAR I: denna worktree (wt-g03-web). 

DITT REVIR (skriv BARA här): app/(public)/  + ev. app/(marketing)/
IMPORTERA (läs, ändra ALDRIG): @corevo/db, @corevo/ui, @corevo/auth, middleware.ts, packages/db, packages/auth
RÖR ALDRIG: andra route-grupper (booking/customer/staff/salon/platform), packages/db, packages/auth, middleware.ts, root-config. De är FRYSTA.

REGLER:
- Bygg EXAKT goal-03. Tenant-sida nås via frisorN.corevo.se, tema renderas per tenant (logga/färg/layout-variant).
- Funktionalitet identisk för alla tenants — bara utseende varierar.
- ⛔ Ingen riktig kunddomän, ingen CNAME. Test via frisor1/frisor2-subdomän eller localhost.
- Måste du ändra en FRYST fil → STOPP, fråga mig. Gör det inte.
- Verifiera DoD (i goal-03). Committa på grenen goal/g03-publik. Rapportera KLAR, STANNA.
```

## ▶️ Session 2B — G04 Bokningsmotor (i wt-g04-booking)

```
Du är Claude Code. Bygg Goal 04 (bokningsmotor, M3) för Corevo Booking Platform.

LÄS FÖRST:
1. C:\Users\Zivar-PC\Desktop\firsör-sas\2-Byggplan\goals\goal-04-bokningsmotor.md  ← din uppgift
2. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\moduler\M3-bokningsmotor.md
3. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\01-DB-schema.md  ← bookings, dubbelbokningsskydd
4. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\ADR\01-tenant-och-tema-arkitektur.md

DU JOBBAR I: denna worktree (wt-g04-booking).

DITT REVIR (skriv BARA här): app/(booking)/ + packages/booking
IMPORTERA (läs, ändra ALDRIG): @corevo/db, @corevo/ui, @corevo/auth, middleware.ts
RÖR ALDRIG: app/(public)/, packages/payments, andra route-grupper, packages/db, packages/auth, middleware.ts. FRYSTA.

VIKTIGT: Stripe/betalning byggs INTE här (det är G09). Lämna en tydlig betal-SLOT/placeholder-komponent som G09 fyller senare. Bygg inte betalningslogik.

REGLER:
- Bygg EXAKT goal-04. Lediga tider, schema, dubbelbokningsskydd (använd DB:ns EXCLUDE-constraint, lita inte bara på app-logik), om/avbokning.
- Måste du ändra en FRYST fil → STOPP, fråga. 
- Verifiera DoD. Committa på goal/g04-booking. Rapportera KLAR, STANNA.
```

## ▶️ Session 2C — G08 Platform Admin (i wt-g08-platform)

```
Du är Claude Code. Bygg Goal 08 (Platform Admin, M7) för Corevo Booking Platform.

LÄS FÖRST:
1. C:\Users\Zivar-PC\Desktop\firsör-sas\2-Byggplan\goals\goal-08-platform-admin.md  ← din uppgift
2. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\moduler\M7-platform-admin.md
3. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\02-onboarding-flode.md  ← onboarding-stegen
4. C:\Users\Zivar-PC\Desktop\firsör-sas\1-Planering\04-domanstrategi.md  ← admin på booking.corevo.se

DU JOBBAR I: denna worktree (wt-g08-platform).

DITT REVIR (skriv BARA här): app/(platform)/
IMPORTERA (läs, ändra ALDRIG): @corevo/db, @corevo/ui, @corevo/auth, middleware.ts
RÖR ALDRIG: andra route-grupper, packages/db, packages/auth, middleware.ts, root-config. FRYSTA.

VIKTIGT:
- Admin bor på booking.corevo.se (reserverad subdomän, ej en tenant).
- Onboarding skapar tenant + tilldelar subdomän-slug under corevo.se (frisorN).
- ⛔ Kundens EGNA domän = SPÄRRAD. DOMAIN_PROVISIONING_ENABLED=false. Bygg UI för domän-koppling men kör INGEN CNAME/custom hostname.
- Stripe-status visas bara som "ej kopplat" (G09 bygger riktiga kopplingen senare) — bygg ingen Stripe-logik här.

REGLER:
- Bygg EXAKT goal-08. Tenant-hantering, onboarding, drift-översikt.
- Måste du ändra en FRYST fil → STOPP, fråga.
- Verifiera DoD. Committa på goal/g08-platform. Rapportera KLAR, STANNA.
```

→ När alla 3 KLAR: merga i ordning G03 → G04 → G08 (se `01-parallell-exekvering.md` avsnitt 6). Sen Runda 3 (G05/G06/G07/G09).

---

## Efter varje runda

1. Kolla DoD (pnpm build grön i varje gren).
2. Merga till main (`git merge --no-ff goal/gXX-...`).
3. `git rebase main` i nästa rundas worktrees.
4. Säg till mig — jag ger dig nästa rundas prompts (Runda 3: G05+G06+G07+G09 parallellt).
```
