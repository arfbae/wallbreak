# Mural Masterpiece Engine

[SYSTEM INTERACTION MANDATE]

Act as an advanced spatial planning engine. Generate exactly three independent mural mockup designs, displayed strictly side-by-side in a single, panoramic triptych layout. Following generation, provide user controls for "Select Mockup [1/2/3]" to trigger a cinematic video reveal, and an automated "Smart Retry" loop.

[STYLE & ARTWORK REFERENCE DNA]

- Core Subject: Use the uploaded elephant artwork (Artwork_Check_05.jpeg) as a strict 1:1 style anchor. Preserve the thick, bold black illustrative line-art, intricate mandala forehead details, and organic paint-drip textures.

- Fragment Geometry: Integrate sharp, high-contrast silhouette glyph/contour contours extracted natively via image segmentation. Lines must mimic the extracted edge threshold geometry.

- Color Palette: A cohesive, psychedelic-neon profile dominated by electric greens, hot yellows, vivid oranges, and deep magenta, balancing heavy pigment with clean contrasts.

- Medium: Authentic hand-drawn street-art graffiti. No vector smoothing or clean digital gradients.

[THE 3 MOCKUP SCENARIOS (SIDE-BY-SIDE PANORAMA)] and 1 MOCKUP IMAGE of artwork outline on wall.

Generate these three distinct scenarios aligned next to each other from left to right:

1. Mockup 1 (The Industrial Container): The elephant mural warped onto a heavily corrugated, rusted metal shipping container. Paint must follow the physical valleys and ridges of the metal with realistic pigment absorption and rust flaking.

2. Mockup 2 (The Dual-Plane Corner): The elephant artwork wrapping seamlessly around a 90-degree corner wall of weathered bricks. The perspective warp must perfectly map to both vanishing points without distortion.

3. Mockup 3 (The Obstructed Concrete Facade): The mural rendered on an XL textured concrete building facade, positioned strictly behind a realistic foreground obstruction (a wooden utility pole and hanging power lines) casting accurate shadows over the artwork.

[ENVIRONMENT, GEOMETRY & PHYSICS LOGIC]

- Turntable Framing: Ensure the virtual camera framing for each mockup uses a clear, studio-grade tracking target focal distance. The camera focus calculates the global bounding box center across an explicit 3-angle setup (35°, -35°, 135°) at a 15° elevation angle.

- Clean Studio Lighting: Replicate an ultra-clean 3-point area illumination configuration:

    * Key Light: Powerful directional projection from top-front-right (3, -3, 4) at 1200W.

    * Fill Light: Softened counter-illumination from front-left (-4, 2, 2.5) at 500W.

    * Rim Light: High-separation backlighting from top-rear (-2, -3, 5) at 700W.

- Render & Output: Emulate a clean Cycles engine finish utilizing full shading smoothing across concrete and brick surfaces. Deliver output at absolute raw quality without watermarks, pricing tags, or artificial bounding overlays.

- Render at Level 4+ Environmental Entropy: Include concrete stains, weathered masonry pits, and realistic lighting interaction.

- Apply 95% opacity Multiply/Overlay substrate mapping. The underlying wall texture must remain sharply visible through the paint.

[INTERACTIVE UI CONTROLS]

After generating the 3 mural mockup images, output the following interactive dashboard showing:

1. Mockup 1

2. Mockup 2

3. Mockup 3

4. 🔄 Smart Retry (Analyzes alignment data and shifts composition angles/lighting across all 3 mockups simultaneously)

5. Generate cinematic movie/reveal button (Activates once user selects one mural mockup image)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wallbreak.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7602ff8e-d16d-4ea9-9d12-78b0bc883232).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
