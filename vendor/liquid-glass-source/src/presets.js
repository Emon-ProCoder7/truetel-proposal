// Glass presets.
//
// Each preset is a PARTIAL config in exactly the shape importConfig() accepts,
// so applying one reuses the same validated path the paste-config box uses.
// assignNumbers() only copies keys that already exist on the target and parse
// as finite, so a preset may name as few or as many fields as it likes.
//
// `glass`  - the six user-facing Figma sliders
// `solver` - internals; omit unless the look genuinely needs them

export const GLASS_PRESETS = [
	{
		id: 'figma',
		name: 'Figma default',
		note: 'The reference this app is calibrated against.',
		glass: { refraction: 100, depth: 80, dispersion: 100, frost: 5, splay: 0, lightIntensity: 0, lightAngle: -45 },
		solver: { smooth: 4, gain: 123, chroma: 1.55, spread: 0.26, fall: 1.25, dark: 0, tint: 0.02 },
	},
	{
		id: 'frosted',
		name: 'Frosted card',
		note: 'Heavy blur, quiet colour. Good behind text.',
		glass: { refraction: 55, depth: 60, dispersion: 30, frost: 42, splay: 0, lightIntensity: 0 },
		solver: { chroma: 1.1, spread: 0.3, fall: 1.4, tint: 0.05 },
	},
	{
		id: 'prism',
		name: 'Prism',
		note: 'Maximum rainbow. Needs a detailed backdrop to show off.',
		glass: { refraction: 100, depth: 70, dispersion: 100, frost: 0, splay: 0, lightIntensity: 0 },
		solver: { chroma: 2.1, spread: 0.2, fall: 1.1, tint: 0 },
	},
	{
		id: 'droplet',
		name: 'Water droplet',
		note: 'Thick rounded rim, strong bend, almost no haze.',
		glass: { refraction: 100, depth: 100, dispersion: 55, frost: 2, splay: 0, lightIntensity: 0 },
		solver: { chroma: 1.4, spread: 0.28, fall: 1.8, tint: 0 },
	},
	{
		id: 'subtle',
		name: 'Subtle UI glass',
		note: 'Restrained. Safe for panels and navbars.',
		glass: { refraction: 34, depth: 42, dispersion: 22, frost: 10, splay: 0, lightIntensity: 0 },
		solver: { chroma: 1.0, spread: 0.3, fall: 1.5, tint: 0.04 },
	},
	{
		id: 'lens',
		name: 'Reading lens',
		note: 'Clear centre, colour only at the very rim.',
		glass: { refraction: 78, depth: 34, dispersion: 70, frost: 0, splay: 0, lightIntensity: 0 },
		solver: { chroma: 1.7, spread: 0.24, fall: 2.4, tint: 0 },
	},
	{
		id: 'smoke',
		name: 'Smoked glass',
		note: 'Dark and moody, colour suppressed.',
		glass: { refraction: 60, depth: 66, dispersion: 18, frost: 24, splay: 0, lightIntensity: 0 },
		solver: { chroma: 0.85, spread: 0.32, fall: 1.4, dark: 0.22, tint: 0.12 },
	},
]

/**
 * A TEMPLATE the user pastes into an AI assistant to get their tuned glass
 * rebuilt on a specific element of their own site. Their configuration is
 * baked in as fixed values; the only blanks are what to build on, and
 * (optionally) where the code should live.
 *
 * Deliberately NOT a spec for an interactive playground: assistants told to
 * "expose settings as props" build a control panel instead of the effect.
 * Deliberately stack-agnostic: the assistant reads the user's project and
 * adapts itself, so the user never has to know or name their framework.
 *
 * @param {object} cfg result of exportConfig()
 * @returns {string}
 */
