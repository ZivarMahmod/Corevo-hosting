## Goal 10 — Säkerhet, compliance & drift

**Spår:** Härdning · **Beror på:** G05, G06, G07, G09 · **Modul:** tvärgående (M9-ops)

**Mål:** Härda hela plattformen inför produktion: bekräfta RLS-täckning, GDPR-funktioner, notiser, loggning/övervakning, rate-limiting och säkerhetsheaders — så Corevo kan drivas tryggt.

**Kontext:** Hela kärnan (M2–M8) byggd och fungerar. RLS finns sedan G02. R2 + Stripe klara. Notiser har stubbats tidigare.

**Omfattning (bygg detta):**
- **RLS-revision:** automatiskt test som itererar alla tenant-tabeller och bekräftar att cross-tenant-läsning ger 0 rader; ingen tabell utan RLS.
- **GDPR:** export av kunddata + radering ("rätten att bli glömd") per profil, med audit-loggning.
- **Notiser:** koppla in faktiska bokningsbekräftelser/påminnelser (e-post via t.ex. Resend; SMS-krok valfri) — ersätt stubbarna från G04/G05.
- **Säkerhetsheaders:** CSP, HSTS, X-Frame-Options, referrer-policy (Next config / middleware).
- **Rate-limiting** på auth- och boknings-endpoints (Cloudflare-lager eller app-lager).
- **Loggning/övervakning:** strukturerad loggning + felrapportering (Sentry el. motsv.), `audit_log` används konsekvent.
- **Backup/återställning:** dokumentera Supabase-backuprutin + R2-versionering.
- **Secrets-hygien:** verifiera att inga hemligheter i klientbundlar; service-role endast server-side.

**Utanför scope:**
- Ny affärsfunktionalitet.
- Penetrationstest (extern, senare).

**Berörda områden/filer:** `5-Kod/next.config.*`, `5-Kod/middleware.ts`, `5-Kod/lib/notifications/`, `5-Kod/lib/gdpr/`, `5-Kod/supabase/tests/`, `5-Kod/lib/observability/`.

**Steg:**
1. Skriv RLS-täckningstest (alla tabeller) + cross-tenant-negativtest.
2. GDPR-export/radering-Actions + UI-knapp i kundprofil och admin.
3. Integrera e-postnotiser (bekräftelse, påminnelse, avbokning).
4. Säkerhetsheaders + CSP.
5. Rate-limiting på känsliga routes.
6. Sentry/loggning + säkerställ audit-loggning på admin/platform-åtgärder.
7. Dokumentera backup/restore.
8. Skanna klientbundle efter läckta secrets. `pnpm build` + lint.

**Verifieras (DoD):**
- RLS-test passerar för ALLA tenant-tabeller (ingen utan policy).
- GDPR-export ger kundens data; radering tar bort/anonymiserar + loggas.
- En riktig bokning skickar bekräftelsemail.
- Säkerhetsheaders syns i response (verifiera).
- Rate-limit aktiv på auth/boka.
- Inga secrets i klientbundle (verifierat).
- `pnpm build` grön.

**Tekniska noter:**
- E-post via Cloudflare-kompatibel leverantör (Resend funkar på Workers). Ingen Node-only-SMTP som bryter på Workers-runtime.
- CSP måste tillåta Stripe + Supabase domäner.
- GDPR-radering: hantera bokningshistorik (anonymisera vid behov för bokföring, radera persondata).
- Rate-limiting: föredra Cloudflare-lager (WAF/Rate Limiting Rules) för auth; app-lager som komplement.
