# FreshCut motiontest evidence index

Current code-phase evidence:

- [`code-phase-verification-2026-08-10.md`](./code-phase-verification-2026-08-10.md)

Final media, recordings and release evidence remain pending the reference and
rights gate.

This directory will retain only non-sensitive test evidence:

- checkpoint screenshots for all eight states;
- complete desktop and mobile recordings;
- Chromium, Firefox and WebKit results;
- console/network and booking-link reports;
- reduced-motion, save-data, media-failure and JavaScript-failure results;
- 320/360/375/390/412/430/768/1024/1440 viewport matrix;
- performance and memory reports;
- four independent critic reports and their re-review verdicts;
- pre/post proof that `freshcut.corevo.se` stayed on the same production release.

No customer originals, credentials, private references or raw Higgsfield source
uploads belong here.

## Deterministic salon master

Run the single-owner compositor from `5-Kod/` with one rejected synthetic raw
frame and a new output path, both outside the repository:

```powershell
node apps/web/scripts/compose-freshcut-salon-master.mjs `
  --input C:\absolute\private\S0R7.png `
  --output C:\absolute\private\S0-01L.png
```

The fixed `freshcut-salon-master-v1` recipe has SHA-256
`fd94045bd63f3858e8add24b696acac41492b8de0ee6a4a868509e8d6e4dc495`.
It accepts exactly one 2752×1536 RGBA PNG, refuses repository/existing outputs,
and writes a sibling path-free receipt. For the accepted 01L chain, the output
SHA-256 is `b3a5f3372668f6a6b3aa28a31911e5a1aa0a2e3cb3ea888106fa04c108356732`
and the receipt SHA-256 is
`e0705131ce5a2dd6a26b0246aecd0955b863f37dfde8f403a17654bd290dc4e5`.

## Closed K1AV endpoint gate

Row `17/K1AV source` runs before K1B and reuses the already-budgeted A-draft
job: Seedance 2.0 Mini, 720p, 5 s, 16:9, silent, count 1, with accepted 01L as
its only start media. It is the sole A draft; do not run a second A draft later.
K1A, K1AR, K1AR2, K1AE and every other rejected result are forbidden inputs.

The job ran and was rejected. Its final complete-chair base reaches about
y=75%, violating the required `y=12–58%` clear margin and y=62% maximum. No
K1AV was extracted or uploaded, no media ID exists, and K1B onward is blocked.
The conditional second-upload exception closed unused; no retry or derivative
substitution is allowed without a new explicit operator-approved contract.

The current contact-sheet harness is triage only. It samples first, middle and
last decoded frames, but it does not implement the required exhaustive K1AV
all-frame/crop record or last-non-black endpoint extraction. No K1AV source can
be accepted from this package alone. Any reopened contract must implement and
test those two gates before a frame may be extracted or uploaded.

Fail closed before any endpoint upload. Review the complete video and every
decoded frame at full 16:9 and at the exact 360×800, 390×844 and 430×932 centre
crops. Verify exactly one complete, world-space-fixed chair in every frame:
headrest, both arms, seat, hydraulic base and footrest all have clear margin
inside `x=41–59%, y=12–58%`, with nothing important below `y=62%`. A cropped
chair, foreground chair part, occluder or wipe is rejection. Also verify rigid
01L topology, material first-frame continuity, straight chest-height dolly only,
an empty salon, and an endpoint clearly inside the salon with a drift-free final
hold of at least 0.75 s. First/middle/final samples alone are not sufficient for
this job, and the existing crop/safe-zone contract is unchanged.

Only after every check passes, select the deterministic last decoded non-black
frame at maximum PTS. The evidence record must contain the source video SHA-256,
decoded frame index, exact PTS, PNG dimensions and PNG SHA-256. That exact PNG
may be uploaded exactly once to the selected private owner workspace; accept its
media ID only after a downloaded copy matches the PNG SHA-256 byte for byte.
Keep the video, PNG, signed URL and raw evidence outside Git.

Accepted K1AV is `continuity-reference-only` with paired provenance
`generated-demo` / `synthetic-text-only`. K1B may then use only 01L, P0R, P1R
and K1AV, matching its camera and rigid geometry with the customer already
beside the same complete chair. A→B is a geometry-matched hard cut, never a
chair foreground/occluder/wipe. A final uses 01L as start and the same K1AV as
end. K1AV shares A's acceptance/publication gate; neither advances independently.
Any failed video, frame, crop, extraction, upload or roundtrip rejects the whole
chain with no alternate endpoint, retry, second upload or downstream reference.
Earlier K1A-family foreground-edge rules remain historical rejected-job
evidence and are superseded by this complete-chair contract.

