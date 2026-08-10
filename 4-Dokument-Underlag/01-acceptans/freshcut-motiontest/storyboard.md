# FreshCut motiontest — storyboard and contact-sheet contract

Status: synthetic v2 composition locked; generated frames pending
Date: 2026-08-10

This storyboard covers a local fictional demo only. It is not the real FreshCut
reference pack or final customer media.

| State | Synthetic source | Start | Key action | End | Desktop copy exclusion | Mobile critical corridor | Raw target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hero | S0/K0 | calm empty threshold | none | same | left `x=0–46%` | `x=41–59%, y=12–58%` | stable still source |
| Entrance / A | S0/K0 → K1A | locked threshold | straight chest-height dolly | empty chair path, 0.75 s hold | left `x=0–46%` | `x=41–59%, y=12–58%` | 5 s |
| Chair / B | K1B → K2 | same K1A camera; customer beside chair with cape already draped | customer settles; same cape falls; barber enters right with K2 tools | one-second preparation hold | right `x=54–100%` | `x=41–59%, y=12–58%` | 5 s |
| Craft / C | K2 → K3 | prepared customer already has final silhouette | one neckline/fade detail with one clipper and comb | one-second finished-detail hold | left `x=0–46%` | `x=41–59%, y=12–58%` | 5 s |
| Service range | R1–R5 | one distinct synthetic subject per still | deterministic responsive composite, no person morph or video | panels resolve to main path | left `x=0–46%` | one panel inside `x=41–59%, y=12–58%` | five stills → poster-only composite |
| Return | K3 | finished main customer | deterministic hold after panels leave | same customer centred | right `x=54–100%` | `x=41–59%, y=12–58%` | exact Craft end-poster URLs, no new fetch |
| Mirror / D | K4 | same finished customer, neutral mirror | one head turn ≤10°, no camera pan | one-second final hold | right `x=54–100%` | `x=41–59%, y=12–58%` | 5 s |
| Team | T0 | fictional team already in place | deterministic subtle CSS/GSAP pan only | stable release to document | left `x=0–46%` | `x=41–59%, y=12–58%` | responsive poster-only still |

K1A and K1B are intentionally separate. A ends on an empty chair/foreground
occlusion. B begins after that hard cut with the customer already beside the
chair, so no person materializes.

R1–R5 are separate young-adult, child, woman, senior and beard/warm-towel
subjects. C never carries Service range. D is mirror-only. Team never shares
D's raw clip.

All 16:9 sources use a horizontally centred 9:16 crop. For tall phones, the
whole critical subject/tool/mirror box stays in `x=41–59%, y=12–58%`; nothing
important is below `y=62%`. Generated media contains no text, pricing, services,
locations, booking UI, sign, logo or physical mirror reflection. Those remain
real DOM.

## Contact-sheet gates

Before acceptance, inspect each still and clip at:

- full 16:9 with the actual left/right DOM overlay mask;
- 9:16 centre crop at 360×800, 390×844 and 430×932;
- first, middle and final video frames;
- transition pairs A→B, B→C, C→Range, Range→Return, Return→D and D→Team.

Reject on hidden critical content, text collision, identity/geometry drift,
hair-length change, tool/hand defect, impossible reflection, visible morph or
missing stable start/end frame.
