// Left rail: the guide overlay and the preset picker.
//
// Both are built in JS rather than markup so index.html stays readable and so
// this whole feature is one import that can be removed cleanly.
//
// The guide shows itself once on a visitor's first load, records that in
// localStorage, and is reachable forever after from the rail button.
//
// The modal is deliberately short. Anyone who wants detail gets sent to the
// static /guide.html page, which is also what AI crawlers read. It has no copy
// button of its own: copying is the rail's job, and duplicating it here just
// competed with the one action a first-time visitor should take.

import './help.css'
import { exportConfig, importConfig } from './state.js'
import { GLASS_PRESETS, buildTemplatePrompt } from './presets.js'
import { starNudge } from './nudge.js'

const SEEN_KEY = 'liquidglass.guide.seen.v1'

const el = (tag, cls, html) => {
	const n = document.createElement(tag)
	if (cls) n.className = cls
	if (html != null) n.innerHTML = html
	return n
}

// localStorage throws in private mode / sandboxed iframes, and a guide is
// never worth breaking the app over.
function seen() {
	try {
		return localStorage.getItem(SEEN_KEY) === '1'
	} catch {
		return true
	}
}
function markSeen() {
	try {
		localStorage.setItem(SEEN_KEY, '1')
	} catch {
		/* ignore */
	}
}

async function toClipboard(text, btn, okLabel) {
	const label = btn.textContent
	let copied = true
	try {
		await navigator.clipboard.writeText(text)
		btn.textContent = okLabel
	} catch {
		// Clipboard API needs a secure context; fall back to a selectable box.
		const ta = el('textarea', 'lg-fallback')
		ta.value = text
		document.body.appendChild(ta)
		ta.select()
		const ok = document.execCommand && document.execCommand('copy')
		ta.remove()
		btn.textContent = ok ? okLabel : 'Press Ctrl+C'
		copied = !!ok
	}
	btn.classList.add('ok')
	setTimeout(() => {
		btn.textContent = label
		btn.classList.remove('ok')
	}, 1600)
	return copied
}

// Three steps, one caveat. Everything else lives on /guide.html.
const GUIDE_HTML = `
<p class="lg-eyebrow">Figma's glass effect, in the browser</p>
<h2>Make glass, then<br />take it with you.</h2>

<ol class="lg-steps">
	<li>
		<span class="lg-num">1</span>
		<div>
			<b>Draw a shape</b>
			<p>Pick one from the toolbar and drag on the image. Or paste SVG from Figma.</p>
		</div>
	</li>
	<li>
		<span class="lg-num">2</span>
		<div>
			<b>Tune the glass</b>
			<p>Sliders on the right match Figma exactly. <b>Reach</b> and <b>Soften</b> go beyond it &mdash; see the full guide. <b>Presets</b> get you close in one click.</p>
		</div>
	</li>
	<li>
		<span class="lg-num">3</span>
		<div>
			<b>Copy the prompt</b>
			<p>Use <b>Copy prompt</b> on the left, then hand it to any AI assistant.</p>
		</div>
	</li>
</ol>

<p class="lg-note">Glass needs something behind it. On a flat colour it is invisible &mdash; by design.</p>
`

