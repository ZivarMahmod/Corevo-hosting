# goal-30 — fixa korrupt git → commit + push main → bygg + deploy allt byggt

> **⚠️ STATUS-KORRIGERING 2026-06-17:** SHIPPED LIVE 2026-06-15 (multibransch-motorn K10–K20, worker `769c55aa`, push `90c56ab..af9e0f2`). Git var EJ korrupt (sandbox-artefakt) — rapport-frågan besvarad. Flytta till `klart/`. OBS: freshcut-storefront-render var overifierbar (0 aktiva tenants + ingen DNS/cert) — den DoD-raden kunde aldrig bevisas.

Thinking: ⚫ (rör git-integritet + prod-deploy — backup + rollback OBLIGATORISK · Zivar-OK för deploy GIVET 2026-06-15)

## Mål
Allt som byggts (multibransch-motorn K10–K20: moduler-admin, onboarding-väljare, terminologi, bild-väljare, offert) ligger ej deployat, och git-indexet är korrupt så ingenting kan committas/pushas. Fixa git utan att förlora historik → committa det äkta deltat → push `main` → bygg + deploy → verifiera att FreshCut/POS är orörda. Efter detta SYNS motorn live = loopen bryts.

## Lägeskoppling
Fas A i `2-Byggplan/ROADMAP-bryt-loopen-2026-06-15.md`. Förutsättning för Fas B (bevisa multi-bransch på en riktig kund).

## Kontext (verifierat 2026-06-15 från sandbox — bekräfta på riktig maskin)
- **Historiken är HEL:** `main` = `90c56ab` (giltig commit "feat(multibransch): grund + onboarding + storefront-gating + moduler-kort + katalog"), 4683 objekt, origin = `github.com/ZivarMahmod/Frisor-sas`.
- **Korrupt:** `.git/index` (bad sha1 signature) + `.git/logs/HEAD` (reflogg). Därför visar `git status` ~1032 "nya" filer och `HEAD` läses ej. Detta KAN delvis vara ö-sökvägen i en sandbox — därför: diagnostisera på riktiga maskinen FÖRST.
- **Inget deployat sedan 2026-06-14** (pre-K10). DB-migrationer 0026–0037 är redan applicerade på prod (`clylvowtowbtotrahuad`). Väntande SQL = 0.

## Diagnostisera FÖRST (gissa inte)
Kör i repo-roten `C:\Users\Zivar-PC\Desktop\firsör-sas`:
```
git status
git fsck --full
git log --oneline -5
```
- Om git är HELT frisk (ingen index-korruption på din disk) → det var sandbox-artefakten. Hoppa Steg 2, gå direkt till Steg 3 (commit/push).
- Om index/HEAD-fel bekräftas → kör Steg 1–2.

## Steg
1. **BACKUP (obligatorisk, före allt annat):** `robocopy "C:\Users\Zivar-PC\Desktop\firsör-sas\.git" "C:\tmp\firsor-git-bak-20260615" /E`. Verifiera kopian finns.
2. **Laga indexet (icke-destruktivt — rör EJ commits/working files):**
   - Säkerställ HEAD pekar rätt: `git symbolic-ref HEAD refs/heads/main`
   - `del .git\index` → `git reset` (mixed; bygger om indexet från HEAD). Alternativ: `git read-tree HEAD`.
   - Om reflogg-fel kvarstår: `del .git\logs\HEAD` (rensar bara reflogg-historik — commits orörda).
   - Verifiera: `git status` visar nu ÄKTA delta · `git log --oneline -5` funkar · `git fsck` rent.
3. **Committa det äkta deltat.** Granska `git status`. Committa i logiska bitar (kod / planering / docs) med tydliga meddelanden. Verifiera att råa template-dumpar i `4-Dokument-Underlag/03-template-katalog/` är gitignorade (ska EJ committas). Inga `.env*`.
4. **Push:** `git push origin main`. Om `main` divergerat från origin → granska FÖRST, **ingen `--force` utan Zivars OK**.
5. **Bygg via `C:\tmp\kod` (ö-path kraschar opennext):**
   ```
   robocopy C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod C:\tmp\kod /E /XD node_modules .next .open-next .git .turbo /XF .env.local
   cd C:\tmp\kod
   pnpm install
   pnpm --filter @corevo/web test
   pnpm --filter @corevo/web typecheck
   pnpm --filter @corevo/web lint
   ```
   Gates: vitest grönt · typecheck 0 · lint 0 · opennext/next build PASS · grep-guard ren (ingen `localhost:3000`, ingen `*.corevo.se`-route-läcka). **Failar en gate → deploya INTE, rapportera.**
6. **Deploy:**
   ```
   $env:NEXT_PUBLIC_ROOT_DOMAIN="corevo.se"; $env:NEXT_PUBLIC_PLATFORM_HOST="booking.corevo.se"; $env:NEXT_PUBLIC_SITE_URL="https://booking.corevo.se"; $env:NEXT_PUBLIC_TENANT_MODE="live"
   pnpm --filter @corevo/web run deploy
   ```
   Fånga **worker-version-id + föregående (rollback) id**.
7. **Live-verifiera (innehåll, ej bara HTTP):**
   - `corevo.se` POS **orörd** (200, ingen storefront-markör)
   - `booking.corevo.se/login` 200, 0 console-fel
   - `freshcut.corevo.se` storefront renderar (title + hero), 0 console-fel
   - Inloggad: admin-ytorna (webshop/blogg/offerter/lojalitet/presentkort/media) finns bakom modul-grind ("inte aktiverad"-notis när off) · onboarding-wizarden laddar med bransch + temaval
   - INGEN regression mot FreshCut.

## Verifiering
- [ ] Git: `fsck` rent, `log` funkar, äkta delta committat + pushat till origin/main
- [ ] Gates gröna (vitest/typecheck/lint/build/grep-guard)
- [ ] Worker live, version + rollback-id noterade
- [ ] POS orörd · FreshCut orörd · admin-ytor + wizard syns · 0 console-fel

## Anti-patterns
- ALDRIG `git reset --hard`, ALDRIG `git push --force` utan Zivars uttryckliga OK, ALDRIG radera `.git` utan verifierad backup.
- Rör EJ `packages/auth` (FRYST G02), POS/`root`, DAL-fence.
- Bygg ALDRIG i repo-roten (ö-path) — bara via `C:\tmp\kod`.
- Deploya ALDRIG om en gate failar.

## Rollback
- **Git:** återställ `C:\tmp\firsor-git-bak-20260615` → `.git`.
- **Deploy:** `wrangler rollback <föregående-id> --config 5-Kod/apps/web/wrangler.jsonc`.

## Rapportera
Var indexet korrupt på riktigt eller sandbox-artefakt? · äkta commit-delta · push-resultat · gate-resultat · worker-version + rollback-id · live-verifiering. Cowork/Nörden gör oberoende live-verifiering efteråt (lita ej på "klart").
