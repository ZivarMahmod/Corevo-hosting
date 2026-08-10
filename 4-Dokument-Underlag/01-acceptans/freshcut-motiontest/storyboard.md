# FreshCut motiontest — storyboard and contact-sheet contract

Status: STOP — row 17 rejected; K1AV was not created; K1B onward blocked
Date: 2026-08-10

This storyboard covers a local fictional demo only. It is not the real FreshCut
reference pack or final customer media.

| State         | Synthetic source | Start                                                            | Key action                                                           | End                                                                                                                           | Desktop copy exclusion | Mobile critical corridor                                             | Raw target                                  |
| ------------- | ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| Hero          | 01L/K0           | calm empty threshold                                             | none                                                                 | same                                                                                                                          | left `x=0–46%`         | `x=41–59%, y=12–58%`                                                 | stable still source                         |
| Entrance / A  | 01L/K0 → K1AV    | locked threshold                                                 | straight chest-height dolly                                          | clearly inside salon; one complete chair with clear margin; stable 0.75 s hold; deterministic last non-black max-PTS endpoint | left `x=0–46%`         | complete chair `x=41–59%, y=12–58%`; nothing important below `y=62%` | 5 s; row 17/K1AV source is the sole A draft |
| Chair / B     | K1B → K2         | same K1AV camera; customer beside chair with cape already draped | customer settles; same cape falls; barber enters right with K2 tools | one-second preparation hold                                                                                                   | right `x=54–100%`      | `x=41–59%, y=12–58%`                                                 | 5 s                                         |
| Craft / C     | K2 → K3          | prepared customer already has final silhouette                   | one neckline/fade detail with one clipper and comb                   | one-second finished-detail hold                                                                                               | left `x=0–46%`         | `x=41–59%, y=12–58%`                                                 | 5 s                                         |
| Service range | R1–R5            | one distinct synthetic subject per still                         | deterministic responsive composite, no person morph or video         | panels resolve to main path                                                                                                   | left `x=0–46%`         | one panel inside `x=41–59%, y=12–58%`                                | five stills → poster-only composite         |
| Return        | K3               | finished main customer                                           | deterministic hold after panels leave                                | same customer centred                                                                                                         | right `x=54–100%`      | `x=41–59%, y=12–58%`                                                 | exact Craft end-poster URLs, no new fetch   |
| Mirror / D    | K4               | same finished customer, neutral mirror                           | one head turn ≤10°, no camera pan                                    | one-second final hold                                                                                                         | right `x=54–100%`      | `x=41–59%, y=12–58%`                                                 | 5 s                                         |
| Team          | T0               | fictional team already in place                                  | deterministic subtle CSS/GSAP pan only                               | stable release to document                                                                                                    | left `x=0–46%`         | `x=41–59%, y=12–58%`                                                 | responsive poster-only still                |

K1AV and K1B are intentionally separate. Row 17/K1AV source runs before K1B and
is the sole A draft. A ends clearly inside the salon after a stable hold of at
least 0.75 s, with exactly one complete chair—headrest, both arms, seat,
hydraulic base and footrest—inside the unchanged critical corridor with clear
margin. No chair part is a foreground element, occluder or wipe. B begins on a
geometry-matched hard cut using the same K1AV camera and rigid geometry, with
the customer already beside the chair, so no person materializes. There is no
later second A draft; A final starts on 01L and ends on the exact accepted K1AV.

Runtime result: row 17 broadly passed the single-chair, rigid-dolly and
horizontal-crop checks, but the final chair base reaches about y=75%, outside
the binding y=58% box and y=62% maximum. The source is rejected. No K1AV was
extracted/uploaded, A final cannot run, and K1B plus every later state is
blocked. No diagnostic reframe, derivative substitute or retry is admissible.

R1–R5 are separate young-adult, child, woman, senior and beard/warm-towel
subjects. C never carries Service range. D is mirror-only. Team never shares
D's raw clip.

01L is the canonical local S0: a bit-exact deterministic reprojection made only
from the fictional text-generated 01R7 pixels. Raw 01R7 remains rejected and is
never a paid-generation reference. Accepted, hash-bound private 01L is the
canonical start reference. The only later upload exception was conditional K1AV: the
deterministic last decoded non-black max-PTS frame from a fully accepted row-17
A-draft video. Row 17 failed, so the exception closed unused and no K1AV exists;
raw 01R8 and every rejected result remain forbidden.

P0R and accepted P1R are internal identity references, not scene media. Their crop gate
protects identity-bearing head, hair, neck, collar and pose continuity; they are
never rendered as storefront posters and do not use the scene DOM-overlay gate.

All 16:9 sources use a horizontally centred 9:16 crop. For tall phones, the
whole critical subject/tool/mirror box stays in `x=41–59%, y=12–58%`; nothing
important is below `y=62%`. Generated media contains no text, pricing, services,
locations, booking UI, sign, logo or physical mirror reflection. Those remain
real DOM.

## Contact-sheet gates

Before acceptance, inspect each still and clip at:

- full 16:9 with the actual left/right DOM overlay mask;
- 9:16 centre crop at 360×800, 390×844 and 430×932;
- for 17/K1AV source, the complete video and every decoded frame at full 16:9
  plus all three exact centre crops; the complete chair (headrest, both arms,
  seat, base and footrest) has clear margin in `x=41–59%, y=12–58%`, nothing
  important falls below `y=62%`, and any crop/occluder/wipe or other
  single-frame failure rejects the job;
- first, middle and final video frames;
- transition pairs A→B, B→C, C→Range, Range→Return, Return→D and D→Team.

The A→B pair must be a geometry-matched hard cut with K1B matching K1AV camera
and rigid salon geometry. Earlier rejected K1A-family foreground-edge rules are
historical evidence only and are superseded by this complete-chair contract.

Reject on hidden critical content, text collision, identity/geometry drift,
hair-length change, tool/hand defect, impossible reflection, visible morph or
missing stable start/end frame.
