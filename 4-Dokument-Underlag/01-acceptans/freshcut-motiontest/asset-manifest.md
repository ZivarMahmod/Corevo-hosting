# FreshCut motiontest — source asset manifest

Status: repository-controlled fallbacks plus authorized synthetic demo lane
Audit date: 2026-08-10

These files may be displayed as existing Corevo/FreshCut fallback material. Their
original import provenance is not documented well enough to approve AI
transformation. They are not the final cinematic reference pack.

| File                   | Source                                                                                                         | Rights/permission                                   | Location represented | Intended use                                                             | Size                 | SHA-256                                                            | Identifiable face                             | AI transformation |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------ | --------------------------------------------- | ----------------- |
| `freshcut-hero.webp`   | pixel-equivalent derivative of BaseKit `localBusiness/barber/default/barber_image-4.jpg`                       | existing display fallback only; third-party default | unverified           | hero fallback; actual motif is clippers behind a client, not an entrance | 1600×900, 36,274 B   | `f012ecd9a68ab5731dc3d7a2f4aea91188b5db7a2ae987ca665b1ec8e7a24ba9` | no clear face; rear client and tattooed hands | not approved      |
| `freshcut-barber.webp` | controlled repository asset; upstream source unverified                                                        | existing display fallback only                      | unverified           | chair/craft poster                                                       | 1500×1999, 115,630 B | `27bb59cedb5eaf7f2f69deb5f26160716d4d1ce5c6b583b3dc146419fe82ddeb` | hands and cropped hair only                   | not approved      |
| `freshcut-2.webp`      | pixel-equivalent derivative of MissSite `70/62/70620da8-4855-4366-b606-b6dd0af61070.png`; ownership unverified | existing display fallback only                      | unverified           | service-range fallback; actual motif is one client profile               | 1080×1080, 77,988 B  | `e167ea4daf77086d451e415b3bad0257a10e07e9d38fa29de675fbcc23cde2e5` | yes; client side profile                      | not approved      |
| `freshcut-3.webp`      | pixel-equivalent derivative of MissSite `21/5b/215bb75f-000e-49a0-bd9c-39bb82810440.png`; ownership unverified | existing display fallback only                      | unverified           | mirror fallback; actual motif has no mirror                              | 1080×1080, 68,140 B  | `da02d42803d71e0811f88b437dd6a4178a2e8f96fa5b822b4bb7448c76bedae9` | partial client profile                        | not approved      |
| `freshcut-4.webp`      | pixel-equivalent derivative of MissSite `e0/a6/e0a602fa-ac66-4d84-9bb8-bbd4f478b263.png`; ownership unverified | existing display fallback only                      | unverified           | team fallback; actual motif is one client with razor                     | 1080×1080, 106,764 B | `ba7991c86c765d070f70e4ba231763169c7cacbfc888c8e7dc581f0e9a8fbcb3` | yes; full client profile                      | not approved      |

The current public storefront also serves an explicit Unsplash stock image and
one additional MissSite close-up. Neither adds verified salon geometry or AI
transformation rights. The configured official Instagram handle could not be
read anonymously during this audit, so no social-media asset is approved by
inference.

## Authorized synthetic demo lane

The local motion demo may use assets generated from text with no uploaded
FreshCut, customer, employee, social-media, stock or repository image. The
first synthetic outputs may be reused only as internal Higgsfield continuity
references for later synthetic outputs in the same ledger. The first explicit
upload exception is canonical 01L below: a deterministic local transform made
only from a rejected text-generated fictional salon frame. The proposed second
exception for K1AV closed unused after its source failed; no second upload or
K1AV media input exists.

Every derivative in this lane must use the paired provenance
`generated-demo` / `synthetic-text-only`. It represents a fictional salon and
fictional people. It is not evidence of a real FreshCut location, employee,
customer, haircut or result, and it may not be relabelled `approved-final`.
For this lane, `synthetic-text-only` means text-origin-only and includes a
deterministic local pixel transform that introduces no external image.

### Canonical local S0

| Asset                 | Source chain                                                                                                                             | Recipe                                                                                                                                                                                                                 | Accepted master                                                                                         | QA                                                                                                                                              | Rights/use                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 01L / canonical S0/K0 | rejected 01R7 job `68d125a3-b390-462e-8d9b-542633c2776e`, raw SHA-256 `68abaae267d4eaad78ccc00cb93e8f7b264c11955e700734ef68da781581c8ad` | `freshcut-salon-master-v1`, version 1, recipe SHA-256 `fd94045bd63f3858e8add24b696acac41492b8de0ee6a4a868509e8d6e4dc495`; path-free receipt SHA-256 `e0705131ce5a2dd6a26b0246aecd0955b863f37dfde8f403a17654bd290dc4e5` | PNG, 2752×1536, 5,625,854 B, SHA-256 `b3a5f3372668f6a6b3aa28a31911e5a1aa0a2e3cb3ea888106fa04c108356732` | unchanged desktop/360/390/430 contact-sheet gate passed; QA manifest SHA-256 `e420e72aae5e1aa096fff5a18dfdadde17ed6964dcb92b5e4c4ce6b6fa766210` | accepted only for `local-generated-demo`; exactly one byte-verified upload to the selected private owner workspace; never real FreshCut/final |

