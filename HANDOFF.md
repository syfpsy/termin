# Phosphor Handoff

Date: 2026-04-25 (updated — MP4/GIF workers, loop URL share, schema compat tests, web-player example all landed)

## User Rules

- Do not deploy to Vercel automatically. Ask the user first.
- The project should stay thorough and future-proof.

## Current Direction

Phosphor is a terminal-native motion design tool for motion designers and terminal-art authors. The durable export direction is now:

- `.me` for human-editable source.
- `.phosphor.json` for stable web/device interchange.
- `.html` as a convenience wrapper, not the long-term contract.
- `phosphor-player.js` as a standalone single-file, non-React web component emitted by production builds.

## Important Files

- `src/export/bundle.ts`: versioned bundle builder, serializer, validator, filename helpers, appearance normalization.
- `src/export/htmlEmbed.ts`: pure HTML template that mounts `<phosphor-player>` with the bundle and inlines the compiled runtime.
- `src/export/loopUrl.ts`: client-side gzip + base64url encoder/decoder for share URLs that point at `/play.html#play=...`.
- `src/export/zipStore.ts`: in-tree ZIP writer (STORE method + CRC-32) used by the PNG sequence export.
- `src/export/renderWorkers/frames.ts`: shared offscreen tick-by-tick renderer used by PNG sequence, GIF, and future workers.
- `src/export/renderWorkers/recordStream.ts`: shared `MediaRecorder` driver for canvas capture. Used by MP4 and WebM workers.
- `src/export/renderWorkers/pngSequence.ts`: renders PNG frames and bundles them (plus a `manifest.json`) into a ZIP.
- `src/export/renderWorkers/webm.ts`: WebM capture with VP9 → VP8 → generic codec fallback.
- `src/export/renderWorkers/mp4.ts`: MP4 capture with H.264 (AVC) codec detection, Chrome/Edge/Safari 14.1+.
- `src/export/renderWorkers/gif.ts`: frame-accurate GIF encoding via `gifenc` with a per-frame quantized palette.
- `src/export/renderWorkers/svg.ts`: `renderSvgAnimation` emits animated SVG with SMIL `<animate>` keyframes per lit cell; `renderSvgPoster` emits the peak-activity frame as a still vector.
- `public/play.html`: standalone loop-URL playback page. Self-decodes `#play=gz.<base64>` or `#play=raw.<base64>` and mounts `<phosphor-player>` with the inline bundle.
- `public/examples/web-player/`: live demo of the drop-in contract (the index.html imports `/phosphor-player.js` as any external site would).
- `public/schemas/phosphor.bundle.v1.schema.json`: JSON Schema for external tooling.
- `src/player/phosphor-player.ts`: standalone web component that loads a bundle by `src` or inline JSON and renders with the engine.
- `vite.player.config.ts`: second Vite build that emits `dist/phosphor-player.js` as one copyable file.
- `vite-plugins/phosphor-player.ts`: Vite plugin that exposes the compiled player as the virtual module `virtual:phosphor-player`, used by the main app to inline the runtime into HTML exports.
- `src/director/client.ts`: local download functions for `.me`, `.phosphor.json`, and HTML.
- `src/ui/App.tsx`: import/export buttons and `.phosphor.json` import support.
- `src/export/queue.ts`: export target labels and readiness.
- `docs/EXPORT_FORMAT.md`: export contract and integration notes.
- `README.md`: quick usage and verification commands.

## Export Contract

Stable bundle identity:

- Schema id: `phosphor.bundle.v1`
- Schema URL: `https://phosphor.dev/schemas/phosphor.bundle.v1.json`
- MIME: `application/vnd.phosphor.bundle+json`
- Extension: `.phosphor.json`

The bundle includes both `scene.source` and compiled `scene.events`. That is deliberate: source stays readable and editable, while JSON events are easier for web players and device runtimes.

## Verification Commands

Run these before handing work back:

```bash
npm run typecheck
npm run test:engine
npm run test:export
npm run build
```

Local app:

- App: `http://127.0.0.1:5173/`
- Admin: `http://127.0.0.1:5173/#admin`
- Export surface: `http://127.0.0.1:5173/#export`
- API provider status: `http://127.0.0.1:8787/api/providers`

## Known Status

- Real local exports: `.me`, `.phosphor.json`, `.html`, `.png-seq.zip`, `.webm`, `.mp4`, `.gif`, animated `.svg` (+ `.poster.svg` variant), and loop URL (client-side share).
- Planned export queue targets: none — the full matrix ships.
- Schema v1 contract is forward-compatible: unknown top-level fields are normalized away, unknown appearance values are clamped, `schemaVersion !== 1` is rejected with a specific error. Covered by `npm run test:export`.
- Last local verification passed: `npm run typecheck`, `npm run test:engine`, `npm run test:export`, `npm run build`.
- Preview check: GIF renderer produced a valid `GIF89a` blob for a 100ms scene in 37ms; loop-URL round-trip compressed 3858B JSON to 1558B base64 (60% smaller) and decoded cleanly.
- No Vercel deploy should be triggered unless the user explicitly approves it.
- Git changes may be uncommitted; check `git status --short`.

## Next Recommended Work

