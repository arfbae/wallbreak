# Mural Mockup Studio — production readiness roadmap

Working through the audit findings one at a time.

## Current request — outline export
 
## Current request — graffiti reference integration

- [ ] Integrate supplied graffiti taxonomy into existing source analysis, mural prompts and combined composition planning; verify style preservation, uncertain lettering and background choices with regression tests.

## Outline export

- [x] Add explicit Canvas Canny threshold control and transparent vector SVG export; verified SVG/PNG browser downloads, transparent backgrounds and 3× vector rendering with a full-scene fixture; all 44 tests pass.
- [x] Convert the selected mockup into a full-scene black-and-white outline with detail and line-weight controls, preview, download, and library save.
- [x] Verify contour processing and the selected-mockup export flow (41 tests passing; fixture-based browser checks for comparison, adjustments, download, library save, and mobile layout).

## Phase 1 — safe to leave published

- [x] Meter the server AI key: signed-in only + 30 renders / rolling 24h quota (`generation_usage` table, `gen-guard.server.ts`)
- [ ] Quote / cost calculator (sq m × rate, prep, travel) feeding the PDF proposal
- [x] Per-route SEO metadata (`/`, `/auth`, `/view`)
- [ ] Input hardening: cap uploaded image size before it hits the server function
- [ ] Friendly error surfaces for gateway 402/403/429

## Phase 2 — polish

- [ ] Mobile responsiveness pass on the triptych, control dock and dialogs
- [ ] Persist generated mockups to the library (currently in-memory only)
- [ ] Loading/skeleton states + generation progress per panel

## Phase 3 — hardening

- [ ] Smoke tests for generation, share links and PDF export
- [ ] Technical debt: split `mural.functions.ts` into thin server fn + prompt module
