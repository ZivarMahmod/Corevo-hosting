# 01 — Parallell exekvering (Corevo Booking Platform)

> Hur du kör **flera Claude Code-instanser samtidigt** i VS Code utan att de krockar.
> Synkad mot `00-roadmap.md` (G01–G11, Spår A–F) + `00-modulkarta.md` (M2–M9) + ADR 01.
> Stack: Next.js (App Router) · Supabase · Cloudflare (OpenNext/Workers + R2) · Stripe Connect. Kod bor i `5-Kod/`.

---

## 0. Grundregel (1 mening)

> 1 Claude Code-instans = 1 **git worktree** = 1 **gren** = 1 **egen mapp** den ÄGER. Två instanser rör aldrig samma fil.

**3 lagar:**
1. Aldrig 2 instanser i samma mapp.
2. Aldrig röra en **fryst** fil parallellt (DB-schema, typer, root-config).
3. Merga i **vågordning** — du (Zivar) mergar, instanserna aldrig själva.

---

## 1. Monorepo-struktur (`5-Kod/`)

**Verktyg 2026 (verifierat):**
- **pnpm workspaces** — paket-länkning (`@corevo/*`).
- **Turborepo** — task-cache + parallell `build`/`lint`/`test`. Funkar med pnpm.
- **`@opennextjs/cloudflare`** — kör Next.js 16 (App Router, Node-runtime) på Cloudflare **Workers** (ej Pages). Stödjer App Router, middleware, ISR, Turbopack. Matchar roadmap-beslut 2026-05-31.

> ⚠️ **Windows:** OpenNext stödjer Windows "på egen risk" (Next.js-tooling har Windows-buggar). Själva *bygget/koden* går bra i VS Code på Windows. Kör **`opennextjs/cloudflare`-bygget + deploy via WSL eller CI/CD** (GitHub Actions) om det strular lokalt. Påverkar bara Våg 3 (deploy), inte parallellt kodande.

```
5-Kod/
├─ package.json            # root  "packageManager":"pnpm@..."   (FRYS efter Våg 0)
├─ pnpm-workspace.yaml     # apps/* + packages/*                 (FRYS)
├─ turbo.json             # pipeline build/lint/test            (FRYS)
├─ tsconfig.base.json      # delade ts-paths (@corevo/*)         (FRYS)
│
├─ apps/
│  └─ web/                # EN Next.js-app (alla moduler = routes, en kodbas per ADR 01 §1)
│     ├─ middleware.ts    #   host → tenant_id (ADR 01 §2)       (FRYS efter Våg 0/G02)
│     ├─ app/(public)/    #   M2 Publik webbplats     ← G03 / Spår A
│     ├─ app/(booking)/   #   M3 Bokningsmotor        ← G04 / Spår B
│     ├─ app/(customer)/  #   M4 Kundportal           ← G05 / Spår C
│     ├─ app/(staff)/     #   M5 Personalportal       ← G06 / Spår C
│     ├─ app/(salon)/     #   M6 Salon Admin          ← G07 / Spår D
│     ├─ app/(platform)/  #   M7 Platform Admin       ← G08 / Spår E
│     └─ open-next.config.ts  # Cloudflare-adapter    ← G11
│
└─ packages/
   ├─ db/                 # M9: schema, migrations, GENERERADE typer  ← KONTRAKT, G02
   ├─ auth/               # Supabase @supabase/ssr, session, auth.tenant_id()  ← G02
   ├─ ui/                 # delade komponenter + tema-tokens (CSS-vars, ADR 01 §3)
   ├─ booking/            # M3 domänlogik (slots, dubbelbokningsskydd)  ← G04
   ├─ payments/           # M8 Stripe Connect (Express, direct charges) ← G09
   └─ config/             # delad eslint/ts/tailwind                    ← G01, FRYS
```

> **Viktigt val:** ADR 01 §1 = **EN kodbas**, inga grenar/templates per kund. Därför **en `apps/web`** med modulerna som **route-grupper** `app/(modul)/`. Det ger naturligt fil-revir: varje goal äger sin egen route-grupp-mapp → noll överlapp även inom samma app.

