'use client';
/**
 * React timeline-editor building blocks on top of `opus-motion-library/web`:
 *   - <ClipThumb>  one motion at an exact frame (inspector / clip thumbnail)
 *   - <Preview>    the whole timeline (clips = layers) with play / pause / scrub, playhead kept in sync
 *   - sequence()   the same clips as a multi-scene Compose spec with transitions (for MotionMix `spec` and `/api/render`)
 *   - renderOnServer()  POST the identical layers to `mgl serve` and get an mp4 back
 *
 * Peer deps as in docs/INTEGRATION.md (react, remotion, @remotion/player, …). Typechecked against src/lib-web.ts.
 */
import {useCallback, useRef, useState} from 'react';
import type {PlayerRef} from '@remotion/player';
import {MotionMix, MotionPlayer, type MixLayer, type MixSpec} from 'opus-motion-library/web';

export const FPS = 30;

/** a clip on the timeline: a MixLayer (motion, props, from, duration, opacity, blend, …) plus editor-only fields */
export type Clip = MixLayer & {id: string; track: number};

/** clips -> layers, bottom track first (a higher track number paints on top) */
export const toLayers = (clips: Clip[]): MixLayer[] =>
  [...clips].sort((a, b) => a.track - b.track).map(({id: _id, track: _track, ...layer}) => layer);

export const totalFrames = (clips: Clip[]) => Math.max(30, ...clips.map((c) => (c.from ?? 0) + (c.duration ?? 90)));

/** one motion at one frame: re-renders whenever `frame` changes, never plays on its own */
export const ClipThumb = ({clip, frame}: {clip: Clip; frame: number}) => (
  <MotionPlayer motion={clip.motion} props={clip.props} overlay={false} format="landscape" loop="once" frame={frame} style={{width: 160}} />
);

/** the whole timeline in one player; `frame` is the playhead, `onFrame` reports it while playing */
export function Preview({clips, frame, onFrame, width = 1920, height = 1080}: {clips: Clip[]; frame: number; onFrame: (f: number) => void; width?: number; height?: number}) {
  const player = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const p = player.current;
    if (!p) return;
    if (p.isPlaying()) {
      p.pause();
      setPlaying(false);
    } else {
      p.play();
      setPlaying(true);
    }
  }, []);

  return (
    <div>
      <MotionMix
        layers={toLayers(clips)}
        width={width}
        height={height}
        fps={FPS}
        durationInFrames={totalFrames(clips)}
        loop="once"
        frame={frame}            // controlled: seeks when it changes while paused
        onFrame={onFrame}        // fires every frame while playing and on every seek
        onEnded={() => setPlaying(false)}
        playerRef={player}       // Remotion PlayerRef: play(), pause(), seekTo(), getCurrentFrame(), …
        assetBase="/opus"        // where the library's public/ folder is served
      />
      <button onClick={toggle}>{playing ? 'Pause' : 'Play'}</button>
      <input type="range" min={0} max={totalFrames(clips) - 1} value={frame} onChange={(e) => {
        player.current?.pause();
        setPlaying(false);
        onFrame(Number(e.target.value)); // parent state -> `frame` prop -> seekTo
      }} />
    </div>
  );
}

/** the same clips played back to back with transitions: a Compose spec (MotionMix `spec`, mgl compose, POST /api/render) */
export const sequence = (clips: Clip[], transition: {type: string; frames?: number} = {type: 'fade', frames: 12}): MixSpec => ({
  width: 1920,
  height: 1080,
  fps: FPS,
  scenes: [...clips].sort((a, b) => (a.from ?? 0) - (b.from ?? 0)).map((c, i, all) => ({
    motion: c.motion,
    props: c.props,
    duration: c.duration,
    ...(i < all.length - 1 ? {transition} : {}),
  })),
});

/** export: the server renders exactly what the player shows */
export async function renderOnServer(clips: Clip[], base = 'http://127.0.0.1:4321') {
  const res = await fetch(`${base}/api/render?wait=1`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({layers: toLayers(clips), frames: totalFrames(clips), format: 'mp4', aspect: 'landscape'}),
  });
  const job = await res.json();
  if (job.status !== 'done') throw new Error(job.error ?? job.status);
  return `${base}${job.output.url}`; // <a href download> / <video src>
}

/** the usual wiring in an editor page */
export function Editor({initial}: {initial: Clip[]}) {
  const [clips] = useState(initial);
  const [frame, setFrame] = useState(0);
  return (
    <>
      <Preview clips={clips} frame={frame} onFrame={setFrame} />
      <ClipThumb clip={clips[0]} frame={frame - (clips[0].from ?? 0)} />
    </>
  );
}
