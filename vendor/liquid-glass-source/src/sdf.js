// Builds the glass height-field used by the fragment shader.
//
// Figma's glass is a 2D screen-space displacement driven by a SMOOTH normal
// field. A raw Euclidean distance transform is not smooth: it has a crease
// along the shape's medial axis, and that crease shows up as radial fan
// streaks once you differentiate it. So the pipeline is:
//
//   1. rasterise the SVG path with Path2D (exact, same curves as Figma)
//   2. exact Euclidean distance transform on the interior
//   3. distance -> rounded rim profile via `depth`
//   4. blur the height field  <-- kills the medial-axis crease
//   5. slight blur on coverage for clean antialiased edges
//
// The path is rasterised inside an arbitrary viewBox rect (viewX, viewY,
// viewW, viewH), so pasted artwork can be used as-is: its own bounding box is
// passed in and no path rewriting is needed.
//
// PADDING (important):
// A path edge sitting exactly on the viewBox border has no exterior pixels, so:
//   * the EDT never sees a zero-distance seed there, so `dist` stays large and
//     the rim profile never ramps down -> NO curved edge on the straight sides
//   * the Sobel gradient has no outside neighbours (CLAMP_TO_EDGE) -> slope 0
//     -> no refraction, no dispersion on those sides
// The fix is to rasterise into a padded buffer so every edge of the path is
// interior to the texture. PAD must also exceed the blur radius, or the box
// blur's edge clamping reintroduces a milder version of the same artifact.
//
// SMOOTHNESS / BANDING (important):
// An integer-radius box blur quantises the kernel width to whole pixels. Three
// such passes leave piecewise-quadratic seams aligned to the blur axes, which
// appear as horizontal and vertical straight lines once the field is
// differentiated - and they get worse as sigma grows. The blur here therefore
// uses a FRACTIONAL radius (the end taps are weighted by the fractional part)
// over 4 passes, which removes the axis-aligned stepping entirely.
//
// Performance notes (both were needed to keep the sliders responsive):
//   * The blur is a 4-pass box blur (Gaussian approximation), so cost is O(1)
//     per pixel regardless of sigma. A true Gaussian kernel was O(sigma) and
//     froze the UI at high Smoothness.
//   * Steps 1-2 depend only on the path, never on the sliders, so they are
//     computed once and cached. Slider drags only re-run steps 3-5.
//
// Output is RG: R = height (0..1), G = coverage (0..1), as either Float32
// (preferred, no banding) or half-float (fallback).

const INF = 1e20

// Exterior margin in FIELD pixels added on all four sides.
const PAD = 48

// Number of box passes used to approximate a Gaussian.
const PASSES = 8
// Live box-blur pass count. Mutable because the blur pass count is the single
// dominant cost of a field rebuild, and a slider drag needs a cheaper one than
// the committed result does. Set once per buildGlassField call, read by
// fastBlur, never left in the fast state (the release rebuild resets it).
let passes = PASSES

// PRECISION (important):
// h is ~1.0 across the interior and neighbouring texels differ by only ~1e-3,
// so DIFFERENCING h in the shader threw nearly all of it away: on the half-float
// fallback the difference retained about 4 bits and quantised into visible
// iso-distance contour bands. The gradient is therefore computed HERE, in
// Float32 where h is still exact, and stored directly. Half-float then keeps
// ~11 bits of the quantity actually used, which is roughly a 100x improvement
// in gradient signal-to-noise and needs no dither (dither traded bands for
// grain; storing the derivative removes both).

// Felzenszwalb & Huttenlocher 1D squared distance transform.
function edt1d(f, d, v, z, n) {
	v[0] = 0
	z[0] = -INF
	z[1] = INF
	let k = 0
	for (let q = 1; q < n; q++) {
		let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
		while (s <= z[k]) {
			k--
			s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
		}
		k++
		v[k] = q
		z[k] = s
		z[k + 1] = INF
	}
	k = 0
	for (let q = 0; q < n; q++) {
		while (z[k + 1] < q) k++
		const dq = q - v[k]
		d[q] = dq * dq + f[v[k]]
	}
}

function edt2d(grid, W, H) {
	const maxWH = Math.max(W, H)
	const f = new Float64Array(maxWH)
	const d = new Float64Array(maxWH)
	const v = new Int32Array(maxWH)
	const z = new Float64Array(maxWH + 1)

	for (let x = 0; x < W; x++) {
		for (let y = 0; y < H; y++) f[y] = grid[y * W + x]
		edt1d(f, d, v, z, H)
		for (let y = 0; y < H; y++) grid[y * W + x] = d[y]
	}
	for (let y = 0; y < H; y++) {
		const row = y * W
		for (let x = 0; x < W; x++) f[x] = grid[row + x]
		edt1d(f, d, v, z, W)
		for (let x = 0; x < W; x++) grid[row + x] = Math.sqrt(d[x])
	}
	return grid
}

