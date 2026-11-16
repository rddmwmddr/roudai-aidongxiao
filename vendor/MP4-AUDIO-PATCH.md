# Local mp4-muxer extension

The existing bundled MIT-licensed mp4-muxer retains its upstream license. A local optional AAC priming extension adds `audio.encoderDelaySamples` and `audio.presentationDuration`. When set, an ISO BMFF `edts/elst` record skips encoder priming in media time, and movie/track presentation duration follows the intended timeline rather than codec padding. The media header retains the complete encoded sample duration. When unset, the old video-only and audio behavior is unchanged.

`DM.Audio.encoderDelay()` measures the local AAC encoder with an offline impulse and the local decoder once per renderer instance. No fixed 44 ms constant is assumed. Backpressure waits on dequeue and never flushes mid-stream, so encoder priming is introduced only once. Tests decode the actual exported AAC and measure onset alignment, hold silence and duration.
