// Landing page behaviour.
//
// Three jobs: slow boomerang video backdrops, nav state, and the interactive
// specimen board. Everything is written so that no work happens for a section
// that is off screen or a tab that is hidden.

import Lenis from 'lenis'

import './landing.css'

/* ------------------------------------------------------------------ *
 * capability check
 * ------------------------------------------------------------------ */

// backdrop-filter over a playing video is the most expensive thing on this
// page. On a weak GPU or a low-core machine, cut the blur radius rather than
// dropping the effect, which is the difference the user actually feels.
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const LITE =
	(navigator.hardwareConcurrency || 8) <= 4 ||
	window.matchMedia('(pointer: coarse)').matches

if (LITE) document.documentElement.classList.add('lite')

/* ------------------------------------------------------------------ *
 * ambient video
 * ------------------------------------------------------------------ */

// This used to run the reverse leg from JS, stepping currentTime 30 times a
// second. Every one of those writes is a seek, and a seek on H.264 means
// decoding from the nearest keyframe forward to the target frame — tens of
// decoded frames for every single frame shown, at 1920x1080. That was the
// stutter, and it was not tunable: the approach itself was wrong.
//
// The palindrome is now baked into the file (forward + reversed, *-loop.mp4),
// so a plain native loop gives the identical motion with no scripting and no
// seeking at all. The files are also 720p instead of 1080p, which is all a
// blurred backdrop behind a dark veil can actually show.
const RATE = 0.5

function ambient(video) {
	let visible = true
	let inView = true

	// playbackRate resets when a new source loads, so reapply on metadata.
	const apply = () => {
		video.playbackRate = RATE
	}
	apply()
	video.addEventListener('loadedmetadata', apply)

	const play = () => {
		if (!visible || !inView) return
		apply()
		const p = video.play()
		if (p && typeof p.catch === 'function') p.catch(() => {})
	}

	const reveal = () => video.classList.add('ready')
	if (video.readyState >= 2) reveal()
	else video.addEventListener('loadeddata', reveal, { once: true })

	if (REDUCED) {
		video.pause()
		return
	}

	play()

	// Decoding a video that is off screen, or in a hidden tab, is pure waste —
	// and on this page it competes with the backdrop-filter compositing.
	if ('IntersectionObserver' in window) {
		new IntersectionObserver(
			(entries) => {
				for (const en of entries) {
					inView = en.isIntersecting
					if (inView) play()
					else video.pause()
				}
			},
			{ threshold: 0.01 },
		).observe(video)
	}

	document.addEventListener('visibilitychange', () => {
		visible = !document.hidden
		if (visible) play()
		else video.pause()
	})
}

for (const v of document.querySelectorAll('video.vid')) ambient(v)

/* ------------------------------------------------------------------ *
 * blur gating
 * ------------------------------------------------------------------ */

// The board only carries `.live` (and therefore backdrop-filter) while it is
// actually on screen. Off screen, the compositor stops re-filtering the region
// on every video frame.
const board = document.querySelector('.board')
const showSection = document.querySelector('#showcase')

if (board && showSection) {
	if ('IntersectionObserver' in window) {
		new IntersectionObserver(
			(entries) => {
				for (const en of entries) board.classList.toggle('live', en.isIntersecting)
			},
			{ threshold: 0.01, rootMargin: '200px 0px' },
		).observe(showSection)
	} else {
		board.classList.add('live')
	}
}

/* ------------------------------------------------------------------ *
 * nav
 * ------------------------------------------------------------------ */

// Two pieces of state: `stuck` (capsule + frost, once the hero is past) and a
// scroll-progress hairline. The stuck flag uses a sentinel because it changes
// far less often than scroll fires; the hairline needs the actual position, so
// it reads scroll but coalesces to one write per frame.
const nav = document.querySelector('.nav')
if (nav) {
	const sentinel = document.createElement('div')
	sentinel.style.cssText =
		'position:absolute;top:0;left:0;width:1px;height:80vh;pointer-events:none'
	document.body.prepend(sentinel)

	if ('IntersectionObserver' in window) {
		new IntersectionObserver(([en]) => nav.classList.toggle('stuck', !en.isIntersecting), {
			threshold: 0,
		}).observe(sentinel)
	}

	const prog = nav.querySelector('.nav__prog')
	if (prog) {
		let queued = false

		const paint = () => {
			queued = false
			const max = document.documentElement.scrollHeight - window.innerHeight
			const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
			prog.style.setProperty('--p', p.toFixed(4))
		}

		window.addEventListener(
			'scroll',
			() => {
				if (queued) return
				queued = true
				requestAnimationFrame(paint)
			},
			{ passive: true },
		)
		paint()
	}
}

