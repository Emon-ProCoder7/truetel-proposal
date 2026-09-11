// Canvas interaction: Figma-style select / move / resize, plus draw-to-create.
//
// All gestures write to `geom` in FRAME units so the numbers always match the
// header fields. While a gesture is live, `ui.interacting` is true, which drops
// the shader tap count; parametric paths are only regenerated on release, so a
// resize drag stretches the existing field instead of rebuilding it per frame.
//
// DRAW PREVIEW
// While a new shape is being dragged out, the glass pass is switched off
// (renderer.setPreview) and the shape is drawn as a FLAT SVG fill instead.
// That does two things: the outline being dragged stays clearly readable, and
// the height field is not rebuilt once per frame during the drag.
// It also fixes the stale-shape bug: the preview path is generated from
// `drag.kind`, captured from the active tool at pointer-down, instead of from
// `shape.d`, which only catches up on release.

import { FRAME_W, FRAME_H, geom, shape, ui, isParametric, applyShape } from './state.js'
import { presetPath } from './shapes.js'
import { bus, needsRender, needsUI } from './bus.js'
import * as history from './history.js'

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 8
const SVG_NS = 'http://www.w3.org/2000/svg'

const round = (n) => Math.round(n * 10) / 10

export function initInteractions({ canvas, sel, renderer }) {
	// --- overlay -----------------------------------------------------------
	const tag = document.createElement('div')
	tag.className = 'sizetag'
	for (const h of HANDLES) {
		const el = document.createElement('div')
		el.className = `h h-${h}`
		el.dataset.h = h
		sel.appendChild(el)
	}
	sel.appendChild(tag)

	// --- flat draw preview -------------------------------------------------
	const pv = document.createElementNS(SVG_NS, 'svg')
	pv.setAttribute('class', 'drawpv')
	pv.setAttribute('preserveAspectRatio', 'none')
	const pvPath = document.createElementNS(SVG_NS, 'path')
	pv.appendChild(pvPath)
	;(canvas.parentElement || document.body).appendChild(pv)

	function syncPreview() {
		if (!drag || drag.mode !== 'draw') {
			pv.classList.remove('on')
			return
		}
		const cw = canvas.clientWidth
		const ch = canvas.clientHeight
		const w = Math.max(geom.w, 1)
		const h = Math.max(geom.h, 1)
		pv.style.left = `${(geom.x / FRAME_W) * cw}px`
		pv.style.top = `${(geom.y / FRAME_H) * ch}px`
		pv.style.width = `${(w / FRAME_W) * cw}px`
		pv.style.height = `${(h / FRAME_H) * ch}px`
		pv.setAttribute('viewBox', `0 0 ${w} ${h}`)
		// Generated from the tool captured at pointer-down, so the outline is
		// always the shape that will actually be created.
		pvPath.setAttribute('d', presetPath(drag.kind, w, h, shape.radius))
		pv.classList.add('on')
	}

	function syncOverlay() {
		const cw = canvas.clientWidth
		const ch = canvas.clientHeight
		sel.classList.toggle('on', ui.selected && ui.tool === 'move')
		sel.style.left = `${(geom.x / FRAME_W) * cw}px`
		sel.style.top = `${(geom.y / FRAME_H) * ch}px`
		sel.style.width = `${(geom.w / FRAME_W) * cw}px`
		sel.style.height = `${(geom.h / FRAME_H) * ch}px`
		tag.textContent = `${round(geom.w)} × ${round(geom.h)}`
		syncPreview()
	}

	// --- coordinate helpers ------------------------------------------------
	// Pointer -> FRAME units. Uses the element box, so it is correct at any
	// CSS size and any device pixel ratio.
	function toFrame(e) {
		const r = canvas.getBoundingClientRect()
		return {
			x: ((e.clientX - r.left) / r.width) * FRAME_W,
			y: ((e.clientY - r.top) / r.height) * FRAME_H,
		}
	}

	const inside = (p) =>
		p.x >= geom.x && p.x <= geom.x + geom.w &&
		p.y >= geom.y && p.y <= geom.y + geom.h

	// --- gesture state -----------------------------------------------------
	let drag = null

	function begin(e) {
		ui.interacting = true
		canvas.setPointerCapture?.(e.pointerId)
	}

	function end() {
		if (!drag) return
		const wasDraw = drag.mode === 'draw'
		const changed = drag.moved
		const kind = drag.kind
		drag = null
		ui.interacting = false
		canvas.classList.remove('dragging')
		pv.classList.remove('on')

		if (wasDraw) {
			// Commit the drawn kind, then switch the glass pass back on.
			shape.kind = kind
			renderer.setPreview?.(false)
		}

		// Presets are regenerated at the final size so corner radii and polygon
		// vertices stay true instead of being stretched.
		if (changed && (isParametric() || wasDraw)) applyShape()
		if (changed) history.push()
		needsRender()
		needsUI()
		syncOverlay()
	}

	// --- resize ------------------------------------------------------------
	for (const el of sel.querySelectorAll('.h')) {
		el.addEventListener('pointerdown', (e) => {
			e.preventDefault()
			e.stopPropagation()
			el.setPointerCapture?.(e.pointerId)
			ui.interacting = true
			drag = {
				mode: 'resize',
				h: el.dataset.h,
				start: toFrame(e),
				base: { ...geom },
				ratio: geom.w / Math.max(geom.h, 1e-6),
				moved: false,
			}
		})
		el.addEventListener('pointermove', (e) => {
			if (!drag || drag.mode !== 'resize') return
			resizeTo(toFrame(e), e.shiftKey)
		})
		el.addEventListener('pointerup', end)
		el.addEventListener('pointercancel', end)
	}

	function resizeTo(p, keepRatio) {
		const b = drag.base
		const h = drag.h
		const dx = p.x - drag.start.x
		const dy = p.y - drag.start.y

		let x = b.x
		let y = b.y
		let w = b.w
		let hh = b.h

		if (h.includes('w')) {
			w = Math.max(MIN, b.w - dx)
			x = b.x + (b.w - w)
		} else if (h.includes('e')) {
			w = Math.max(MIN, b.w + dx)
		}
		if (h.includes('n')) {
			hh = Math.max(MIN, b.h - dy)
			y = b.y + (b.h - hh)
		} else if (h.includes('s')) {
			hh = Math.max(MIN, b.h + dy)
		}

		// Shift on a corner keeps the aspect ratio, like Figma.
		const corner = h.length === 2
		if (keepRatio && corner) {
			if (w / hh > drag.ratio) w = hh * drag.ratio
			else hh = w / drag.ratio
			if (h.includes('w')) x = b.x + (b.w - w)
			if (h.includes('n')) y = b.y + (b.h - hh)
		}

		geom.x = x
		geom.y = y
		geom.w = w
		geom.h = hh
		drag.moved = true
		needsRender()
		needsUI()
		syncOverlay()
	}

	// --- canvas: move, draw, select ----------------------------------------
	canvas.addEventListener('pointerdown', (e) => {
		const p = toFrame(e)

		if (ui.tool !== 'move') {
			// draw-to-create: the drag defines the new layer's box
			begin(e)
			// The kind is captured HERE. Nothing downstream reads `ui.tool`
			// again, so switching tools mid-gesture cannot desync the preview.
			drag = { mode: 'draw', origin: p, kind: ui.tool, moved: false }
			geom.x = p.x
			geom.y = p.y
			geom.w = MIN
			geom.h = MIN
			ui.selected = true
			canvas.classList.add('dragging')
			// Flat preview: glass off, no field rebuilds while dragging.
			renderer.setPreview?.(true)
			needsRender()
			syncOverlay()
			return
		}

		if (!inside(p)) {
			if (ui.selected) {
				ui.selected = false
				syncOverlay()
			}
			return
		}

		ui.selected = true
		begin(e)
		drag = { mode: 'move', start: p, base: { ...geom }, moved: false }
		canvas.classList.add('dragging')
		syncOverlay()
	})

	canvas.addEventListener('pointermove', (e) => {
		const p = toFrame(e)

		if (!drag) {
			const over = ui.tool === 'move' && inside(p)
			canvas.classList.toggle('over', over)
			return
		}

		if (drag.mode === 'move') {
			let dx = p.x - drag.start.x
			let dy = p.y - drag.start.y
			// Shift locks to the dominant axis.
			if (e.shiftKey) {
				if (Math.abs(dx) > Math.abs(dy)) dy = 0
				else dx = 0
			}
			geom.x = drag.base.x + dx
			geom.y = drag.base.y + dy
			drag.moved = true
			needsRender()
		} else if (drag.mode === 'draw') {
			let w = p.x - drag.origin.x
			let h = p.y - drag.origin.y
			// Shift draws a square / circle.
			if (e.shiftKey) {
				const m = Math.max(Math.abs(w), Math.abs(h))
				w = Math.sign(w || 1) * m
				h = Math.sign(h || 1) * m
			}
			geom.x = w < 0 ? drag.origin.x + w : drag.origin.x
			geom.y = h < 0 ? drag.origin.y + h : drag.origin.y
			geom.w = Math.max(MIN, Math.abs(w))
			geom.h = Math.max(MIN, Math.abs(h))
			drag.moved = true
			// No needsRender(): the WebGL frame does not change during the flat
			// preview, only the SVG outline does.
		}

		needsUI()
		syncOverlay()
	})

	canvas.addEventListener('pointerup', (e) => {
		const wasDraw = drag?.mode === 'draw'
		end()
		if (wasDraw) {
			// Figma returns to the move tool after drawing one shape.
			ui.tool = 'move'
			needsUI()
			syncOverlay()
		}
	})
	canvas.addEventListener('pointercancel', end)
	canvas.addEventListener('pointerleave', () => canvas.classList.remove('over'))

	// --- keyboard ----------------------------------------------------------
	window.addEventListener('keydown', (e) => {
		const t = e.target
		if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return

		if (e.key === 'Escape') {
			if (ui.tool !== 'move') {
				ui.tool = 'move'
				needsUI()
			} else {
				ui.selected = false
			}
			syncOverlay()
			return
		}

		if (!ui.selected) return
		const step = e.shiftKey ? 10 : 1
		let used = true
		if (e.key === 'ArrowLeft') geom.x -= step
		else if (e.key === 'ArrowRight') geom.x += step
		else if (e.key === 'ArrowUp') geom.y -= step
		else if (e.key === 'ArrowDown') geom.y += step
		else used = false

		if (used) {
			e.preventDefault()
			needsRender()
			needsUI()
			syncOverlay()
			history.pushSoon()
		}
	})

	// Keep the overlay glued to the shape when the header, the window, or undo
	// changes the geometry.
	bus.on('ui', syncOverlay)
	window.addEventListener('resize', syncOverlay)
	new ResizeObserver(syncOverlay).observe(canvas)

	syncOverlay()
	return { syncOverlay }
}
