// WebGL2 renderer: background blit + the glass pass.
//
// PERFORMANCE (this is where the lag came from):
//  1. The old build redrew the 20-tap glass shader over the WHOLE canvas on
//     EVERY animation frame, forever. Now the loop is lazy: a frame is only
//     drawn when something actually changed (`invalidate()`).
//  2. The expensive shader is confined to the layer's field rect with
//     gl.scissor, and a trivial background blit covers the rest. On the
//     reference layout that is ~13% of the pixels instead of 100%.
//  3. Tap count drops while a pointer gesture is in flight, so dragging and
//     resizing stay smooth; full quality returns on release.
//  4. Device pixel ratio is capped, and canvas sizing is driven by a
//     ResizeObserver instead of reading clientWidth every frame (which forced
//     a layout on each one).
//  5. The height field is rebuilt at most once per frame, only when the PATH
//     changed, and its rasterise+EDT stage is cached inside sdf.js.

import { buildGlassField } from './sdf.js'
import {
	FRAME_W, FRAME_H, TUNING, TINT, params, SOLVER, geom, shape, ui, sizeRef,
} from './state.js'

const MAX_DPR = 1.5
const TAPS_FULL = 40
const TAPS_DRAG = 8

// The EDT runs on the main thread, so cap the field size. A big pasted shape
// drops its supersample factor instead of stalling the UI.
const SDF_MAX_TEXELS = 1.8e6

const VS = `#version 300 es
void main() {
	int id = gl_VertexID;
	vec2 p = vec2(float((id << 1) & 2), float(id & 2));
	gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

// Cheap pass: straight background blit, used outside the layer's field rect.
const FS_BG = `#version 300 es
precision mediump float;
uniform sampler2D uBg;
uniform vec2 uRes;
uniform vec2 uBgMul;
uniform vec2 uBgAdd;
out vec4 frag;
void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	frag = vec4(texture(uBg, px * uBgMul + uBgAdd).rgb, 1.0);
}`

const FS_GLASS = `#version 300 es
precision highp float;

uniform sampler2D uBg;
uniform sampler2D uH;
uniform vec2 uRes;
uniform vec2 uBgMul;
uniform vec2 uBgAdd;
uniform vec2 uHTexel;
uniform vec4 uField;
uniform float uRefract;
uniform float uDisp;
uniform float uFrost;
uniform float uGain;
uniform float uDark;
uniform float uSpec;
uniform float uSplay;
uniform float uLight;
uniform float uChroma;
uniform float uFall;
uniform float uSpread;
uniform float uTintAmt;
uniform vec3 uTint;
uniform int uTaps;

out vec4 frag;

const int NS_MAX = 40;
const float TAU = 6.28318530718;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 sbg(vec2 p) {
	return texture(uBg, p * uBgMul + uBgAdd).rgb;
}

// Pre-filtered fetch. Frost needs an AREA average, not point samples; taking
// it from a coarser mip level means each tap already carries the average of
// the gap to its neighbours, so a sparse disc reads as a smooth blur.
vec3 sbgL(vec2 p, float lod) {
	return textureLod(uBg, p * uBgMul + uBgAdd, lod).rgb;
}

float hAt(vec2 g) {
	return texture(uH, g).b;
}