/* ------------------------------------------------------------------ *
 * specimens
 * ------------------------------------------------------------------ */

// Presets are attached per component in the markup (data-preset), so all seven
// run at once against the same backdrop. Nothing here switches presets; this
// section only makes the components behave like the real controls they imitate.

const EASE_MS = 550

/**
 * Single-selection group with one shared indicator that slides between items.
 * Moving one element is a single composited transform; animating each item's
 * own background would repaint every item on every change.
 */
function segmented(container) {
	const sel = container.getAttribute('data-seg')
	const items = [...container.querySelectorAll(sel)]
	if (!items.length) return

	const ind = document.createElement('span')
	ind.className = 'ind'
	container.prepend(ind)

	let active = items.find((i) => i.classList.contains('is-on')) || items[0]

	function place(el, animate) {
		const cr = container.getBoundingClientRect()
		const r = el.getBoundingClientRect()
		if (!r.width || !r.height) return

		if (!animate) ind.style.transition = 'none'
		ind.style.width = r.width + 'px'
		ind.style.height = r.height + 'px'
		// Absolute offsets are measured from the padding box, so the container's
		// own 1px border has to come out of the delta.
		const x = r.left - cr.left - container.clientLeft
		const y = r.top - cr.top - container.clientTop
		ind.style.transform = 'translate(' + x + 'px,' + y + 'px)'
		if (!animate) {
			// Force a reflow before restoring the transition, otherwise the jump
			// and the next move coalesce into one animated frame.
			void ind.offsetWidth
			ind.style.transition = ''
		}
	}

	for (const item of items) {
		item.addEventListener('click', () => {
			if (item === active) return
			active.classList.remove('is-on')
			item.classList.add('is-on')
			active = item
			place(item, !REDUCED)
		})
	}

	const reposition = () => place(active, false)
	reposition()

	// Web fonts and the responsive breakpoints both change item widths after
	// first paint, so re-measure instead of trusting the initial layout.
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(reposition)
	if ('ResizeObserver' in window) new ResizeObserver(reposition).observe(container)
	else window.addEventListener('resize', reposition, { passive: true })
}

for (const group of document.querySelectorAll('[data-seg]')) segmented(group)

/* ---------- command palette: real open / close ---------- */

const cmd = document.querySelector('.cmd')
if (cmd) {
	const bar = cmd.querySelector('.cmd__bar')

	const setOpen = (open) => {
		cmd.classList.toggle('is-open', open)
		if (bar) bar.setAttribute('aria-expanded', String(open))
	}

	if (bar) bar.addEventListener('click', () => setOpen(!cmd.classList.contains('is-open')))

	window.addEventListener('keydown', (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault()
			setOpen(!cmd.classList.contains('is-open'))
			if (bar) bar.focus()
		} else if (e.key === 'Escape' && cmd.classList.contains('is-open')) {
			setOpen(false)
		}
	})
}

/* ---------- popovers ---------- */

for (const trigger of document.querySelectorAll('[data-pop]')) {
	const wrap = trigger.closest('.agents__wrap')
	if (!wrap) continue

	const setOpen = (open) => {
		wrap.classList.toggle('is-open', open)
		trigger.setAttribute('aria-expanded', String(open))
	}

	trigger.addEventListener('click', (e) => {
		e.stopPropagation()
		setOpen(!wrap.classList.contains('is-open'))
	})

	// Click-away and Escape, same as a real menu.
	document.addEventListener('click', (e) => {
		if (wrap.classList.contains('is-open') && !wrap.contains(e.target)) setOpen(false)
	})
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') setOpen(false)
	})
}

/* ---------- pressed-state buttons ---------- */

