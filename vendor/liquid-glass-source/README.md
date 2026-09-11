<div align="center">

<img src="https://lh3.googleusercontent.com/d/1W3AEjS97apCKc72aIrTTlDPnsVEW_w4v" width="96" alt="Liquid Glass logo" />

# Liquid Glass

**Figma's Liquid Glass effect, rebuilt as a real-time WebGL2 renderer.**

Design the glass in the browser, then export a config you can paste anywhere.

[**Live site →**](https://liquidglass.miftahulislamefaz.xyz/) · [**Open the editor →**](https://liquidglass.miftahulislamefaz.xyz/app.html) · [**Guide →**](https://liquidglass.miftahulislamefaz.xyz/guide.html)

<img src="https://lh3.googleusercontent.com/d/1TGmfd7SzdEluHuYy4BbYumFhOWgQ2X5_" width="100%" alt="Liquid Glass editor" />

</div>

---

## What it does

Real refraction, not a blur filter. A signed distance field is built from any shape, turned into a height field, and used to bend the background per pixel on the GPU — with chromatic dispersion, frost, and specular light.

- **Any shape** — rectangles, ellipses, pills, polygons, stars, or paste your own SVG path
- **Figma-accurate controls** — Refraction, Depth, Dispersion, Frost, Splay, Light
- **Two controls Figma doesn't have** — see below
- **Copy-paste configs** — export JSON, import it back, share it
- **Presets** — seven starting points, one click each

## Controls

| Control | What it does |
| --- | --- |
| Refraction | How hard the background bends |
| Depth | How thick the glass reads |
| Dispersion | Chromatic splitting at the curved edge |
| Frost | Background blur through the glass |
| Splay | How widely projected light spreads (needs Light intensity > 0) |
| **Reach** | How far the bevel reaches inward. High values turn the whole shape into a lens instead of a flat pane with a bevelled border. |
| **Soften** | Rounds off the creases that fan in from the corners once Reach is wide, so the lens becomes a smooth dome instead of a faceted one. |

**Reach** and **Soften** go beyond Figma. Figma's bevel is pinned near the border, which caps how much the glass can behave like a real lens; Reach lifts that cap. Soften then blurs the distance field *before* the rim profile is applied — tapered so the border keeps its exact distance and only the interior smooths, which is what removes the corner creases without draining the refraction.

## A config to start from

```json
{
  "glass":  { "lightAngle": -45, "lightIntensity": 20, "refraction": 100, "depth": 100, "dispersion": 0, "frost": 22, "splay": 4 },
  "layer":  { "x": 320, "y": 119.75, "w": 313, "h": 296 },
  "solver": { "reach": 100, "soften": 24, "smooth": 4, "gain": 160, "chroma": 1.0, "spread": 0.26, "fall": 1.6, "dark": 0, "tint": 0.02 }
}
```

Paste it into the editor's config box and hit Apply.

## Run it locally

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

## How it's built

No framework, no renderer library — vanilla JS and one WebGL2 fragment shader.

- **Field** — exact Euclidean distance transform (Felzenszwalb & Huttenlocher), a rim profile, and a Sobel pass, packed into an `RGBA32F` texture as `(gx, gy, height, coverage)`. Storing the *gradient* instead of differencing height in the shader is worth about 100× in signal-to-noise and saves eight texture fetches per pixel.
- **Threading** — the field build costs ~42 ms at drag resolution and ~830 ms at full, so it runs in a Web Worker. The main thread only uploads, which keeps the sliders at full framerate.
- **Precision** — falls back to `RGBA16F` where `OES_texture_float_linear` is unavailable.
- **Scroll** — [Lenis](https://github.com/darkroomengineering/lenis).

```
src/
  renderer.js      WebGL2 pipeline + shaders
  sdf.js           distance transform, rim profile, Sobel
  field-worker.js  the build, off the main thread
  state.js         params, solver constants, shape model
  ui.js            panel bindings
  interact.js      canvas drag/resize
  landing.js       landing page
public/
  guide.html       full control reference
```

## Credits

Built by [Miftahul Islam Efaz](https://github.com/Miftahul-Islam-Efaz). Effect inspired by Figma's Liquid Glass.
