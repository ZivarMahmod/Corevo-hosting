# Strategy digest — sajtbyggare-pilot-fidelity

_Read this (not the full log) when generating the next hypothesis._

## Current best
- **iteration 1 (exp1, KEPT, commit c9ff7d7)** — `mean_fidelity 4.63 / 5` (from baseline **1.75**, +2.88).
- Gates all green: render_proof 0, exact_token 0, unresolved 0, editable_regions **17**, modules_woven 1. section_coverage **1.0**.

## Categories tried
| category | runs | kept | result |
|---|---|---|---|
| fidelity-coverage | 1 | 1 | exp1: 8-section verbatim copy + 17-region manifest → +2.88. Keystone works. |

## Key learnings
1. **The keystone pattern works**: verbatim 8-section copy + DRY-noted manifest (color/font mirrored exactly from vendor CSS) + asset copy → 1.75→4.63 in one step. This IS the pattern to feed goal-36.
2. **Token-gate bug fixed**: `exact_token_mismatches` scanned ALL region defaults as font tokens → 12 false positives on text/image defaults. Fixed to scan only color/font defaults. Baseline unaffected (0→0). Validate gates against a REAL manifest, not just baseline (the adversarial verifier missed this because baseline has no manifest).
3. **Static-mode bounds the ceiling**: judge compares OURS vs the *static* vendor render (CDN/JS blocked, apples-to-apples). So self-hosting fonts/icons is a TRAP — it would make OURS use Heebo/FA while the static vendor referent still falls back → divergence → judge penalty. Asset-fidelity (the old hyp #2) is DROPPED for this referent.
4. **Architectural work is fidelity-neutral**: css-scoping under [data-tenant] is a real goal-36 requirement but won't move the judge (appearance unchanged) → ce-optimize's keep-if-improved would revert it. It must be part of the handoff pattern REGARDLESS of fidelity delta — not gated on it.
5. **Module = stand-in in measurement**: the live BookingMount needs a DB, so the harness renders a static booking stand-in at the marker. So judged "module_integration"/reservation fidelity ≈ the template's reservation CHROME + the stand-in, not the real module. Optimize the template chrome (real), don't chase the stand-in.

## Exploration frontier (remaining headroom 4.63 → 5)
- Judge's 4-scored sections (real residual): **navbar-hero, service, reservation**; worst_section = reservation (2/3 judges), about (1/3). module_integration 4.
- NEXT: a cheap vision DIAGNOSTIC is running to separate REAL template gaps (verbatim-copy misses in those 3 sections) from static-mode-inherent limits (blank FA glyph, CDN-font fallback — judge ignores these). exp2 targets only the real gaps.
- Untried-but-deferred: css-scoping (do as pattern work, not a fidelity experiment); booking bransch-awareness (OUT of pilot scope — touches read-only booking-mount, goal-37).

## Pattern emerging for goal-36 handoff
verbatim section copy (strip JS/spinner, rewrite asset paths, one `<corevo-module>` marker) + a manifest mirroring salvia (color/font lifted from vendor CSS, text/image verbatim) + copy all referenced vendor images + css-scoping under [data-tenant] (neutral but required) + the fidelity harness (gates + vision judge).
