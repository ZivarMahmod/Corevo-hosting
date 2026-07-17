# Cron-schemaläggning

## Nuläge

`pending-expiry` och `reminders` körs var 15:e minut av
`.github/workflows/cron-booking.yml`. Båda anropas även om det första anropet
misslyckas, och ett icke-200-svar gör körningen röd. `workflow_dispatch` är
nödvägen för en manuell körning.

Detta är fortfarande en tillfällig drifträls. Schemalagda GitHub Actions är
best-effort, kan försenas och kan inaktiveras efter längre tids inaktivitet i
repot. Kontrollera därför regelbundet att workflowen fortfarande är aktiv och
att senaste körningen är grön. `CRON_SECRET` måste roteras samtidigt i Worker-
miljön och GitHub-repots secret; testa därefter en manuell körning.

Reminder-svepet kräver migration 0088. Den atomiska DB-claimen använder
`FOR UPDATE SKIP LOCKED`, unik körningstoken och en 15-minuters lease, så två
överlappande körningar inte kan skicka samma rad samtidigt. Ett icke-200 ska därför
alltid behandlas som en verklig retry-/driftvarning, inte döljas.

## Cloudflare Cron Triggers — utredning

**Slutsats: GÅR, men ska göras som en separat deployändring.** OpenNexts aktuella
dokumentation stöder en custom Worker som importerar den genererade
`.open-next/worker.js`, återanvänder dess `fetch` och lägger till en `scheduled`
handler. `wrangler.jsonc.main` behöver då peka på denna custom Worker och
`triggers.crons` behöver läggas till. Om DO Queue/DO Tag Cache används måste
OpenNexts Durable Object-exporter också återexporteras.

Det rör den produktionskritiska Worker-entryn och ska inte blandas in i denna
sweep. En separat ändring ska:

1. lägga till en minimal custom Worker enligt OpenNexts dokumenterade mönster,
2. koppla schemat till en intern, autentiserad körning av båda Next-rutterna,
3. behålla GitHub-workflowen som manuell nödräls under en verifieringsperiod,
4. verifiera cron-loggar, retries och att samma sweep inte kan överlappa osäkert,
5. deploya via `scripts/deploy-prod.mjs`, aldrig med en fristående bare deploy.

Källa: [OpenNext – Custom Worker](https://opennext.js.org/cloudflare/howtos/custom-worker).
