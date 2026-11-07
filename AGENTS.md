# Architecture rules

- Keep outline conversion in the client-side image-processing module using Canny contours, not the AI generation pipeline, to preserve the selected scene's coordinates without redraws or extra generation costs.
- Outline export uses its own dialog and saves as a mockup library item so source images remain unchanged and existing library workflows stay compatible.
- Vectorize the Canny matrix with ImageTracer into filled contour paths, removing background layers and retaining the image viewBox so SVG exports scale without embedded raster images.
- Keep conditional graffiti guidance in one browser-safe shared module consumed by source analysis, mural prompt assembly and composition planning; this prevents style rules drifting across the existing pipeline and does not imply measured OCR or segmentation.
- Validate render requests (modes, wall/artwork limits, size caps) in the browser-safe mural-request module used by the server function and UI, so user-facing limits live in one tested place.
- Each mockup in a render pass is wrapped so an unexpected error fails only that panel; multi-wall mode measures and renders every wall independently through the same central router.
- Pitch writing uses an authenticated server function and request-local streaming Responses helper; drafts never imply email delivery or an attached file until the user shares it.
- Record walk-through clips in the browser from the exact selected image, keeping scene fidelity and avoiding generation costs.
- Hugging Face Spaces remain allowlisted, opt-in resources in the central router; preserve every reference and the original prompt, enforce documented input limits, disable prompt rewriting, and never rotate credentials or auto-resubmit a queued Space job.
