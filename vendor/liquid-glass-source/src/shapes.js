// Shape library + SVG paste parser.
//
// Everything downstream (sdf.js, the shader) only ever sees ONE thing: an SVG
// path string plus the viewBox it lives in. So "support any object" reduces to
// producing that pair. Presets are generated at the layer's current size so a
// corner radius stays circular instead of being stretched by the layer rect.
//
// The original Figma vector keeps its own fixed viewBox - it is a traced
// artwork, not a parametric primitive, so resizing stretches it exactly like
// Figma stretches a vector layer.

export const FIGMA_PATH =
	'M54 32C36 24.6667 12.5 9.33333 0 0V199.5H355C349.5 131 310.167 110.833 285 90C260.167 72.6667 202.737 48.1404 159.5 46C109 43.5 69.7231 38.4057 54 32Z'

export const FIGMA_VIEW = { vw: 355, vh: 199.5 }

// Presets that regenerate from width/height. `custom` and `figma` do not.
export const PRESETS = [
	['figma', 'Figma vector (original)'],
	['rect', 'Rectangle'],
	['pill', 'Pill'],
	['ellipse', 'Ellipse / circle'],
	['triangle', 'Triangle'],
	['diamond', 'Diamond'],
	['pentagon', 'Pentagon'],
	['hexagon', 'Hexagon'],
	['star', 'Star'],
]

const f = (n) => String(Math.round(n * 1000) / 1000)

function roundedRect(w, h, r) {
	const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
	if (rr < 0.01) return `M0 0H${f(w)}V${f(h)}H0Z`
	const a = `A${f(rr)} ${f(rr)} 0 0 1 `
	return (
		`M${f(rr)} 0H${f(w - rr)}${a}${f(w)} ${f(rr)}` +
		`V${f(h - rr)}${a}${f(w - rr)} ${f(h)}` +
		`H${f(rr)}${a}0 ${f(h - rr)}` +
		`V${f(rr)}${a}${f(rr)} 0Z`
	)
}

function ellipsePath(w, h) {
	const rx = w / 2
	const ry = h / 2
	const a = `A${f(rx)} ${f(ry)} 0 0 1 `
	return `M0 ${f(ry)}${a}${f(w)} ${f(ry)}${a}0 ${f(ry)}Z`
}

function polyPath(pts, w, h) {
	return (
		pts
			.map(([ux, uy], i) => `${i ? 'L' : 'M'}${f(ux * w)} ${f(uy * h)}`)
			.join('') + 'Z'
	)
}

function ngon(n, w, h) {
	const pts = []
	for (let i = 0; i < n; i++) {
		const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
		pts.push([0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)])
	}
	return polyPath(pts, w, h)
}

function starPath(n, inner, w, h) {
	const pts = []
	for (let i = 0; i < n * 2; i++) {
		const a = -Math.PI / 2 + (i * Math.PI) / n
		const r = i % 2 ? 0.5 * inner : 0.5
		pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)])
	}
	return polyPath(pts, w, h)
}

/**
 * @param {string} kind one of PRESETS
 * @param {number} w layer width in path units
 * @param {number} h layer height in path units
 * @param {number} r corner radius, rectangle only
 */
