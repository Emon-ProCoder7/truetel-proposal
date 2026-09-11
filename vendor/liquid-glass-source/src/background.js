// Background image source: the bundled default, an uploaded file, a dropped
// file, or a pasted image. The renderer only ever sees a decoded HTMLImage,
// so nothing else in the app needs to know where the pixels came from.

const $ = (id) => document.getElementById(id)

export function initBackground({ renderer, defaultUrl, onReady }) {
	const input = $('bgfile')
	const reset = $('bgreset')
	const msg = $('bgmsg')
	const stage = $('stage')

	let blobUrl = null

	function say(text, bad = false) {
		if (!msg) return
		msg.textContent = text
		msg.classList.toggle('bad', bad)
	}

	function release() {
		if (blobUrl) URL.revokeObjectURL(blobUrl)
		blobUrl = null
	}

	// Loads a URL, swaps it in only after decode so a bad file never blanks
	// the canvas that is already on screen.
	function load(url, label, isBlob) {
		const img = new Image()
		img.onload = () => {
			if (isBlob) {
				release()
				blobUrl = url
			}
			renderer.setBackground(img)
			renderer.invalidate()
			say(label ? `${label} — ${img.naturalWidth}\u00d7${img.naturalHeight}` : '')
			if (reset) reset.disabled = !isBlob
			onReady?.(img)
		}
		img.onerror = () => {
			if (isBlob) URL.revokeObjectURL(url)
			say('That image could not be decoded', true)
		}
		img.src = url
	}

	function useFile(file) {
		if (!file) return
		if (!file.type.startsWith('image/')) {
			say('That file is not an image', true)
			return
		}
		load(URL.createObjectURL(file), file.name, true)
	}

	input?.addEventListener('change', () => {
		useFile(input.files?.[0])
		input.value = '' // allow re-picking the same file
	})

	reset?.addEventListener('click', () => {
		release()
		load(defaultUrl, '', false)
	})
	if (reset) reset.disabled = true

	// Drop an image anywhere on the canvas.
	if (stage) {
		const stop = (e) => {
			e.preventDefault()
			e.stopPropagation()
		}
		stage.addEventListener('dragover', (e) => {
			stop(e)
			stage.classList.add('dropping')
		})
		stage.addEventListener('dragleave', () => stage.classList.remove('dropping'))
		stage.addEventListener('drop', (e) => {
			stop(e)
			stage.classList.remove('dropping')
			useFile(e.dataTransfer?.files?.[0])
		})
	}

	// Paste an image from the clipboard, unless a text box has focus.
	window.addEventListener('paste', (e) => {
		const t = e.target
		if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
		const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
		if (!item) return
		useFile(item.getAsFile())
	})

	return { load: useFile }
}