// --- fractional-radius box blur -------------------------------------------

// Radius (possibly fractional) whose `n`-fold box convolution matches `sigma`.
// Variance of one box of half-width r is ((2r+1)^2 - 1) / 12.
function radiusForGauss(sigma, n) {
	const want = (12 * sigma * sigma) / n + 1
	return 0.5 * (Math.sqrt(want) - 1)
}

function boxHFrac(src, dst, W, H, r) {
	const ri = Math.floor(r)
	const fr = r - ri
	const norm = 1 / (2 * r + 1)
	for (let y = 0; y < H; y++) {
		const row = y * W
		// integer core window sum over [-ri, ri]
		let acc = 0
		for (let i = -ri; i <= ri; i++) {
			const xx = i < 0 ? 0 : i >= W ? W - 1 : i
			acc += src[row + xx]
		}
		for (let x = 0; x < W; x++) {
			// fractional end taps just outside the integer core
			let lo = x - ri - 1
			let hi = x + ri + 1
			if (lo < 0) lo = 0
			if (hi >= W) hi = W - 1
			dst[row + x] = (acc + fr * (src[row + lo] + src[row + hi])) * norm

			// slide the integer core one pixel right
			let out = x - ri
			let inn = x + ri + 1
			if (out < 0) out = 0
			if (inn >= W) inn = W - 1
			acc += src[row + inn] - src[row + out]
		}
	}
}

function boxVFrac(src, dst, W, H, r) {
	const ri = Math.floor(r)
	const fr = r - ri
	const norm = 1 / (2 * r + 1)
	for (let x = 0; x < W; x++) {
		let acc = 0
		for (let i = -ri; i <= ri; i++) {
			const yy = i < 0 ? 0 : i >= H ? H - 1 : i
			acc += src[yy * W + x]
		}
		for (let y = 0; y < H; y++) {
			let lo = y - ri - 1
			let hi = y + ri + 1
			if (lo < 0) lo = 0
			if (hi >= H) hi = H - 1
			dst[y * W + x] =
				(acc + fr * (src[lo * W + x] + src[hi * W + x])) * norm

			let out = y - ri
			let inn = y + ri + 1
			if (out < 0) out = 0
			if (inn >= H) inn = H - 1
			acc += src[inn * W + x] - src[out * W + x]
		}
	}
}

// Blurs `src`, returning whichever buffer holds the result.
function fastBlur(src, W, H, sigma, scratchA, scratchB) {
	if (sigma <= 0.02) return src
	const r = radiusForGauss(sigma, passes)
	if (r < 0.02) return src
	let a = src
	let b = scratchA
	const tmp = scratchB
	for (let i = 0; i < passes; i++) {
		boxHFrac(a, tmp, W, H, r)
		boxVFrac(tmp, b, W, H, r)
		const t = a
		a = b
		b = t
	}
	return a
}

// --- float32 -> float16 ----------------------------------------------------
const _b = new ArrayBuffer(4)
const _f = new Float32Array(_b)
const _i = new Uint32Array(_b)
function toHalf(val) {
	_f[0] = val
	const x = _i[0]
	let bits = (x >> 16) & 0x8000
	let m = (x >> 12) & 0x07ff
	const e = (x >> 23) & 0xff
	if (e < 103) return bits
	if (e > 142) {
		bits |= 0x7c00
		bits |= (e === 255 ? 0 : 1) && x & 0x007fffff
		return bits
	}
	if (e < 113) {
		m |= 0x0800
		bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1)
		return bits
	}
	bits |= ((e - 112) << 10) | (m >> 1)
	bits += m & 1
	return bits
}

// --- cached rasterise + EDT ------------------------------------------------
// These depend only on the path, its viewBox and the supersample scale, so
// they survive every slider drag.
let cache = null
let cacheFast = null

