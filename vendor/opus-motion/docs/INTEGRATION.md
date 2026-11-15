# Integration — using the motions in other projects

Pick the section for the host's stack. All paths below assume the library lives at `<lib>` (copied, git submodule,
or a sibling folder) and that you ran `npm install` there once.

| stack | best path | alternative |
|---|---|---|
| Remotion video project | `mgl add` (copy source) | render clips here, use as `<OffthreadVideo>` |
| Next.js App Router | `mgl add --player` (copy source) | built package (`npm run build:lib`, then install) |
| Vite / CRA / React SPA | built package `opus-motion-library/web` | `mgl add --player` |
| Plain HTML, WordPress, Vue, Svelte, Astro, Webflow | `<opus-motion>` custom element | exported `webm`/`mp4` in `<video>` |
| React Native, Flutter, iOS, Android | `mgl export` → mp4 / webm-alpha / png | Lottie is not supported |
| Keynote, PowerPoint, Premiere, Resolve, CapCut | `mgl export --as prores-alpha` / `mp4` | `--as png` sequence |
| **Video-editor website** (timeline, drop-in motions) | [§ Video editors](#video-editor-websites--timeline-uis): `<opus-motion>` / React `MotionMix` with `frame`, `props-schema.json`, `mgl serve` | `MotionPlayer` per clip |
| Any backend, language or no-code tool | `mgl serve` HTTP API ([HTTP_API.md](HTTP_API.md)) | `mgl export`, MCP |

**Assets.** Motions load images with Remotion's `staticFile()`: a path like `"demo/owl.jpg"` becomes
`/demo/owl.jpg` on the host's web root. Either (a) serve the needed files from the library's `public/` folder at the
host's web root (copy them into the host's `public/`; `mgl add` does this for files referenced by defaults / recipes),
(b) set a base: `assetBase="/opus"` on the players / `asset-base="/opus"` on the element (sets
`window.remotion_staticBase`), or (c) pass absolute URLs (`https://…`, `data:`, `blob:`) as `src` — they are used as is.
Fonts load from Google Fonts at runtime via `@remotion/google-fonts` (needs network access to fonts.gstatic.com;
without it the browser falls back to system fonts).

