import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Two entries:
//   index.html -> the marketing landing page (src/landing.js)
//   app.html   -> the editor itself (src/main.js)
//
// The editor used to live at index.html. It moved to app.html so that "/" can
// be a real landing page, which is what both search engines and first-time
// visitors expect at the root of a domain.
export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, 'index.html'),
				app: resolve(__dirname, 'app.html'),
			},
		},
	},
})
