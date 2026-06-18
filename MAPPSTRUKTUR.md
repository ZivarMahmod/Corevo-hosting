# MAPPSTRUKTUR — så behandlas och byggs mapparna (handoff)

Egen fil för EN sak: exakt hur repots mappar fungerar, växer och hänger ihop.
Reglerna är lag (kortversion bor i `CLAUDE.md`). Uppdaterad 2026-06-07.

---

## RYTMEN — kedjan varje bygge följer

```
3-Bakgrund-Research   →   1-Planering   →   4-Dokument-Underlag   →   2-Byggplan/goals   →   5-Kod   →   6-Testing   →   2-Byggplan/klart
     (ta reda på)          (besluta)          (material in)             (målet)             (bygg)      (du testar)       (bevisat klart)
```

En sak vandrar alltid VÄNSTER → HÖGER. Den hoppar aldrig bakåt, den får aldrig två hem samtidigt.

---

## Mapparna — en i taget

### Roten
Får BARA innehålla: `HANDOFF.md` (var står vi), `CLAUDE.md` (hur vi jobbar), `MAPPSTRUKTUR.md` (denna), + config som måste ligga där (`.gitignore` m.m.). **Allt annat i roten = fel.**

### `1-Planering/` — det vi BESLUTAT
Tankar som blivit beslut. Inte research, inte mål — beslut och modeller.
- `00-modulkarta.md` = ingången/kartan. Enda filen i mappens rot.
- `01-arkitektur/` = tvärgående beslut som rör ALLT: DB-schema, ADR, domänstrategi, infra-nuläge.
- `02-floden/` = flöden som korsar moduler: onboarding, pengaflöde.
- `0N-<delen>/` = **planering för EN specifik del bor IHOP i egen mapp.** Exempel: `03-avbokning/`.
- **Så växer den:** ny del planeras → ny numrerad mapp. Aldrig lösa filer i roten.

### `2-Byggplan/` — det vi SKA göra + det vi GJORT
- Roten = en levande styrfil: `ROADMAP.md` (enda roadmapen — rak väg, scope kvar, öppna beslut, lagkrav). Öppna goals i `goals/`, fixar i `fix/`.
- `goals/` = mål/briefs som INTE körts än. En fil = ett mål = `goal-NN-*` eller `fix-NN-*`.
- `klart/` = arkivet. 8 kategorier (se `klart/0-LÄS-MIG-FÖRST.md`): 01-grund · 02-ytor · 03-betalning · 04-sakerhet-drift · 05-design · 06-mejl-notiser · 07-workflows-faser · 08-fixar.
- **Livscykel för en goal:** skrivs i `goals/` → körs av Code → verifieras (aldrig ögonmått) → FLYTTAS till rätt `klart/`-kategori. Aldrig kopia — flytt. `goals/` tom = inget pågår.
- Körda plan-/workflowdokument = historik → `klart/07-workflows-faser/`.

### `3-Bakgrund-Research/` — det vi TAGIT REDA PÅ
Fakta utifrån: konkurrenter, lagar, priser, gap-analyser. Datum i filnamnet (`*-2026-06-07.md`).
Research åldras — datumet säger hur färsk den är. Härifrån föds beslut som skrivs i `1-Planering`.

### `4-Dokument-Underlag/` — material som MATAR bygget
Inte beslut, inte research — råmaterial och kanon som bygget använder. Numrerade undermappar:
- `01-acceptans/` = Claude Design-paketet = **LAG**. ⛔ Strukturera ALDRIG om internt (relativa referenser).
- `02-design-brief/` = design-briefer + referenser.
- `03-template-katalog/` = templates: `00-inbox/` (rådump, gitignorad) → `01-kandidater/` → `02-valda/` + `KATALOG.md`.
- `04-audits/` = audit-rapporter, datum i namnet.
- `05-salj/` = säljmaterial.
- `06-skarmdumpar-bygg/` = bygg-/verifierings-screenshots (gitignorad), sorterade i undermappar.
- `07-systemkarta/` = tankekartan (HTML).
- **Så växer den:** ny typ av underlag → ny numrerad mapp (08-, 09- …).

### `5-Kod/` — ALL kod
Monorepo (apps/web, packages, supabase/migrationer). Dokumentation om koden:
- `5-Kod/docs/` = teknisk doc (API, moduler).
- `5-Kod/docs/ops/` = drift: runbooks, deploy, inloggnings-referens, secrets-inventering, rollback-filer.
- Planering bor ALDRIG här. Kod bor ALDRIG någon annanstans.

### `6-Testing/` — det ZIVAR ska köra
Testlistor och manuella tester som DU utför (t.ex. `TESTA-DETTA-03.md`).
Skillnad mot verifiering i goals: goals verifieras av Nörden/Code mekaniskt; `6-Testing` = dina ögon som andra uppsättning.
Körd testlista = historik → `2-Byggplan/klart/07-workflows-faser/`.

### `Nörden/` — källunderlag
Original-PDF:er och källfiler som inte hör till bygget direkt.

---

## "Var ska filen?" — beslutsträd (30 sekunder)

1. Är det **kod**? → `5-Kod/`. Doc om koden? → `5-Kod/docs/` (drift? → `docs/ops/`).
2. Är det **fakta utifrån** (priser, lagar, konkurrenter)? → `3-Bakgrund-Research/`, datum i namnet.
3. Är det ett **beslut/modell vi tagit**? → `1-Planering/0N-<delen>/` (tvärgående? → `01-arkitektur/` el. `02-floden/`).
4. Är det **material bygget använder** (design, templates, audits, skärmdumpar)? → `4-Dokument-Underlag/0N-…/`.
5. Är det ett **mål som ska köras**? → `2-Byggplan/goals/`. Kört + verifierat? → `2-Byggplan/klart/<kategori>/`.
6. Är det något **Zivar ska testa/utföra**? → `6-Testing/`.
7. Passar inget? → närmaste enligt ovan. **ALDRIG i roten.**

---

## Exempel: avbokning vandrar genom rytmen

1. Lag + konkurrenter undersöks → `3-Bakgrund-Research/avbokning-lag-konkurrenter-research.md`
2. Beslutsrundor med Zivar → modellen LÅST → `1-Planering/03-avbokning/avbokning-aterbetalning-modell.md`
3. (Ev. designunderlag/villkorstexter → `4-Dokument-Underlag/`)
4. Brief skrivs → `2-Byggplan/goals/goal-NN-policy-motor.md`
5. Code bygger → `5-Kod/`
6. Zivars testlista → `6-Testing/`
7. Verifierat klart → flytt till `2-Byggplan/klart/03-betalning/`

---

## Hårda regler (sammanfattning)
- Roten är helig — 3 md-filer + config, inget annat.
- En sak har ETT hem. Flytt, aldrig kopia.
- Bygg once, never delete — gammalt/ersatt flyttas till `klart/` (t.ex. `klart/02-ytor/_gamla-modulspecar/`), raderas inte.
- Numrerade mappar växer med nästa lediga nummer.
- Research får datum i filnamnet. Goals/fixar får löpnummer.
- Stale referenser till flyttade filer kan finnas i gamla HANDOFF-block — sök på filnamnet, filen finns.