Local diagnostic reframes are inadmissible and were never uploaded or
referenced. They remain outside Git only as rejected diagnostic evidence and
are scheduled with the raw video for cleanup on 2026-09-09.

## Local contact-sheet QA harness

Run the reusable gate from `5-Kod/` while the local motiontest app is available
at `http://motiontest.localhost:3000`:

Prerequisites are the workspace dependencies, FFmpeg and FFprobe on `PATH`
(or `FFMPEG_BIN`/`FFPROBE_BIN`), plus Playwright Chromium. Install the browser
once with `pnpm exec playwright install chromium` if it is not already present.

```powershell
node apps/web/scripts/qa-freshcut-motion-contact-sheet.mjs `
  --candidate C:\absolute\private\S0.png `
  --scene entrance `
  --copy-placement left `
  --output C:\absolute\private\freshcut-qa
```

To validate a responsive crop pair through the actual DOM, provide both
object-position values. Supplying only one value fails closed:

```powershell
node apps/web/scripts/qa-freshcut-motion-contact-sheet.mjs `
  --candidate C:\absolute\private\S0R3.png `
  --scene hero `
  --copy-placement left `
  --output C:\absolute\private\freshcut-s0r3-qa `
  --desktop-object-position '40% center' `
  --mobile-object-position center
```

The candidate and output directory must both be absolute local paths outside
the repository. The command rejects remote URLs, repository paths, symlink or
junction escapes back into the repository, unknown scenes and copy placement
that does not match the acceptance contract. It never copies raw media into the
output package or records the private source path.

For video, the final sample is selected from the probed maximum decoded-frame
PTS. The harness does not assume 30 fps, so 24 fps Seedance outputs cannot
silently seek beyond their last frame.

The equivalent environment variables are:

- `FRESHCUT_QA_CANDIDATE`
- `FRESHCUT_QA_SCENE`
- `FRESHCUT_QA_COPY_PLACEMENT`
- `FRESHCUT_QA_OUTPUT_DIR`
- `FRESHCUT_QA_BASE_URL` (optional; local `motiontest.localhost` only)
- `FRESHCUT_QA_DESKTOP_OBJECT_POSITION` (optional; requires the mobile value)
- `FRESHCUT_QA_MOBILE_OBJECT_POSITION` (optional; requires the desktop value)
- `FRESHCUT_QA_TRANSITION_INPUTS_JSON` (optional scene-to-private-path object)

CLI values override the matching environment values. To add transition
evidence, repeat `--transition-input scene=C:\absolute\private\file`. The
harness only renders the documented pairs Entrance→Chair, Chair→Craft,
Craft→Range, Range→Return, Return→Mirror and Mirror→Team; the current candidate
is included automatically. Every supplied transition input must participate
in at least one of those pairs or the run fails closed.

Each successful package is hash-named and contains:

- a desktop 16:9 frame with the copy exclusion mask and critical corridor;
- exact centre-crops at 360×800, 390×844 and 430×932;
- for clips, first/middle/last-decoded-frame matrices; the last sample may be
  black and is QA evidence, not an accepted endpoint;
- for stills, a 1440×900 screenshot through the real FreshCut motiontest DOM,
  with scene videos paused and hidden, and the local candidate accepted only
  when the poster's current source matches a same-origin intercepted request;
- when a responsive object-position pair is supplied, additional real-DOM
  screenshots at 360×800, 390×844 and 430×932 using the supplied mobile
  crop while the 1440×900 screenshot uses the desktop crop;
- desktop and 390×844 transition pairs when their private inputs are present;
- `contact-sheet.html` and a relative-path-only `qa-manifest.json`.

An exhaustive K1AV frame record and deterministic non-black endpoint are
separate required artifacts that this harness does not currently produce. The
closed row-17 job failed before either artifact was authorized.

The default focused test does not require FFmpeg, Playwright, a server or media:

```powershell
pnpm exec vitest run apps/web/scripts/qa-freshcut-motion-contact-sheet.test.mjs
```
