# Mural Mockup Generator — Upload → 3 Mural Variations

A web app where the user uploads any artwork and gets back 3 photorealistic mural mockups of that artwork painted on real-world walls, presented as a panoramic triptych with select / retry / cinematic reveal controls.

## How it works (user flow)

1. **Upload** — drop any image (PNG/JPG). Preview shows the source artwork.
2. **Generate** — one click kicks off 3 parallel mural renders. Loading state shows scene names as they complete.
3. **Triptych** — the 3 mockups render side-by-side in a panoramic strip:
   - **Mockup 1 — Industrial Container:** corrugated rusted shipping container, paint flowing into the ridges
   - **Mockup 2 — Dual-Plane Corner:** 90° corner of weathered red brick, mural wrapping both planes
   - **Mockup 3 — Obstructed Concrete Facade:** large concrete wall with a wooden utility pole + power lines casting shadows across the mural
4. **Controls dock** at the bottom:
   - `Select Mockup [1] [2] [3]` — highlights & zooms the chosen panel
   - `🔄 Smart Retry` — re-runs all 3 scenes with shifted angle/lighting prompts
   - `▶ Generate Cinematic Reveal` — enabled once a mockup is selected; opens fullscreen overlay with a scripted cinematic animation (detail-crop → slow zoom-out → ambient parallax loop) on the selected mural

## Architecture

### Backend (server function, not edge function)
- `src/lib/mural.functions.ts` — `generateMurals(artworkDataUrl, variant?)` server function
- Calls Lovable AI Gateway (`google/gemini-3-pro-image-preview` — Nano Banana Pro for best fidelity) **3 times in parallel** using the uploaded artwork as the reference image
- Each call uses a hardened prompt template that locks the artwork as a 1:1 style/composition anchor and specifies wall, perspective, lighting, obstructions, and "wall texture must bleed through paint at ~95% opacity"
- Variant param (`base` | `retry`) swaps a second prompt set with shifted camera angles (±35°, elevation 25°) and warmer lighting for Smart Retry
- Returns `{ murals: [{ scene, imageDataUrl }, ...] }`
- Requires Lovable Cloud + Lovable AI Gateway — I'll enable both

### Frontend
- `src/routes/index.tsx` — replaces placeholder; full mural studio page
- New components in `src/components/mural/`:
  - `UploadZone.tsx` — dropzone for source artwork
  - `MuralTriptych.tsx` — panoramic side-by-side strip with select state
  - `ControlDock.tsx` — Select / Smart Retry / Cinematic Reveal buttons
  - `CinematicReveal.tsx` — fullscreen Framer Motion overlay (sequenced scale/translate/blur keyframes on the still mural; no actual video file)
- TanStack Query mutation drives generation; `useServerFn(generateMurals)`
- All design tokens in `src/styles.css` — deep near-black background with a faint magenta→green radial wash, Space Grotesk display + JetBrains Mono for HUD labels (studio control-room aesthetic so the murals stay the focus)

## Technical notes

- Generated images come back as base64 data URLs and stay in component state (not written to `src/assets/`) since they're per-upload, not project assets
- Parallel generation via `Promise.all` on 3 fetches to the gateway — if one fails the others still render and the failed slot shows a retry button
- 429/402 responses from the gateway surface as toast notifications with clear messaging
- Cinematic reveal is pure CSS/Framer Motion on the still image — no `videogen` call, so it's instant and free. If you later want a real MP4, we can wire `videogen--generate_video` as a follow-up.
- Smart Retry replaces the existing 3 images in place with a crossfade

## Out of scope

- Saving mural history (each upload is ephemeral). Add Lovable Cloud storage + a gallery table later if you want persistence.
- Real video export of the cinematic reveal (browser animation only for now).
