# 14 — Goal: Mejl via egen SMTP (one.com) + per-salong-mall + Reply-To

**Datum:** 2026-06-02
**Typ:** Autonom byggorder för Claude Code — körs via /goal.
**Vad detta är:** Enda ingångspunkten för körningen. Läs filen först, sen HANDOFF.md + CLAUDE.md.

## Utgångsläge — var projektet står
- Notis-systemet är byggt och fungerar i abstraktion: `apps/web/lib/notifications/email.ts` (`sendEmail`), `booking.ts` (orkestrering: `sendBookingConfirmation`/`Cancellation`/`Reminder`/`Rebook`, `sendPaymentReceipt`), `templates.ts` (Corevo-brandad HTML), `google-review.ts`, `reminders.ts`, `parse.ts`, `settings.ts`.
- Idag skickar `sendEmail` via **Resend HTTP-API** (`https://api.resend.com/emails`) och no-op:ar när `RESEND_API_KEY` saknas.
- `sendEmail` stöder redan `replyTo` i sin signatur, MEN orkestreringen (`safeSend` i `booking.ts`) skickar **aldrig** vidare `replyTo`, och From-namnet är globalt ("Corevo").
- Mallen (`templates.ts`) är Corevo-brandad (forest/guld), **inte** per-salong. `shell(title, bodyHtml, tenantName, eyebrow?)`.
- Salongsdata finns: `settings.branding` (`@corevo/ui TenantBranding`) har `color_primary`, `color_accent`, `logo_url`. Slogan = temats `tagline` (`components/storefront/theme-content.ts` → `THEME_CONTENT[theme].tagline`, eller `resolveThemeContent`). Salongens kontaktmejl = `settings.contact.email`.
- Stacken kör på Cloudflare Workers → klassisk SMTP (nodemailer) går INTE i Workern. Lösning: Supabase Edge Function (Deno) som SMTP-relä.

## Uppdraget
Byt mejl-transporten från Resend till **salongens/Corevos egen one.com-SMTP**, via en **Supabase Edge Function** som tunn SMTP-relä, OCH gör mejlen **per-salong-brandade** med **Reply-To = salongens mejl** och **From-namn = salongens namn** (adress kvar `bokning@corevo.se`).

Slutresultat: kunden får ett mejl som ser ut att komma från salongen (namn + logga + slogan + accentfärg), skickat från `bokning@corevo.se`, och trycker kunden "svara" går det till salongens egen mejl — aldrig till bokning@corevo.se. Ingen Resend.

## Autonomi-regler
- Du fattar alla tekniska val själv — fråga aldrig droppvis.
- En commit per punkt (E1…E5); tsc + eslint + notis-tester gröna före varje push.
- Allt via kod / migration / CLI — aldrig manuell dashboard.
- Genuint mänskliga steg (one.com-mejlkonto + secrets) är batchade nederst — du väntar ALDRIG på dem, bygg klart mekanismen utan dem (graceful no-op precis som dagens Resend-väg).
- POS på corevo.se orörd. Följ `private.tenant_id()`, `staff`/`staff_id`, build-once-never-delete.
- ASCII-byggväg pga ö-bug: robocopy till `C:\tmp\kod` med **/PURGE** före deploy (se HANDOFF).

## Beslut som redan är fattade — stanna inte för dessa
- **Transport = Supabase Edge Function** (`supabase/functions/send-email/`), Deno, nodemailer mot one.com SMTP (Supabase officiella `send-email-smtp`-exempel). INTE worker-mailer, INTE DB-webhook. Workern anropar funktionen över HTTPS.
- **one.com SMTP:** `SMTP_HOSTNAME=send.one.com`, `SMTP_PORT=465` (implicit TLS, `secure:true`), `SMTP_USERNAME`/`SMTP_PASSWORD` = `bokning@corevo.se`-kontots inlogg (Edge Function-secrets).
- **Funktionen skyddas** med en delad hemlighet: header `x-relay-secret` måste matcha `EMAIL_RELAY_SECRET`; annars 401. Så bara vår Worker kan anropa den.
- **Workern → funktionen:** `email.ts` POST:ar `{from, to, subject, html, replyTo}` till `EMAIL_RELAY_URL` med header `x-relay-secret: EMAIL_RELAY_SECRET`.
- **Graceful degrade:** saknas `EMAIL_RELAY_URL` eller `EMAIL_RELAY_SECRET` → `sendEmail` loggar `email.skipped` och returnerar `{ok:false, skipped:true}` (kastar aldrig). Exakt samma kontrakt som dagens Resend-no-op. Behåll recipient-valideringen.
- **From:** display-namn = salongens namn, adress från `NOTIFICATIONS_FROM` (default `bokning@corevo.se`). Bygg `"<SalongNamn>" <bokning@corevo.se>` per utskick. Escapa namnet.
- **Reply-To:** `settings.contact.email`. Saknas → utelämna Reply-To (svar går då till From). Förfalska aldrig.
- **Per-salong-brand i mallen:** `accentColor` ← `branding.color_accent || branding.color_primary || Corevo-guld #F5A623`. `logoUrl` ← `branding.logo_url` (annars monogram av första bokstaven i namnet). `slogan` ← temats `tagline`. "Drivs av Corevo" kvar litet i foten. Behåll `accentForeground()` för läsbar knapptext på vald accent.
- **Resend tas bort** som transport (ta bort `RESEND_ENDPOINT`-anropet). Lämna ingen död Resend-kod.