Raw 01R7 and 01R8 remain rejected and may never appear in later `medias[]`.
Only the single hash-bound 01L `media_input` may represent S0/K0. The private
raw/master files and upload URL remain outside Git; the ledger records the
confirmed media ID, byte verification and balance without recording any URL.

### Closed unused K1AV continuity endpoint exception

Row `17/K1AV source` ran as the already-budgeted A draft before K1B, using
accepted canonical 01L as its only start media. The source failed its binding
vertical safe-zone gate, so this exact second-upload exception closed unused.

| Asset                          | Source chain                                                                                                                                 | Deterministic extraction                              | Required accepted record                                             | QA                                                                          | Rights/use                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| K1AV / rejected, never created | rejected row-17 job `50026697-fc68-46b4-8279-a0e6b13ffba0`; video SHA-256 `f37879dc47a98bbcffe5bfd00b73bc2f2c81aa17537f558ca41c4b24508d1739` | none; source gate failed before authorized extraction | no frame index/PTS/PNG SHA/media ID; no upload or roundtrip occurred | final chair base reaches about y=75%, violating `y=12–58%` and y=62 maximum | exception closed unused; never reference/storefront/`approved-final` |

The complete A-draft video and every decoded frame must first pass the unchanged
full-frame and exact 360×800, 390×844 and 430×932 centre-crop contract, plus the
rigid-geometry, first-frame and stable-final-hold gates. Every frame contains
exactly one complete barber chair: headrest, both arms, seat, hydraulic base and
footrest all have clear margin inside `x=41–59%, y=12–58%`, with nothing
important below `y=62%`. A cropped chair, foreground chair part, occluder or
wipe is rejection. A ends clearly inside the salon on a stable hold of at least
0.75 s. A→B is a geometry-matched hard cut; K1B matches K1AV camera and rigid
geometry with the customer already beside the same complete chair.

The closed exception would have allowed one PNG only after all checks passed: the
deterministic last decoded non-black frame at maximum PTS. No hand-picked
alternative is allowed. The acceptance record must bind the source video
SHA-256, decoded frame index, exact PTS, PNG dimensions and PNG SHA-256.

Only that exact PNG could then have been uploaded once to the selected private
owner workspace. Its downloaded bytes must roundtrip to the recorded PNG
SHA-256 before its media ID is accepted. An accepted K1AV would have had
`use_scope=continuity-reference-only` and paired provenance
`generated-demo` / `synthetic-text-only`; it is never public storefront media,
real FreshCut evidence or `approved-final`. K1B may reference it only after the
whole chain passes, and A final would then have used canonical 01L as start and
the same accepted K1AV as end. The gate failed, so neither happened.

K1AV shares A's acceptance/publication gate: a failed A source can never yield
an accepted K1AV, and A cannot advance to final/public media unless that exact
K1AV passes. Earlier K1A-family foreground-edge/occlusion rules are historical
rejected-job records and are superseded by this complete-chair hard-cut rule.

If the source video, any decoded frame, any exact crop, endpoint extraction,
upload or byte roundtrip fails, the result is rejected. Rejected videos, frames,
PNGs, upload IDs and all K1A/K1AR/K1AR2/K1AE outputs remain forbidden in later
`medias[]`; this exception permits no retry, substitute frame or extra upload.

The final chair base reached about y=75%, so the raw source was rejected. No
K1AV extraction, upload, roundtrip or media ID occurred and K1B onward is
blocked. Local diagnostic reframes are inadmissible, retained outside Git only
as rejected evidence, never uploaded/referenced, and scheduled with the raw
video for cleanup on 2026-09-09.

Raw outputs and signed download URLs remain outside Git. The ledger records
job/output IDs, hashes, estimates, decisions and the final versioned local
media path. Only hash-named FFmpeg derivatives enter the web media tree.

## Missing real-final approval pack

Final generation remains blocked until FreshCut/user-provided references cover:

- canonical salon entrance, chair/workstation, mirror and team/environment;
- one consistent main customer from safe rear/side angles;
- hands/tools/cape/towel details;
- model/customer consent where a person is identifiable;
- explicit permission to upload each selected image to Higgsfield and transform it;
- which salon each image represents and whether the camera route is physically real.

No private/raw reference should be committed. Approved derivatives belong in
the versioned web-media pipeline; source originals remain outside Git.
