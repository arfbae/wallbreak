# Mural Mockup Studio — production readiness roadmap

Working through the audit findings one at a time.

## Use the user's own AI keys

- [ ] Store the provided keys as server secrets; route renders to Google Gemini and fal.ai (wall + artwork capable) when built-in credits run out; explain in the key box which key types work and where they're stored. Also try Hugging Face as an image service; explain Cloudinary only stores pictures.

## One artwork on several walls

- [x] "Multi-wall" mode: one artwork on 1–3 wall photos, one mockup per wall, each wall measured separately; per-panel failure isolation; clear messages for missing wall/artwork, bad or oversized images and used-up credits (75 tests). Browser-checked up to the render service; a finished real render is pending because AI credits are used up.

## Graffiti reference integration

- [x] Integrate supplied graffiti taxonomy into existing source analysis, mural prompts and combined composition planning; verified style preservation, uncertain lettering and background choices with 12 regression tests (56 total passing). Real-render check with an actual graffiti photo still pending.

## Outline export

- [x] Add explicit Canvas Canny threshold control and transparent vector SVG export; verified SVG/PNG browser downloads, transparent backgrounds and 3× vector rendering with a full-scene fixture; all 44 tests pass.
- [x] Convert the selected mockup into a full-scene black-and-white outline with detail and line-weight controls, preview, download, and library save.
- [x] Verify contour processing and the selected-mockup export flow (41 tests passing; fixture-based browser checks for comparison, adjustments, download, library save, and mobile layout).

## Phase 1 — safe to leave published

- [x] Meter the server AI key: signed-in only + 30 renders / rolling 24h quota (`generation_usage` table, `gen-guard.server.ts`)
- [x] Quote / cost calculator (sq m × rate, prep, travel) feeding the PDF proposal
- [x] Per-route SEO metadata (`/`, `/auth`, `/view`)
- [x] Input hardening: cap uploaded image size before it hits the server function
- [x] Friendly error surfaces for gateway 402/403/429

## Phase 2 — polish

- [ ] Mobile responsiveness pass on the triptych, control dock and dialogs
- [x] Persist generated mockups to the library (bookmark button on each mockup; Library panel shows a Mockups row with full-size preview and download)
- [ ] Loading/skeleton states + generation progress per panel

## Phase 3 — hardening

- [ ] Smoke tests for generation, share links and PDF export
- [ ] Technical debt: split `mural.functions.ts` into thin server fn + prompt module