## Punkter

### E1 — Supabase Edge Function: SMTP-relä
**Mål:** En deploybar Edge Function som tar emot ett renderat mejl och skickar via one.com SMTP.
**Krav/Bygg:**
- `supabase/functions/send-email/index.ts` (Deno). Använd nodemailer (Supabase officiella SMTP-exempel-mönster), `host=SMTP_HOSTNAME`, `port=SMTP_PORT`, `secure:true`, auth `SMTP_USERNAME`/`SMTP_PASSWORD`.
- POST JSON `{from, to, subject, html, replyTo?}`. Validera fält. Sätt `replyTo` bara om satt.
- Auth: kräv header `x-relay-secret` == `EMAIL_RELAY_SECRET`, annars `401`.
- Svar: `200 {ok:true, id?}` vid skickat, `4xx/5xx {ok:false, error}` annars. Logga inte hemligheter.
- `supabase/functions/send-email/deno.json` / ev. import map om det behövs.

**Klar när:**
- [ ] `supabase/functions/send-email/index.ts` finns och exporterar en `Deno.serve`-handler.
- [ ] Anrop utan korrekt `x-relay-secret` ger 401 (verifierbart i koden: tidig guard före SMTP).
- [ ] Saknade obligatoriska fält (`to`/`subject`/`html`/`from`) ger 400.
- [ ] SMTP-konfig läses från env `SMTP_HOSTNAME/SMTP_PORT/SMTP_USERNAME/SMTP_PASSWORD`, inget hårdkodat.
- [ ] `supabase functions deploy send-email` lyckas (eller dokumentera exakt kommando om CLI-login krävs av Zivar — då batcha det nederst).

### E2 — `email.ts`: byt transport Resend → Edge Function
**Mål:** `sendEmail` skickar via reläet istället för Resend, med oförändrat anropskontrakt mot resten av appen.
**Krav/Bygg:**
- Ta bort Resend-anropet. POST till `process.env.EMAIL_RELAY_URL` med header `x-relay-secret: process.env.EMAIL_RELAY_SECRET`, body `{from, to, subject, html, replyTo?}`.
- `sendEmail`-args utökas: `from?` (override för display-namn-adress). Default `fromAddress()` = `NOTIFICATIONS_FROM ?? 'Corevo <bokning@corevo.se>'`.
- Behåll: recipient-regex-validering, graceful no-op när `EMAIL_RELAY_URL`/`EMAIL_RELAY_SECRET` saknas, `SendResult`-typen, all try/catch (kastar aldrig).

**Klar när:**
- [ ] Ingen referens till `api.resend.com` eller `RESEND_API_KEY` kvar i `email.ts`.
- [ ] `sendEmail` POST:ar till `EMAIL_RELAY_URL` med `x-relay-secret`-headern.
- [ ] Utan `EMAIL_RELAY_URL` eller `EMAIL_RELAY_SECRET` → returnerar `{ok:false, skipped:true}`, kastar ej (verifierbart i test).
- [ ] `sendEmail` accepterar och vidarebefordrar `from` och `replyTo`.

### E3 — Per-salong-brandad mall (`templates.ts`)
**Mål:** Mallen bär salongens accentfärg, logga och slogan; Corevo blir liten powered-by.
**Krav/Bygg:**
- Utöka `BookingEmailData` med `accentColor?: string`, `logoUrl?: string | null`, `slogan?: string | null`.
- `shell(...)`: använd `accentColor` (fallback Corevo-guld) för topp-bar + CTA-knapp + eyebrow-färg. Visa `logoUrl` som `<img>` (plain, ingen next/image) högst upp; saknas → monogram (första bokstaven i `tenantName`) i accent-cirkel. Visa `slogan` under namnet om satt. Behåll "Drivs av Corevo" i foten. Använd `accentForeground()` (`@corevo/ui`) för knapptext-kontrast.
- Applicera på ALLA mallar: `confirmationEmail`, `cancellationEmail`, `reminderEmail`, `receiptEmail`, `rebookEmail`, och `google-review.ts`-shell:en.
- Inline-styles only (mejl-säkert), behåll table-layout + 520px.

