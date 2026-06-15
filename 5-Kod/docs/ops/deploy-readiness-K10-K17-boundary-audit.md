# Deploy-readiness — klient/server-gräns-audit (K10–K17)

> Skapad 2026-06-15 av autonoma bygg-schemat (v2-ultra-max, körning 19 / Fas 5 next-build-säkring).
> Komplement till `deploy-runbook.md`. Den här filen = **pre-deploy-beviset** för EN sak: att `next build` inte kraschar på klient/server-gräns-fällan.

---

## ✅ VERDIKT

**0 (noll) klient→`server-only`-brott i hela kodbasen.**

Hela import-grafen för **alla 98 `'use client'`-filer** spårades mekaniskt. Ingen klient-ö drar in en `server-only`-modul i klient-bundlen. **Deploy-grinden är INTE blockerad av next-build-fällan** (den som varje tidigare körning flaggade som "kunde ej verifiera här").

> Detta är det specifika felet `"You're importing a component that needs 'server-only'"` — det inträffar **inte** vid en `next build` av nuvarande kod.

---

## Vad som kontrollerades (metod)

Statisk hel-graf-reachability (script, ej ögonmått):

- **427 filer** skannade (`apps/web` + `packages/*`), **98 `use client`**, **18 `use server`**, **57 `server-only`**.
- Från varje klient-fil: bredden-först genom hela import-grafen.
- **`import type` / `export type` räknas EJ** — de raderas vid build (aldrig i bundlen). Korrekt uteslutna.
- **`'use server'`-filer = RPC-gräns** — traversering STANNAR där (deras kod bundlas aldrig till klienten, bara ett anrops-stub). Korrekt sink.
- **Dynamiska `import()`** inkluderade (de hamnar också i klient-grafen).
- Resolver täcker alla repo-alias: `@/*` → `apps/web/*`, `@corevo/{auth,db,db/types,ui,ui/tokens}`, relativa. **1 ouppslagen** i hela repot = `@corevo/config/eslint` i `eslint.config.mjs` (lint-config, ej app-graf) → irrelevant.

Konservativ åt rätt håll: metoden **över-rapporterar hellre än missar**. Resultatet 0 är därför starkt.

---

## K10–K17 — nyckel-öar, verdikt

| Klient-ö | Direktiv | Gräns |
|---|---|---|
| `storefront/OffertForm.tsx` (K17) | use client | ✅ ren |
| `admin/ImagePicker.tsx` (K13) | use client | ✅ ren |
| `admin/ShopAdmin.tsx` (K10/K13) | use client | ✅ ren |
| `admin/BloggAdmin.tsx` (K10/K13) | use client | ✅ ren |
| `admin/MediaLibrary.tsx` (K12) | use client | ✅ ren |
| `admin/PresentkortAdmin.tsx` (K11) | use client | ✅ ren |
| `platform/TenantPreviewFrame.tsx` (K15) | use client | ✅ ren |
| `platform/RolesMatrix.tsx` (G21) | use client | ✅ ren |

Plus: **ingen** klient-ö importerar `lib/supabase/server`, `lib/platform/guard` eller `lib/r2/upload` direkt.

---

## Två "träffar" som är FALSKA (läs — så de inte flaggas igen)

Första svepet flaggade 2 filer. **Båda är falska** — strängen `import 'server-only'` står bara i en **varnings-KOMMENTAR** i annars rena typ/konstant-filer:

1. **`lib/platform/preview-slots.ts`** — rad 4: `// ... this file MUST stay free of \`import 'server-only'\``. Filen = bara `export type` + `const` + en ren `parseInboundMessage`. **0 imports.** Ren.
2. **`lib/platform/catalog-shared.ts`** — rad 2–4: kommentar som förklarar att den medvetet INTE har `import 'server-only'` (RolesMatrix importerar `PERMISSION_AREAS`-värdet). Filen = bara typer + rena perm-helpers. Ren.

Detektorn rad-ankrades sen (kommentarer räknas ej) → **0 brott**. Behåll kommentarerna; de är rätt dokumentation, inte en bugg.

---

## ⚠️ Scope — vad detta INTE är

Detta certifierar **endast** klient/`server-only`-gränsen. Det **ersätter inte** en riktig `tsc` / `next build` (typer, JSX, exhaustiveness, env). Den biten kräver din maskin (repo-`node_modules` är Windows-byggt + ö:et i sökvägen kraschar opennext här — samma som varje körning).

### Kör på din maskin (sanningskällan)
```powershell
robocopy C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod C:\tmp\kod /E /XD node_modules .next .open-next .git .turbo /XF .env.local
cd C:\tmp\kod
pnpm install
pnpm --filter @corevo/web typecheck
pnpm --filter @corevo/web exec next build
```
Förväntat: gränsen är ren → inga `'server-only'`-bundle-fel. Kvarvarande ev. fel = typ/övrigt, ej denna fälla.

---

## Status denna körning

- **Väntande SQL = 0.** Ingen DB-ändring. Prod-invarianter: `tables_without_rls=0`, `content_slots=0`, 27 mallar / 249 slots, 1 tenant (deleted).
- **Ingen deploy.** Ingen kod ändrad (audit = read-only). Deploy-rutan i `LOG.md` oförändrad.
- Script: `/tmp/audit.mjs` (sandbox, ej committat — engångsverktyg; metoden dokumenterad ovan för reproduktion).
