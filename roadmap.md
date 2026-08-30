# Mural Mockup Studio — production readiness roadmap

Working through the audit findings one at a time.

## Phase 1 — safe to leave published
- [x] Meter the server AI key: signed-in only + 30 renders / rolling 24h quota (`generation_usage` table, `gen-guard.server.ts`)
- [ ] Quote / cost calculator (sq m × rate, prep, travel) feeding the PDF proposal
- [ ] Per-route SEO metadata (`/`, `/auth`, `/view`)
- [ ] Input hardening: cap uploaded image size before it hits the server function
- [ ] Friendly error surfaces for gateway 402/403/429

## Phase 2 — polish
- [ ] Mobile responsiveness pass on the triptych, control dock and dialogs
- [ ] Persist generated mockups to the library (currently in-memory only)
- [ ] Loading/skeleton states + generation progress per panel

## Phase 3 — hardening
- [ ] Smoke tests for generation, share links and PDF export
- [ ] Technical debt: split `mural.functions.ts` into thin server fn + prompt module