**Klar när:**
- [ ] `BookingEmailData` har `accentColor`, `logoUrl`, `slogan`.
- [ ] `shell()` renderar accentfärg på topp-bar + knapp; faller tillbaka på guld när `accentColor` saknas.
- [ ] `logoUrl` renderas när satt; annars monogram av `tenantName`.
- [ ] Alla 5 mall-funktionerna + google-review använder den uppdaterade shell:en utan tsc-fel.
- [ ] Ingen `var(--...)`/extern CSS i mejl-HTML (bara inline).

### E4 — Tråda salongsdata genom orkestreringen + call-sites
**Mål:** Varje mejl får rätt From-namn, Reply-To och brand-fält.
**Krav/Bygg:**
- `booking.ts`: `safeSend` (och övriga sändare) ska skicka `replyTo` (salongens mejl) och `from` (`"<namn>" <bokning@corevo.se>`) till `sendEmail`, samt fylla `accentColor/logoUrl/slogan` i `BookingEmailData`.
- Inför en liten resolver (t.ex. `resolveEmailBrand(settings, theme)`) som ger `{fromName, replyTo, accentColor, logoUrl, slogan}` ur `settings` (branding + contact) + temats tagline. Återanvänd `resolveThemeContent`/`THEME_CONTENT` för tagline.
- Uppdatera call-sites så de skickar in settings/tenant: `app/boka/actions.ts`, kund-rebook (`lib/kund/actions.ts`), Stripe-webhook-kvitto (`app/api/stripe/webhook/route.ts`), `lib/notifications/reminders.ts`, `google-review.ts`. De som redan har `supabase`+`tenantId` läser branding/contact därifrån.
- Reply-To utelämnas när `contact.email` saknas. From-namn faller tillbaka på "Corevo" om tenantName saknas.

**Klar när:**
- [ ] `safeSend`/sändarna skickar `replyTo` + `from` till `sendEmail` (ej hårdkodat globalt).
- [ ] Bekräftelse-, avboknings-, påminnelse-, kvitto-, omboknings- och review-mejl får alla salongens From-namn + Reply-To när data finns.
- [ ] `accentColor/logoUrl/slogan` fylls från `settings.branding` + temats tagline.
- [ ] Saknad `contact.email` → inget Reply-To skickas (verifierbart i test).
- [ ] Inga call-sites kvar som anropar de gamla signaturerna utan salongsdata (tsc grönt).

### E5 — Verifiering + deploy
**Mål:** Allt grönt och deployat; live-mejl-test dokumenterat för när secrets är satta.
**Krav/Bygg:**
- `pnpm --filter @corevo/web typecheck` + `lint` + `vitest run` (notis-tester) gröna. Lägg/uppdatera ett enhetstest som bevisar: (a) no-op utan relä-secrets, (b) Reply-To utelämnas utan contact-mejl, (c) From-namn byggs av tenantName.
- Bygg + deploy Workern (ASCII-väg + /PURGE). Deploy Edge Function.
- Dokumentera i `5-Kod/docs/ops/` exakt vilka secrets som ska sättas var (Edge Function vs Worker) + hur man kör ett live-testmejl.

**Klar när:**
- [ ] typecheck + lint + vitest gröna (klistra utdrag i rapporten).
- [ ] Worker deployad live, alla rutter 200.
- [ ] Edge Function deployad.
- [ ] `5-Kod/docs/ops/mejl-egen-smtp.md` finns med secrets-tabell + live-test-steg.
- [ ] HANDOFF.md NULÄGE + TESTA-DETTA uppdaterade (Resend ersatt av one.com-väg).

## Batchade uppföljningar — kräver människa, blockerar inte bygget
Markera som "pending-owner" i rapporten, vänta inte:
1. **Zivar:** skapa `bokning@corevo.se` i one.com → notera SMTP-användare + lösen.
2. **Secrets på Edge Function** (Supabase): `SMTP_HOSTNAME=send.one.com`, `SMTP_PORT=465`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_RELAY_SECRET`.
3. **Secrets på Workern:** `EMAIL_RELAY_URL` (funktionens URL), `EMAIL_RELAY_SECRET` (samma värde), `NOTIFICATIONS_FROM=Corevo <bokning@corevo.se>`.
4. Efter secrets: kör live-testmejlet enligt ops-docen.

## När du är klar
Rapportera per punkt (E1–E5) med bevis (kommando-utdrag, commit-hashar). Pusha till main först när ALLT är grönt. STANNA efter E5 — hitta inte på nya uppgifter. Lista "pending-owner"-stegen så Zivar ser dem.

## Versionshistorik
| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-06-02 | Första brief — Resend → one.com SMTP via Edge Function, per-salong-mall, Reply-To/From. |
