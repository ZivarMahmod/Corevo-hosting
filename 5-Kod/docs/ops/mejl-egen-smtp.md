# Transaktionell e-post via SMTP-relä

Corevo skickar transaktionell e-post från Cloudflare Workern över HTTPS till
Supabase Edge Function `send-email`, som ansluter till den godkända SMTP-tjänsten.
Workern får aldrig öppna en SMTP-anslutning direkt.

```text
Corevo Worker
  -> apps/web/lib/notifications/email.ts
  -> HTTPS + x-relay-secret
  -> supabase/functions/send-email
  -> SMTP över TLS
  -> mottagarens e-postserver
```

## Ägare och kontrakt

- Transportklient: `apps/web/lib/notifications/email.ts`.
- Mallar och orkestrering: `apps/web/lib/notifications/`.
- Relä: `supabase/functions/send-email/`.
- Publik avsändarkonfiguration: `NOTIFICATIONS_FROM` i Worker-konfigurationen.
- Worker-konfiguration: `EMAIL_RELAY_URL` och `EMAIL_RELAY_SECRET`.
- Edge Function-konfiguration: SMTP-värden och samma `EMAIL_RELAY_SECRET`.

Reläet kör utan Supabase-JWT och måste därför neka tom eller felaktig delad
hemlighet. Workern ska degradera till ett slutet `skipped`-resultat när reläet inte
är konfigurerat; e-postfel får inte rulla tillbaka en redan lyckad bokning eller
betalning.

## Aktivering

1. Verifiera att avsändardomänens SPF, DKIM och DMARC stämmer med SMTP-tjänsten.
2. Sätt SMTP-konfiguration och relähemlighet i rätt Supabase-miljö. Lägg aldrig
   värdena i Git, `.env`-exempel, logg eller dokumentation.
3. Deploya `send-email` till exakt den godkända Supabase-miljön med
   `verify_jwt=false`.
4. Sätt `EMAIL_RELAY_URL` och matchande `EMAIL_RELAY_SECRET` som Worker-hemligheter.
5. Bygg och deploya Workern endast genom den vanliga
   [deploy-runbooken](deploy-runbook.md).
6. Kontrollera först reläets auth-/metodfel och skicka därefter ett godkänt canary
   till en kontrollerad mottagare.
7. Kör ett end-to-end-flöde och kontrollera From, Reply-To, SPF/DKIM/DMARC,
   leverans och att loggarna saknar mottagare, meddelandetext och hemligheter.

Liveleverans är inte verifierad bara för att koden bygger eller Edge Function svarar.
Den kräver mottagen canary i aktuell miljö.

## Felsökning

| Symtom                                  | Kontroll                                          |
| --------------------------------------- | ------------------------------------------------- |
| Workern returnerar `skipped`            | Worker-URL/hemlighet och rätt miljö               |
| Reläet svarar `401`                     | delad hemlighet på båda sidor                     |
| Reläet svarar `503 smtp_not_configured` | SMTP-konfiguration i Edge Function                |
| Reläet svarar `502 smtp_send_failed`    | TLS, konto, avsändare och SMTP-leverantörens logg |
| Levererat men hamnar i skräppost        | SPF, DKIM, DMARC och From-alignment               |

Kopiera inte providerfel eller råa meddelanden till applikationsloggen. Använd slutna
felkoder och leverantörens skyddade driftvy.

## Rollback

1. Ta bort eller rotera Worker-relähemligheten för att stoppa nya anrop.
2. Rotera relähemligheten i Edge Function vid misstänkt läcka.
3. Behåll affärshändelserna i den durabla outboxen; skapa inte en andra kö.
4. Rulla tillbaka kod endast genom ordinarie releaseflöde.
5. Återaktivera först efter ny auth-, canary- och leveranskontroll.