export function initHelp() {
	if (document.getElementById('lgRail')) return

	// --- left rail ---
	const rail = el('div', 'lg-rail')
	rail.id = 'lgRail'

	const guideBtn = el('button', 'lg-railbtn')
	guideBtn.type = 'button'
	guideBtn.title = 'How to use this, and how to put it on your own site'
	guideBtn.innerHTML =
		'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M6.2 6.1a1.9 1.9 0 113.1 1.5c-.7.5-1.3.8-1.3 1.7"/><circle cx="8" cy="11.6" r=".7" fill="currentColor" stroke="none"/></svg><span>Guide</span>'

	const presetBtn = el('button', 'lg-railbtn')
	presetBtn.type = 'button'
	presetBtn.title = 'Ready-made glass looks'
	presetBtn.innerHTML =
		'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2l2 3.9 4.3.6-3.1 3 .8 4.2L8 11.9l-3.9 2 .8-4.2-3.1-3 4.3-.6z"/></svg><span>Presets</span>'

	const promptBtn = el('button', 'lg-railbtn')
	promptBtn.type = 'button'
	promptBtn.title = 'Copy a ready-to-paste brief for rebuilding this on your own site'
	promptBtn.innerHTML =
		'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 2.5H6a1.5 1.5 0 00-1.5 1.5v8A1.5 1.5 0 006 13.5h5a1.5 1.5 0 001.5-1.5V4.5z"/><path d="M6.8 6.2h3.4M6.8 8.4h3.4M6.8 10.6h2.2"/></svg><span>Copy&nbsp;prompt</span>'

	rail.append(guideBtn, presetBtn, promptBtn)
	document.body.appendChild(rail)

	// --- preset flyout ---
	// Name and note are wrapped in one text column inside the button, so a note
	// can never visually detach from the preset it describes.
	const flyout = el('div', 'lg-flyout')
	flyout.hidden = true

	const fhead = el('div', 'lg-flyhead')
	fhead.appendChild(el('h3', null, 'Presets'))
	fhead.appendChild(el('p', null, 'Glass settings only — your shape and background stay.'))
	flyout.appendChild(fhead)

	const list = el('div', 'lg-plist')
	for (const p of GLASS_PRESETS) {
		const b = el('button', 'lg-preset')
		b.type = 'button'

		const text = el('span', 'lg-ptext')
		text.appendChild(el('span', 'lg-pname', p.name))
		text.appendChild(el('span', 'lg-pnote', p.note))

		b.appendChild(text)
		b.appendChild(
			el(
				'span',
				'lg-pgo',
				'<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 2.5L7.8 6l-3.6 3.5"/></svg>',
			),
		)

		b.addEventListener('click', () => {
			importConfig({ glass: p.glass, solver: p.solver })
			for (const other of list.children) other.classList.remove('sel')
			b.classList.add('sel')
		})
		list.appendChild(b)
	}
	flyout.appendChild(list)
	document.body.appendChild(flyout)

	// --- guide overlay ---
	const overlay = el('div', 'lg-overlay')
	overlay.hidden = true
	const sheet = el('div', 'lg-sheet')
	const body = el('div', 'lg-body', GUIDE_HTML)

	const closeX = el('button', 'lg-x')
	closeX.type = 'button'
	closeX.title = 'Close'
	closeX.innerHTML =
		'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>'

	// Footer: a quiet link out to the full docs, and one primary action.
	const foot = el('div', 'lg-foot')
	const more = el('a', 'lg-link', 'Full guide')
	more.href = '/guide.html'
	more.target = '_blank'
	more.rel = 'noopener'
	const done = el('button', 'lg-cta', 'Start')
	done.type = 'button'
	foot.append(more, el('span', 'lg-spacer'), done)

	sheet.append(closeX, body, foot)
	overlay.appendChild(sheet)
	document.body.appendChild(overlay)

	// --- behaviour ---
	const closeFlyout = () => {
		flyout.hidden = true
		presetBtn.classList.remove('on')
	}
	const openGuide = () => {
		overlay.hidden = false
		closeFlyout()
		sheet.scrollTop = 0
	}
	const closeGuide = () => {
		overlay.hidden = true
		markSeen()
	}

	guideBtn.addEventListener('click', openGuide)
	closeX.addEventListener('click', closeGuide)
	done.addEventListener('click', closeGuide)
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) closeGuide()
	})
	document.addEventListener('keydown', (e) => {
		if (e.key !== 'Escape') return
		if (!overlay.hidden) closeGuide()
		else if (!flyout.hidden) closeFlyout()
	})

	presetBtn.addEventListener('click', (e) => {
		e.stopPropagation()
		flyout.hidden = !flyout.hidden
		presetBtn.classList.toggle('on', !flyout.hidden)
	})
	document.addEventListener('pointerdown', (e) => {
		if (flyout.hidden) return
		if (flyout.contains(e.target) || presetBtn.contains(e.target)) return
		closeFlyout()
	})

	promptBtn.addEventListener('click', () =>
		toClipboard(buildTemplatePrompt(exportConfig()), promptBtn, 'Copied').then(
			(ok) => ok && starNudge('Prompt copied.'),
		),
	)

	if (!seen()) openGuide()
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initHelp, { once: true })
} else {
	initHelp()
}
