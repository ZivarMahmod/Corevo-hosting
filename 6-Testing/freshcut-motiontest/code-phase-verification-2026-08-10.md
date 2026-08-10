# FreshCut motiontest — code-phase verification

Date: 2026-08-10
Branch: `codex/freshcut-motiontest-production-grade`
Release status: public demo review explicitly authorized on 2026-08-10; final
cinematic media and production release remain blocked by the reference and
rights gate.

Verified source snapshot: 2,051 files, aggregate SHA-256
`235f5b60bc396edd2f78eb6d408473f9b237662624af455baf7b6262ea1b9675`.
The original workspace and the isolated verification copy matched file-for-file
before and after the browser run.

## Verified implementation

- One GSAP/ScrollTrigger authority drives the eight-state scene manifest.
- Booking, service prices and salon information remain server-rendered DOM content.
- The existing booking provider remains the booking URL owner.
- Reduced motion, save-data, 2G, low-memory and media-failure paths retain the complete business content.
- Motiontest does not mount the public realtime listener or cookie banner.
- Motiontest does not expose the denied `/login` account path; ordinary FreshCut
  and preview keep their existing account navigation.
- The skip link, checkpoint focus and all compact interactive targets are keyboard/touch usable.
- Ordinary FreshCut and preview rendering do not receive the motiontest shell marker or skip-link contract.

## Automated gates

| Gate | Result |
| --- | --- |
| Full repository unit/contract suite | 352 files, 2,782 tests passed; 0 failed |
| Typecheck | passed; 0 errors |
| Lint | 0 errors; 3 pre-existing Zentum `<img>` warnings |
| Production Next build | passed in the isolated copy with Node 22.23.2 and pnpm 10.33.0 |
| Chromium browser suite | 22 passed, 1 approved-final media test skipped, 0 failed |
| Firefox browser suite | 22 passed, 1 approved-final media test skipped, 0 failed |
| WebKit browser suite | 22 passed, 1 approved-final media test skipped, 0 failed |
| Explicit live FreshCut isolation | 3/3 passed against `https://freshcut.corevo.se` |
| Browser console/network probe | 9/9 returned HTTP 200; 0 failed requests, HTTP errors, console errors or page errors |
| Independent browser-fix re-review | passed with 0 Critical, 0 Major and 0 Minor findings |

The complete Playwright result contains 69 rows: 66 passed, 3 skipped, 0 failed
and 0 flaky. Each engine passed all five CLS/fallback tests, both no-JavaScript
tests and all 15 active main-experience tests. The only skip in each engine is
the codec/currentSrc test, with the explicit reason that no `approved-final`
media family exists yet.

The browser matrix ran against the same source snapshot through the repository's
workflow-compatible local Next development transport. The production build was
verified separately. A discarded diagnostic run against a production server over
plain HTTP was not treated as product evidence: the production CSP correctly
contains `upgrade-insecure-requests` and HSTS, so WebKit upgraded CSS and JS to
HTTPS while the diagnostic server had no TLS listener. Final deployed acceptance
must therefore rerun all three engines against the real HTTPS motiontest host.

Cold-load CLS measurements:

| Viewport | Chromium | Firefox | WebKit |
| --- | ---: | ---: | ---: |
| 1440×900 | 0.034793 | 0 | 0 |
| 390×844 | 0.027771 | 0 | 0 |
| 320×800 | 0.010572 | 0 | 0 |

At 1440×900 the two-salon summary ended at approximately 776.97 px in
Chromium, 776.93 px in Firefox and 776.94 px in WebKit, within the 900 px first
viewport. The same first-viewport business gate now also runs at the exact
1024 px desktop breakpoint.

## Isolation evidence

- A final read-only `git ls-remote` check after the browser run confirmed GitHub
  `main` at commit `cdc6a6c6b6fddc89e32c10baf565d69bfeb62a7a`; this is the
  production branch used by the verified `bokningsplatformen` deployment.
- The verified production Worker version was
  `e9b82edd-e0d6-422d-92e0-14973138928f`.
- `freshcut.corevo.se` resolved through Cloudflare and returned HTTP 200 during
  the final read-only isolation check.
- `motiontest.corevo.se` still had no public A record or reachable HTTPS host at
  the code-phase gate.
- No production deploy, motiontest deploy, DNS change, migration or remote push
  was performed during this verification.

Before a future motiontest release, re-read the production Worker version and
prove that it is unchanged after the isolated motiontest deployment.

## Open release blocker

Final Higgsfield production is not approved. The repository contains display
fallbacks, but no verified real FreshCut entrance-to-mirror reference pack and
no documented permission to upload identifiable salon/customer material for AI
transformation. See the source manifest and generation ledger in
`4-Dokument-Underlag/01-acceptans/freshcut-motiontest/`.

Required before the skipped media gate can run:

- approved real entrance, chair/workstation, mirror and team/environment references;
- one consistent main-customer rear/side reference and approved hands/tools/cape/towel material;
- photographer/model/customer permission for Higgsfield upload and AI transformation;
- selected canonical salon and a camera route supported by those photographs;
- encoded, versioned desktop/mobile WebM+MP4 assets and poster frames produced by
  the repository media pipeline.

The owner explicitly authorized an isolated public demo deployment with the
designed fallback media on 2026-08-10 so the motion, booking and responsive
experience can be reviewed online. That authorization does not approve final
Higgsfield media or a production release. Do not call the experience complete
or promote it to live FreshCut until the approved reference pack has produced
final media and all four independent critic loops have passed against that
integrated media.
