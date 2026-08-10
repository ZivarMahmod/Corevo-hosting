# FreshCut motiontest — Higgsfield generation ledger

Status: pre-generation gate passed; generation active; first S0 rejected on mobile crop
Balance last verified after job 01: 907.5 credits (2026-08-10)
Workspace: selected private owner workspace, Plus; opaque workspace ID kept outside Git
Free/unlimited generation available: no
Acceptance scope: `local-generated-demo`

## Budget envelope

- normal project ceiling, 60%: 545.7 credits;
- explicit-approval gate, before 65%: 591.2 credits;
- protected reserve, at least 35%: 318.3 credits;
- fourteen Nano Banana Pro 2K stills: 14 × 2 = 28 credits;
- four Seedance 2.0 Mini 720p 5 s drafts: 4 × 12.5 = 50 credits;
- four Seedance 2.0 standard 1080p 5 s finals: 4 × 45 = 180 credits;
- registered normal path: 258 credits, 28.37% of 909.5;
- expected balance after normal path: 651.5 credits, 71.63%;
- headroom to 60% ceiling: 287.7 credits.
- documented S0 composition retry: +2 credits; current projected path 260 credits,
  expected final balance 649.5 credits and unchanged compliance with all gates.

The estimates above were re-read live on 2026-08-10 with one output, 16:9 and
audio disabled. Nano Banana Pro required a representative prompt to estimate
and returned exactly 2 credits for one 2K image. Every job must be estimated
again immediately before submission. Any price or balance difference stops the
sequence and recalculates the envelope.

Omtag, automatic alternatives and dedicated 9:16 finals are not included.
Each requires a documented visual failure, a new row and a new live estimate.

## Pre-generation reviews

| Review lane | Independent result | Blocking findings | Current resolution | Gate |
| --- | --- | --- | --- | --- |
| Motion/continuity | GO | split K1A/K1B; cape/tool source; C one action; Range separate; D mirror-only; Team separate | final rereview confirmed the prompt, ledger and storyboard chain | pass |
| Conversion/mobile | GO | hidden compact media owners, opaque returning panel, unsafe crop and copy zones | canonical timeline/manifest/CSS fixed; independent rereview passed 87/87 tests | pass |
| Architecture/integration | conditional GO | runtime provenance and source-family ownership had to stay fail-closed | `generated-demo` / `synthetic-text-only` source gate and pipeline manifest tests are green | pass |
| Performance/accessibility | GO | eager/lazy posters, constrained-client teardown, decoder/preload ownership, static GPU hints, 200% wrap and runtime request gates | independent rereview passed 135/135 focused tests plus Chromium poster/layout/constrained-client matrices; output metrics remain post-generation gates | pass |
| Rights/budget, additional safety review | GO | v2 prompts, rows, sequential allowlist and reproducible still chain required | mechanical rereview confirmed 22 jobs and 258-credit path; live checks remain per job | pass |

No job may be submitted until the four primary lanes show pass and all
critical/major findings are closed.

## Reference allowlist

The initial still jobs S0, P0 and P1 use an empty media list. Every other still
may reference only accepted output IDs from earlier still rows. Every video may
reference only accepted output IDs from the fourteen still rows. It must never
reference a repository, FreshCut, MissSite, BaseKit, Unsplash, social-media,
customer or uploaded private image.

## Pre-registered v2 jobs

All jobs use one output. Still prompts are `synthetic-v2`; video prompts are
`synthetic-v2-A` through `synthetic-v2-D`. Blank IDs mean not submitted.

| Seq | Asset/job role | Model/config | Allowed parent/reference rows | Estimate | Actual | Job/output ID | Status | Accepted |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 01 | S0 / SALON_REF / K0 | Nano Banana Pro, 2K, 16:9 | none | 2 | 2 | `914901a3-7ef3-4202-9bee-fc5c7a98c76a` | rejected: portrait crop clips chair; centre mullion blocks path | no |
| 01R | S0 retry / SALON_REF / K0 | Nano Banana Pro, 2K, 16:9 | none; retry of 01 | 2 | 0 | — | planned after documented visual failure | no |
| 02 | P0 / CUSTOMER_REF | Nano Banana Pro, 2K, 16:9 | none | 2 | 0 | — | planned | no |
| 03 | P1 / BARBER_REF | Nano Banana Pro, 2K, 16:9 | none | 2 | 0 | — | planned | no |
| 04 | K1A / empty chair | Nano Banana Pro, 2K, 16:9 | S0 | 2 | 0 | — | blocked until S0 accepted | no |
| 05 | K1B / customer beside chair | Nano Banana Pro, 2K, 16:9 | S0, P0, P1, K1A | 2 | 0 | — | blocked until refs accepted | no |
| 06 | K2 / stable preparation | Nano Banana Pro, 2K, 16:9 | S0, P0, P1, K1B | 2 | 0 | — | blocked until refs accepted | no |
| 07 | K3 / finished craft detail | Nano Banana Pro, 2K, 16:9 | S0, P0, P1, K2 | 2 | 0 | — | blocked until refs accepted | no |
| 08 | K4 / mirror start-result | Nano Banana Pro, 2K, 16:9 | S0, P0, K3 | 2 | 0 | — | blocked until refs accepted | no |
| 09 | R1 / young adult | Nano Banana Pro, 2K, 16:9 | S0 | 2 | 0 | — | blocked until S0 accepted | no |
| 10 | R2 / child | Nano Banana Pro, 2K, 16:9 | S0 | 2 | 0 | — | blocked until S0 accepted | no |
| 11 | R3 / woman | Nano Banana Pro, 2K, 16:9 | S0 | 2 | 0 | — | blocked until S0 accepted | no |
| 12 | R4 / senior | Nano Banana Pro, 2K, 16:9 | S0 | 2 | 0 | — | blocked until S0 accepted | no |
| 13 | R5 / beard or warm towel | Nano Banana Pro, 2K, 16:9 | S0 | 2 | 0 | — | blocked until S0 accepted | no |
| 14 | T0 / fictional team | Nano Banana Pro, 2K, 16:9 | S0, P1 | 2 | 0 | — | blocked until refs accepted | no |
| 15 | B draft / chair | Seedance 2.0 Mini, 720p, 5 s, silent | S0, P0, P1, K1A, K1B, K2 | 12.5 | 0 | — | blocked until still review | no |
| 16 | C draft / craft | Seedance 2.0 Mini, 720p, 5 s, silent | S0, P0, P1, K2, K3 | 12.5 | 0 | — | blocked until B draft review | no |
| 17 | A draft / entrance | Seedance 2.0 Mini, 720p, 5 s, silent | S0, K1A | 12.5 | 0 | — | blocked until B+C review | no |
| 18 | D draft / mirror | Seedance 2.0 Mini, 720p, 5 s, silent | S0, P0, K4 | 12.5 | 0 | — | blocked until B+C review | no |
| 19 | B final / chair | Seedance 2.0 std, 1080p, 5 s, silent | same accepted stills as row 15 | 45 | 0 | — | blocked until B draft accepted | no |
| 20 | C final / craft | Seedance 2.0 std, 1080p, 5 s, silent | same accepted stills as row 16 | 45 | 0 | — | blocked until C draft accepted | no |
| 21 | A final / entrance | Seedance 2.0 std, 1080p, 5 s, silent | same accepted stills as row 17 | 45 | 0 | — | blocked until A draft accepted | no |
| 22 | D final / mirror | Seedance 2.0 std, 1080p, 5 s, silent | same accepted stills as row 18 | 45 | 0 | — | blocked until D draft accepted | no |

