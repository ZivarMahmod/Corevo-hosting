# FIX-24: Ombygg + redeploy — .env.local läckte in i gårdagens bygge → alla tenant-subdomäner 404
Thinking: 🟡 (känd felklass, dokumenterad fix, men prod är nere → noggrannhet på guarden)

## Mål
`freshcut.corevo.se` ska rendera storefronten igen (salvia-temat). Goal-23-flaggan (`DOMAIN_PROVISIONING_ENABLED=true`) ska FÖLJA MED i det nya bygget — ingen rollback.

## Lägeskoppling
HANDOFF 2026-06-07-blocket: goal-23 deployades via `C:\tmp\kod` med robocopy `/MIR /XD node_modules .next .open-next` — **utan att radera `.env.local`**. Verifierat 2026-06-07 (Cowork): freshcut.corevo.se visar "Sidan kunde inte hittas"; repo:ts `5-Kod/apps/web/.env.local` innehåller `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000` + `NEXT_PUBLIC_SITE_URL=localhost:3000`. Identisk incident 2026-06-03 (HANDOFF "Grundorsak till nattens 404").

## Kontext
- Next inlinar `NEXT_PUBLIC_*` vid BYGGTID. `.env.local` i byggträdet vinner → localhost inlinas som root-domän → subdomän-klassningen i middleware känner inte igen `*.corevo.se` → tenant=null → 404.
- `wrangler.jsonc` har korrekta `vars`, men de räddar inte det som redan inlinats i bundlen.
- Bygg ALLTID från `C:\tmp\kod` (ö:et i repo-vägen kraschar opennext — känt).
- Smoke via HTTP-status räcker INTE (404-sidan svarar 200). Verifiering = innehåll.

## Berörda filer
- `C:\tmp\kod\apps\web\.env.local` — RADERAS ur byggträdet (repo-filen rörs EJ — den behövs för lokal dev)
- Ingen kodändring. Ren ombygg + deploy.

## Steg
1. Synka byggträdet färskt: `robocopy C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod C:\tmp\kod /MIR /XD node_modules .next .open-next .git`
2. `del C:\tmp\kod\apps\web\.env.local` (MÅSTE — /MIR återkopierar den, därför ALLTID del efter synk)
3. Verifiera att flaggan följde med: `findstr "DOMAIN_PROVISIONING_ENABLED" C:\tmp\kod\apps\web\wrangler.jsonc` → ska visa `"true"`
4. `cd C:\tmp\kod\apps\web` → installera deps om saknas → `pnpm exec opennextjs-cloudflare build`
5. **GREP-GUARD (gate, hoppa ALDRIG):** sök `localhost:3000` i byggd output (`.open-next`). Enda tillåtna träffen = `DEFAULT_ROOT`-konstanten. Andra träffar → STOPP, deploya inte, rapportera.
6. `pnpm exec opennextjs-cloudflare deploy`
7. Fånga + logga **version-ID** ur deploy-outputen (missades igår — HANDOFF 🔲 punkt 3).

## Verifiering
- [ ] `freshcut.corevo.se` renderar storefront-INNEHÅLL (hero "Skarpt klippt…", tjänster) — kolla HTML-body, inte bara HTTP-status
- [ ] `corevo.se` (POS) 200 + orörd
- [ ] `booking.corevo.se` → /login 200
- [ ] DomänPanelen (`/salonger/[id]` → Domän, som platform@) visar AKTIVT formulär, ej ⛔-banner
- [ ] 0 console-fel på freshcut + /login
- [ ] Version-ID noterat (för HANDOFF + rollback-rad)

## Anti-patterns
- Bygg ALDRIG direkt i `firsör-sas` (ö-krasch).
- Lita ALDRIG på robocopy-flaggor för att hålla `.env.local` ute — radera filen explicit, varje gång.
- HTTP 200 ≠ funkar — 404-staten svarar 200. Verifiera innehåll.
- Rollbacka INTE workern som fix (tar bort goal-23-flaggan i onödan) — ombygget ÄR fixen.

## Kopplingar
goal-23 (`2-Byggplan/goals/goal-23-domanpanel-self-serve.md`), HANDOFF 2026-06-07-blocket (🔲 KVAR-listan), incident 2026-06-03 (.env.local-footgun), `5-Kod/docs/ops/custom-domains-ops.md`.

## Rollback
`wrangler rollback <förra version-ID> --config wrangler.jsonc` (hämta ID via `pnpm exec wrangler deployments list`). Obs: rollback släcker goal-23-flaggan — bara om ombygget självt felar.