1. ~~Replace the HTML convenience runtime with the same compiled `phosphor-player` bundle or generate it from a shared runtime source.~~ **Done 2026-04-24.** HTML export now inlines the compiled `phosphor-player` via the `virtual:phosphor-player` Vite plugin; the hand-rolled mini-engine is gone. Covered by `npm run test:export`.
2. ~~Add proper render-worker implementations for PNG sequence and WebM before MP4/GIF.~~ **Done 2026-04-24.** Frame renderer + STORE ZIP + MediaRecorder paths landed under `src/export/renderWorkers/`. PNG ZIP structure and CRC-32 are covered by `npm run test:export`; WebM path requires a browser to exercise.
3. ~~Add an example `examples/web-player/` page that imports `phosphor-player.js` and a sample `.phosphor.json`.~~ **Done 2026-04-25.** Demo at `public/examples/web-player/` served at `/examples/web-player/`. Sample bundle regenerated by `npm run build:example`. In dev, `/phosphor-player.js` is served via middleware from the existing plugin so the demo works in both dev and prod.
4. ~~Add schema compatibility tests when `schemaVersion` moves beyond `1`.~~ **Done 2026-04-25.** Forward-compat invariants (version rejection, unknown-field normalization, appearance clamping, missing-field errors) codified in `npm run test:export`. When v2 lands, extend these tests to cover the v2 supermsg of v1 readers.
5. ~~Decide whether hosted loop URLs should store bundles in Vercel Blob, GitHub raw files, or another storage layer.~~ **Decided 2026-04-25: client-side fragment encoding first.** `/play.html#play=gz.<base64>` carries the whole bundle in the URL. No server, no auth, fully portable. At ~1.5 kB fragment per typical scene it fits every URL limit. Server-backed fallback (Vercel Blob) is deferred until a real scene hits the ~8 kB practical URL ceiling.
6. ~~Build MP4 and GIF exporters on top of the existing PNG sequence frame pipeline (ffmpeg.wasm is the natural next dep).~~ **Done 2026-04-25, without ffmpeg.** MP4 uses native `MediaRecorder` with AVC detection (Chrome/Edge/Safari 14.1+); GIF uses `gifenc` (~3 kB) with a quantized global palette for flicker-free frames. Saved ~25 MB of wasm.
7. ~~SVG vector emitter.~~ **Done 2026-04-25.** Animated SVG with SMIL `<animate>` per lit cell ships as the default `svg` export; a still-poster variant (`scene.poster.svg`) is still exported by `exportSvgPoster`. A 1.2 s probe scene emits ~15 kB of valid SVG with 23 `<text>` / 23 `<animate>` nodes that parse clean and animate live. Remaining as future polish: move from SMIL to CSS keyframes if SMIL is ever dropped from Chrome, and self-host ffmpeg.wasm behind a lazy import if users need higher-quality MP4 than MediaRecorder produces on Firefox.

## After Effects Pass (2026-04-25)

Direct timeline editing landed: drag/resize/add/delete/edit events with multi-select, marquee, snapping, ripple, mute/solo/lock per event, markers, loop region, onion skin, history panel, copy/paste, split-at-playhead, time-remap, frame stepping. Per-property keyframe animation followed: `prop <name> [<time> <value> [<easing>]]+` lines drive seven numeric Appearance properties through linear/ease-in/ease-out/ease-in-out/hold curves. Bundles compile keyframes to `scene.animations` and the standalone player + every render worker samples the effective Appearance per tick. Slider ◆ buttons drop keyframes at the playhead; an inline graph editor on the timeline shows them as draggable diamonds with per-keyframe value/easing popover.

Polish pass added a help overlay (toggle with `?`), a director proposal diff view (LCS line diff with +/− stats + diff/full toggle), and tick-synced audio (`sound:beep-low|beep-high|click|blip|swish|chime` per-event modifier with a transport mute toggle).

## Deferred (need engine design pass)

- **Per-event property keyframes**: `prop event-3 intensity 0ms 0.5 200ms 1.0` — would let individual events animate their own parameters across their window. Each primitive (`pulse`, `glitch`, `type`, ...) needs to declare its animatable parameters and read sampled values inside its evaluator. The `PropertyAnimation` type is already structured to carry an event id reference; what's missing is the per-effect contract. Suggest a `Primitive.animatableParams: Record<string, { min, max, default }>` that the parser uses to validate and the evaluator uses to look up sampled values.
- **Color / font / mode keyframes**: extending the keyframe model from numeric to discrete (mode, font) and color (tone). Color animation in particular is high-value but requires a tone-interpolation strategy (RGB lerp, HSL lerp, or named-tone hold). Font/mode are step-style and can land trivially with a `hold` easing; the renderer just needs to read the sampled discrete value per tick.
- **Server-side patch protocol for the director**: today the director returns a full DSL replacement and the new diff view shows the change. A cleaner model is for the director to emit structured patch ops (`{op: 'move', eventLine: 3, atMs: 1500}`, `{op: 'add', effect: 'glitch', atMs: 2000}`) so the AI can edit a long scene without rewriting it. Wire a `mode: 'patch' | 'replace'` field on `DirectorProposal` and apply patches via the existing `dslEdit` helpers when present.
- **More render-worker variants**: ffmpeg.wasm behind a lazy import (Firefox MP4 path, higher-quality H.264), lottie or rive bundle export for designers who already work in those tools.
