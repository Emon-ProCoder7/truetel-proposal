// Single source of truth for everything the renderer reads.
//
// Layout of the model:
//   params  - Figma's Glass panel, on Figma's own 0-100 scales
//   SOLVER  - calibration constants Figma does not expose
//   geom    - the layer rect, in Figma FRAME units (same numbers as Figma)
//   shape   - one SVG path plus the box it lives in
//   ui      - transient editor state (tool, selection, interaction)
//
// Nothing here touches the DOM or WebGL, so it can be read from any module and
// serialised straight to a config blob.

import { presetPath, FIGMA_PATH, FIGMA_VIEW } from './shapes.js'
import { needsField, needsRender, needsUI } from './bus.js'

// Figma frame the reference design was measured in.
export const FRAME_W = 953
export const FRAME_H = 535.5

// Height the calibration constants were fitted against, so Depth and
// Smoothness keep their meaning on shapes of any size.
export const DEPTH_REF = 199.5

// --- calibration: Figma's 0-100 scales -> solver units --------------------
export const TUNING = {
	depthAt100: 42.5,      // rim width in path units
	refractAt100: -77,     // displacement, negative = inward
	dispAt100: 26,         // chromatic split half-width - wide band, saturation comes from chroma
	frostAt100: 24,        // blur radius
	specAt100: 1.2,        // specular gain

	smooth: 6,             // height-field blur sigma, kills the medial crease
	                       // (a rectangle creases along both diagonals, so it
	                       //  needs more than the original artwork did)
	gain: 123,             // normal amplification
	chroma: 1.55,          // saturation restored after spectral integration
	spread: 0.26,          // width of each spectral response curve - tighter = cleaner hue separation
	fall: 1.25,            // rim profile falloff - low so colour reaches inward like Figma
	dark: 0,               // backdrop compression darkening
	tint: 0.02,            // fill #2A2E30 at 2 percent, straight from Figma
	profile: 1,            // rim profile exponent, 1 = circular bevel
}

export const DEFAULTS = {
	lightAngle: -45,
	lightIntensity: 0,
	refraction: 100,
	depth: 54,
	dispersion: 60,
	frost: 20,
	splay: 0,
}

export const SOLVER_DEFAULT = {
	reach: TUNING.depthAt100,
	soften: 0,
	smooth: TUNING.smooth,
	gain: TUNING.gain,
	chroma: TUNING.chroma,
	spread: TUNING.spread,
	fall: TUNING.fall,
	dark: TUNING.dark,
	tint: TUNING.tint,
}

export const GEOM_DEFAULT = { x: 320, y: 119.75, w: 313, h: 296 }

export const params = { ...DEFAULTS }
export const SOLVER = { ...SOLVER_DEFAULT }
export const geom = { ...GEOM_DEFAULT }

export const shape = {
	kind: 'rect',
	radius: 39,
	d: presetPath('rect', GEOM_DEFAULT.w, GEOM_DEFAULT.h, 39),
	vx: 0,
	vy: 0,
	vw: GEOM_DEFAULT.w,
	vh: GEOM_DEFAULT.h,
	fillRule: 'nonzero',
}

// Editor-only state. `tool` is the active Figma-style tool; anything other
// than 'move' means the next canvas drag DRAWS that shape.
export const ui = {
	tool: 'move',
	selected: true,
	// true while a pointer gesture is in flight - the renderer drops quality
	// during gestures so dragging stays at 60fps
	interacting: false,
}

export const TINT = [0x2a / 255, 0x2e / 255, 0x30 / 255]

// Shapes that are regenerated from W/H. Artwork ('figma', 'custom') keeps its
// authored box and is simply stretched, exactly like a Figma vector layer.
export const PARAMETRIC = new Set([
	'rect', 'pill', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon',
	'star',
])

export const isParametric = () => PARAMETRIC.has(shape.kind)

export function sizeRef() {
	return Math.max(Math.min(shape.vw, shape.vh) / DEPTH_REF, 0.05)
}

/**
 * Re-derives `shape.d` for the current kind and size, then asks for a field
 * rebuild. Cheap for artwork (nothing changes), a re-rasterise for presets.
 */
