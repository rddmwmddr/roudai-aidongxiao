# HTTP API — `mgl serve`

A small server (Node built-ins + the Remotion renderer already in the repo) that lets **any website, editor, backend or
agent** use the library over plain HTTP: browse the catalog with a **props JSON Schema** per motion, then render
mp4 / webm / ProRes / GIF / PNG from JSON.

```bash
cd <lib> && npm install
node cli/mgl.mjs serve                 # http://127.0.0.1:4321  (also: npm run serve, node cli/serve.mjs)
```

It bundles the compositions once at start-up (~30–90 s; `/api/health` says `"bundle":"ready"`), then renders jobs one at
a time from a queue. Local only by default: binds `127.0.0.1` and answers only requests whose `Host` is `localhost` /
`127.0.0.1`. CORS is on (`*`). No secrets are built in.

| option | default | meaning |
|---|---|---|
| `--port N` (env `PORT`) | `4321` | |
| `--host H` (env `HOST`) | `127.0.0.1` | `0.0.0.0` to expose (Docker / reverse proxy); prints a warning when no token is set |
| `--token T` (env `MGL_SERVE_TOKEN`) | none | require `Authorization: Bearer T` (or `?token=T`) on every `/api` route |
| `--cors-origin O` | `*` | set to your editor's origin (`https://editor.example.com`) when hosting |
| `--concurrency N` | `min(4, CPUs)` | frames rendered in parallel per job |
| `--gl angle\|swangle\|egl\|vulkan` | `angle` | Chrome GL backend; use `swangle` on servers without a GPU |
| `--max-frames N` | `9000` | longest allowed render (5 min at 30 fps) |
| `--max-queue N` | `50` | queued + running jobs; more get `429` |
| `--ttl MIN` | `60` | finished files are deleted after this many minutes |
| `--out DIR` | `out/serve` | where renders are written |
| `--no-warm` | | bundle on the first render instead of at start-up |

## Endpoints

| route | returns |
|---|---|
| `GET /api/health` | `{ok, bundle: building\|ready\|error, motions, recipes, styles, queue, running}` |
| `GET /api/motions?category=&q=&overlay=1&loopable=1&weight=light&role=&mood=&limit=&offset=` | `{total, count, categories, motions: [summary]}`: id, title, category, description, useFor, tags, durationInFrames, formats, overlay, `overlayProps`, loopable, weight, roles, text / colour / image prop names, `previewUrl`, `schemaUrl` |
| `GET /api/motions?full=1` | same, plus every `props` (default + doc) and `propsSchema` (paged, 50 by default) |
| `GET /api/motions/:id` | the whole catalog entry + `propsSchema` |
| `GET /api/motions/:id/schema` | the props **JSON Schema** (draft 2020-12) |
| `GET /api/motions/:id/preview` | `image/jpeg`, three frames of the motion (404 when the gallery image is missing) |
| `GET /api/schema` | every props schema `{motions: {id: schema}}` (also a static file: `props-schema.json`) |
| `GET /api/suggest?q=<brief>&overlay=1&image=1&text=1&loop=1&light=1&category=&limit=` | ranked motions and recipes for a plain-words brief, with reasons and ready props (same engine as `mgl suggest`) |
| `GET /api/styles[?family=&full=1]`, `GET /api/styles/:id` | the 148 one-line looks (pass the id as `style`) |
| `GET /api/recipes[?full=1]`, `GET /api/recipes/:id`, `GET /api/recipes/:id/preview` | ready-made mixes |
| `GET /api/transitions` | `[{type, defaultFrames}]` for Compose scene transitions |
| `POST /api/render[?wait=1]` | queue a render, **202** + job (`wait=1` holds the request until it finishes) |
| `GET /api/jobs`, `GET /api/jobs/:id` | job status and progress |
| `GET /api/jobs/:id/file` | the file (`Content-Disposition` attachment, **Range** supported, so it plays in `<video>`) |
| `DELETE /api/jobs/:id` | cancel (queued or rendering) |
| `GET /api/render-schema`, `GET /api/openapi.json` | the render request schema; an OpenAPI 3 outline |
| `GET /assets/<path>` | the library's `public/` folder (images the motions load): use as `asset-base` |
| `GET /dist/<path>` | `dist/` after `npm run build:lib` (e.g. `/dist/opus-motion.element.js`) |

### `POST /api/render`

Exactly one target: **`motion`** (+ `props`), **`recipe`** (+ `overrides`), **`layers`** or **`spec`**.

| field | |
|---|---|
| `motion` / `props` | a motion id and its props (merged over the defaults; see its schema) |
| `recipe` / `overrides` | a recipe id; `overrides` = `{motionId: props}` merged into its layers |
| `layers` | a mix, bottom to top: `[{motion, props?, from?, duration?, offset?, opacity?, blend?, scale?, x?, y?}]` (the timeline of an editor) |
| `spec` | a full Compose spec: `{width?, height?, fps?, background?, style?, scenes:[{motion\|layers, props, duration, transition}], overlays?, captions?, audio?}` |
| `style` | a style id (`woodcut`, `risograph`, …) over everything |
| `format` | output type: `mp4` (default), `webm`, `webm-alpha`, `prores-alpha`, `gif`, `poster` (one PNG frame). `landscape` / `square` / `portrait` are accepted here too, as `aspect` |
| `aspect`, `width`, `height` | preset 1920×1080 / 1080×1080 / 1080×1920, or an explicit size (`width` and `height` together, 16–4096; mp4 sizes are made even) |
| `fps`, `frames` | default 30 and the motion / recipe / spec length; `frames` is the length in frames |
| `frame` | `poster`: which frame (default 60 % of the length) |
| `quality` | `draft` \| `normal` (default) \| `high` (mp4 / webm quality) |
| `scale` | `gif`: output scale, default 0.5 |

