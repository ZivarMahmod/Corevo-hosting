# FreshCut motiontest — Higgsfield generation ledger

Status: blocked before further spend
Available balance last read-only check: 909.5 credits (2026-08-10)
Project target: at most 60%; hard approval gate before 65%; reserve at least 35%.

Calculated from the verified 909.5-credit balance:

- normal project ceiling: 545.7 credits;
- explicit-approval gate: before 591.2 credits;
- protected reserve: at least 318.3 credits.

The account balance was previously reported as 1,010 credits. A read-only
generation-history audit found two completed, unattributed jobs created on
2026-08-10 whose current cost estimates total exactly 100.5 credits. That
matches the later verified balance of 909.5. This implementation did not submit
either job. Both outputs were inspected and rejected for final use. Calculate
every future gate from the lower verified balance.

Read-only catalogue/cost preflight:

- `seedance_2_0_mini`, 5 s, 720p, silent, one 16:9 or 9:16 output: 12.5 credits;
- `seedance_2_0`, fast, 5 s, 720p, silent, one 16:9 output: 17.5 credits;
- `seedance_2_0`, standard, 5 s, 1080p, silent, one 16:9 or 9:16 output: 45 credits.

The live 2026-08-10 model recommendation ranked `seedance_2_0` as the best
reference-continuity candidate because it supports start frame, end frame,
multiple image/video references, silent output, both target aspect ratios and
draft/final modes. `seedance_2_0_mini` remains the intended first draft model.
`cinematic_studio_video_v2` was also cost-checked (5 credits standard, 7.5
credits exact in pro for a 5 s silent 16:9 output), but it is not the primary
continuity model; use it only for a documented difficult camera shot after a
reference-matched Seedance attempt fails review.

Four Mini drafts would cost 50 credits. Four selected 1080p finals would cost
180 credits. Two dedicated 1080p mobile finals would add 90 credits. That
270-credit final path is only a budget envelope, not an approval to generate.

| Scene | Purpose | Model/mode | Reference IDs | Prompt version | Estimated cost | Actual cost | Status | Accepted | Rejection reason | Final path |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| A / entrance | environment continuity | Seedance 2.0 Mini, 720p draft candidate | missing | v1 draft | 12.5 | 0 | blocked: references/rights | no | — | — |
| B / chair | customer sits + barber enters | Seedance 2.0 Mini, 720p draft candidate | missing | v1 draft | 12.5 | 0 | blocked: references/rights | no | — | — |
| C / craft | main transformation action | Seedance 2.0 Mini, 720p draft candidate | missing | v1 draft | 12.5 | 0 | blocked: references/rights | no | — | — |
| D / mirror | final result input | Seedance 2.0 Mini, 720p draft candidate | missing | v1 draft | 12.5 | 0 | blocked: references/rights | no | — | — |
| Historical/unattributed `fc42993e-5f9b-4f13-ae03-8badaef0fe9e` | generic 15 s barbershop clip | Seedance 2.5, 720p, audio enabled | none | truncated single-prompt draft | 97.5 | 97.5 inferred from current estimator | completed, inspected | no | fictional salon; no FreshCut references; audio present; no required entrance/service-range/team continuity | rejected; do not integrate |
| Historical/unattributed `c15c003b-b5f1-48b5-8f79-e8e83cb8523a` | multi-panel storyboard image | Seedream 5 Pro, 2K | none | broad six-shot storyboard prompt | 3 | 3 inferred from current estimator | completed, inspected | no | fictional salon and people; no provenance or FreshCut geometry; concept-only composition | rejected; do not integrate |

Before each paid job record the live model, mode, output count and cost estimate.
Start with one controlled draft. A second candidate requires a documented visual
failure. Final-quality generation is forbidden before the placeholder
composition, safe zone, crop and critic gates pass.
