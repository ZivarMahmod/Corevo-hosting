# goal-50 — arkitekturbeslut (läs FÖRE kod)

> Datum 2026-06-26. Grundat i live-DB + kod-karta, inte i briefens stale-antagande.
> Briefen = LAG; LÅST-sektionen går FÖRE briefens body vid krock. Detta dokument
> löser krockarna och fångar 18h-trappet (konflatera ALDRIG de tre render-vägarna).

## Empirisk korrigering av briefen
Briefen säger "templates-tabellen = 5 rader (salvia/leander/zigge/linnea/edit)".
**Fel.** Live `templates` (`clylvowtowbtotrahuad`) = **27 rader** (23 storefront + 4 admin),
kolumner `key,name,tags,tokens,sections,status` — **ingen** `html`/`manifest`/`render_type`/
`thumbnail`. Inga salvia/leander/... i tabellen; de 5 "temana" bor som KOD-konstanter
(`WIZARD_THEMES`, `STOREFRONT_LAYOUTS`). 0041 importerade vendor-katalogen som
tokens+sections (INTE render-bron-HTML). Admin-panelerna (breeze/celestial/sneat/
star-admin2) ligger kvar i tabellen trots §1 "hård skip".

## De TRE render-vägarna (får ALDRIG blandas — 18h-trappet)
| # | Väg | Var | Distinkt look? |
|---|---|---|---|
| **A** | render-bron HTML | `templates/{restoran,klinik,drivin,carserv}.ts` + `manifest/*` → `renderTemplate(html,modules)` | **JA** (full vendor-HTML/CSS) |
| **B** | React-teman | `WIZARD_THEMES`/`STOREFRONT_LAYOUTS[theme]` (salvia/leander/zigge/linnea/edit) | NEJ (palett ovanpå 1 layout) |
| **C** | templates-tabellen | 27 rader tokens+sections, ingen HTML | NEJ (ingen layout-data) |

LÅST kräver "varje mall distinkt via riktig HTML" → **bara väg A duger.** Live-beviset
("Alotan/BarberX/Barberz identisk preview") = `StorefrontPreview` + publika `page.tsx`
renderar `STOREFRONT_LAYOUTS[cfg.theme]`; en katalog-nyckel som inte är 1 av 5 → fallback
`leander`. Det är roten.

## Beslut (3 avvikelser från briefens body — tvingade av LÅST + DB-verklighet + R6)
1. **Boxen = KOD-registry (`look-registry.ts`) av väg-A-looks**, INTE DB-rader.
   De 4 finns redan som kod m. proofs; R6 säger bunta inte HTML i bundeln/DB; LÅST säger
   "en sorts sak i boxen: mallar". → ingen migration, ingen `render_type`-union, inget
   tema-i-boxen. goal-36 APPENDAR fler looks i registryt (additivt). Box nu = 4 looks.
2. **Flagg-OFF förblir byte-identisk** (HÅRDA REGLER i /goal + HANDOFF, rollback-garanti) —
   går FÖRE RIV-BORT-radens "pensionera legacy-tema-vägen". ALLA ändringar i flagg-ON-grenen.
   grep-testet "0 WIZARD_THEMES/THEME_KEYS/theme==='salvia'" scopas till **flagg-ON
   look-vägen** (nya galleri-komponenten + studions look-steg), inte legacy-filen.
3. **Teman + 23 token-rader pensioneras ur flagg-ON-galleriet** (visas ej). Publika rendern
   forsätter rendera BEFINTLIGA tema-tenants (build-once-never-delete) — bryts ej.

## READ-ONLY-kontrakt (forka ALDRIG, goal-36 §9)
`manifest/types.ts` · `render-bridge.tsx` (utöka bara m. try/catch, signatur orörd) ·
`booking-mount.tsx` · flaggan. Saknas region-typ → STOPP + flagga.

## Var looken lagras per tenant
Reuse `cfg.theme` (redan `string`, kan bära katalog-nyckel) i studion. Persistens i settings
landas i M9 efter läsning av `parseTheme`/`foldOnboardingDraft` — render-bron-nyckeln får
INTE krascha `STOREFRONT_LAYOUTS[...]` (dispatch före index).

## Prod-säkerhet
Ingen prod-deploy (detachar kunddomäner). Bygg via `C:\tmp\kod` (ö-bug). POS + 3 fasta
hostar aldrig nere. STOPP för Zivars browser-verify.