Alpha formats render motions that can be overlays on their `overlayProps` (transparent background) and say so in
`warnings` when a motion paints its own background. Bad input returns `400 {"error": "…"}` before anything is queued.

A job: `{id, status: queued|bundling|rendering|done|error|canceled, progress 0..1, queuePosition?, request, output?: {format, width, height, fps, durationInFrames, bytes, filename, url}, warnings?, error?, links}`.

```bash
curl -s 'http://127.0.0.1:4321/api/motions?category=text&limit=3' | head -c 300
curl -s http://127.0.0.1:4321/api/motions/number-counter/schema

# render one motion to mp4, wait for it, download
curl -s -X POST 'http://127.0.0.1:4321/api/render?wait=1' -H 'content-type: application/json' \
  -d '{"motion":"number-counter","props":{"label":"USERS","unit":"","readouts":[],"keyframes":[[0,0],[40,12480]]},"aspect":"square","frames":45}'
curl -s -o out.mp4 http://127.0.0.1:4321/api/jobs/<id>/file
```

```js
// browser / editor: queue, poll, play
const base = 'http://127.0.0.1:4321';
const job = await (await fetch(`${base}/api/render`, {method: 'POST', headers: {'content-type': 'application/json'},
  body: JSON.stringify({layers: timelineLayers, frames: totalFrames, aspect: 'landscape'})})).json();
let j = job;
while (!['done', 'error', 'canceled'].includes(j.status)) {
  await new Promise((r) => setTimeout(r, 1000));
  j = await (await fetch(`${base}/api/jobs/${job.id}`)).json();   // j.progress for a progress bar
}
videoEl.src = `${base}${j.output.url}`;
```

### Props JSON Schema (for property panels)

`GET /api/motions/:id/schema`, `props-schema.json` (all motions, also at the package root / `opus-motion-library/props-schema.json`) or
`node cli/mgl.mjs schema <id>`. Generated by `cli/gen-schemas.mjs` from `catalog.json` (run `npm run gen`). One property per
prop: `type` (string / number / boolean / array / object, from the default), `default`, `description` (the prop's doc), and:

- `enum` when the doc lists the closed set of choices (`"roll | tick | lock"`); `x-opus-options` lists suggested values when the set is open (`"… | …"`)
- `x-opus-widget`: `text` · `color` · `image` · `number` · `toggle` · `select` · `list` · `json`; `x-opus-text: true` marks words the user should replace; `x-opus-optionLabels` explains each option
- `x-opus`, at the top: category, `durationInFrames`, `formats`, `overlay` / `overlayProps`, `loopable`, `weight`, `textProps` / `colorProps` / `imageProps`

All properties are optional (defaults apply) and unknown ones are allowed. Enums come from prose docs: treat them as
the intended choices, not a security boundary.

## Host it (Docker)

Not run in this repo's CI (no Docker on the dev machine): treat as a starting point.

```dockerfile
FROM node:22-bookworm-slim
# Chrome headless shell needs these libraries (Remotion docs: Linux dependencies)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3 \
      libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx remotion browser ensure          # bake Chrome in, so the first render does not download it
ENV HOST=0.0.0.0 PORT=4321
EXPOSE 4321
# swangle = software GL (no GPU); keep concurrency low on small instances. Pass the token at run time.
CMD ["node", "cli/mgl.mjs", "serve", "--gl", "swangle", "--concurrency", "2"]
```

```bash
docker build -t opus-motion-server .
docker run -p 4321:4321 -e MGL_SERVE_TOKEN="$(openssl rand -hex 24)" opus-motion-server \
  node cli/mgl.mjs serve --gl swangle --cors-origin https://editor.example.com
```

Add a `.dockerignore` with `node_modules`, `out`, `.git`, `site/node_modules`, `examples/*/node_modules`, `analysis`, `sample`.

## Security notes

- The default bind is local; to host it, set `--token` (or put it behind your own auth proxy) and `--cors-origin`. Without a token anyone who can reach the port can queue renders.
- A render loads whatever URLs the props point at (`src`, `images`, fonts) from the server's Chrome: on a public deployment, put it in a network that cannot reach internal services, or allow-list the URLs in your own backend before forwarding the request.
- `--token` protects `/api/*`; `/assets/*` and `/dist/*` serve the library's own public files and stay open.
- Limits: 4 MB request body, `--max-frames`, `--max-queue`, finished files deleted after `--ttl`. Jobs are in memory (a restart forgets them).
- Remotion is source-available: companies above the free tier need a Remotion company licence (https://remotion.dev/license), also for a hosted render service.
- Scale-out: one process renders one job at a time. Run several containers behind a queue / load balancer rather than raising `--concurrency` past your CPU count.