Execution is sequential: B draft, then C draft and joint continuity review;
only then A and D drafts. Each final follows only its accepted draft. No batch,
parallel paid submission or automatic retry.

## Per-job completion record

Immediately after each job, extend its row or append an execution record with:

- job ID and output ID;
- UTC start/completion time, operator and selected private workspace;
- exact model ID/version, mode, resolution, aspect, duration, output count and audio flag;
- prompt version and SHA-256;
- ordered parent/reference output IDs;
- estimated/actual credits and balance before/after;
- raw local SHA-256, status and `acceptance_scope=local-generated-demo`;
- acceptance decision, rejection reason, retry-of row and retention/delete date;
- final hash-named path when integrated.

### Execution log

Common operator is Codex through the Higgsfield connector in the selected
private owner workspace. Every row uses `acceptance_scope=local-generated-demo`;
connector backend revisions are recorded as unavailable when only the exact
catalog model ID is exposed. Raw files remain outside Git and are scheduled for
deletion 30 days after generation unless an accepted derivative still depends
on them.

| Seq | UTC start → complete | Job/output ID | Exact config | Prompt SHA-256 | Ordered parent output IDs | Estimate → actual; balance before → after | Raw local SHA-256 | Decision / retention / integrated path |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | 2026-08-10T19:21:27.267Z → 2026-08-10T19:22:03.973Z | `914901a3-7ef3-4202-9bee-fc5c7a98c76a` | requested `nano_banana_pro`; connector result `nano_banana_2`; 2K, 16:9, count 1 | `7b47120674c5c9562c7d8a7e3f88108b91e0049c45a370d426fc2871a2033ad2` | none | 2 → 2; 909.5 → 907.5 | `e889caf47651bd89ed16c08a8ee84a14d491a5b1bc4af487445f86c63ecc58a7` | rejected: centred 9:16 crop places a door mullion centrally and clips the chair at right; retry 01R; delete raw 2026-09-09; no integrated path |

Reject any output with a recognizable real person, real brand, readable sign,
possible real FreshCut geometry, broken anatomy, identity drift, morphing,
reflection error or failed desktop/mobile safe zone.

## Reproducible still-to-poster chain

Hero, Range and Team publish responsive poster-only families from accepted
stills. Range first creates one deterministic composition from R1–R5. Return
does not publish a family: it reuses the exact Craft desktop/mobile poster URLs,
captured by pipeline v4 from C's final K3 endpoint rather than C's K2 start.
Record the applicable chain without signed URLs:

`still output ID(s) + still SHA-256(s) → optional composition recipe/hash → poster recipe/version → pipeline sourceHash → familyHash`.

Each published manifest retains `sceneId`, version, pipeline version,
`mediaDelivery=poster-only`, provenance pair, `sourceHash`, `familyHash`, recipe,
FFmpeg version and poster output names. No temporary video is created for a
still-only scene, and raw outputs never enter the public tree.

## Historical unattributed jobs — rejected, outside v2 spend

| Job ID | Output | Inferred cost | Decision | Reason |
| --- | --- | ---: | --- | --- |
| `fc42993e-5f9b-4f13-ae03-8badaef0fe9e` | generic 15 s Seedance 2.5 barbershop video | 97.5 | rejected | fictional uncontrolled salon, audio, no required continuity |
| `c15c003b-b5f1-48b5-8f79-e8e83cb8523a` | broad Seedream 5 Pro storyboard | 3 | rejected | concept-only fictional salon/people with no accepted reference chain |

These jobs explain the earlier 1,010 to 909.5 balance change but were not
submitted by this implementation and may not be integrated or referenced.