// RGB response for a normalised wavelength t (0 = red, 1 = blue). Narrow
// curves keep the three channels reading different offsets, which is what
// produces saturated hue separation instead of a grey average.
vec3 spectralWeight(float t) {
	vec3 c = vec3(0.0, 0.5, 1.0);
	vec3 x = (vec3(t) - c) / uSpread;
	return exp(-x * x) + 1e-4;
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec3 base = sbg(px);

	// uField is the PADDED field rect, so a path edge flush with its own
	// viewBox border is still interior to the texture and has a real gradient.
	vec2 g = (px - uField.xy) / uField.zw;
	if (any(lessThan(g, vec2(0.0))) || any(greaterThan(g, vec2(1.0)))) {
		frag = vec4(base, 1.0);
		return;
	}

	vec4 hg4 = texture(uH, g);
	float cov = hg4.a;
	if (cov <= 0.002) {
		frag = vec4(base, 1.0);
		return;
	}

	// --- Gradient of the height field.
	// Sobel over a TWO-texel radius. The wider baseline averages out residual
	// quantisation and blur seams, which is what produced straight sharp lines
	// at high Smoothness. Cost is identical: still 8 taps.
	// The gradient arrives precomputed in RG. It used to be differenced from h
	// here, but h sits near 1.0 while neighbouring texels differ by ~1e-3, so on
	// the half-float fallback that subtraction kept only a few bits and banded
	// into iso-distance contours. Storing the derivative instead keeps full
	// relative precision, and costs 8 fewer texture fetches per fragment.
	float gx = hg4.r;
	float gy = hg4.g;

	// Soft-limit the slope. Where a feature is THINNER than Depth - the thin
	// tip, the inside of a tight corner - the whole rim ramp is squeezed into a
	// couple of texels, the raw gradient explodes and the displacement jumps
	// many pixels between neighbours. That is what reads as a hard sharp wedge.
	// tanh caps the slope smoothly; broad rims sit far below the limit and are
	// untouched, so this costs nothing where nothing is wrong.
	float gm = length(vec2(gx, gy)) * uGain;
	if (gm > 1e-5) {
		float lim = 1.35;
		float sc = lim * tanh(gm / lim) / gm;
		gx *= sc;
		gy *= sc;
	}

	vec3 n = normalize(vec3(-gx * uGain, -gy * uGain, 1.0));

	// Slope magnitude localises every rim feature: ~0 across the flat interior,
	// peaking in the narrow boundary band - exactly what "along the curved
	// edge" means in Figma's docs. Smoothstep, not a raw clamp, or the slope
	// discontinuity reads as a hard line where the rim meets the interior.
	float slope = clamp(length(vec2(gx, gy)) * uGain, 0.0, 1.0);
	slope = slope * slope * (3.0 - 2.0 * slope);

	vec2 d = n.xy * uRefract;

	// Chromatic split direction is the SURFACE GRADIENT; the width is gated by
	// the RIM PROFILE (edge), not by slope - slope peaks in a narrow ridge and
	// confined the dispersion to a thin line.
	vec2 dir = normalize(vec2(gx, gy) + vec2(1e-6));
	float edge = clamp(1.0 - hg4.b, 0.0, 1.0);
	edge = pow(edge, uFall);
	// Local thickness. A thin tip and a broad rim BOTH have h~0 at the very
	// edge, so per-pixel height cannot tell them apart - the neighbourhood
	// average can. Four wide taps: a low average means the feature is thinner
	// than Depth, so the dispersion must shrink with it, as Figma does. Without
	// this the red-shifted tap at the tip travels the full band width into
	// bright screen content and comes back as that hard orange streak.
	float sp = 40.0;
	float nbr = hAt(g + vec2(-uHTexel.x * sp, 0.0)) + hAt(g + vec2(uHTexel.x * sp, 0.0))
		+ hAt(g + vec2(0.0, -uHTexel.y * sp)) + hAt(g + vec2(0.0, uHTexel.y * sp));
	float thick = smoothstep(0.06, 0.42, nbr * 0.25);

	// The hard wedge at the tip is REFRACTION, not dispersion, so the same
	// thin-feature factor has to gate the displacement too. thick is ~1 across
	// the broad rim, so the calibrated body of the match is unaffected.
	d *= mix(0.45, 1.0, thick);
	float w = uDisp * edge * thick;


	float taps = float(uTaps);
	// Mip level that matches the spacing between frost taps.
	// Figma is visibly soft inside even at Frost 5, so the glass carries a
	// baseline blur. Physically the backdrop is gathered over a refracted cone,
	// never a single ray, so zero frost still averages a small area.
	float fr = uFrost + 2.2;
	float flod = log2(max(1.0, fr * 2.5 / sqrt(taps)));
	vec3 num = vec3(0.0);
	vec3 den = vec3(0.0);
	vec3 blur = vec3(0.0);
	float bden = 0.0;
	for (int i = 0; i < NS_MAX; i++) {
		if (i >= uTaps) break;
		float t = (float(i) + 0.5) / taps;
		// s in [-1, 1]: red bends least, blue bends most
		float s = t * 2.0 - 1.0;
		// Frost ring rotates with the spectral index so a single loop covers
		// both the blur and the dispersion.
		float a = t * TAU * 3.0;
		// Golden angle: consecutive taps never line up, so the disc fills evenly
		// instead of clustering into the spokes a fixed turn count produces.
		float ga = float(i) * 2.39996323;
		vec2 o = vec2(cos(ga), sin(ga)) * fr * sqrt(t);
		vec3 wt = spectralWeight(t);
		num += wt * sbgL(px + d + o + dir * (w * s), flod);
		blur += sbgL(px + d + o, flod);
		bden += 1.0;
		den += wt;
	}
	vec3 disp = num / den;
	blur /= max(bden, 1.0);
	float fringe = clamp(edge * 1.35, 0.0, 1.0);
	vec3 col = mix(blur, disp, fringe);

	// Integrating a spectrum is an AVERAGING operation, so it inherently pulls
	// the result toward grey. Figma's band is vividly saturated, so chroma is
	// restored explicitly: keep the integrated luminance, scale only the colour
	// difference from it.
	float lum = dot(col, LUMA);
	float boost = mix(1.0, uChroma, edge);
	col = clamp(vec3(lum) + (col - vec3(lum)) * boost, 0.0, 1.0);

	// Steep glass compresses the backdrop and loses light.
	col *= (1.0 - uDark * slope);

	// Fill #2A2E30
	col = mix(col, uTint, uTintAmt);

	// Projected light. Splay sets how widely it spreads, so it maps to the
	// specular lobe width. Figma reports Light intensity 0% here, so this is
	// off by default.
	if (uSpec > 0.001) {
		float la = radians(uLight);
		vec3 L = normalize(vec3(cos(la), sin(la), 0.75));
		float shine = 96.0 / (1.0 + uSplay * uSplay * 4.0);
		col += pow(max(dot(n, L), 0.0), shine) * uSpec * slope;
	}

	frag = vec4(mix(base, col, cov), 1.0);
}`

function compile(gl, type, src) {
	const s = gl.createShader(type)
	gl.shaderSource(s, src)
	gl.compileShader(s)
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
		throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed')
	}
	return s
}

function program(gl, fs, names) {
	const p = gl.createProgram()
	gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS))
	gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
	gl.linkProgram(p)
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(p) || 'link failed')
	}
	const U = {}
	for (const n of names) U[n] = gl.getUniformLocation(p, n)
	return { p, U }
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createRenderer(canvas) {
	const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
	if (!gl) throw new Error('WebGL2 is required for this effect.')

	// Half-float height texels quantise to ~10 bits of mantissa; after a heavy
	// blur that shows up as stepped contours once the field is differentiated
	// and amplified. float32 removes it, but LINEAR filtering of a float32
	// texture needs this extension.
	const FLOAT_LINEAR = !!gl.getExtension('OES_texture_float_linear')

	const bg = program(gl, FS_BG, ['uBg', 'uRes', 'uBgMul', 'uBgAdd'])
	const glass = program(gl, FS_GLASS, [
		'uBg', 'uH', 'uRes', 'uBgMul', 'uBgAdd', 'uHTexel', 'uField',
		'uRefract', 'uDisp', 'uFrost', 'uGain', 'uDark', 'uSpec', 'uSplay',
		'uLight', 'uChroma', 'uSpread', 'uFall', 'uTintAmt', 'uTint', 'uTaps',
	])

	const vao = gl.createVertexArray()
	gl.bindVertexArray(vao)

	const bgTex = gl.createTexture()
	const hTex = gl.createTexture()
	for (const [unit, tex] of [[0, bgTex], [1, hTex]]) {
		gl.activeTexture(gl.TEXTURE0 + unit)
		gl.bindTexture(gl.TEXTURE_2D, tex)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
	}
	gl.useProgram(bg.p)
	gl.uniform1i(bg.U.uBg, 0)
	gl.useProgram(glass.p)
	gl.uniform1i(glass.U.uBg, 0)
	gl.uniform1i(glass.U.uH, 1)

	// The field now arrives asynchronously, so hTex has to be sampleable from
	// the very first frame. A 1x1 zero texel reads back coverage 0, and the
	// glass pass composites mix(base, col, cov) - so it resolves to pure
	// background. No flash, no undefined sampling; just no glass until the
	// first real field lands. RGBA16F regardless of precision support, since
	// the real upload re-specifies the texture anyway.
	gl.activeTexture(gl.TEXTURE1)
	gl.bindTexture(gl.TEXTURE_2D, hTex)
	gl.texImage2D(
		gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0,
		gl.RGBA, gl.HALF_FLOAT, new Uint16Array(4),
	)

	let bgImage = null
	let fieldPad = 0
	let fieldScale = 4
	let dirty = true
	let fieldDirty = true; let preview = false

	function pickScale(fast = ui.interacting) {
		// A rebuild at scale 4 pushes ~1.7M texels through two multi-pass blurs, a
		// Sobel, and an 8 MB texture upload - far too much to redo every frame of
		// a drag. Scale 1 is ~10.8x fewer texels and a ~2.6 MB upload. The height
		// field is smooth and the texture is LINEAR filtered, so a coarse field
		// costs very little visible quality; full scale returns on release.
		// Takes the flag explicitly so the idle prewarm below can ask for the drag
		// scale while the pointer is NOT down.
		let s = fast ? 1 : 4
		while (
			s > 1 &&
			(shape.vw * s + 96) * (shape.vh * s + 96) > SDF_MAX_TEXELS
		) s -= 0.5
		return s
	}

	function fieldArgs(scale, fast) {
		const ref = sizeRef()
		return {
			pathD: shape.d,
			viewW: shape.vw,
			viewH: shape.vh,
			viewX: shape.vx,
			viewY: shape.vy,
			fillRule: shape.fillRule,
			scale,
			depth: (params.depth / 100) * SOLVER.reach * ref,
			profile: TUNING.profile,
			smooth: SOLVER.smooth * ref,
			soften: SOLVER.soften * ref,
			float32: FLOAT_LINEAR,
			fast,
		}
	}

	// The coarse drag field starts COLD. Before its very first frame can draw,
	// prepare() still has to rasterise the path, getImageData it, run the O(n)
	// EDT and allocate six typed arrays. None of the per-frame cost cuts touch
	// any of that, because it happens once per cache slot - which is exactly the
	// "lags on the first drag, smooth afterwards" symptom. So build that slot
	// during idle time, before the pointer ever goes down. Re-armed after every
	// full-quality rebuild, because the cache key includes the path.
	const idle = window.requestIdleCallback
		? (fn) => window.requestIdleCallback(fn, { timeout: 500 })
		: (fn) => setTimeout(fn, 150)
	const unidle = window.cancelIdleCallback
		? (id) => window.cancelIdleCallback(id)
		: (id) => clearTimeout(id)
	let warmKey = ''
	let warmId = 0
	function warmDragField() {
		const key = [shape.d, shape.vw, shape.vh, shape.vx, shape.vy].join('|')
		if (key === warmKey) return
		if (warmId) unidle(warmId)
		warmId = idle(() => {
			warmId = 0
			warmKey = key
			// Return value is deliberately discarded. buildGlassField fills the
			// drag cache slot as a side effect; uploading it here would replace
			// the full-quality texture currently on screen.
			postField(fieldArgs(pickScale(true), true), true)
		})
	}

	// --- async field pipeline ---------------------------------------------
	// Benchmarked on the shipped code: 41.9 ms per build at drag scale, 829.6 ms
	// at full scale. A frame is 16.7 ms, so a synchronous build stalls the
	// slider however much the maths is trimmed - fewer taps, lower resolution
	// and fewer blur passes each moved the number without getting under budget.
	// The worker owns the build; this thread only uploads the result.
	let worker = null
	let workerOk = true
	let busy = false
	let queued = false
	let seq = 0
	let texW = 0
	let texH = 0

	function uploadField(f) {
		// Both of these come from the same build - see the note in field-worker.js.
		fieldPad = f.pad
		fieldScale = f.scale
		gl.activeTexture(gl.TEXTURE1)
		gl.bindTexture(gl.TEXTURE_2D, hTex)
		const type = f.float32 ? gl.FLOAT : gl.HALF_FLOAT
		if (f.width === texW && f.height === texH) {
			// Same size: update in place. texImage2D RE-SPECIFIES the texture, which
			// makes the driver drop and reallocate its backing store - every frame
			// of a drag, for ~2.6 MB. Dimensions are constant while dragging, so
			// every frame after the first takes this path.
			gl.texSubImage2D(
				gl.TEXTURE_2D, 0, 0, 0, f.width, f.height,
				gl.RGBA, type, f.data,
			)
		} else {
			gl.texImage2D(
				gl.TEXTURE_2D, 0, f.float32 ? gl.RGBA32F : gl.RGBA16F,
				f.width, f.height, 0, gl.RGBA, type, f.data,
			)
			texW = f.width
			texH = f.height
		}
		gl.useProgram(glass.p)
		gl.uniform2f(glass.U.uHTexel, 1 / f.width, 1 / f.height)
		dirty = true
	}

	function getWorker() {
		if (worker || !workerOk) return worker
		try {
			worker = new Worker(new URL('./field-worker.js', import.meta.url), {
				type: 'module',
			})
			worker.onmessage = (e) => {
				busy = false
				const f = e.data
				// Only the newest request may reach the GPU. Anything older is a
				// field the user has already dragged past.
				if (!f.warm && f.seq === seq) uploadField(f)
				if (queued) {
					queued = false
					rebuildField()
				}
			}
			worker.onerror = () => {
				// Losing the worker must not lose the glass. Fall back to building
				// inline - laggy, but correct.
				workerOk = false
				worker = null
				busy = false
				queued = false
				rebuildField()
			}
		} catch {
			workerOk = false
			worker = null
		}
		return worker
	}

	function postField(args, warm) {
		const w = getWorker()
		if (!w) {
			// No worker support. buildGlassField does not report scale, so add it.
			if (!warm) uploadField({ ...buildGlassField(args), scale: args.scale })
			return
		}
		if (busy) {
			// Never queue more than one. Coalescing to "latest wins" keeps the
			// backlog from growing while the user keeps dragging.
			if (!warm) queued = true
			return
		}
		busy = true
		w.postMessage({ seq: warm ? -1 : ++seq, warm: !!warm, args })
	}

	function rebuildField() {
		const scale = pickScale()
		postField(fieldArgs(scale, ui.interacting), false)
		if (!ui.interacting) warmDragField()
	}

	// Canvas backing size is only recomputed when the element actually resizes.
	let cssW = 0
	let cssH = 0
	function applySize(w, h) {
		cssW = w
		cssH = h
		const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
		const pw = Math.max(1, Math.round(w * dpr))
		const ph = Math.max(1, Math.round(h * dpr))
		if (canvas.width !== pw || canvas.height !== ph) {
			canvas.width = pw
			canvas.height = ph
			dirty = true
		}
	}
	applySize(canvas.clientWidth, canvas.clientHeight)

	const ro = new ResizeObserver((entries) => {
		const r = entries[0].contentRect
		if (r.width !== cssW || r.height !== cssH) applySize(r.width, r.height)
	})
	ro.observe(canvas)

	// Layer rect in device px. Shared with the interaction layer through the
	// returned API so hit-testing can never drift from what is drawn.
	function layerRect() {
		const cw = canvas.width
		const ch = canvas.height
		return {
			x: (geom.x / FRAME_W) * cw,
			y: (geom.y / FRAME_H) * ch,
			w: (geom.w / FRAME_W) * cw,
			h: (geom.h / FRAME_H) * ch,
		}
	}

	function render() {
		if (!dirty || !bgImage) return
		dirty = false

		if (fieldDirty && !preview) {
			fieldDirty = false
			rebuildField()
		}

		const cw = canvas.width
		const ch = canvas.height
		gl.viewport(0, 0, cw, ch)
		gl.bindVertexArray(vao)

		// background cover fit
		const s = Math.max(cw / bgImage.width, ch / bgImage.height)
		const dw = bgImage.width * s
		const dh = bgImage.height * s
		const bx = (cw - dw) / 2
		const by = (ch - dh) / 2

		// --- pass 1: background, whole canvas, one texture fetch per pixel
		gl.disable(gl.SCISSOR_TEST)
		gl.useProgram(bg.p)
		gl.uniform2f(bg.U.uRes, cw, ch)
		gl.uniform2f(bg.U.uBgMul, 1 / dw, 1 / dh)
		gl.uniform2f(bg.U.uBgAdd, -bx / dw, -by / dh)
		gl.drawArrays(gl.TRIANGLES, 0, 3)

		// --- pass 2: glass, scissored to the padded field rect
		if (preview) return; const r = layerRect()
		const kx = r.w / shape.vw
		const ky = r.h / shape.vh
		// Displacement magnitudes are scalar, so a stretched layer uses the
		// geometric mean of the two axis scales.
		const k = Math.sqrt(Math.max(kx * ky, 1e-9))
		const padX = (fieldPad / fieldScale) * kx
		const padY = (fieldPad / fieldScale) * ky

		const fx = r.x - padX
		const fy = r.y - padY
		const fw = r.w + padX * 2
		const fh = r.h + padY * 2

		// gl.scissor is bottom-left based, clamped to the drawing buffer.
		const sxi = Math.max(0, Math.floor(fx))
		const syi = Math.max(0, Math.floor(ch - (fy + fh)))
		const swi = Math.min(cw - sxi, Math.ceil(fw + (fx - Math.floor(fx))))
		const shi = Math.min(ch - syi, Math.ceil(fh + 1))
		if (swi <= 0 || shi <= 0) return

		gl.enable(gl.SCISSOR_TEST)
		gl.scissor(sxi, syi, swi, shi)

		const ref = sizeRef()
		gl.useProgram(glass.p)
		const U = glass.U
		gl.uniform2f(U.uRes, cw, ch)
		gl.uniform2f(U.uBgMul, 1 / dw, 1 / dh)
		gl.uniform2f(U.uBgAdd, -bx / dw, -by / dh)
		gl.uniform4f(U.uField, fx, fy, fw, fh)
		gl.uniform1f(U.uRefract, (params.refraction / 100) * TUNING.refractAt100 * ref * k)
		gl.uniform1f(U.uDisp, (params.dispersion / 100) * TUNING.dispAt100 * ref * k)
		gl.uniform1f(U.uFrost, (params.frost / 100) * TUNING.frostAt100 * ref * k)
		gl.uniform1f(U.uSpec, (params.lightIntensity / 100) * TUNING.specAt100)
		gl.uniform1f(U.uSplay, params.splay)
		gl.uniform1f(U.uLight, params.lightAngle)
		gl.uniform1f(U.uGain, SOLVER.gain)
		gl.uniform1f(U.uChroma, SOLVER.chroma)
		gl.uniform1f(U.uSpread, SOLVER.spread)
		gl.uniform1f(U.uFall, SOLVER.fall)
		gl.uniform1f(U.uDark, SOLVER.dark)
		gl.uniform1f(U.uTintAmt, SOLVER.tint)
		gl.uniform3f(U.uTint, TINT[0], TINT[1], TINT[2])
		gl.uniform1i(U.uTaps, ui.interacting ? TAPS_DRAG : TAPS_FULL)
		gl.drawArrays(gl.TRIANGLES, 0, 3)
		gl.disable(gl.SCISSOR_TEST)
	}

	return {
		gl,
		floatLinear: FLOAT_LINEAR, setPreview(on) { preview = !!on; dirty = true; },
		layerRect,
		render,
		invalidate() {
			dirty = true
		},
		invalidateField() {
			fieldDirty = true
			dirty = true
		},
		setBackground(img) {
			bgImage = img
			gl.activeTexture(gl.TEXTURE0)
			gl.bindTexture(gl.TEXTURE_2D, bgTex)
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
			// Frost samples coarser mip levels, so the chain has to exist and the
			// min filter has to be willing to read it.
			gl.generateMipmap(gl.TEXTURE_2D)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
			dirty = true
		},
	}
}