**Licence.** Remotion is source-available; companies above the free tier need a company licence
(https://remotion.dev/license). Once settled pass `acknowledgeRemotionLicense` to silence the console note.

---

## Use it anywhere: copy-paste matrix

Library at `<lib>`; run `npm install` there once (and `npm run build:lib` for the browser paths).

**Video-editor website** (users drop motions on a timeline, preview live, export mp4)
```html
<script src="https://cdn.jsdelivr.net/npm/opus-motion-library@1.1.0/dist/opus-motion.element.js" defer></script>  <!-- or your own copy of dist/, see "One script tag" -->
<opus-motion id="pv" layers='[{"motion":"aurora"},{"motion":"blur-in-title","props":{"title":"Hello"},"from":30,"duration":150}]'
  duration="240" frame="0" autoplay="false" play-on-view="false" loop="false"></opus-motion>
<script>pv.setAttribute('frame', 90); /* scrub */ pv.play(); pv.pause(); pv.addEventListener('opus-frame', (e) => e.detail.frame);</script>
<!-- property panel: GET /api/motions/<id>/schema or props-schema.json · export: POST /api/render {layers, frames} · full recipe below -->
```

**Remotion video project**
```bash
node <lib>/cli/mgl.mjs suggest "launch video for a fintech app"
node <lib>/cli/mgl.mjs add product-launch number-counter --to ../my-video/src    # then <Composition component={productLaunchRecipe.component} …/>
```

**React / Next.js / Vite**
```tsx
import {MotionBackground, MotionPlayer} from 'opus-motion-library/web';   // 'use client' in Next.js
<MotionBackground recipe="hero-aurora-night" scrim="linear-gradient(#0000 40%, #000c)" style={{minHeight: '90vh'}}><h1>Headline</h1></MotionBackground>
<MotionPlayer motion="number-counter" playOnView loop="once" props={{label: 'USERS', unit: '', readouts: [], keyframes: [[0, 0], [90, 48210]]}} />
```

**Plain HTML, WordPress, Webflow, Squarespace (custom code / embed)**
```html
<script src="https://cdn.jsdelivr.net/npm/opus-motion-library@1.1.0/dist/opus-motion.element.js" defer></script>
<opus-motion recipe="hero-aurora-night" background></opus-motion>
<opus-motion motion="neon-sign" props='{"lines":[{"text":"OPEN LATE"}]}' loop="crossfade"></opus-motion>
```

**Native apps** (iOS, Android, Flutter, React Native) and **slides / editors** (Keynote, PowerPoint, Premiere, Resolve, CapCut)
```bash
node <lib>/cli/mgl.mjs export hero-aurora-night --as mp4 --format portrait       # plays everywhere
node <lib>/cli/mgl.mjs export confetti-burst --as prores-alpha                   # overlay with alpha: editors, Keynote, iOS
node <lib>/cli/mgl.mjs export confetti-burst --as webm-alpha                     # overlay with alpha: Android, web, Flutter
```

**AI agents (MCP)**
```bash
claude mcp add opus-motion -- node /abs/path/to/<lib>/mcp/server.mjs        # Claude Code; other clients: AGENTS.md § MCP
# tools: search_motions → get_motion → preview → render / export / add_to_project
node <lib>/cli/mgl.mjs suggest "dark hero with a stats section" --json        # no MCP: same ranking from the CLI
```

**HTTP API** (any language, a backend, no-code automation, a hosted render service)
```bash
node <lib>/cli/mgl.mjs serve &                                                # http://127.0.0.1:4321 · Docker + auth: HTTP_API.md
curl -s localhost:4321/api/motions/number-counter/schema                      # props JSON Schema for a property panel
curl -s -X POST 'localhost:4321/api/render?wait=1' -H 'content-type: application/json' -d '{"motion":"number-counter","props":{"label":"USERS"},"frames":90}'
curl -s -o out.mp4 localhost:4321/api/jobs/<id>/file
```

---

## Video-editor websites / timeline UIs

An online editor needs five things; the library has all of them:

| editor feature | how |
|---|---|
| **Browse / search motions** | `GET /api/motions?q=&category=` and `/api/suggest?q=` on `mgl serve`, or the static `catalog.json` (`opus-motion-library/catalog.json`); thumbnails `gallery/<id>.jpg` (`/api/motions/:id/preview`) |
| **Property panel** | one JSON Schema per motion: `props-schema.json`, `GET /api/motions/:id/schema` or `mgl schema <id>` (types, defaults, enums, `x-opus-widget` = text / color / image / number / toggle / select / list / json; `x-opus-text` marks the words to replace) |
| **Live preview at a frame, scrubbing, playback** | `frame` + `onFrame` + `playerRef` on `MotionPlayer` / `MotionMix`; the `frame` attribute, `seekTo()`, `play()`, `pause()` and the `opus-frame` event on `<opus-motion>` |
| **Multi-clip timeline** | clips become `layers` (`from`, `duration`, `offset`, `opacity`, `blend`, `scale`, `x`, `y`; later = on top) or a **Compose spec** (scenes back to back with `transition`s, `overlays`, `captions`, `audio`) |
| **Export** | `POST /api/render` with the same `layers` / `spec` gives mp4, webm(-alpha), ProRes, GIF or PNG; progress on `GET /api/jobs/:id` |

A working editor in one HTML file (multi-track timeline, drag clips, schema-driven inspector, play / scrub, "Render mp4"):
`examples/timeline-editor/index.html` (`npm run build:lib && node examples/serve.mjs`, open `/examples/timeline-editor/`; run `node cli/mgl.mjs serve` too for export).
React building blocks (typechecked against the source): `examples/timeline-editor/TimelineEditor.tsx`.

**React: one motion at an exact frame** (clip thumbnail, inspector)
```tsx
import {MotionPlayer} from 'opus-motion-library/web';
<MotionPlayer motion="blur-in-title" props={{title: 'Hello'}} loop="once" frame={clipFrame} style={{width: 160}} />
// `frame` is controlled: change it to scrub. The player does not autoplay, mounts immediately (no lazy load, no reduced-motion still).
```

**React: the whole timeline with play / pause / scrub and the playhead in sync**
```tsx
import {useRef, useState} from 'react';
import type {PlayerRef} from '@remotion/player';
import {MotionMix, type MixLayer} from 'opus-motion-library/web';

const layers: MixLayer[] = clips.map((c) => ({motion: c.motion, props: c.props, from: c.start, duration: c.length})); // bottom track first
const player = useRef<PlayerRef>(null);
const [frame, setFrame] = useState(0);

<MotionMix layers={layers} width={1920} height={1080} fps={30} durationInFrames={totalFrames} loop="once"
  frame={frame} onFrame={setFrame} playerRef={player} assetBase="/opus" />
// play: player.current.play()   pause: player.current.pause()   scrub: player.current.pause(); setFrame(n)
```
`onFrame` fires on every frame while playing and on every seek; `frame` only seeks while paused, so feeding one into the other is safe.
`playerRef` is Remotion's `PlayerRef` (`play`, `pause`, `seekTo`, `getCurrentFrame`, `isPlaying`, `toggle`, `addEventListener`, …).

**Composing several motions: layers or a Compose spec**
```jsonc
// A) layers: tracks over time, everything in one shot (what the timeline editor sends)
{"layers": [
  {"motion": "aurora", "props": {"pixelSize": 0}, "from": 0, "duration": 300},
  {"motion": "blur-in-title", "props": {"backdrop": "none", "background": "transparent", "title": "Hello"}, "from": 30, "duration": 210},
  {"motion": "confetti-burst", "props": {"background": "transparent", "showSubject": false}, "from": 150, "duration": 100, "opacity": 0.8, "blend": "screen"}
], "frames": 300}

// B) Compose spec: scenes back to back with transitions (types: GET /api/transitions), global overlays, captions, audio
{"spec": {"width": 1920, "height": 1080, "fps": 30, "scenes": [
  {"motion": "blur-in-title", "props": {"title": "One"}, "duration": 90, "transition": {"type": "fade", "frames": 12}},
  {"layers": [{"motion": "aurora"}, {"motion": "number-counter", "props": {"label": "USERS", "unit": "", "readouts": []}, "from": 10}], "duration": 120}
], "overlays": [{"motion": "film-look", "from": 0, "duration": 198, "props": {"overlay": true}}]}}
```
Both work the same in the browser (`<MotionMix layers={…} />`, `<MotionMix spec={…} />`, JSON in `<opus-motion layers="…">`) and on the server
(`POST /api/render {layers, frames}` or `{spec}`, `mgl compose spec.json`). Layers above the bottom one should be overlay-capable
(`catalog.json` → `overlay`; merge the motion's `overlayProps`, as the example does) so they do not hide what is below. Put the user's colours, words and
images into the clip `props` using the `textProps` / `colorProps` / `imageProps` names (the schema's `x-opus-*` hints say which is which).

**Vanilla JS / Vue / Svelte timeline:** `<opus-motion>` has `el.seekTo(frame)`, `el.play()`, `el.pause()`, `el.getCurrentFrame()`, `el.player` (the `PlayerRef`),
the `opus-frame` event (`detail.frame`) and `frame="45"` (change it to scrub). Set the `layers` / `props` / `duration` attributes to re-render.
Keep `autoplay="false" play-on-view="false" loop="false"` for editor previews.

**One frame from the server** (no browser player): `POST /api/render {"motion": …, "props": …, "format": "poster", "frame": 45}` returns a PNG.

---

## One script tag from a CDN (`<opus-motion>`)

The element is one self-contained file (`dist/opus-motion.element.js`, about 9 MB / 3 MB gzip: every motion plus React and Remotion).
`dist/` is gitignored, so where it is hosted matters:

| source | URL | status |
|---|---|---|
| **your own build** | `npm run build:lib`, then copy `dist/opus-motion.element.js`; `mgl serve` also serves it at `/dist/opus-motion.element.js` | always works |
| **GitHub Pages** (CI copies it next to the showcase site on every push to `main`) | `https://govindusasanka.github.io/opus-motion-library/opus-motion.element.js` | live after the next push of `main` (workflow updated; 404 before) |
| **npm + jsDelivr / unpkg** | `https://cdn.jsdelivr.net/npm/opus-motion-library@1.1.0/dist/opus-motion.element.js` (`package.json` sets `jsdelivr` / `unpkg`, so `…/npm/opus-motion-library@1.1.0` resolves to it too) | **needs `npm publish`** by the owner (npm shows 404 today) |
| jsDelivr from GitHub (`/gh/GovinduSasanka/opus-motion-library@v1.1.0/dist/…`) | | does **not** work: `dist/` is not committed (404). Repo files do work: `catalog.json`, `props-schema.json`, `recipes/*.json`, `gallery/*.jpg`, `public/demo/*` |

```html
<script src="https://cdn.jsdelivr.net/npm/opus-motion-library@1.1.0/dist/opus-motion.element.js" defer></script>
<opus-motion motion="aurora" asset-base="https://cdn.jsdelivr.net/gh/GovinduSasanka/opus-motion-library@main/public"></opus-motion>
```
`asset-base` is only needed for motions that load images from the library's `public/` folder (`demo/*.jpg`); jsDelivr's GitHub mirror serves them.
Pin a version (`@1.1.0`), never a floating tag, in production. For page weight prefer the React `/web` entry (one chunk per motion) or an exported mp4 / webm.

---

## Remotion video project

Copy only what you need (shadcn-style): esbuild traces the motion's local imports and copies them with the
library's folder structure, plus a registry that contains just those motions.

```bash
cd <lib>
node cli/mgl.mjs suggest "launch video for a fintech app"          # choose
node cli/mgl.mjs add product-launch number-counter --to ../my-video/src   # motions and/or recipes
```

It prints the `npm install …` line (pinned to the versions this library is tested with — Remotion packages must all
share one version), the `tsconfig` flags (`"jsx": "react-jsx"`, `"resolveJsonModule": true`) and a usage snippet:

```tsx
// my-video/src/Root.tsx
import {Composition} from 'remotion';
import {productLaunchRecipe, numberCounter} from './opus-motion';

export const RemotionRoot = () => (
  <>
    <Composition id="launch" component={productLaunchRecipe.component} width={1920} height={1080} fps={30}
      durationInFrames={productLaunchRecipe.durationInFrames} />
    <Composition id="stat" component={numberCounter.component} width={1080} height={1080} fps={30} durationInFrames={150}
      defaultProps={{...numberCounter.defaultProps, label: 'DOWNLOADS', unit: '', readouts: [], keyframes: [[0, 0], [90, 125000]]}} />
  </>
);
```

Use any copied motion as a plain component inside your own scenes: `<numberCounter.component {...numberCounter.defaultProps} label="…" />`
inside a `<Sequence>`. Mix with `LayersComp` / `DefLayers` from `./opus-motion` (copied when a layered recipe is added).
Re-run `mgl add` to update; edit the copied files freely. Worked example: `examples/remotion-project/`.

---

## Next.js (App Router)

The players are client components (they use `@remotion/player`, `IntersectionObserver`, `matchMedia`).

**Option A — copy source (most robust):**
```bash
node <lib>/cli/mgl.mjs add hero-aurora-night stats-reveal --player --to ./src --public ./public
npm install …   # the printed line (react-dom, remotion, @remotion/player, …)
```
```tsx
// src/components/Hero.tsx
'use client';
import {MotionBackground} from '@/opus-motion';

export function Hero() {
  return (
    <MotionBackground recipe="hero-aurora-night" scrim="linear-gradient(#0000 40%, #000c)" style={{minHeight: '90vh'}}>
      <h1>Your headline</h1>
    </MotionBackground>
  );
}
```
Then use `<Hero />` from any server component (page.tsx). `MotionBackground` drops the recipe's `type` layers so the
headline is real HTML.

**Option B — the built package:** in `<lib>` run `npm run build:lib && npm pack`, then in the app
`npm install <lib>/opus-motion-library-1.0.0.tgz` plus the peer dependencies (react, react-dom, remotion,
@remotion/player, @remotion/three, @remotion/transitions, @remotion/google-fonts, @remotion/noise, @remotion/paths,
@remotion/layout-utils, three, @react-three/fiber). `dist/*.js` already start with `"use client"`.
`import {MotionBackground} from 'opus-motion-library/web'`. No `transpilePackages` needed (it is plain ESM); if you
link the source instead (`file:` / workspace), add `transpilePackages: ['opus-motion-library']` and make sure only one
copy of React / Remotion is resolved (`npm ls react remotion`), e.g. with webpack `resolve.alias` /
`turbopack.resolveAlias` pointing `react`, `react-dom`, `remotion`, `@remotion/*` at the app's `node_modules`.

Assets: copy the library files you use into `public/` (Option A does it), or set `assetBase`.
SSR: the players render an empty sized box on the server and mount on the client — no hydration mismatch.

---

## Vite / CRA / any React app

```bash
cd <lib> && npm run build:lib
cd <app> && npm install <relative-path-to-lib>   # "opus-motion-library": "file:../opus-motion-library"
npm install react react-dom remotion@4.0.532 @remotion/player@4.0.532 @remotion/three@4.0.532 @remotion/transitions@4.0.532 \
  @remotion/google-fonts@4.0.532 @remotion/noise@4.0.532 @remotion/paths@4.0.532 @remotion/layout-utils@4.0.532 three@0.169.0 @react-three/fiber@9.1.2
```
With a `file:` link, dedupe the singletons (otherwise React / Remotion load twice and hooks fail):
```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {dedupe: ['react', 'react-dom', 'remotion', '@remotion/player', '@remotion/three', '@remotion/transitions',
    '@remotion/google-fonts', '@remotion/noise', '@remotion/paths', '@remotion/layout-utils', 'three', '@react-three/fiber']},
});
```
```tsx
import {MotionBackground, MotionPlayer, MotionMix} from 'opus-motion-library/web';   // code-split per motion
// import {…} from 'opus-motion-library'   // everything in one bundle + registry / Compose / helpers
```
Working example with screenshots: `examples/react-vite/`.

### Component reference

All three share: `format` (`landscape` 1920×1080 | `square` | `portrait`) or `width`/`height`, `fps`,
`durationInFrames`, `loop` (`true`/`'restart'`, `'crossfade'`, `'auto'`, `false`/`'once'`), `autoPlay`, `controls`,
`fit` (`contain` | `cover`), `playOnView`, `lazy` (default true), `respectReducedMotion` (default true), `stillFrame`,
`playbackRate`, `assetBase`, `placeholder`, `className`, `style`, `onEnded`.

- **`<MotionPlayer motion="id" props={…} overlay? background? />`** — one motion. `overlay` merges the motion's
  `overlayProps` (transparent background) so it can float over your UI. Default size: `width: 100%` with the format's
  aspect ratio; give it a height to `fit="cover"`.
- **`<MotionMix recipe="id" | layers={[…]} | spec={composeSpec} overrides={{motionId: props}} withText? />`** —
  several motions in one player (`layers` = bottom → top, same fields as Compose layers: `from`, `duration`,
  `offset`, `opacity`, `blend`, `scale`, `x`, `y`). `spec` plays a full multi-scene Compose spec with transitions.
- **`<MotionBackground …MotionMix or MotionPlayer props… scrim? as? contentStyle?>children</MotionBackground>`** —
  full-bleed `cover` player behind `children`, `pointer-events: none`, `aria-hidden`, plays on view, loops
  `auto`, and drops recipe layers with `role: "type"` unless `withText`.
- `useReducedMotion()`, `preloadMotions(ids)` (web entry), `createWebComponents(resolver)` for custom registries.

Not provided: a `MotionTransition` between two live React subtrees — rendering interactive host DOM inside a
scaled player is not reliable. For page transitions use a short `MotionPlayer` overlay (`loop="once"`, `overlay`)
over the outgoing view, or your router's own transitions.

---

## Plain HTML, WordPress, Vue, Svelte, Astro, Webflow — `<opus-motion>`

```bash
cd <lib> && npm run build:lib       # -> dist/opus-motion.element.js (~2.8 MB, ~0.85 MB gzip, React included)
```
Copy `dist/opus-motion.element.js` and the `public/` files you use to the site, then:
```html
<script src="/js/opus-motion.element.js" defer></script>

<header style="position:relative; min-height:80vh">
  <opus-motion recipe="hero-aurora-night" background></opus-motion>   <!-- full-bleed, behind content -->
  <h1 style="position:relative">Your headline</h1>
</header>

<opus-motion motion="neon-sign" props='{"lines":[{"text":"OPEN LATE","color":"#7FE7FF"}]}' loop="crossfade"></opus-motion>
<opus-motion recipe="testimonial-quote" asset-base="/opus-public"
  overrides='{"story-caption-box":{"items":[{"text":"Best purchase this year."}]}}'></opus-motion>
```
Attributes: `motion` | `recipe` | `layers` (JSON), `props` (JSON), `overrides` (JSON), `format`, `width`, `height`,
`fps`, `duration`, `loop` (`auto` default, `restart`, `crossfade`, `once`, `false`), `autoplay`, `controls`, `fit`,
`background` (full-bleed cover, no pointer events, type layers dropped), `overlay`, `with-text`, `play-on-view`,
`reduced-motion="play"` to opt out of the still frame, `still-frame`, `asset-base`. Event: `opus-ended`.
Vue / Svelte: it is a normal custom element (Vue: `compilerOptions.isCustomElement = (t) => t === 'opus-motion'`).
WordPress: enqueue the script, then use a Custom HTML block. Working example: `examples/html/`.

---

## React Native, Flutter, iOS, Android — exported files

Motions are web components; on native, play rendered files:
```bash
node cli/mgl.mjs export hero-aurora-night --as mp4 --format portrait          # H.264, plays everywhere
node cli/mgl.mjs export confetti-burst --as webm-alpha                         # VP9 + alpha (Android, web, Flutter)
node cli/mgl.mjs export confetti-burst --as prores-alpha                       # ProRes 4444 + alpha (iOS/AVFoundation, editors)
node cli/mgl.mjs export loading-loop --as gif --scale 0.5                      # tiny loops, email
node cli/mgl.mjs export sparkle-burst --as png --transparent                    # PNG sequence (sprite sheets, game engines)
node cli/mgl.mjs export stats-reveal --as poster --frame 200 --out poster.jpg   # still / placeholder
```
Alpha exports automatically apply the motion's `overlayProps` (transparent background); motions that paint their own
background warn that the alpha will be opaque. Verify alpha with
`ffprobe -c:v libvpx-vp9 -show_entries stream=pix_fmt file.webm` → `yuva420p`.
- **React Native**: `react-native-video` (`repeat`, `muted`, `resizeMode="cover"`); alpha: webm on Android, HEVC-with-alpha or
  PNG sequence on iOS (convert ProRes 4444 with `avconvert` / Compressor).
- **Flutter**: `video_player` (mp4); for alpha, a PNG sequence animated with `Image.asset` frames or the webm on Android.
- **iOS (Swift)**: `AVPlayerLooper` + `AVPlayerLayer` with mp4; overlays from ProRes 4444 → HEVC with alpha.
- **Android**: ExoPlayer / Media3 with mp4 or webm (VP9 alpha supported).

## Keynote, PowerPoint, Premiere, Resolve, After Effects, CapCut

- Full-frame clips: `--as mp4` (choose `--format` to match the deck / timeline).
- Overlays to stack over your own footage or slides: `--as prores-alpha` (.mov with alpha; Keynote, Final Cut,
  Premiere, Resolve, AE) — e.g. `confetti-burst`, `embers`, `star-glint`, `film-look`, `hud-chrome`, `blur-in-title`
  with `backdrop:"none"`.
- PowerPoint on Windows: mp4 (alpha is not supported); put the overlay over a matching slide background colour instead.

## Known issue: pixel filters in small players
Motions that use the SVG pixelate filter (`aurora` with its default `pixelSize: 6`, `pixel-dither`, `comic-halftone`)
can render blank or partly blank in Chrome when a 1920-wide composition is displayed scaled down to roughly 300–500 px.
Render the player at its on-screen size instead (`width`/`height` close to the element's CSS size — the showcase site
does this), or pass `pixelSize: 0` to `aurora`. Exports and full-size players are not affected.
