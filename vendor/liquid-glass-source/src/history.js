// Undo / redo over state snapshots. One entry per completed gesture, not per
// pixel of slider travel, which is why callers push on `change`, not `input`.

import { snapshot, restoreSnapshot } from './state.js'
import { bus } from './bus.js'

const LIMIT = 100

let stack = [snapshot()]
let cursor = 0

function announce() {
	bus.emit('history', { canUndo: cursor > 0, canRedo: cursor < stack.length - 1 })
}

export function push() {
	const snap = snapshot()
	if (snap === stack[cursor]) return
	stack = stack.slice(0, cursor + 1)
	stack.push(snap)
	if (stack.length > LIMIT) stack.shift()
	cursor = stack.length - 1
	announce()
}

export function undo() {
	if (cursor <= 0) return
	cursor--
	restoreSnapshot(stack[cursor])
	announce()
}

export function redo() {
	if (cursor >= stack.length - 1) return
	cursor++
	restoreSnapshot(stack[cursor])
	announce()
}

export function state() {
	return { canUndo: cursor > 0, canRedo: cursor < stack.length - 1 }
}

// Coalesced push, for keyboard nudges and other rapid-fire edits.
let timer = 0
export function pushSoon(ms = 400) {
	clearTimeout(timer)
	timer = setTimeout(push, ms)
}

export function initHistoryKeys() {
	window.addEventListener('keydown', (e) => {
		if (!(e.ctrlKey || e.metaKey)) return
		const k = e.key.toLowerCase()
		if (k === 'z') {
			e.preventDefault()
			if (e.shiftKey) redo()
			else undo()
		} else if (k === 'y') {
			e.preventDefault()
			redo()
		}
	})
	announce()
}
