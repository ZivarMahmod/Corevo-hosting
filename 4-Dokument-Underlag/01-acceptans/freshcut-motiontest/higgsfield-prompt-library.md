# FreshCut motiontest — Higgsfield prompt library

Status: v2 locked for the local synthetic demo; real-FreshCut generation remains blocked.
Date: 2026-08-10

## Provenance and model lane

The v2 lane is text-only. It must not upload or reference a FreshCut, customer,
employee, MissSite, BaseKit, Unsplash, social-media or repository image. Every
person and environment is fictional. Later jobs may reference only accepted
output IDs from the fourteen still jobs registered in `generation-ledger.md`.

- stills: `nano_banana_pro`, 2K, 16:9, one output;
- drafts: `seedance_2_0_mini`, 720p, 5 s, 16:9, one silent output;
- selected finals: `seedance_2_0`, `mode=std`, 1080p, 5 s, 16:9, one silent output;
- no batch, automatic retry, audio or unregistered model substitution;
- paired runtime provenance: `generated-demo` / `synthetic-text-only`.

The real-FreshCut lane still requires the approval pack in `asset-manifest.md`.
Nothing in this file authorizes transformation of real material.

## Global block for every prompt

```text
FICTIONAL DEMO ASSET — not a real FreshCut salon, employee or customer.
Create no real person's likeness and no real salon geometry. No readable text,
signage, logo, watermark, UI, pricing or brand mark.

Preserve the accepted internally generated references when supplied: exact
doorway, floor, chair, workstation, mirror frame, lighting, cape, customer
identity, hair silhouette and screen direction. Chest-height camera, fixed
horizon and lens, physically plausible parallax, no axis crossing. Customer is
rear/three-quarter facing screen-left toward the mirror; barber stays
camera-right.

Every critical whole bounding box — face, head, hands, tool, chair and mirror
anchor — remains inside x=41–59% and y=12–58% for the portrait crop. Put no
important detail below y=62%. Preserve the shot's desktop copy exclusion zone:
left-copy scenes reserve x=0–46%; right-copy scenes reserve x=54–100%.

No direct-camera performance, duplicate person, person materializing, floating
tool, tool swap, extra or fused finger, detached hand, changing tattoo,
changing hair length, changing cape, warped chair, bent wall, impossible glass
or generated mirror reflection. Natural anatomy, gravity and restrained motion.
No strobe, flicker, rapid exposure shift or sequence with more than three
flashes per second.
```

## Fourteen still jobs

The first three jobs have an empty media/reference list. Record each accepted
output ID before it is used by a later row.

### S0 — `SALON_REF` and K0 threshold

```text
Create one photorealistic 16:9 cinematic establishing frame of a completely
fictional contemporary Scandinavian barbershop. Empty salon. Chest-height 35 mm
camera outside a central open doorway, fixed level horizon. Warm practical
light, graphite and muted olive walls, pale stone floor, one matte-black barber
chair beyond the doorway, one simple workstation and one rigid rectangular
mirror with neutral dark glass. Clear straight path toward the chair. Place the
doorway/chair anchor inside x=47–59%, y=12–58%; reserve x=0–46% as calm dark
negative space for DOM copy. No people, text, signs, logos or reflections.
```

### S0R — one documented composition retry

Use only after row 01 is rejected for its centred portrait crop. Send the same
global block and S0 prompt plus this correction; no media references:

```text
COMPOSITION CORRECTION: keep the doorway opening itself unobstructed at exact
image centre. No door frame, mullion or wall edge may cross x=45–55%. Place the
entire chair — headrest, both arms, seat, footrest and base — fully inside
x=45–55%, y=18–58%, with clear margin around it. Preserve calm negative space
at x=0–40%. The centred 9:16 crop must show the whole doorway path and whole
chair, not a partial chair at either edge.
```

### S0R2 — second documented artifact retry

Use only after row 01R is rejected for rendering a visible composition guide.
Send the same global block and S0 prompt plus this correction; no references:

```text
All spatial instructions are invisible composition guidance only. Do not draw
or render any guide, outline, border, rectangle, line, highlight, annotation or
frame around the chair or doorway. Compose one natural unmarked photograph:
the open doorway and the complete chair are centred together, the whole chair
has clear margin on every side, and calm dark negative space remains on the
left. The centred portrait crop shows the full doorway path and full chair.
```

### S0R3 — third documented crop retry

Use only after row 01R2 is rejected because the true tall-phone centre crops
clip the chair footrest at the right edge. Send the same global block and S0
prompt plus this correction; no references:

```text
FINAL PHYSICAL PLACEMENT CORRECTION: make the open doorway and the complete
barber chair share the exact visual centre of the photograph. Move the chair
substantially left within the room so its headrest, both arms, seat, hydraulic
base and entire footrest all have generous empty margin inside even the
narrowest centred tall-phone crop. Keep the chair facing slightly left without
extending any part toward the right crop edge. Preserve the broad calm dark wall
on the far left for DOM copy. These are invisible photographic composition
instructions: render no guide, border, rectangle, line, annotation, text or
highlight of any kind.
```

