# Phosphor Handoff

Date: 2026-04-24 (updated — HTML runtime unified + PNG sequence and WebM render workers shipped)

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
- `src/export/zipStore.ts`: in-tree ZIP writer (STORE method + CRC-32) used by the PNG sequence export.
- `src/export/renderWorkers/frames.ts`: shared offscreen tick-by-tick renderer used by PNG sequence and future encode workers.
- `src/export/renderWorkers/pngSequence.ts`: renders PNG frames and bundles them (plus a `manifest.json`) into a ZIP.
- `src/export/renderWorkers/webm.ts`: MediaRecorder-based WebM capture, codec detection, scene-duration-accurate recording.
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

- Real local exports: `.me`, `.phosphor.json`, `.html`.
- Planned export queue targets: MP4, GIF, SVG, PNG sequence, WebM, loop URL.
- Last local verification passed: `npm run typecheck`, `npm run test:engine`, `npm run test:export`, `npm run build`.
- In-app browser checked `http://127.0.0.1:5173/#export`; no new console errors appeared during reload.
- No Vercel deploy should be triggered unless the user explicitly approves it.
- Git changes may be uncommitted; check `git status --short`.

## Next Recommended Work

1. ~~Replace the HTML convenience runtime with the same compiled `phosphor-player` bundle or generate it from a shared runtime source.~~ **Done 2026-04-24.** HTML export now inlines the compiled `phosphor-player` via the `virtual:phosphor-player` Vite plugin; the hand-rolled mini-engine is gone. Covered by `npm run test:export`.
2. ~~Add proper render-worker implementations for PNG sequence and WebM before MP4/GIF.~~ **Done 2026-04-24.** Frame renderer + STORE ZIP + MediaRecorder paths landed under `src/export/renderWorkers/`. PNG ZIP structure and CRC-32 are covered by `npm run test:export`; WebM path requires a browser to exercise.
3. Add an example `examples/web-player/` page that imports `phosphor-player.js` and a sample `.phosphor.json`.
4. Add schema compatibility tests when `schemaVersion` moves beyond `1`.
5. Decide whether hosted loop URLs should store bundles in Vercel Blob, GitHub raw files, or another storage layer.
6. Build MP4 and GIF exporters on top of the existing PNG sequence frame pipeline (ffmpeg.wasm is the natural next dep).
