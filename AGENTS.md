# Architecture rules

- Keep outline conversion in the client-side image-processing module using Canny contours, not the AI generation pipeline, to preserve the selected scene's coordinates without redraws or extra generation costs.
- Outline export uses its own dialog and saves as a mockup library item so source images remain unchanged and existing library workflows stay compatible.
- Vectorize the Canny matrix with ImageTracer into filled contour paths, removing background layers and retaining the image viewBox so SVG exports scale without embedded raster images.
- Keep conditional graffiti guidance in one browser-safe shared module consumed by source analysis, mural prompt assembly and composition planning; this prevents style rules drifting across the existing pipeline and does not imply measured OCR or segmentation.