export function applyShape() {
	if (shape.kind === 'figma') {
		shape.d = FIGMA_PATH
		shape.vx = 0
		shape.vy = 0
		shape.vw = FIGMA_VIEW.vw
		shape.vh = FIGMA_VIEW.vh
		shape.fillRule = 'nonzero'
	} else if (isParametric()) {
		shape.d = presetPath(shape.kind, geom.w, geom.h, shape.radius)
		shape.vx = 0
		shape.vy = 0
		shape.vw = geom.w
		shape.vh = geom.h
		shape.fillRule = 'nonzero'
	}
	needsField()
}

export function setShapeKind(kind) {
	shape.kind = kind
	if (kind === 'figma') {
		geom.w = FIGMA_VIEW.vw
		geom.h = FIGMA_VIEW.vh
	}
	applyShape()
	needsUI()
}

export function resetGlass() {
	Object.assign(params, DEFAULTS)
	Object.assign(SOLVER, SOLVER_DEFAULT)
	needsField()
	needsUI()
}

export function resetLayer() {
	Object.assign(geom, GEOM_DEFAULT)
	applyShape()
	needsUI()
}

// --- config blob ----------------------------------------------------------
// Round-trippable: exportConfig() -> clipboard -> importConfig(). The shape's
// path is included, so a pasted config restores pasted artwork too.

const r2 = (n) => +Number(n).toFixed(2)

export function exportConfig() {
	return {
		glass: { ...params },
		layer: { x: r2(geom.x), y: r2(geom.y), w: r2(geom.w), h: r2(geom.h) },
		shape: {
			kind: shape.kind,
			radius: shape.radius,
			fillRule: shape.fillRule,
			viewBox: [r2(shape.vx), r2(shape.vy), r2(shape.vw), r2(shape.vh)],
			d: shape.d,
		},
		solver: { ...SOLVER },
	}
}

function assignNumbers(target, src) {
	if (!src || typeof src !== 'object') return 0
	let n = 0
	for (const key of Object.keys(target)) {
		const v = Number(src[key])
		if (Number.isFinite(v)) {
			target[key] = v
			n++
		}
	}
	return n
}

/**
 * Applies a config produced by exportConfig (accepts the JSON text or an
 * already-parsed object). Throws with a readable message on bad input.
 * @returns {string} a short summary of what was applied
 */
export function importConfig(input) {
	let cfg = input
	if (typeof input === 'string') {
		const text = input.trim()
		if (!text) throw new Error('Paste a config first')
		try {
			cfg = JSON.parse(text)
		} catch {
			throw new Error('That is not valid JSON')
		}
	}
	if (!cfg || typeof cfg !== 'object') throw new Error('Config must be an object')
	if (!cfg.glass && !cfg.layer && !cfg.shape && !cfg.solver) {
		throw new Error('No glass / layer / shape / solver keys found')
	}

	const applied = []
	if (assignNumbers(params, cfg.glass)) applied.push('glass')
	if (assignNumbers(SOLVER, cfg.solver)) applied.push('solver')
	if (assignNumbers(geom, cfg.layer)) applied.push('layer')

	const s = cfg.shape
	if (s && typeof s === 'object') {
		if (typeof s.kind === 'string') shape.kind = s.kind
		if (Number.isFinite(Number(s.radius))) shape.radius = Number(s.radius)
		shape.fillRule = s.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'
		if (typeof s.d === 'string' && s.d.trim()) shape.d = s.d.trim()
		const vb = Array.isArray(s.viewBox) ? s.viewBox.map(Number) : null
		if (vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
			shape.vx = vb[0]
			shape.vy = vb[1]
			shape.vw = vb[2]
			shape.vh = vb[3]
		}
		applied.push('shape')
	}

	// Parametric kinds re-derive their path from W/H; artwork keeps the pasted
	// `d` verbatim.
	if (isParametric() || shape.kind === 'figma') applyShape()
	else needsField()

	needsUI()
	needsRender()
	return applied.join(', ')
}

// --- snapshots (undo/redo) ------------------------------------------------
export function snapshot() {
	return JSON.stringify({ params, solver: SOLVER, geom, shape })
}

export function restoreSnapshot(snap) {
	const s = JSON.parse(snap)
	Object.assign(params, s.params)
	Object.assign(SOLVER, s.solver)
	Object.assign(geom, s.geom)
	Object.assign(shape, s.shape)
	// The rasterise+EDT stage is keyed and cached, so an unchanged path is
	// nearly free here.
	needsField()
	needsUI()
	needsRender()
}