function prepare(pathD, viewW, viewH, viewX, viewY, fillRule, scale, float32, fast) {
	const key = [
		pathD, viewW, viewH, viewX, viewY, fillRule, scale, PAD, float32,
	].join('|')
	// TWO slots, not one. A drag changes the supersample scale on grab and again
	// on release, and the scale is part of the key, so a single slot would throw
	// the entry away and re-run getImageData plus the O(n) EDT on BOTH flips.
	// Splitting by slot rather than keying a shared LRU also guarantees the big
	// full-quality entry can never be evicted by the small drag entry.
	const slot = fast ? cacheFast : cache
	if (slot && slot.key === key) return slot

	const W = Math.max(8, Math.round(viewW * scale) + PAD * 2)
	const H = Math.max(8, Math.round(viewH * scale) + PAD * 2)

	// A worker has no document. OffscreenCanvas exposes the same 2D context,
	// including Path2D fills and getImageData. Sized by the c.width/c.height
	// assignments just below, so the 1x1 here is only a placeholder.
	const c = typeof document === 'undefined'
		? new OffscreenCanvas(1, 1)
		: document.createElement('canvas')
	c.width = W
	c.height = H
	const ctx = c.getContext('2d', { willReadFrequently: true })
	ctx.clearRect(0, 0, W, H)
	ctx.save()
	// Shift the path inward so all four of its edges have exterior pixels, and
	// move its own viewBox origin to 0,0.
	ctx.translate(PAD, PAD)
	ctx.scale(scale, scale)
	ctx.translate(-viewX, -viewY)
	ctx.fillStyle = '#fff'
	ctx.fill(new Path2D(pathD), fillRule === 'evenodd' ? 'evenodd' : 'nonzero')
	ctx.restore()

	const img = ctx.getImageData(0, 0, W, H).data
	const n = W * H

	const grid = new Float64Array(n)
	const cov0 = new Float32Array(n)
	for (let i = 0; i < n; i++) {
		const a = img[i * 4 + 3] / 255
		cov0[i] = a
		grid[i] = a > 0.5 ? INF : 0
	}
	edt2d(grid, W, H)

	// distance in path units, as Float32 for speed
	const dist = new Float32Array(n)
	for (let i = 0; i < n; i++) dist[i] = grid[i]

	// blur coverage once - it never changes with the sliders
	const sA = new Float32Array(n)
	const sB = new Float32Array(n)
	const cov = fastBlur(cov0.slice(), W, H, 0.9, sA, sB)

	const entry = {
		key,
		W,
		H,
		dist,
		cov,
		h: new Float32Array(n),
		dsm: new Float32Array(n),
		scratchA: new Float32Array(n),
		scratchB: new Float32Array(n),
		out: float32 ? new Float32Array(n * 4) : new Uint16Array(n * 4),
	}
	if (fast) cacheFast = entry
	else cache = entry
	return entry
}

/**
 * @param {object} o
 * @param {string} o.pathD    SVG path data
 * @param {number} o.viewW    viewBox width in path units
 * @param {number} o.viewH    viewBox height in path units
 * @param {number} [o.viewX]  viewBox origin x (pasted artwork bbox)
 * @param {number} [o.viewY]  viewBox origin y
 * @param {string} [o.fillRule] 'nonzero' | 'evenodd'
 * @param {number} o.scale    supersample factor
 * @param {number} o.depth    Figma "Depth" - rim width in path units
 * @param {number} o.profile  rim profile exponent shaping (1 = neutral)
 * @param {number} o.smooth   blur sigma in path units - removes the crease
 * @param {number} [o.soften]  blur sigma applied to the DISTANCE field before
 *   profiling, in path units. Rounds off the medial-axis creases that appear
 *   once the rim ramp is wide enough to straddle the shape skeleton.
 * @param {boolean} [o.float32] emit Float32 texels instead of half-floats
 * @returns {{data: Float32Array|Uint16Array, width: number, height: number,
 *   pad: number, float32: boolean}}
 *   `pad` is the exterior margin in FIELD pixels; the caller must expand the
 *   sampling rect by pad/scale path units so the texture maps correctly.
 */