for (const btn of document.querySelectorAll('[aria-pressed]')) {
	btn.addEventListener('click', () => {
		btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')
	})
}

/* ---------- switches ---------- */

for (const sw of document.querySelectorAll('[data-switch]')) {
	const flip = () => {
		sw.setAttribute('aria-checked', sw.getAttribute('aria-checked') === 'true' ? 'false' : 'true')
	}
	sw.addEventListener('click', flip)
	sw.addEventListener('keydown', (e) => {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault()
			flip()
		}
	})
}

/* ---------- slider ---------- */

const slider = document.querySelector('.slider')
if (slider) {
	let queued = false
	let pending = 58
	let settle = 0

	function paint() {
		queued = false
		slider.style.setProperty('--val', pending + '%')
		slider.setAttribute('aria-valuenow', String(Math.round(pending)))
	}

	function set(v) {
		pending = Math.max(0, Math.min(100, v))
		if (queued) return
		queued = true
		requestAnimationFrame(paint)
	}

	// Keyboard steps ease to the new value; a drag must track the pointer
	// exactly, so the easing class is removed while dragging.
	function eased(v) {
		if (!REDUCED) slider.classList.add('anim')
		set(v)
		clearTimeout(settle)
		settle = setTimeout(() => slider.classList.remove('anim'), EASE_MS)
	}

	function fromEvent(e) {
		const r = slider.getBoundingClientRect()
		if (r.width === 0) return
		set(((e.clientX - r.left) / r.width) * 100)
	}

	slider.addEventListener('pointerdown', (e) => {
		slider.classList.remove('anim')
		slider.setPointerCapture(e.pointerId)
		fromEvent(e)
	})
	slider.addEventListener('pointermove', (e) => {
		if (slider.hasPointerCapture(e.pointerId)) fromEvent(e)
	})
	slider.addEventListener('keydown', (e) => {
		const step = e.shiftKey ? 10 : 2
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
			e.preventDefault()
			eased(pending + step)
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
			e.preventDefault()
			eased(pending - step)
		} else if (e.key === 'Home') {
			e.preventDefault()
			eased(0)
		} else if (e.key === 'End') {
			e.preventDefault()
			eased(100)
		}
	})

	paint()
}

/* ---------- scrolling buttons ---------- */

// Scroll animation is routed through Lenis: see scrollToTop / scrollToEl.

const disc = document.querySelector('.disc')
if (disc) {
	disc.addEventListener('click', () => {
		// The arrow flies off first, then the page follows.
		disc.classList.add('sent')
		setTimeout(() => disc.classList.remove('sent'), EASE_MS)
		scrollToTop()
	})
}

const explore = document.querySelector('.explore')
if (explore) {
	explore.addEventListener('click', () => {
		const target = document.querySelector('#how')
		if (target) scrollToEl(target)
	})
}

/* ------------------------------------------------------------------ *
 * load reveal
 * ------------------------------------------------------------------ */

// Waits for layout to be trustworthy (load + web fonts) so nothing shifts
// mid-animation, but never longer than the cap: the hero video is several
// megabytes and must not be allowed to hold the page behind the curtain.
const root = document.documentElement

// On reload the browser restores your previous scroll position. That lands
// you mid-page behind the curtain, so the hero plays its entrance off screen
// and what you actually see is a half-finished page snapping into place.
// Pinning reloads to the top makes the reveal play where it was designed to.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

if (root.classList.contains('js-anim')) {
	let revealed = false

	const reveal = () => {
		if (revealed) return
		revealed = true

		// Belt and braces: if anything restored scroll anyway, correct it
		// while the curtain is still opaque rather than after it lifts.
		window.scrollTo(0, 0)
		root.classList.add('revealed')

		// Drop the curtain from the DOM once it has faded, so it stops
		// costing a full-viewport compositor layer for the rest of the visit.
		const curtain = document.querySelector('.boot')
		if (curtain) {
			const drop = () => curtain.remove()
			curtain.addEventListener('transitionend', drop, { once: true })
			setTimeout(drop, 1400)
		}
	}

	const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
	const afterLoad = () => fonts.then(reveal).catch(reveal)

	if (document.readyState === 'complete') afterLoad()
	else window.addEventListener('load', afterLoad, { once: true })

	setTimeout(reveal, 1800)
}

