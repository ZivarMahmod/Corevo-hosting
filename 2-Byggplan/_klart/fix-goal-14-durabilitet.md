# FIX-14 — Mejl-durabilitet + deploy-säkerhet (efter goal-14)

**Datum:** 2026-06-02
**Typ:** Autonom fix-brief för Claude Code — körs via /goal.
**Vad detta är:** Enda ingångspunkten. Läs först, sen HANDOFF.md + CLAUDE.md.

## Utgångsläge
Goal-14 är live och verifierat: bokningsbekräftelse + avbokning skickas via one.com-SMTP (Edge Function), från `booking@corevo.se`, per-salong-brandat, landar i inkorgen. Men live-deployen avslöjade tre lösa trådar som måste tätas så det inte driftar tillbaka:

1. **Kodens default-avsändare är fel stavning:** `email.ts`/`templates.ts` har default `Corevo <bokning@corevo.se>` (ett o). Det riktiga mejlkontot + domänen är `booking@corevo.se` (två o). Just nu räddas det av `NOTIFICATIONS_FROM` i dashboarden — men den raderas vid deploy (se #2).
2. **Deployen skrev över remote-config.** `pnpm run deploy` kördes mot top-level-miljön och wrangler rapporterade att den TOG BORT ur remote: custom-domän-rutterna `demo.corevo.se` + `booking.corevo.se` OCH `vars.NOTIFICATIONS_FROM` — eftersom de fanns i molnet men INTE i `wrangler.jsonc`. Domänerna överlevde den här gången, men en framtida deploy kan koppla bort dem → båda sajterna nere. Detta MÅSTE göras omöjligt.
3. **Bruten logga i mejlet.** `logo_url` är satt men `R2_PUBLIC_BASE_URL` saknas → mejlet visar en trasig bild-ikon i stället för att falla tillbaka på monogrammet.

## Autonomi-regler
- Alla tekniska val själv; fråga aldrig droppvis.
- En commit per punkt; `pnpm --filter @corevo/web typecheck` + `lint` + `vitest run` gröna före varje push.
- Allt via kod/CLI. POS på corevo.se orörd. ASCII-byggväg + `/PURGE` vid deploy (ö-bug).
- Zivars steg (R2-publik-URL-värde) är batchat nederst — vänta aldrig på det, bygg mekanismen ändå.

## Beslut som redan är fattade — stanna inte
- Avsändaradress överallt = `booking@corevo.se` (två o). Display-namn = salongens namn (oförändrat).
- `NOTIFICATIONS_FROM` och `R2_PUBLIC_BASE_URL` är PUBLIKA värden → de hör hemma som `vars` i `wrangler.jsonc` (inte bara dashboard), så deploys behåller dem. (Hemligheter som `EMAIL_RELAY_SECRET`/`SMTP_*` förblir secrets.)
- Custom-domänerna `demo.corevo.se` + `booking.corevo.se` ska vara definierade i `wrangler.jsonc` så en vanlig `deploy` ALDRIG kopplar bort dem.
- Mejl-loggan: rendera `<img>` BARA när `logoUrl` är en fullständig `https://`-URL; annars monogram. Aldrig en trasig bild.
- **Bilder ersätts, hopas inte.** En salong ska ha EN aktuell bild per slot (logga/hero[i]/galleri[i]/about/closing/team[i]). Laddar de upp en ny → den gamla raderas ur R2. Tar de bort en → objektet raderas. Inga döda/orphade filer. Idag genererar `uploadImage` ett nytt random-UUID-namn per uppladdning och raderar aldrig det gamla (`lib/r2/upload.ts:63`).

## Punkter

### FX1 — booking@ durabelt i koden
**Mål:** Default-avsändaren är `booking@corevo.se` i koden, inte beroende av dashboard.
**Bygg:** Ändra default i `apps/web/lib/notifications/email.ts` (`fromAddress()`/`NOTIFICATIONS_FROM`-fallback) + ev. `templates.ts`-kommentarer till `Corevo <booking@corevo.se>`.
**Klar när:**
- [ ] Grep i `apps/web` ger 0 träffar på `bokning@corevo.se` (ett o) som default/fallback.
- [ ] Default-avsändaren är `Corevo <booking@corevo.se>` när `NOTIFICATIONS_FROM` är osatt.
- [ ] Befintliga mejl-tester gröna.

### FX2 — Mejl-logga: monogram-fallback, aldrig trasig bild
**Mål:** Mejlet visar aldrig en bruten bild-ikon.
**Bygg:** I `templates.ts` `shell()`: rendera logo-`<img>` endast om `logoUrl` är en absolut `http(s)://`-URL; annars monogram (som idag).
**Klar når:**
- [ ] `shell()` med `logoUrl=''`/`null`/relativ → monogram (inget `<img>`).
- [ ] `shell()` med giltig `https://`-URL → `<img>`.
- [ ] Render-test täcker båda fallen.

### FX3 — wrangler.jsonc: deploys får aldrig riva domäner/vars
**Mål:** En vanlig `pnpm run deploy` (top-level) varken kopplar bort domänerna eller raderar from/R2-varsen.
**Bygg:** Lägg i `apps/web/wrangler.jsonc` (rätt miljö/top-level så `deploy`-kommandot träffar den): `vars.NOTIFICATIONS_FROM = "Corevo <booking@corevo.se>"`, `vars.R2_PUBLIC_BASE_URL = "https://pub-8f440f10134347eeb2491f9712f5a6f5.r2.dev"` (r2.dev-publik-URL, given av Zivar — sätt det riktiga värdet, ingen placeholder), och custom-domän-rutterna `demo.corevo.se` + `booking.corevo.se` (zone `corevo.se`, `custom_domain: true`). Verifiera mot den befintliga remote-konfigen så inget annat tappas.
**Klar när:**
- [ ] `wrangler.jsonc` innehåller båda custom-domänerna + `NOTIFICATIONS_FROM` + `R2_PUBLIC_BASE_URL`.
- [ ] En `wrangler deploy --dry-run` (eller deploy-diff) visar INGEN borttagning av `demo.corevo.se`/`booking.corevo.se`/`NOTIFICATIONS_FROM` ur remote.
- [ ] Dokumentera i `5-Kod/docs/ops/deploy-runbook.md` det säkra deploy-kommandot (rätt `--env` om så krävs) så framtida deploys inte skriver över remote oavsiktligt.

### FX4 — Liten doc-städ
**Bygg:** I `HANDOFF.md`: markera de två stale Resend-raderna i det arkiverade G10-blocket som "superseded av goal-14 (one.com SMTP)". Flytta `goal-14-mejl-egen-smtp.md` → `2-Byggplan/goals/_klart/` (verifierad klar). Lägg denna fix-brief i `_klart/` när FX1–FX3 är gröna.
**Klar när:**
- [ ] HANDOFF har ingen vilseledande "kräver RESEND_API_KEY" i nuläget.
- [ ] goal-14 + fix-14 i `_klart/`.

### FX5 — Bild-livscykel: ersätt, hopa inte
**Mål:** En salong har alltid EXAKT en aktuell fil per bild-slot i R2 — inga döda/orphade objekt.
**Bygg:** Vid branding-save (owner + platform): innan/efter en ny bild skrivs för en slot, **radera det tidigare objektet** ur R2 (`bucket.delete(oldKey)`). När en bild tas bort (slot rensas) → radera dess objekt. Härled R2-nyckeln ur den lagrade publika URL:en (strippa `R2_PUBLIC_BASE_URL`-prefixet). Gäller alla media-slots: logo, hero[], gallery[], about_image, closing_image, team[].img. Radering är best-effort — får ALDRIG kasta/blockera en save.
**Hint:** läs salongens nuvarande `settings.branding` FÖRE save → diffa gamla vs nya bild-URL:er → radera de som inte längre refereras. Lägg gärna en liten `deleteByPublicUrl(url)`-helper i `lib/r2/upload.ts`.
**Klar när:**
- [ ] Ladda upp logga två gånger → exakt ETT objekt för den sloten finns i R2 (det gamla raderat).
- [ ] Ta bort en galleri-bild → dess R2-objekt raderas.
- [ ] R2-delete som misslyckas loggar men kastar ej → saven lyckas ändå.
- [ ] Inga orphade objekt kvar efter en byt-bild-cykel (verifiera mot bucket-listing).

## Batchade uppföljningar — kräver Zivar, blockerar inte
1. ✅ **R2-publik-URL — KLAR.** Zivar har aktiverat r2.dev-publik-åtkomst, värde = `https://pub-8f440f10134347eeb2491f9712f5a6f5.r2.dev` (bakat in i FX3). Produktion senare: byt till egen subdomän `media.corevo.se` + se till att lagrade bild-länkar inte bryts (lagra helst R2-NYCKEL i DB, bygg URL vid render).
2. (Valfritt) Radera den stray Supabase-secreten som heter "ZivarMahmod's Project".

## När du är klar
Rapportera per punkt (FX1–FX5) med bevis + commit-hashar. Deploya och bekräfta (deploy-diff) att domänerna + varsen står kvar. STANNA efter FX5.

## Versionshistorik
| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-06-02 | Fix efter goal-14: booking@ durabelt, mejl-logga-fallback, wrangler deploy-säkerhet, doc-städ. |