export function buildGlassField({
	pathD,
	viewW,
	viewH,
	viewX = 0,
	viewY = 0,
	fillRule = 'nonzero',
	scale,
	depth,
	profile,
	smooth,
	soften = 0,
	float32 = false,
	fast = false,
}) {
	// Two separate blurs run here, each PASSES deep and two axes per pass, so
	// the pass count multiplies almost all of the per-rebuild work. 3 passes is
	// still a decent Gaussian approximation and cuts that work ~2.7x while a
	// value is moving; the rebuild on release restores the full count.
	passes = fast ? 3 : PASSES
	const p = prepare(
		pathD, viewW, viewH, viewX, viewY, fillRule, scale, float32, fast,
	)
	const { W, H, dist, cov, scratchA, scratchB, out } = p
	const n = W * H

	const depthPx = Math.max(depth, 0.001) * scale
	const inv = 1 / depthPx
	const expo = profile && profile !== 1 ? 2 / (1 + profile) : 0

	// The exact Euclidean distance field has a real gradient discontinuity along
	// the shape MEDIAL AXIS - the 45-degree diagonals running in from each corner
	// and the spine between them. At the calibrated Figma reach the profile has
	// already flattened (dh/dt = 0) well before the ramp arrives there, so the
	// crease is multiplied by zero and never shows. Widen Reach enough to turn the
	// panel into a full lens and the ramp straddles the skeleton, so the creases
	// surface as fans radiating from the corners. No profile shaping removes them,
	// because they are in `dist` itself, not in the profile applied to it.
	//
	// Blurring `dist` before profiling rounds the skeleton away. It also blunts
	// the sqrt singularity at the border, which is what draws the hairline just
	// inside the outline. Default 0, so the Figma calibration is untouched.
	// Softening must be TAPERED, not global. Two facts make this necessary:
	//
	//   1. Almost all of the slope - and therefore all of the refraction - lives
	//      in the narrow band next to the border, because dh/dt = (1-t)/sqrt(2t-t^2)
	//      is singular at t = 0 and has already collapsed to ~0 by mid-panel.
	//   2. The medial axis is ALWAYS interior. It is the set of points equidistant
	//      from two edges, so it can never approach the border.
	//
	// The two regions do not overlap. Blurring `dist` everywhere therefore paid
	// for a fix in the interior by flattening the rim, which read as the glass
	// losing its bend and going flat-frosted. Blending back toward the exact
	// distance near the border keeps full rim strength while still dissolving the
	// corner fans deeper in.
	let src = dist
	if (soften > 0) {
		const ds = p.dsm
		ds.set(dist)
		const db = fastBlur(ds, W, H, soften * scale, scratchA, scratchB)
		// full exact distance at the border, full blur by half the ramp width
		const kInv = 1 / Math.max(0.5 * depthPx, 1e-6)
		for (let i = 0; i < n; i++) {
			const d0 = dist[i]
			let w = d0 * kInv
			if (w > 1) w = 1
			w = w * w * (3 - 2 * w)
			db[i] = d0 + (db[i] - d0) * w
		}
		src = db
	}

	const h = p.h
	for (let i = 0; i < n; i++) {
		let t = src[i] * inv
		if (t > 1) t = 1
		const u = 1 - t
		let v = Math.sqrt(1 - u * u)
		if (expo) v = Math.pow(v, expo)
		h[i] = v
	}

	// smooth the height field before it is differentiated
	const hb = fastBlur(h, W, H, Math.max(smooth, 0) * scale, scratchA, scratchB)

	// Sobel over a two-texel baseline - the exact operation the shader used to
	// run per-fragment, moved here where the operands are still Float32. The
	// 0.0625 folds together the Sobel 0.125 and the 0.5 that compensated for the
	// widened baseline, so Normal gain keeps its previous meaning.
	const B = 2
	for (let y = 0; y < H; y++) {
		const rm = (y - B < 0 ? 0 : y - B) * W
		const r0 = y * W
		const rp = (y + B >= H ? H - 1 : y + B) * W
		for (let x = 0; x < W; x++) {
			const xm = x - B < 0 ? 0 : x - B
			const xp = x + B >= W ? W - 1 : x + B
			const h00 = hb[rm + xm]
			const h10 = hb[rm + x]
			const h20 = hb[rm + xp]
			const h01 = hb[r0 + xm]
			const h21 = hb[r0 + xp]
			const h02 = hb[rp + xm]
			const h12 = hb[rp + x]
			const h22 = hb[rp + xp]
			const gx = ((h20 + 2 * h21 + h22) - (h00 + 2 * h01 + h02)) * 0.0625
			const gy = ((h02 + 2 * h12 + h22) - (h00 + 2 * h10 + h20)) * 0.0625
			const i = r0 + x
			const o = i * 4
			if (float32) {
				out[o] = gx
				out[o + 1] = gy
				out[o + 2] = hb[i]
				out[o + 3] = cov[i]
			} else {
				out[o] = toHalf(gx)
				out[o + 1] = toHalf(gy)
				out[o + 2] = toHalf(hb[i])
				out[o + 3] = toHalf(cov[i])
			}
		}
	}

	return { data: out, width: W, height: H, pad: PAD, float32 }
}
