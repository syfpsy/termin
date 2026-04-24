# Phosphor Export Format

## Stable Format

The durable interchange format is `.phosphor.json`.

- Schema id: `phosphor.bundle.v1`
- Schema URL: `https://phosphor.dev/schemas/phosphor.bundle.v1.json`
- MIME type: `application/vnd.phosphor.bundle+json`
- JSON Schema file: `public/schemas/phosphor.bundle.v1.schema.json`
- TypeScript contract and validator: `src/export/bundle.ts`

Use this format for websites, embedded players, native apps, hardware devices, and any future render workers.

## Why Not HTML As The Contract

HTML export is convenient for sharing, but it is a wrapper. The HTML page embeds the exact same `phosphor-player` runtime that ships at `dist/phosphor-player.js`, plus the bundle as an inline JSON script. The wrapper may change as the player improves. `.phosphor.json` is the stable data contract.

## Bundle Shape

Required top-level fields:

- `$schema`: schema URL for tooling.
- `schema`: exact schema id, currently `phosphor.bundle.v1`.
- `schemaVersion`: numeric version, currently `1`.
- `runtime`: engine and minimum player version metadata.
- `scene`: source, compiled events, timing, loop, and grid geometry.
- `appearance`: portable renderer settings.
- `assets`: font and palette manifest.
- `compatibility`: notes for deterministic playback and forward-compatible readers.

The key portability rule is that `scene.source` remains the human-editable `.me` source, while `scene.events` gives devices a JSON event list so they do not have to parse the text format first.

## Web Playback

Production builds emit a standalone non-React web component at `dist/phosphor-player.js`. It is built as a single file so it can be copied next to bundles without the React app.

```html
<script type="module" src="/phosphor-player.js"></script>
<phosphor-player src="/boot_sequence_v3.phosphor.json"></phosphor-player>
```

Inline bundles are also supported:

```html
<phosphor-player>
  <script type="application/vnd.phosphor.bundle+json">
    { "schema": "phosphor.bundle.v1", "schemaVersion": 1, "...": "..." }
  </script>
</phosphor-player>
```

The player source lives at `src/player/phosphor-player.ts`.

## Device Playback

Device runtimes should consume:

- `scene.grid.cols` and `scene.grid.rows` for the fixed cell surface.
- `scene.tickRate` for the clock.
- `scene.loop.startMs` and `scene.loop.endMs` for repeating playback.
- `scene.events` for event scheduling.
- `appearance.mode`, `appearance.decay`, `appearance.bloom`, and palette assets as supported.

Forward-compatible readers should ignore unknown fields, clamp unsupported appearance values, and reject unsupported `schemaVersion` values.

## Current Export Buttons

- `.me source`: editable text only.
- `phosphor`: stable `.phosphor.json` bundle.
- `html`: self-contained convenience page. The HTML inlines the compiled `phosphor-player` runtime (via the `virtual:phosphor-player` Vite plugin at `vite-plugins/phosphor-player.ts`) plus the bundle. No second runtime is maintained.
- `png-seq`: renders every scene tick to an offscreen canvas and bundles the PNG frames into a STORE-method ZIP (`src/export/renderWorkers/pngSequence.ts` + in-tree ZIP writer at `src/export/zipStore.ts`). Includes a `manifest.json` describing frame count, tick rate, and resolution.
- `webm`: captures the offscreen canvas with `MediaRecorder` (`src/export/renderWorkers/webm.ts`). Picks the highest-quality supported WebM codec (VP9 → VP8 → generic) and records for exactly scene-duration milliseconds. Browsers without MediaRecorder support are flagged in the queue.
- Export surface queue: still shows future MP4, GIF, SVG, and loop-URL targets as `planned`; MP4/GIF will land next on top of the PNG sequence pipeline.

## Validation

Run:

```bash
npm run test:export
```

The smoke test builds a bundle from the default scene, validates it, round-trips JSON, and checks an invalid bundle failure path.
