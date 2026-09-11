// Chrome wiring: tools, header popovers, shape fields, custom dropdown, glass
// sliders, solver sliders, SVG paste, config paste.
// This module owns every DOM listener that is not a canvas gesture.

import './chrome.css'

import {
	params, SOLVER, geom, shape, ui, PARAMETRIC,
	applyShape, setShapeKind, resetGlass, resetLayer,
	exportConfig, importConfig,
} from './state.js'
import { parseSvgShape } from './shapes.js'
import { bus, needsField, needsRender, needsUI } from './bus.js'
import * as history from './history.js'
import { starNudge } from './nudge.js'

// Params that change the HEIGHT FIELD rather than just the shading.
const REBUILD = new Set(['depth', 'smooth', 'reach', 'soften'])

// Splay only shapes the specular lobe, so it is inert while Light intensity is
// 0 (the shader skips the whole highlight branch). That looked like a dead
// control, so the row is dimmed and labelled instead of silently doing nothing.
function syncSplayDep() {
	const li = document.getElementById('lightIntensity')
	const sp = document.getElementById('splay')
	if (!li || !sp) return
	const off = parseFloat(li.value) <= 0.0001
	const row = sp.closest('.slider')
	if (row) row.classList.toggle('is-inert', off)
	const tag = document.querySelector('[data-dep="lightIntensity"]')
	if (tag) tag.textContent = off ? 'needs light' : ''
}

const $ = (id) => document.getElementById(id)
const fmt = (n) => (Math.abs(n) >= 100 || Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(2))

