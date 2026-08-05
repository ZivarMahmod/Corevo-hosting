# ROADMAP — aktuell byggordning

Uppdaterad 2026-08-04. Det här dokumentet visar bara nästa ordning. Historik
finns i Git; aktuell verifierad status sammanfattas i `HANDOFF.md`.

## 1. Slutför kodbassaneringen

- En ägare per beteende, state, dataflöde och renderträd.
- Radera ersatta komponenter, actions, CSS, exports, tester och instruktioner.
- Noll produktionsberoenden från `lib/**` till UI och från delade komponenter
  till routeägda actions.
- Kör strict TypeScript, hela testsviten, lint, build, acceptanskontrakt,
  importgraf och dokumentlänkar.
- Granska den samlade diffen innan commit. Ingen push eller deploy ingår.

## 2. Gör en färsk releaseinventering

- Jämför repo-migrationer med preview och produktion read-only.
- Verifiera externa providergrindar för SMS, e-post, betalning, media och domäner.
- Verifiera host-, auth-, tenant-, RLS-, scheduler-, backup- och rollbackflöden.
- Separera tydligt lokalt grönt, previewverifierat och produktionsverifierat.

## 3. Kör Zivars acceptans

Testa en verklig browserhandling i taget på rätt host, session och miljö:
onboarding, kundadmin, personal, kundportal, booking, storefront, preview och
aktiva moduler. Fel går tillbaka till den befintliga ägaren; ingen parallell fixväg
skapas.

## 4. Go/no-go och release

Först efter godkänd lokal grind, releaseinventering och användaracceptans:

1. Zivar fattar uttryckligt go/no-go-beslut.
2. Godkända migrationer körs i bestämd ordning.
3. Kod pushas och deployas.
4. Auth-, domän-, data- och provider-smoke körs mot produktion.
5. Rollback används direkt om en blockerande grind faller.

Nya funktioner startas inte mellan acceptans och release. Produktion, DNS,
Cloudflare och remote branch ändras aldrig implicit.