export function presetPath(kind, w, h, r = 0) {
	switch (kind) {
		case 'pill':
			return roundedRect(w, h, Math.min(w, h) / 2)
		case 'ellipse':
			return ellipsePath(w, h)
		case 'triangle':
			return polyPath([[0.5, 0], [1, 1], [0, 1]], w, h)
		case 'diamond':
			return polyPath([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h)
		case 'pentagon':
			return ngon(5, w, h)
		case 'hexagon':
			return ngon(6, w, h)
		case 'star':
			return starPath(5, 0.42, w, h)
		default:
			return roundedRect(w, h, r)
	}
}

// --- SVG paste ------------------------------------------------------------

const num = (el, name, dflt = 0) => {
	const v = parseFloat(el.getAttribute(name))
	return Number.isFinite(v) ? v : dflt
}

// Basic shapes -> path data, so the whole pipeline stays path-only.
function elToPath(el) {
	const tag = el.tagName.toLowerCase()
	if (tag === 'path') return el.getAttribute('d') || ''
	if (tag === 'rect') {
		const x = num(el, 'x')
		const y = num(el, 'y')
		const w = num(el, 'width')
		const h = num(el, 'height')
		if (w <= 0 || h <= 0) return ''
		const r = Math.max(num(el, 'rx'), num(el, 'ry'))
		const d = roundedRect(w, h, r)
		return x || y ? shiftPath(d, x, y) : d
	}
	if (tag === 'circle') {
		const r = num(el, 'r')
		if (r <= 0) return ''
		return shiftPath(ellipsePath(r * 2, r * 2), num(el, 'cx') - r, num(el, 'cy') - r)
	}
	if (tag === 'ellipse') {
		const rx = num(el, 'rx')
		const ry = num(el, 'ry')
		if (rx <= 0 || ry <= 0) return ''
		return shiftPath(
			ellipsePath(rx * 2, ry * 2),
			num(el, 'cx') - rx,
			num(el, 'cy') - ry,
		)
	}
	if (tag === 'polygon' || tag === 'polyline') {
		const raw = (el.getAttribute('points') || '')
			.trim()
			.split(/[\s,]+/)
			.map(Number)
		if (raw.length < 6) return ''
		let d = ''
		for (let i = 0; i + 1 < raw.length; i += 2) {
			d += `${i ? 'L' : 'M'}${f(raw[i])} ${f(raw[i + 1])}`
		}
		return d + 'Z'
	}
	return ''
}

// Only used for the shapes generated above, whose commands are known: an
// absolute M/L/H/V/A path emitted by this file. Never applied to pasted `d`.
function shiftPath(d, dx, dy) {
	if (!dx && !dy) return d
	return d.replace(/([MLHVA])([^MLHVAZ]*)/g, (_, cmd, args) => {
		const n = args.trim().split(/[\s,]+/).filter((s) => s !== '').map(Number)
		if (cmd === 'H') return 'H' + n.map((v) => f(v + dx)).join(' ')
		if (cmd === 'V') return 'V' + n.map((v) => f(v + dy)).join(' ')
		if (cmd === 'A') {
			const out = n.slice()
			for (let i = 5; i < out.length; i += 7) {
				out[i] += dx
				out[i + 1] += dy
			}
			return 'A' + out.map(f).join(' ')
		}
		return cmd + n.map((v, i) => f(v + (i % 2 ? dy : dx))).join(' ')
	})
}

// getBBox is the browser's own exact curve maths, so the pasted artwork is
// measured the same way Figma measures it. The probe must be in the render
// tree (not display:none) for getBBox to work, hence the off-screen shim.
let probe = null
function bboxOf(d) {
	if (!probe) {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
		svg.setAttribute('width', '1')
		svg.setAttribute('height', '1')
		svg.style.cssText =
			'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden'
		const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
		svg.appendChild(p)
		document.body.appendChild(svg)
		probe = p
	}
	probe.setAttribute('d', d)
	return probe.getBBox()
}

/**
 * Parses pasted SVG markup (or a bare path `d`) into a shape descriptor.
 * @returns {{d: string, vx: number, vy: number, vw: number, vh: number,
 *   fillRule: string, count: number, transformed: boolean}}
 */
export function parseSvgShape(code) {
	const src = (code || '').trim()
	if (!src) throw new Error('Paste some SVG first')

	let ds = []
	let fillRule = 'nonzero'
	let transformed = false

	if (src[0] !== '<') {
		// bare path data
		ds = [src]
	} else {
		const markup = /<svg[\s>]/i.test(src)
			? src
			: `<svg xmlns="http://www.w3.org/2000/svg">${src}</svg>`
		const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
		if (doc.querySelector('parsererror')) throw new Error('That is not valid SVG')
		const els = doc.querySelectorAll(
			'path,rect,circle,ellipse,polygon,polyline',
		)
		for (const el of els) {
			// defs/clipPath/mask contents are not drawn
			if (el.closest('defs,clipPath,mask,marker,symbol')) continue
			if (el.getAttribute('fill') === 'none' && el.tagName.toLowerCase() !== 'path') continue
			if (el.getAttribute('transform')) transformed = true
			if (el.parentElement?.getAttribute('transform')) transformed = true
			const fr = el.getAttribute('fill-rule') || el.getAttribute('clip-rule')
			if (fr === 'evenodd') fillRule = 'evenodd'
			const d = elToPath(el)
			if (d.trim()) ds.push(d.trim())
		}
	}

	if (!ds.length) throw new Error('No drawable shape found in that SVG')

	const d = ds.join(' ')
	const b = bboxOf(d)
	if (!(b.width > 0.01) || !(b.height > 0.01)) {
		throw new Error('That shape has no area')
	}

	return {
		d,
		vx: b.x,
		vy: b.y,
		vw: b.width,
		vh: b.height,
		fillRule,
		count: ds.length,
		transformed,
	}
}
