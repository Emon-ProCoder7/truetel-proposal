// The star ask, shown at the one moment it reads as fair: right after the user
// has actually taken something away (a copied config, or a copied prompt).
//
// Shown ONCE EVER per browser, not once per session. The flag lives in
// localStorage so it survives reloads, new tabs and closing the browser. A
// second ask after the first has been ignored is what turns a polite request
// into nagging, so there is deliberately no re-show and no expiry.
//
// Styles live in style.css under "star nudge" (.nudge / .nudge.in).

const KEY = 'liquidglass.starnudge.v1'
const REPO = 'https://github.com/Miftahul-Islam-Efaz/LIQUID-GLASS'

// localStorage throws in private mode and sandboxed iframes. If we cannot
// remember, we fall back to once per page load rather than asking repeatedly.
let shownThisLoad = false

function alreadyShown() {
	try {
		return localStorage.getItem(KEY) === '1'
	} catch {
		return shownThisLoad
	}
}

function remember() {
	try {
		localStorage.setItem(KEY, '1')
	} catch {
		/* ignore — shownThisLoad already covers this page load */
	}
}

/**
 * Show the star nudge once, ever.
 *
 * @param {string} [lead] what the user just took, e.g. 'Config copied.'
 * @returns {boolean} true if it was shown on this call
 */
export function starNudge(lead = 'Copied.') {
	if (alreadyShown()) return false
	shownThisLoad = true
	remember()

	const el = document.createElement('div')
	el.className = 'nudge'
	el.setAttribute('role', 'status')

	const p = document.createElement('p')
	p.append(document.createTextNode(lead + ' This is free and open source — '))
	const a = document.createElement('a')
	a.href = REPO
	a.target = '_blank'
	a.rel = 'noopener'
	a.textContent = 'a star on GitHub'
	p.append(a, document.createTextNode(' is the only thanks I need.'))

	const x = document.createElement('button')
	x.type = 'button'
	x.setAttribute('aria-label', 'Dismiss')
	x.textContent = '\u00d7'

	el.append(p, x)
	document.body.appendChild(el)

	// Two frames: one to get it into the layout, one so the transition has a
	// start value to animate from.
	requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')))

	let done = false
	const close = () => {
		if (done) return
		done = true
		el.classList.remove('in')
		setTimeout(() => el.remove(), 400)
	}
	x.addEventListener('click', close)
	a.addEventListener('click', close)
	setTimeout(close, 9000)

	return true
}