| Fil/mapp | Roll | Status |
|---|---|---|
| root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` | Bygg-rigg | **FRYS efter Våg 0 (G01)** |
| `packages/db` (schema + typer) | M9-kontraktet | **FRYS efter Våg 0 (G02)** |
| `packages/config` | Lint/ts/tailwind | **FRYS efter Våg 0 (G01)** |
| `apps/web/middleware.ts` | tenant-resolution | **FRYS efter G02** |
| `app/(modul)/*`, övriga `packages/*` | Byggs i vågor | Ägs per goal |

---

## 2. Git worktrees — en instans per worktree

**Varför:** worktree = separat mapp på disk, **egen gren**, men **delar samma `.git`**. Varje Claude Code öppnar sin egen mapp i VS Code → kan fysiskt inte skriva i en annan instans filer.

> Repot finns redan (`5-Kod/` har egen git enligt roadmap). Worktrees läggs som syskonmappar.

### 2.1 Engångs-setup
```bash
cd C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod
# om tomt repo, första commit efter Våg 0:
git add . && git commit -m "chore: monorepo-skelett + DB-kontrakt (Vag 0)"
```

### 2.2 Skapa en worktree per goal (mall)
```bash
# Monster:  git worktree add <mapp> -b <gren> <bas-gren>
git worktree add ../wt-g03-web      -b goal/g03-publik     main
git worktree add ../wt-g04-booking  -b goal/g04-booking    main
git worktree add ../wt-g08-platform -b goal/g08-platform   main
```

Resultat på disk:
```
Desktop/firsör-sas/
├─ 5-Kod/              (main)              ← du styr + mergar härifrån
├─ wt-g03-web/         (goal/g03-publik)   ← Code-instans #1
├─ wt-g04-booking/     (goal/g04-booking)  ← Code-instans #2
└─ wt-g08-platform/    (goal/g08-platform) ← Code-instans #3
```

### 2.3 Öppna varje worktree i EGET VS Code-fönster
```bash
code ../wt-g03-web
code ../wt-g04-booking
code ../wt-g08-platform
```
→ starta **en Claude Code per fönster**. Ge varje instans bara **sin** goal-brief (`2-Byggplan/goals/goal-0X-*.md`).

### 2.4 Städa när en goal är mergad
```bash
git worktree remove ../wt-g03-web
git branch -d goal/g03-publik
```

| Kommando | Gör |
|---|---|
| `git worktree list` | Visar alla worktrees + grenar |
| `git worktree add <mapp> -b <gren> main` | Ny isolerad arbetsyta |
| `git worktree remove <mapp>` | Tar bort när klar |
| `git branch -d <gren>` | Raderar mergad gren |

---

## 3. Fil-revir-karta (vem äger vad)

> Regel: en mapp har **exakt en ägare** per våg. Allt nedan = synkat mot roadmap-spåren.

| Goal | Modul | Spår | Äger (skriver i) | Får BARA läsa (import) | Får ALDRIG röra |
|---|---|---|---|---|---|
| **G01** | infra | Fund. | root-config, `packages/config` | — | — |
| **G02** | M9 | Fund. | `packages/db`, `packages/auth`, `middleware.ts` | — | — |
| **G03** | M2 | A | `app/(public)/`, `app/(marketing)/` | `@corevo/db`, `ui`, `auth` | andra route-grupper |
| **G04** | M3 | B | `app/(booking)/`, `packages/booking` | `@corevo/db`, `ui`, `auth` | `app/(public)/`, payments |
| **G05** | M4 | C | `app/(customer)/` | `@corevo/db,booking,ui,auth` | andra route-grupper |
| **G06** | M5 | C | `app/(staff)/` | `@corevo/db,booking,ui,auth` | andra route-grupper |
| **G07** | M6 | D | `app/(salon)/` | `@corevo/db,booking,ui,auth` | andra route-grupper |
| **G08** | M7 | E | `app/(platform)/` | `@corevo/db,ui,auth` | andra route-grupper |
| **G09** | M8 | F | `packages/payments`, `app/(booking)/*pay*` 🟡 | `@corevo/db,booking` | andra route-grupper |
| **G10** | säk. | Härd. | RLS-test, audit, säkerhets-config | allt (läs) | — |
| **G11** | e2e/CI | Härd. | `open-next.config.ts`, `.github/`, e2e-tester | allt (läs) | — |

> 🟡 **G09 kollision-risk:** Stripe-knappen/checkout sitter i bokningsflödet (M3). Lös så här: G09 äger **`packages/payments`** fullt ut, och M3-betalkomponenten exponeras av G04 som en **slot/placeholder** som G09 fyller. Kör därför **G09 EFTER G04 mergats** (roadmap: G09 beror på G04). Då rör de aldrig samma fil samtidigt.

### Delade filer (FRYS-lista — byggs i Våg 0, rörs sen aldrig parallellt)
| Fil | Byggs av | Fryst efter |
|---|---|---|
| `packages/db/schema/*.sql` + Supabase migrations | G02 | Våg 0 |
| `packages/db/types.ts` (genererade Supabase-typer) | G02 | Våg 0 |
| `packages/auth/*` (`auth.tenant_id()`-klient, ssr-session) | G02 | Våg 0 |
| `apps/web/middleware.ts` (host → tenant_id) | G02 | Våg 0 |
| root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` | G01 | Våg 0 |
| `packages/config/*` | G01 | Våg 0 |

> Måste en parallell instans ändra en **fryst** fil? **STOPP.** Görs INTE i worktreen.
> Du noterar det → kör en liten "kontrakts-fix" **solo** (mini-Våg 0) → merga → sen `git rebase main` i övriga worktrees. Sen fortsätter de.

---

## 4. Kontrakt-först-principen

> Allt som **fler än en goal** rör genereras **EN gång** i Våg 0 och **fryses**. Parallella instanser **importerar** — uppfinner aldrig eget.

| Kontrakt | Var | Hur (en gång, Våg 0) |
|---|---|---|
| DB-schema (M9) | `packages/db/schema/*.sql` + migrations | G02 skriver, mergas till `main` |
| TS-typer | `packages/db/types.ts` | `supabase gen types typescript` → committas |
| RLS-helper | `auth.tenant_id()` i DB + `packages/auth` | G02, enligt ADR 01 §4 |
| Tenant-resolution | `apps/web/middleware.ts` | G02, host→tenant_id (ADR 01 §2) |
| Tema-tokens | `packages/ui` CSS-vars (`--color-primary`…) | G01/G02, ADR 01 §3 |
| Lint/ts/tailwind | `packages/config` | G01 |

**Konsekvens:** G04 (booking) och G08 (platform) importerar båda `@corevo/db` + `@corevo/auth`. De **pratar aldrig med varandra live** → ingen koordinering, inga krockar.

> **ADR-koppling:** `tenant_id` är JWT-claim i `app_metadata`, RLS är sista försvarslinjen. Alla parallella goals **ärver** detta gratis via `@corevo/db` + `@corevo/auth` — ingen instans får hitta på egen tenant-filtrering.

---

## 5. Vågor (max parallellitet, från roadmap)

> Mellan varje våg: **allt mergas till `main`**, sen `git rebase main` i nästa vågs worktrees.

```
VÅG 0  Fundament   G01 → G02         [SOLO, sekventiellt]   ──merge──┐
                                                                     ▼
VÅG 1  Kärna       G03 + G04 + G08   [3 parallella Code]    ──merge──┐
                                                                     ▼
VÅG 2  Ovanpå M3   G05 + G06 + G07 + G09  [4 parallella]    ──merge──┐
                                                                     ▼
VÅG 3  Härdning    G10 → G11         [1–2, sekventiellt]
```

### Våg 0 — Fundament (SOLO, 1 instans, sekventiellt)
| Steg | Goal | Äger | Levererar |
|---|---|---|---|
| 1 | **G01** | root-config, `packages/config` | monorepo-rigg (pnpm+turbo), scaffold Next på CF |
| 2 | **G02** | `packages/db`, `packages/auth`, `middleware.ts` | DB-schema, RLS, genererade typer, tenant-resolution, **frysta kontrakt** |

→ **Måste mergas till `main` innan ALLT annat.** Ingen parallellism. RLS-test obligatoriskt (roadmap §5).

### Våg 1 — Kärna (3 instanser parallellt)
| Goal | Worktree | Äger | Importerar |
|---|---|---|---|
| **G03** M2 | `wt-g03-web` | `app/(public)/` | `@corevo/db,ui,auth` |
| **G04** M3 | `wt-g04-booking` | `app/(booking)/`, `packages/booking` | `@corevo/db,ui,auth` |
| **G08** M7 | `wt-g08-platform` | `app/(platform)/` | `@corevo/db,ui,auth` |

→ Skilda route-grupper + skilda paket = noll filöverlapp.

### Våg 2 — Ovanpå M3 (4 instanser parallellt, alla kräver G04 mergad)
| Goal | Worktree | Äger | Importerar |
|---|---|---|---|
| **G05** M4 | `wt-g05-customer` | `app/(customer)/` | `@corevo/db,booking,ui,auth` |
| **G06** M5 | `wt-g06-staff` | `app/(staff)/` | `@corevo/db,booking,ui,auth` |
| **G07** M6 | `wt-g07-salon` | `app/(salon)/` | `@corevo/db,booking,ui,auth` |
| **G09** M8 | `wt-g09-payments` | `packages/payments` (+ fyller M3:s betal-slot) | `@corevo/db,booking` |

→ Alla läser den **frysta** `@corevo/booking` från G04. Skriver bara i sin egen mapp.

### Våg 3 — Härdning (1–2 instanser, sekventiellt)
| Goal | Äger |
|---|---|
| **G10** Säkerhet/Compliance/Ops | RLS-test över alla tabeller, audit, GDPR-checklista |
| **G11** E2E + deploy-pipeline | `open-next.config.ts`, Cloudflare-deploy, `.github/` CI, E2E-tester |

---

## 6. Merge-disciplin (din checklista)

> Du (Zivar) mergar från `5-Kod/` (gren `main`). Instanserna mergar **aldrig** själva.

### När en goal rapporterar KLAR (DoD grön: `pnpm build` + lint + RLS-test):
```bash
cd C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod   # main
git fetch
git merge --no-ff goal/g04-booking              # gren som är klar
```

### Merge-ordning per våg
| Våg | Merge-ordning | Konflikt-risk |
|---|---|---|
| 0 | G01 → G02 | — (solo) |
| 1 | G03 → G04 → G08 | ~0 (skilda route-grupper/paket) |
| 2 | G05 → G06 → G07 → **G09 sist** | ~0 (G09 fyller M3-slot efter G04) |
| 3 | G10 → G11 | låg |

### Varför konflikter uteblir
- Skilda mappar (route-grupper + paket) per goal → git rör olika filer → **auto-merge**.
- Frysta kontrakt → ingen rör `packages/db` / `middleware.ts` parallellt.
- `--no-ff` → varje goal = en tydlig merge-commit (lätt att backa: `git revert -m 1 <commit>`).

### Om en konflikt ändå dyker upp
1. Nästan alltid i en **fryst** fil → någon bröt revir-kartan.
2. `git merge --abort`.
3. Fixa kontraktet **solo** (mini-Våg 0) → merga → `git rebase main` i kvarvarande worktrees.

### Innan nästa våg startar
```bash
# i VARJE worktree for nasta vag:
git rebase main      # hamtar in nyss mergade fundament/karna
```

---

## 7. Snabb-cheatsheet

| Steg | Kommando |
|---|---|
| Ny arbetsyta | `git worktree add ../wt-gXX -b goal/gXX-namn main` |
| Öppna i VS Code | `code ../wt-gXX` |
| Merga klar goal | `git merge --no-ff goal/gXX-namn` (från `5-Kod/` på `main`) |
| Synka inför ny våg | `git rebase main` (i varje worktree) |
| Städa | `git worktree remove ../wt-gXX && git branch -d goal/gXX-namn` |
| Se läget | `git worktree list` |
| Backa en merge | `git revert -m 1 <merge-commit>` |

> **Gyllene regel:** Aldrig 2 instanser i samma mapp · aldrig röra fryst fil parallellt · merga i vågordning.

---

## 8. Avvikelser mot roadmap (läs detta)

| Punkt | Roadmap säger | Denna guide säger | Varför |
|---|---|---|---|
| Vågindelning | Fas 2 = G03+G04+G08; Fas 3 = G05+G06+G07+G09 | **Identiskt** (döpt om till Våg 1/2) | Ingen avvikelse |
| G09 (Stripe) | Beror på G04 | Lagd **sist i Våg 2**, fyller M3:s betal-slot | Undviker fil-krock med G04:s bokningsflöde |
| Struktur | "5-Kod, egen git" | **pnpm+turbo monorepo, EN `apps/web`** med route-grupper per modul | ADR 01 §1 (en kodbas) + ger naturligt fil-revir |
| `packages/auth` | nämns ej explicit som paket | Eget paket, fryst i G02 | Delad RLS/ssr-klient = kontrakt alla importerar |

> Inga **hårda** konflikter mot roadmap. Allt ovan är en **konkretisering** av roadmapens parallella spår till worktrees + fil-revir. Stäm av G09-slot-mönstret mot `goal-09-betalningar-stripe.md` innan Våg 2.
