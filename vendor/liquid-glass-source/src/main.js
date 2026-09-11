// Bootstrap only. Every concern lives in its own module:
//
//   state.js       model + config blob + snapshots
//   shapes.js      preset paths + SVG paste parsing
//   sdf.js         rasterise -> EDT -> height field
//   renderer.js    WebGL2 passes, lazy redraw, quality scaling
//   interact.js    select / move / resize / draw-to-create
//   ui.js          panel wiring
//   background.js  default / uploaded / dropped / pasted backdrop
//   history.js     undo + redo
//   bus.js         change notifications between the above

import './style.css'
import './typography.css'
import './help.js'
// Served from /public, deliberately NOT imported. A bundled import makes the
// backdrop a hard dependency of the entry chunk, so the editor cannot start
// until the whole JPEG has downloaded and decoded. As a plain URL it loads in
// parallel with renderer setup and the editor is interactive immediately.
const bgUrl = '/Images/Default-image.jpeg'

import { createRenderer } from './renderer.js'
import { initInteractions } from './interact.js'
import { initUI } from './ui.js'
import { initBackground } from './background.js'
import { initHistoryKeys } from './history.js'
import { bus } from './bus.js'

// Last CSS import, so its media queries win over style.css and chrome.css.
import './responsive.css'

const canvas = document.getElementById('gl')
const sel = document.getElementById('sel')

let renderer
try {
	renderer = createRenderer(canvas)
} catch (err) {
	document.body.innerHTML = `<p class="fatal">${err.message}</p>`
	throw err
}

initUI()
initInteractions({ canvas, sel, renderer })
initHistoryKeys()

// The render loop is LAZY: a frame is only drawn when a module announces a
// change. Idle cost is one empty rAF callback instead of a full-screen
// 20-tap shader pass, which is what made the old build lag.
bus.on('render', () => renderer.invalidate())
bus.on('field', () => renderer.invalidateField())

function frame() {
	renderer.render()
	requestAnimationFrame(frame)
}

let started = false
const background = initBackground({
	renderer,
	defaultUrl: bgUrl,
	onReady: () => {
		if (started) return
		started = true
		renderer.invalidateField()
		requestAnimationFrame(frame)
		const p = document.getElementById('precision')
		if (p) {
			p.textContent = renderer.floatLinear
				? 'Height field: RG32F (full precision)'
				: 'Height field: RG16F \u2014 float32 linear filtering unavailable'
		}
	},
})

// Load the bundled backdrop through the same path as an upload.
const img = new Image()
img.onload = () => {
	renderer.setBackground(img)
	background.markDefaultLoaded?.()
	renderer.invalidateField()
	if (!started) {
		started = true
		requestAnimationFrame(frame)
	}
	const p = document.getElementById('precision')
	if (p) {
		p.textContent = renderer.floatLinear
			? 'Height field: RG32F (full precision)'
			: 'Height field: RG16F \u2014 float32 linear filtering unavailable'
	}
}
img.onerror = () => {
	document.body.innerHTML = '<p class="fatal">Default-image.jpeg failed to load.</p>'
}
img.src = bgUrl
