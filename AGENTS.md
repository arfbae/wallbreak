# Architecture rules

- Keep outline conversion in the client-side image-processing module using Canny contours, not the AI generation pipeline, to preserve the selected scene's coordinates without redraws or extra generation costs.
- Outline export uses its own dialog and saves as a mockup library item so source images remain unchanged and existing library workflows stay compatible.