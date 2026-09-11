// Height-field builder, off the main thread.
//
// Measured on the shipped pipeline (bench, 313x296 default shape):
//   scale 1, 3 passes  ->  41.9 ms   (drag)
//   scale 4, 8 passes  -> 829.6 ms   (release commit)
// One frame at 60fps is 16.7 ms, so neither fits. Trimming taps, resolution
// and pass counts moved the number but never below the budget - the work is
// simply too big for a frame. Running it here means the slider never waits on
// it: the main thread only uploads the finished buffer.
import { buildGlassField } from './sdf.js'

self.onmessage = (e) => {
	const { seq, warm, args } = e.data

	const f = buildGlassField(args)

	if (warm) {
		// Prewarm only: the point was to fill this worker's prepare() cache slot
		// (rasterise + getImageData + EDT + allocations) so the first real drag
		// frame skips it. Nothing to upload.
		self.postMessage({ seq, warm: true })
		return
	}

	// buildGlassField returns a CACHED buffer that it overwrites on the next
	// build. Transferring that buffer would detach the cache and force a fresh
	// allocation every time, so hand over a copy instead.
	const data = f.data.slice()

	self.postMessage(
		{
			seq,
			warm: false,
			width: f.width,
			height: f.height,
			pad: f.pad,
			float32: f.float32,
			// Echoed so the renderer sets fieldPad and fieldScale from the SAME
			// build. They are used together as (fieldPad / fieldScale); taking one
			// from an in-flight request and the other from the texture on screen
			// would misplace the field rect for a frame.
			scale: args.scale,
			data,
		},
		[data.buffer],
	)
}
