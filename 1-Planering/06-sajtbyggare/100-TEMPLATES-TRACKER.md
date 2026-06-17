# 100-TEMPLATES-TRACKER — sajtbyggare

> Durabel checklista för goal-36 (bygg + optimera alla ~100 katalog-mallar). Loopen läser denna FÖRST,
> tar nästa `TODO`/`KVAR`, kör per-mall-pipelinen (se `PILOT-UTFALL.md` → MÖNSTRET), uppdaterar raden. Idempotent.
>
> Radformat: `NN namn | bransch | status | ev. KVAR`
> status: `TODO` → `BYGGD` → `VERIFIERAD 0FAIL (fidelity X.X)` → `COMMIT <sha>`
> Källa-worklist: `4-Dokument-Underlag/03-template-katalog/` (numrerade `01`–`100` + namngivna: BarberX, barberz, brber, haircare, hairsal, razor, alotan, base …).

## Klara (pilot)
| NN | namn | bransch | status | KVAR |
|---|---|---|---|---|
| 23 | restoran | restaurang | **VERIFIERAD 0FAIL (fidelity 4.13–4.63), COMMIT `c9ff7d7`** | CSS-scoping (mönster-pkt 4); resolver-wiring för 6 copy-fält (goal-37/F2) |

## Att göra (resten ~99) — TODO
Loopen enumererar från katalogen och lägger till en rad per mall vid första beröring. Prioritera mallar med en LIVE Corevo-modul-vertikal (restaurang/salong/klinik/gym) först — där `<corevo-module>`-väven ger mest värde.

_Mönster, harness och fällor: se `PILOT-UTFALL.md`. Keep-tröskel ≥0.5 (domar-varians ~±0.5). Allt bakom `SAJTBYGGARE_ENABLED`; deploy = separat Zivar-OK._