### S0R4 — fourth documented DOM-overlay retry

Use only after row 01R3 passes every true tall-phone crop but the real opaque
desktop DOM panel hides the chair's left side. Send the same global block and S0
prompt plus this correction; no references:

```text
DOM OVERLAY CORRECTION: keep the open doorway centred, but make the complete
barber chair modestly smaller and place every physical part of it just right of
centre, fully inside x=49–58% and y=28–58%. The headrest, both arms, seat,
hydraulic base and entire footrest must all remain to the right of the opaque
left copy panel ending at x=47%, while also retaining clear margin inside the
narrowest centred tall-phone crop. Preserve the broad calm dark wall at x=0–46%
for DOM copy. All percentages are invisible composition instructions only:
render one natural unmarked photograph with no guide, border, rectangle, line,
annotation, text or highlight.
```

### S0R5 — fifth documented coordinate-free retry

Use only after row 01R4 renders the numeric composition instructions as visible
labels and guide lines. This retry deliberately replaces both the global block
and S0 block with the following coordinate-free text; no references:

```text
FICTIONAL DEMO ASSET. Create one natural, unmarked, photorealistic wide
cinematic photograph of an empty contemporary Scandinavian barbershop. It must
not resemble a real salon or contain any real person's likeness.

The camera is chest-height outside an open doorway with a fixed level horizon
and a calm documentary lens. Warm practical light, graphite and muted olive
walls, pale stone floor. A broad plain dark wall fills nearly the entire left
half as calm empty copy space. The open doorway sits at the visual centre. A
complete matte-black barber chair stands slightly right of the doorway centre
and is modestly sized, with its headrest, both arms, seat, hydraulic base and
entire footrest all clearly visible with generous empty floor and wall margin.
It must remain complete even when the outer sides of the photograph are trimmed
heavily for a tall phone. Keep one simple workstation and one rigid rectangular
mirror with neutral dark glass farther behind the chair. Maintain a clear
straight walking path from the doorway.

This is only a photograph. Include no characters, letters, numbers, percentage
marks, measurements, captions, guide lines, grids, diagrams, borders,
rectangles, annotations, highlights, watermark, signage, logo, interface,
pricing, brand mark or reflection.
```

### P0 — `CUSTOMER_REF`

```text
Create one wholly fictional adult customer identity reference, never resembling
a public or real person. Neutral dark studio, consistent warm salon lighting,
rear and subtle three-quarter side presentation in one natural pose, short dark
finished fade silhouette already established, plain dark clothing, no logo.
Subject centred within x=41–59%, head and torso inside y=12–58%. No direct gaze,
text, tattoo, jewelry, duplicate view or transformation sheet.
```

### P1 — `BARBER_REF`

```text
Create one wholly fictional adult barber identity reference, never resembling a
public or real person. Neutral dark studio, consistent warm salon lighting,
three-quarter side pose facing screen-left, plain black workwear and apron with
no logo, empty relaxed hands. Full relevant silhouette inside x=41–59%,
y=12–58%. No direct gaze, text, tattoo, tools, duplicate view or character sheet.
```

### K1A — empty chair transition frame

References: accepted S0 only.

```text
Same exact fictional salon and camera family as S0, now just inside the doorway.
Empty salon and empty chair. Preserve rigid wall, floor, doorway, workstation,
mirror and lighting geometry. Chest-height 35 mm camera, straight path and
foreground chair edge suitable for an occlusion cut. Chair anchor inside
x=47–59%, y=18–58%; reserve x=0–46% for copy. No people or new objects.
```

### K1B — customer already beside chair

References: accepted S0, P0, P1 and K1A only.

```text
Same exact fictional salon and exact K1A camera transform, background geometry
and foreground chair edge. The accepted fictional customer already stands
immediately beside the chair, rear three-quarter facing screen-left, with the
same plain dark cape loosely fastened and already draped around the shoulders.
The accepted barber is just outside the visible right edge; do not show an
entering limb. Keep customer/chair inside x=41–53%, y=12–58%; reserve
x=54–100% for right-side DOM copy. Same hair silhouette, clothing, lens,
horizon and light.
```

### K2 — stable preparation

References: accepted S0, P0, P1 and K1B only.

```text
Same customer seated in the same chair with a plain dark cape settled by
gravity. Same barber standing camera-right in a stable preparation pose. Hair
length and silhouette already match the later finished frame. One clipper and
one comb only, held naturally but not touching skin. Customer/chair/hands inside
x=41–53%, y=12–58%; reserve x=54–100% for copy. No tool swap or reflection.
```

### K3 — finished craft detail

