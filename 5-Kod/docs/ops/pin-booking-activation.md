# PIN-verifierad bokning

Det publika bokningsflödet använder en fyrsiffrig engångskod innan bokningen skapas.
Tenantens `settings.booking.verificationMode` väljer `sms_only`,
`sms_with_email_fallback` eller `email_only`. SMS går direkt via Giada; e-post går
via det etablerade e-postreläet.

## Kanoniska ägare

| Område                              | Ägare                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Tenantläge                          | `apps/web/lib/platform/booking-variant.ts`                                     |
| Start, omskick, avbryt och finalize | `apps/web/lib/booking/actions.ts`                                              |
| PIN/HMAC och kanaltransport         | `apps/web/lib/booking/verification.ts`                                         |
| Giada health/send                   | `apps/web/lib/notifications/giada.ts`                                          |
| Atomiska DB-kontrakt                | `supabase/migrations/0118_pin_booking_verification.sql` och senare migrationer |
| E-postreserv                        | [e-postrunbooken](mejl-egen-smtp.md)                                           |

## Flöde

1. Workern läser tenantens verifieringsläge.
2. `email_only` väljer e-post. Övriga lägen läser Giadas färska `/health`.
3. Frisk och online Giada väljer SMS. Fel, timeout eller stale health väljer e-post
   endast när tenantläget tillåter fallback; `sms_only` failar stängt.
4. `start_booking_verification` skapar challenge, tids-hold och PIN-outbox atomiskt.
5. Workern skickar den klara koden direkt och markerar leveransen. Klar PIN lagras
   inte i databasen och kan därför inte auto-retryas senare.
6. `finalize_verified_storefront_booking` verifierar challenge, session, kontakt,
   kod och bokningsdata och skapar bokning + bekräftelse-outbox atomiskt.

Samma request/challenge ska vara idempotent. Ett tappat svar får återanvända samma
bokning; det får inte skapa en andra bokning.

## Serverkonfiguration

- `BOOKING_PIN_PEPPER`: unik serverhemlighet för HMAC.
- `GIADA_SMS_BASE_URL`: godkänd HTTPS-bas.
- `GIADA_SMS_API_KEY`: server-only API-nyckel.
- `GIADA_HEALTH_MAX_AGE_SECONDS`: högsta tillåtna health-ålder.
- `GIADA_HEALTH_TIMEOUT_MS`: health-timeout.
- `GIADA_SEND_TIMEOUT_MS`: send-timeout.
- e-postreläets Worker-konfiguration när e-post eller fallback används.

Värdena får aldrig ligga i Git, klientmiljö, dokument eller logg. Giada får inte ha
Supabase-credentials och får inte claima Corevos affärs-outbox.

## Aktiveringsgrind

1. Verifiera migrationshistorik och schema enligt
   [databasmigrations-runbooken](database-migration-drift.md).
2. Verifiera tenantens exakta `verificationMode`.
3. Verifiera att pepper och transportkonfiguration finns i rätt Worker-miljö.
4. Kontrollera Giada health: autentiserad tjänst frisk, modem online och tidsstämpel
   inom den konfigurerade åldern.
5. Bevisa e-postleverans innan ett fallbackläge aktiveras.
6. Kör en uttryckligen godkänd SMS-canary och kontrollera idempotens utan att logga
   nummer eller text.
7. Kör ett fullständigt test: start, leverans, fel kod, omskick, finalize, tappat
   finalize-svar och exakt en bokning/outbox.
8. Kontrollera offlinefallet: inget Giada-jobb, hold släpps och endast tillåten
   fallback erbjuds.

Kod-, health- och canarybevis är separata. Rapportera aldrig kanalen som live innan
alla tre är verifierade i aktuell miljö.

## Incident och rollback

1. Stäng först fysisk sändning på Giada. Health ska därefter inte kunna väljas som
   SMS-frisk.
2. Ta vid behov bort eller rotera Worker-nyckeln.
3. Byt berörda tenants till `email_only` endast om e-postleveransen är verifierad;
   annars stoppar verifieringen fail-closed.
4. Behåll `BOOKING_PIN_PEPPER`, challenges, holds och outbox för säker avstämning.
5. Rulla inte tillbaka databasmigrationer medan challenge-/outboxrader kan finnas.
6. Granska endast slutna felkoder, maskerade kontakter och slutlig bokningsstatus.
