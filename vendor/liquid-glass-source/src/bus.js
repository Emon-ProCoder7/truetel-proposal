// Minimal event bus. The modules never import each other's internals; they
// only announce what changed, which is what keeps the render loop lazy.
//
// Events:
//   'render' - the picture changed, redraw on the next frame
//   'field'  - the PATH changed, the height field must be rebuilt
//   'ui'     - state changed programmatically, resync the panel + overlay

const listeners = new Map()

export const bus = {
	on(event, fn) {
		if (!listeners.has(event)) listeners.set(event, new Set())
		listeners.get(event).add(fn)
		return () => listeners.get(event).delete(fn)
	},
	emit(event, arg) {
		const set = listeners.get(event)
		if (!set) return
		for (const fn of set) fn(arg)
	},
}

// Shorthands used everywhere.
export const needsRender = () => bus.emit('render')
export const needsField = () => bus.emit('field')
export const needsUI = () => bus.emit('ui')
