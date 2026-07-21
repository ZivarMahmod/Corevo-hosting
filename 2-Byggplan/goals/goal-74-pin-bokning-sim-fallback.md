# goal-74 — Verifierad publik bokning via SMS eller e-post

> Startad 2026-07-21 på Zivars uttryckliga prioritering. Goal-73 är mekaniskt
> verifierad men ligger kvar i väntan på Zivars fysiska liveacceptans.

## Mål

En publik bokning skapas först efter att besökaren verifierat sin valda
kontaktväg med en sexsiffrig PIN. En frisk Giada-gateway ger telefon/SMS; en
offline eller stale gateway ger e-post utan att besökaren först behöver misslyckas.
PIN och bokningsbekräftelse dispatchas direkt och är inte beroende av den
befintliga 15-minuterskörningen för schemalagda notifieringar.

## Designlag

- `1-Planering/18-sms-direktoperator/02-PIN-BOKNING-SIM-FALLBACK-DESIGN.md`
- `1-Planering/18-sms-direktoperator/03-PIN-BOKNING-SIM-IMPLEMENTATIONSPLAN.md`

## Acceptans

- Klartext-PIN finns bara i serverminnet under det omedelbara transportanropet.
- PIN gäller i fem minuter, max fem försök och resend tidigast efter 30 sekunder.
- Fel, utgången eller redan använd PIN kan aldrig skapa en bokning.
- Challenge, hold, bokning och outboxevent har en atomisk DB-sanning.
- `notifications_outbox` är fortsatt enda durabla notifieringsledgern.
- Giada har ingen Supabase-access och accepterar stabil idempotensnyckel.
- Offline Giada väljer e-post före kontaktsteget; inget falskt SMS-löfte visas.
- Bekräftelsen försöker dispatchas i samma request efter commit. Transportfel
  lämnar en retrybar outboxrad och rullar aldrig tillbaka bokningen.
- Inga nya Workers, Queues, Durable Objects eller crontriggers skapas.
- SIM-provider visar nummer. Alfanumeriskt avsändarnamn aktiveras först genom en
  framtida godkänd A2P/SMPP-adapter bakom samma transportkontrakt.
- Live-SMS förblir spärrat tills fysisk SIM-canary har godkänts uttryckligen.

## Verifiering

- Riktade TDD-test för Giada API/auth, health, HMAC/PIN, rate limits, holds,
  atomisk finalize, actions, UI och omedelbar outboxdispatch.
- Full web-Vitest, typecheck, lint och build.
- Full gateway-pytest.
- Manuell e-postfallback-canary utan modem.
- Separat fysisk live-SMS-canary när SIM finns i Giada.

## Status

- [x] Implementerad på `codex/pin-booking-sim-fallback`
- [x] Mekaniskt verifierad
- [ ] E-postfallback-canary godkänd
- [ ] Fysisk SIM-canary godkänd

Driftordning och manuella canary-steg finns i
`5-Kod/docs/ops/pin-booking-activation.md` respektive
`6-Testing/goal-74-pin-bokning-testlista.md`. Ingen migration eller Worker-version
är driftsatt av implementationen.

Mekaniskt bevis 2026-07-21: web 270 testfiler/2 193 tester, typecheck,
lint utan fel och Next-produktionsbuild passerar; migrationen parsas som 29
PostgreSQL-statements; gateway 54/54 tester passerar. Lintens sju varningar är
befintliga och ligger utanför goal-74:s filer.