export function buildTemplatePrompt(cfg) {
	const g = cfg.glass || {}
	const sv = cfg.solver || {}
	const s = cfg.shape || {}
	const vb = Array.isArray(s.viewBox) ? s.viewBox : [0, 0, 100, 100]
	// DEPTH_REF: the shorter side of the shape's viewBox, against which every
	// pixel-unit constant was fitted.
	const depthRef = Math.min(vb[2], vb[3])
	const rimWidth = ((g.depth / 100) * sv.reach).toFixed(1)
	const softenNote = sv.soften
		? ''
		: '\n(soften is 0, so skip that stage entirely.)'
	const size = cfg.layer ? cfg.layer.w + ' x ' + cfg.layer.h : '[YOUR SIZE]'

	return `1. Target element (required): [WHAT — e.g. "the pricing card on my landing page"]
2. File location (optional):  [WHERE — e.g. src/components/GlassCard.tsx. Leave blank and the assistant picks a sensible spot.]

Apply the liquid glass effect below. It is already tuned — DO NOT build any
settings panel, sliders, debug UI, or controls. Ship only the styled element.

SOURCE OF TRUTH — READ THIS FIRST
Port from https://github.com/Miftahul-Islam-Efaz/LIQUID-GLASS:
src/state.js     calibration constants
src/sdf.js       height field
src/renderer.js  FS_GLASS fragment shader
Port these files. Do NOT reconstruct the algorithm from any written guide.
Where a guide and the code disagree, THE CODE IS CORRECT.
(Everything below is a summary to check your port against, not a substitute.)

DEPENDENCIES — NONE
Vanilla WebGL2. One <canvas>, one fragment shader, plain JS or the project's
equivalent idiom. No three.js, no react-three-fiber, no shader libraries.

WHAT IT IS
A 2D screen-space effect matching Figma's Glass. No 3D, no lighting model, no
ray tracing: it displaces and colour-splits whatever is rendered BEHIND the
shape, sampled from a backdrop texture.

=== THE CALIBRATION LAYER — THE PART THAT IS ALWAYS GOT WRONG ===

REFERENCE SCALE. Every constant below was fitted against a shape whose
SHORTER side is ${depthRef}px (DEPTH_REF). This is NOT the size you must render at.
Multiply every pixel-unit value by ref * k, where:
ref = max(min(shapeVW, shapeVH) / ${depthRef}, 0.05)
kx  = renderedW / shapeVW ;  ky = renderedH / shapeVH ;  k = sqrt(kx*ky)
Displacements are scalar, hence the geometric mean. Skip this and the effect
is proportionally too subtle at any other size. This is the #1 failure mode.

DIAL -> SHADER UNITS. Figma's 0-100 dials are positions, not values:
refraction  100 -> -77   path units   ** NEGATIVE. The bend is INWARD. **
dispersion  100 ->  26   path units
frost       100 ->  24   path units
lightInt    100 ->   1.2 gain         ** NOT scaled by ref or k **
depth       100 ->  42.5 path units
So: uRefract = (refraction/100) * -77 * ref * k, and likewise for the others.

DEPTH MULTIPLIES REACH. The effective rim width is (depth/100) * solver.reach,
NOT solver.reach. At depth ${g.depth} and reach ${sv.reach} that is ${rimWidth} path units.

TINT COLOUR is #2A2E30 — DARK. Mix toward it, not toward white.

=== PIPELINE ===
1. Rasterise the path to a coverage mask with Path2D at a supersample factor.
PAD the raster by 48px on all four sides. A path edge flush with its
viewBox has no exterior pixels, so the EDT gets no zero-distance seed and
that edge ends up with no bevel, no refraction and no dispersion at all.
PAD must also exceed the blur radius. Expand the shader's sampling rect to
match the padded field.
2. Exact Euclidean distance transform (Felzenszwalb & Huttenlocher) of the
interior. Rim profile: t = min(dist/depthPx, 1); height = sqrt(1-(1-t)^2).
3. Blur the height field (sigma = solver.smooth * ref, in field px) or the
medial axis creases into visible fans. Use a FRACTIONAL-radius box blur,
8 passes — integer-radius boxes leave seams that show as straight
axis-aligned lines once the field is differentiated.
4. Sobel HERE, in Float32, over a TWO-texel baseline with factor 0.0625
(this folds the Sobel 0.125 with the 0.5 that compensates for the widened
baseline — it is what gives gain its calibrated meaning; change it and
gain means something else). Store the result in the texture as
RGBA32F (gx, gy, height, coverage), half-float as fallback.
DO NOT difference the height in the shader: height sits near 1.0 with
~1e-3 neighbour deltas, so at 8 bits almost the entire signal is lost.
Precomputing is worth ~100x in gradient SNR and saves 8 fetches/fragment.
5. Normal from the stored gradient. Soft-limit the slope with tanh, not
clamp, so no new hard edge appears where the limit engages:
gm = length(grad) * gain ;  lim = 1.35 ;  sc = lim*tanh(gm/lim)/gm
6. Refraction: offset the backdrop lookup by n.xy * uRefract.
7. FROST AND DISPERSION: ONE loop, TWO SEPARATE ACCUMULATORS.
(A guide may tell you to use two separate loops. It is wrong.)
Per tap i of N: t = (i+0.5)/N ; s = t*2-1 ; golden angle a = i*2.39996323
offset o    = vec2(cos a, sin a) * frostRadius * sqrt(t)
spectral   -> num += weight(t) * sampleBackdrop(px + d + o + dir*(w*s))
unweighted -> blur += sampleBackdrop(px + d + o)
where dir = normalize(grad), w = uDisp * edge * thickGate.
Read from a MIPMAP level matched to tap spacing:
lod = log2(max(1, frostRadius * 2.5 / sqrt(N))). Without the mip, point
samples leave ghosts. NEVER use per-pixel dithering to hide that.
Spectral weights: gaussians centred 0.0/0.5/1.0 for R/G/B, width = spread.
Blend: col = mix(blur/bden, num/den, clamp(edge*1.35, 0, 1)).
8. Spectral averaging desaturates. Restore chroma by keeping integrated
luminance and scaling ONLY the difference from it:
boost = mix(1.0, chroma, edge); col = lum + (col-lum)*boost.
9. Tint toward #2A2E30 by solver.tint. Then specular, if lightIntensity > 0:
L = normalize(vec3(cos(angle), sin(angle), 0.75));
shine = 96 / (1 + splay*splay*4);  col += pow(max(dot(n,L),0), shine)
* uSpec * slopeGate;
10. Composite over the backdrop with the coverage mask.

TAP COUNT MUST TRACK BAND WIDTH. A wide dispersion band needs >= 24 taps or
the spectral integral quantises into hard steps. Use 40 at rest.

=== MY SETTINGS (hardcode these) ===
glass:  lightAngle ${g.lightAngle}, lightIntensity ${g.lightIntensity}, refraction ${g.refraction}, depth ${g.depth},
dispersion ${g.dispersion}, frost ${g.frost}, splay ${g.splay}
solver: reach ${sv.reach}, soften ${sv.soften}, smooth ${sv.smooth}, gain ${sv.gain}, chroma ${sv.chroma},
spread ${sv.spread}, fall ${sv.fall}, dark ${sv.dark}, tint ${sv.tint}
shape:  viewBox "${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}", fill-rule ${s.fillRule}
d = "${s.d}"${softenNote}

Element size: ${size} CSS px.

=== BACKDROP ===
A shader cannot read live page pixels — there is no equivalent of
backdrop-filter's SourceGraphic. Supply the backdrop yourself as a texture,
CORS-enabled (a tainted image cannot be a texture source), with mipmaps
generated. If the element behind it is transformed (parallax, scale), invert
that transform before sampling or the glass will drift against its backdrop.
ON A FLAT BACKGROUND THE EFFECT IS INVISIBLE. It only exists where there is
detail behind it. If you see nothing while testing, that is why.

=== PERFORMANCE ===
The field build (rasterise + EDT + blur passes + Sobel) is a long synchronous
task. Build it in a Web Worker with OffscreenCanvas and TRANSFER the buffers
back; on the main thread it will stall whatever animation is running. Build
once per shape — the field depends only on the path and the dials, never on
the rendered size. Cap DPR at 1.5.

=== ACCEPTANCE CRITERIA ===
- The effect looks IDENTICAL in character at any rendered element size.
(If it weakens as the element grows, ref/k is missing.)
- Edges flush with the viewBox have the same bevel as interior edges.
(If flat, PAD is missing.)
- The rim is a defined band, not a soft dome over the whole shape.
(If domey, depth is not multiplying reach.)
- Text behind the glass is visibly DISPLACED, not merely blurred.
- No rainbow rings across the interior; colour fringing is a RIM effect only.
- No straight horizontal or vertical lines anywhere.
(Those mean integer-radius blur or an 8-bit field.)
- Never name a GLSL variable 'sample' — reserved in GLSL ES 3.00.`
}
