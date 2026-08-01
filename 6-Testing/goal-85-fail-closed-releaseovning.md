# Goal 85 — fail-closed releaseövning

Status 2026-08-02: **FIXA FÖRST**. Produktion är orörd och ingen deploy har
körts.

## Grönt lokalt

- [x] Releasekontrollen accepterar både äldre fyrsiffriga och nuvarande
  tidsstämplade migrationsfiler.
- [x] CI och deploy kräver senaste lokala migration
  `20260730002641`; en äldre checkpoint stoppar körningen.
- [x] Migrationsinventeringen hittar 155 migrationer utan lucka eller dubblett.
- [x] Verifierarens egna tester är gröna: 7/7.
- [x] Lokalt schemafingerprint är
  `sha256:8ac7c15cc605420e4ba6731bcdf127ef7c7516fc4a167c8af9e7e48ed39568bd`.

## Kvar före godkännande

- [ ] Repetera hela migrationskedjan på en tom, tillfällig databas.
- [ ] Jämför previewdatabasens migrationshistorik och fingerprint med lokalt.
- [ ] Kör SQL-runtimeprov, RLS/grants och security advisors mot preview.
- [ ] Verifiera scheduler med saknad respektive korrekt hemlighet.
- [ ] Kontrollera hostkontrakt och en torr deploy-/rollbackplan.
- [ ] Sätt produktionens checkpoint först när migrationerna faktiskt ska köras.

Ingen punkt ovan får lösas genom att skriva till produktion. Previewskrivningar
kräver ett uttryckligt avgränsat testbeslut.