References: accepted S0, P0, P1 and K2 only.

```text
Same customer, barber, chair, cape, hair silhouette and salon. Show the end of
one final neckline/fade detail only, with the same clipper and comb in the same
hands. Camera has moved no more than 15 degrees right and still faces toward the
neutral mirror edge. Hands, tool and finished head inside x=47–59%, y=12–58%;
reserve x=0–46% for left-side DOM copy. Stable finish, no full haircut change.
```

### K4 — mirror start/result frame

References: accepted S0, P0 and K3 only.

```text
Same finished fictional customer and exact salon in a locked rear/side result
composition. Customer and rigid rectangular mirror anchor occupy x=41–53%,
y=12–58%; reserve x=54–100% for DOM result and booking copy. Mirror glass is
oblique neutral matte with stable planar edges and no visible face, body, tool
or generated reflection. No barber or team in frame.
```

### R1–R5 — separate service-range stills

References: accepted S0 only. Each row is a separate one-output job. Reuse the
fictional salon palette, never the main customer or barber identity.

```text
R1 YOUNG ADULT: one fictional young adult client, rear/side view, one simple
finished haircut moment. One subject only.

R2 CHILD: one fictional child client from a safe rear/side angle, calmly seated
for a simple haircut; one adult barber's hands may be visible, no face focus.

R3 WOMAN: one fictional adult woman client, rear/side view, one precise scissor
detail. One subject only.

R4 SENIOR: one fictional senior adult client, rear/side view, one calm finished
haircut moment. One subject only.

R5 BEARD: one fictional adult beard client, side/rear crop, one warm-towel or
beard-line moment, never both actions at once.

For every row: subject/action inside x=41–59%, y=12–58%; no important detail
below y=62%; no identity reuse, category morph, direct gaze, text or logo.
```

### T0 — separate team still

References: accepted S0 and P1 only.

```text
Same exact fictional salon palette and rigid geometry. A small fictional adult
team already stands naturally beyond and to the right of the mirror; nobody
enters or materializes. The accepted barber may appear once. Keep the main team
environment anchor inside x=41–59%, y=12–58% while reserving x=0–46% for DOM
about copy. Neutral matte mirror, no reflected people, text, logo or signage.
```

## Four action clips

Run B draft first, then C. Review B and C together. A and D drafts remain
blocked until that continuity review passes. A final is generated only after
its corresponding draft passes composition, anatomy, physics and both crops.

### A — S0/K0 to K1A, 5 s

```text
Use accepted S0 as start image and K1A as end image. Empty fictional salon.
Hold the first frame locked for about 0.75 s, dolly straight through the doorway
at chest height with no zoom or roll, preserve rigid wall, door, floor, chair
and mirror geometry, then hold the final frame about 0.75 s. End on a clear path
toward the empty chair; chair foreground supplies the next occlusion cut.
```

### B — K1B to K2, 5 s

```text
Use accepted K1B as start image and K2 as end image plus accepted S0, K1A, P0
and P1 as continuity references. The same customer already stands beside the
chair, rear three-quarter, wearing the same loosely draped cape. Customer turns
once and settles; that existing cape only settles with gravity and never
appears or changes material. The same barber enters from camera-right carrying
the same single clipper and comb already present in K2, then stops camera-right.
Camera trucks left no more than 0.5 m and never crosses the customer-chair axis.
End with a one-second stable preparation hold matching C exactly.
```

### C — K2 to K3, 5 s

```text
Use accepted K2 as start image and K3 as end image plus accepted S0, P0 and P1
as continuity references. Hair length and silhouette already match the final.
Show only one final neckline/fade detail. Exactly one clipper and one comb remain
visible in the same hands. No tool swap or full haircut transformation. Camera
arcs right no more than 15 degrees; barber remains camera-right and neutral
mirror edge screen-left. Hands remain anatomically attached and blade never
passes through skin. End on a one-second stable finished detail.
```

### D — K4 mirror only, 5 s

```text
Use accepted K4 as start image plus accepted S0 and P0 as continuity references.
Locked rear/side mirror composition. One natural customer head turn of at most
10 degrees, then a one-second stable hold. Neutral matte mirror has no visible
face, body or tool reflection and its planar edges remain rigid. No team reveal,
camera pan, person entry, identity change or new haircut state.
```

## Local still delivery

Hero, Range, Return and Team are poster-only and never receive video sources.
Range is a deterministic responsive composition of R1–R5, with one distinct
subject at a time and one mobile-centred dominant panel. Hero uses S0. Craft is
captured from the final K3 endpoint of clip C, and Return reuses those exact
Craft desktop/mobile poster URLs so it causes no new fetch. Team uses T0 with a
local CSS/GSAP pan; the source image itself is stable. Every still output ID and
SHA chains through the versioned poster recipe into its manifest. No temporary
video is created for a still-only scene.