/* ------------------------------------------------------------------ *
 * smooth scroll
 * ------------------------------------------------------------------ */

// Lenis interpolates the real document scroll position, so position: sticky
// and position: fixed keep working — which matters here, because the
// showcase backdrop is sticky and the nav is fixed.
//
// Skipped entirely under prefers-reduced-motion: easing the scroll is
// exactly the kind of motion that setting asks us not to add.
let lenis = null

if (!REDUCED) {
	lenis = new Lenis({
		// Long enough to feel eased, short enough that the page still feels
		// under your hand rather than gliding on after you stop.
		// lerp, not duration: a duration restarts a fixed-length animation on
		// every wheel tick and they queue up behind each other, which is what
		// reads as lag. A lerp is a framerate-independent catch-up toward the
		// live scroll target, so the page keeps up with the pointer.
		lerp: 0.12,
		// Cubic ease-out: fast pickup, long settle, no overshoot.
		easing: (t) => 1 - Math.pow(1 - t, 3),
		smoothWheel: true,
		// Touch devices already have native momentum; doubling it feels laggy.
		syncTouch: false,
	})

	const frame = (time) => {
		lenis.raf(time)
		requestAnimationFrame(frame)
	}
	requestAnimationFrame(frame)

	// Delegated so it covers the nav links, the hero buttons and anything
	// added later. Without this, in-page anchors jump instantly while the
	// wheel eases, which reads as a bug.
	document.addEventListener('click', (e) => {
		const link = e.target.closest && e.target.closest('a[href^="#"]')
		if (!link) return

		const id = link.getAttribute('href')
		if (!id || id === '#') return

		const target = document.querySelector(id)
		if (!target) return

		e.preventDefault()
		scrollToEl(target)
	})
}

// Hoisted, so the handlers defined earlier in this file can call them.
// They only ever run on click, long after this module has evaluated.
function scrollToTop() {
	if (lenis) lenis.scrollTo(0, { duration: 0.9 })
	else window.scrollTo({ top: 0 })
}

function scrollToEl(el) {
	// Clear the fixed nav so the target heading is not hidden under it.
	const offset = -84
	if (lenis) lenis.scrollTo(el, { offset, duration: 0.9 })
	else el.scrollIntoView({ block: 'start' })
}

/* ---------- github star count ---------- */
// Progressive enhancement: the link works with or without this. The count is
// revealed only if GitHub actually answers, so a rate limit or offline visit
// leaves the button looking deliberate rather than broken. Unauthenticated API
// is 60 requests/hour per IP, so the answer is cached for the session instead
// of refetched on every navigation.
;(() => {
	const slots = document.querySelectorAll('[data-star-count]')
	const meter = document.querySelector('[data-star-meter]')
	const fill = document.querySelector('[data-star-fill]')
	const GOAL = 100
	if (!slots.length) return

	const KEY = 'liquidglass.stars'

	// sessionStorage throws in some privacy modes - never let that break the page.
	const read = () => {
		try {
			return sessionStorage.getItem(KEY)
		} catch {
			return null
		}
	}
	const write = (v) => {
		try {
			sessionStorage.setItem(KEY, v)
		} catch {}
	}

	const show = (n) => {
		if (!Number.isFinite(n) || n <= 0) return
		const label = n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
		for (const s of slots) {
			s.textContent = label
			s.hidden = false
		}
		// Goal-gradient effect: a specific, visibly-close target converts far
		// better than an open-ended ask. Clamped so passing 100 never draws a
		// bar wider than its rail.
		if (fill) fill.style.width = Math.min(100, (n / GOAL) * 100) + '%'
		if (meter) meter.hidden = false
	}

	const cached = read()
	if (cached !== null) {
		show(Number(cached))
		return
	}

	fetch('https://api.github.com/repos/Miftahul-Islam-Efaz/LIQUID-GLASS', {
		headers: { Accept: 'application/vnd.github+json' },
	})
		.then((r) => (r.ok ? r.json() : null))
		.then((d) => {
			if (!d || typeof d.stargazers_count !== 'number') return
			write(String(d.stargazers_count))
			show(d.stargazers_count)
		})
		.catch(() => {})
})()
