# klart/ — arkiv över VERIFIERAT klart arbete

Allt här är kört, verifierat och stängt. Inget i den här mappen är en aktiv uppgift.
Aktiva goals bor i `2-Byggplan/goals/`. När en goal verifierats KLAR flyttas den hit — **in i rätt underkategori**, aldrig i roten.

(Den gamla projekt-readmen som låg här flyttades till `07-workflows-faser/ursprunglig-projekt-readme.md`.)

## Struktur (sorterad per ändamål, 2026-06-07)

| Mapp | Innehåll |
|---|---|
| `01-grund/` | Scaffold, DB/RLS, inloggning, deploy-pipeline, go-live, baseline-seed, kunddomän-grund |
| `02-ytor/` | En undermapp per yta: `storefront/` · `bokningsmotor/` · `kundportal/` · `personalportal/` · `salong-admin/` · `platform-admin/` (goal + M-modulspec ligger ihop) |
| `03-betalning/` | Stripe/betalnings-goals + M8 |
| `04-sakerhet-drift/` | Säkerhet, compliance, RLS-härdningar, RBAC, adversariella fynd |
| `05-design/` | Design-trohet, designvågor, designplaner |
| `06-mejl-notiser/` | Mejl/SMTP-goals |
| `07-workflows-faser/` | Workflow-dokument, FAS-fynd/synteser, roadmaps, nattloggar, testlistor — körhistorik |
| `08-fixar/` | Fix-briefs (buggfixar med egen brief) |

## Regler

- Ny klar goal → den kategori som matchar ändamålet. Tveksam? Närmaste kategori, aldrig roten.
- Fixar heter `fix-NN-*.md` och går alltid till `08-fixar/`.
- Workflow-/fas-dokument är historik, inte specar → `07-workflows-faser/`.
- Referenser i HANDOFF till gamla platta sökvägar (`klart/goal-NN…`) kan vara stale efter omsorteringen — filen finns, sök på filnamnet.