export function initUI() {
	const els = {}

	// --- tools -------------------------------------------------------------
	const tools = [...document.querySelectorAll('[data-tool]')]
	for (const btn of tools) {
		btn.addEventListener('click', () => {
			ui.tool = btn.dataset.tool
			if (ui.tool !== 'move') ui.selected = false
			needsUI()
		})
	}
	// Figma's single-key tool shortcuts, limited to the shapes we support.
	const KEYS = { v: 'move', r: 'rect', o: 'ellipse', e: 'ellipse', l: 'pill', p: 'pentagon', t: 'triangle', s: 'star' }
	window.addEventListener('keydown', (e) => {
		if (e.ctrlKey || e.metaKey || e.altKey) return
		const t = e.target
		if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
		const tool = KEYS[e.key.toLowerCase()]
		if (!tool) return
		ui.tool = tool
		if (tool !== 'move') ui.selected = false
		needsUI()
	})

	// --- header popovers ---------------------------------------------------
	// Image / SVG / Config each live behind one compact header button, so the
	// inspector only carries the properties of the selected object.
	function initPopovers() {
		const groups = [...document.querySelectorAll('.hgrp')]

		function closeAll(except) {
			for (const g of groups) {
				if (g === except) continue
				g.classList.remove('open')
				const pop = g.querySelector('.hpop')
				if (pop) pop.hidden = true
			}
		}

		for (const g of groups) {
			const btn = g.querySelector('[data-pop]')
			const pop = $(btn?.dataset.pop || '')
			if (!btn || !pop) continue
			btn.addEventListener('click', (e) => {
				e.stopPropagation()
				const open = g.classList.contains('open')
				closeAll(g)
				g.classList.toggle('open', !open)
				pop.hidden = open
			})
			// Clicks inside the popover must not close it.
			pop.addEventListener('click', (e) => e.stopPropagation())
		}

		document.addEventListener('click', () => closeAll(null))
		window.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') closeAll(null)
		})
	}

	// --- sliders -----------------------------------------------------------
	function bindRange(store, key) {
		const input = $(key)
		const out = $(`o-${key}`)
		if (!input) return
		els[key] = { input, out }

		// Whether this slider forces a CPU height-field rebuild rather than just a
		// reshade. Only these are expensive enough to need the drag treatment.
		const heavy = REBUILD.has(key)

		// Canvas gestures have always announced themselves through
		// `ui.interacting`, which is what makes the renderer fall back to a coarse
		// field and few spectral taps. The panel sliders never did, so dragging
		// Depth or Reach rebuilt a full-resolution field on EVERY input event at
		// full tap count - the most expensive thing the editor does. Announcing
		// the drag reuses that existing fast path for free.
		const startDrag = () => {
			if (!heavy || ui.interacting) return
			ui.interacting = true
		}
		const endDrag = () => {
			if (!heavy || !ui.interacting) return
			ui.interacting = false
			needsField() // one full-quality rebuild, on release
		}

		input.addEventListener('pointerdown', startDrag)
		input.addEventListener('pointerup', endDrag)
		input.addEventListener('pointercancel', endDrag)
		// Arrow-key nudges are drags too, and blur covers a pointer released
		// outside the window, which would otherwise strand the coarse field.
		input.addEventListener('keydown', startDrag)
		input.addEventListener('keyup', endDrag)
		input.addEventListener('blur', endDrag)
		input.addEventListener('input', () => {
			store[key] = parseFloat(input.value)
			if (out) out.textContent = fmt(store[key])
			if (heavy) needsField()
			else needsRender()
		})
		input.addEventListener('change', () => {
			endDrag()
			history.push()
		})
	}

	for (const key of Object.keys(params)) bindRange(params, key)
	for (const key of Object.keys(SOLVER)) bindRange(SOLVER, key)

	const liEl = document.getElementById('lightIntensity')
	if (liEl) liEl.addEventListener('input', syncSplayDep)
	syncSplayDep()

	// --- geometry fields ---------------------------------------------------
	const geomFields = { 'g-x': 'x', 'g-y': 'y', 'g-w': 'w', 'g-h': 'h' }
	for (const [id, key] of Object.entries(geomFields)) {
		const input = $(id)
		if (!input) continue
		els[id] = input
		input.addEventListener('input', () => {
			const v = parseFloat(input.value)
			if (!Number.isFinite(v)) return
			geom[key] = (key === 'w' || key === 'h') ? Math.max(6, v) : v
			needsRender()
			needsUI()
		})
		input.addEventListener('change', () => {
			// Resizing a preset re-derives its path so radii stay circular.
			if ((key === 'w' || key === 'h') && PARAMETRIC.has(shape.kind)) applyShape()
			history.push()
		})
	}

	// --- custom shape dropdown --------------------------------------------
	// A native <select> renders as the OS list (white rows on Windows), which
	// broke the dark UI. This is a plain button + popover with the same data.
	const dd = $('kindDD')
	const ddBtn = $('kindBtn')
	const ddMenu = $('kindMenu')
	const ddLabel = $('kindLabel')
	const ddOpts = ddMenu ? [...ddMenu.querySelectorAll('[data-kind]')] : []

	function closeMenu() {
		if (!dd) return
		dd.classList.remove('open')
		if (ddMenu) ddMenu.hidden = true
		ddBtn?.setAttribute('aria-expanded', 'false')
	}

	function openMenu() {
		if (!dd) return
		dd.classList.add('open')
		if (ddMenu) ddMenu.hidden = false
		ddBtn?.setAttribute('aria-expanded', 'true')
	}

	ddBtn?.addEventListener('click', (e) => {
		e.stopPropagation()
		if (dd.classList.contains('open')) closeMenu()
		else openMenu()
	})

	for (const opt of ddOpts) {
		opt.addEventListener('click', () => {
			closeMenu()
			if (opt.dataset.kind === shape.kind) return
			setShapeKind(opt.dataset.kind)
			history.push()
		})
	}

	document.addEventListener('click', (e) => {
		if (dd && !dd.contains(e.target)) closeMenu()
	})
	window.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') closeMenu()
	})

	initPopovers()

	// The coach line under the canvas retires once the user draws anything.
	const coach = $('coach')
	$('gl')?.addEventListener('pointerdown', () => {
		if (!coach || coach.classList.contains('gone')) return
		coach.classList.add('gone')
		setTimeout(() => coach.remove(), 300)
	}, { once: true })

	// --- corner radius -----------------------------------------------------
	const radius = $('radius')
	radius?.addEventListener('input', () => {
		const v = parseFloat(radius.value)
		if (!Number.isFinite(v)) return
		shape.radius = Math.max(0, v)
		const out = $('o-radius')
		if (out) out.textContent = fmt(shape.radius)
		applyShape()
	})
	radius?.addEventListener('change', () => history.push())

	// --- SVG paste ---------------------------------------------------------
	const svgin = $('svgin')
	const svgmsg = $('svgmsg')

	function say(el, text, bad = false) {
		if (!el) return
		el.textContent = text
		el.classList.toggle('bad', bad)
	}

	function applySvg() {
		try {
			const p = parseSvgShape(svgin.value)
			shape.kind = 'custom'
			shape.d = p.d
			shape.vx = p.vx
			shape.vy = p.vy
			shape.vw = p.vw
			shape.vh = p.vh
			shape.fillRule = p.fillRule
			// Adopt the artwork's own size so it lands at 1:1 scale.
			geom.w = p.vw
			geom.h = p.vh
			needsField()
			needsUI()
			history.push()
			say(
				svgmsg,
				p.transformed
					? `Applied ${Math.round(p.vw)}×${Math.round(p.vh)} — element transforms were ignored`
					: `Applied — ${Math.round(p.vw)}×${Math.round(p.vh)}, ${p.count} path${p.count === 1 ? '' : 's'}`,
				Boolean(p.transformed),
			)
		} catch (err) {
			say(svgmsg, err.message, true)
		}
	}

	$('svgapply')?.addEventListener('click', applySvg)
	$('svgclear')?.addEventListener('click', () => {
		svgin.value = ''
		say(svgmsg, '')
	})
	// Pasting straight into the box applies it, which is the whole point.
	svgin?.addEventListener('paste', () => setTimeout(applySvg, 0))

	// --- config copy / paste ----------------------------------------------
	const cfgin = $('cfgin')
	const cfgmsg = $('cfgmsg')

	$('copy')?.addEventListener('click', async (e) => {
		const text = JSON.stringify(exportConfig(), null, 2)
		try {
			await navigator.clipboard.writeText(text)
			flash(e.currentTarget, 'Copied')
			starNudge('Config copied.')
		} catch {
			if (cfgin) cfgin.value = text
			say(cfgmsg, 'Clipboard blocked — config placed in the box below')
		}
	})

	$('cfgapply')?.addEventListener('click', () => {
		try {
			const applied = importConfig(cfgin.value)
			history.push()
			say(cfgmsg, `Applied — ${applied}`)
		} catch (err) {
			say(cfgmsg, err.message, true)
		}
	})
	$('cfgclear')?.addEventListener('click', () => {
		cfgin.value = ''
		say(cfgmsg, '')
	})

	// --- buttons -----------------------------------------------------------
	function flash(btn, text) {
		const old = btn.textContent
		btn.textContent = text
		btn.classList.add('ok')
		setTimeout(() => {
			btn.textContent = old
			btn.classList.remove('ok')
		}, 900)
	}

	$('undo')?.addEventListener('click', () => history.undo())
	$('redo')?.addEventListener('click', () => history.redo())
	$('reset')?.addEventListener('click', () => {
		resetGlass()
		history.push()
	})
	$('center')?.addEventListener('click', () => {
		resetLayer()
		history.push()
	})

	const undoBtn = $('undo')
	const redoBtn = $('redo')
	bus.on('history', (s) => {
		if (undoBtn) undoBtn.disabled = !s.canUndo
		if (redoBtn) redoBtn.disabled = !s.canRedo
	})

	// --- sync --------------------------------------------------------------
	function sync() {
		for (const [key, el] of Object.entries(els)) {
			if (!el.input) continue
			const store = key in params ? params : SOLVER
			el.input.value = store[key]
			if (el.out) el.out.textContent = fmt(store[key])
		}
		for (const [id, key] of Object.entries(geomFields)) {
			const input = els[id]
			if (input && document.activeElement !== input) {
				input.value = Math.round(geom[key] * 10) / 10
			}
		}

		if (ddOpts.length) {
			let label = shape.kind
			for (const opt of ddOpts) {
				const on = opt.dataset.kind === shape.kind
				opt.classList.toggle('sel', on)
				if (on) label = opt.textContent.trim()
			}
			if (ddLabel) ddLabel.textContent = label
		}

		if (radius && document.activeElement !== radius) {
			radius.value = shape.radius
		}
		const rOut = $('o-radius')
		if (rOut) rOut.textContent = fmt(shape.radius)
		const rRow = $('radiusRow')
		if (rRow) rRow.hidden = shape.kind !== 'rect'

		for (const btn of tools) {
			btn.classList.toggle('active', btn.dataset.tool === ui.tool)
		}
		document.body.classList.toggle('drawing', ui.tool !== 'move')
	}

	bus.on('ui', sync)
	sync()
	return { sync }
}
