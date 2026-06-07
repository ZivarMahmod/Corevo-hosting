# 4 — Dokument & Underlag

Råmaterial och underlag: designpaket, briefer, templates, audits, säljmaterial, skärmdumpar.

## Struktur (2026-06-07)

| Mapp | Innehåll | Regler |
|---|---|---|
| `01-acceptans/` | **Claude Design-paketet = LAG** (mockar, specs, tokens, probe.js). Flyttad hit från `2-Byggplan/`. | ⛔ Strukturera ALDRIG om internt — filerna refererar varandra relativt. Exakt kopia-regeln i `CLAUDE.md` gäller. |
| `02-design-brief/` | Design-briefer + referenser (trackade) | |
| `03-template-katalog/` | Frisör-templates → Corevo-katalogen: `00-inbox/` (rådump, gitignorad) → `01-kandidater/` → `02-valda/`. Beslutslogg: `KATALOG.md` | Corevo-namn vid ombrandning, färger behålls, samma bildset, licens kollas |
| `04-audits/` | Audit-rapporter (DB, säkerhet, genomgångar) | En fil per audit, datum i namnet |
| `05-salj/` | Säljmaterial (prisjämförelser m.m.) | |
| `06-skarmdumpar-bygg/` | Bygg-/verifierings-screenshots (gitignorad, lokal). Sorterad: `konkurrent-referenser/` · `storefront/` · `backoffice/` · goal-specifika mappar (`goal17-*`, `salonger-kort/`) | Ny skärmdump → rätt undermapp, aldrig i roten |

Ny fil? Välj mappen som matchar — aldrig löst i den här rotnivån (README undantagen).
Äldre referenser till o-numrerade sökvägar (`acceptans/`, `skarmdumpar-bygg/`…) i HANDOFF/gamla goals är historik — filen finns, sök på filnamnet.
