# Phosphor

Phosphor is a terminal-native motion design tool for motion designers and terminal-art authors. The authoring loop is AI-first: describe a scene, preview generated `.me` notation, commit or rewrite it, then tune the live CRT renderer.

## Current Build

- React + Vite + TypeScript desktop workspace.
- Framework-agnostic engine under `src/engine`.
- Strict engine layers: `Grid`, `PhosphorBuffer`, fixed `TickClock`, DSL parser/evaluator, Canvas renderer, WebGL post-pass renderer.
- Director API with Anthropic, OpenAI, and mock fallback.
- Local-first scene/settings persistence.
- `.me` import/export and self-contained HTML export.
- 99-scene library across boot, loading, transitions, alerts, reveals, and backdrops, with engine-rendered thumbnails and fork workflow.
- Addressable product surfaces: `#start`, `#library`, `#effects`, `#assets`, `#export`, `#settings`, `#empty`.
- Export queue scaffold for future MP4/GIF/SVG/PNG/WebM workers.
- Recent-scene persistence in localStorage plus an IndexedDB scene store for the future local-first library.

## Run Locally

```bash
npm install
npm run dev
```

App: `http://127.0.0.1:5173/`

Director API: `http://127.0.0.1:8787/api/providers`

Useful views:

- `http://127.0.0.1:5173/` - authoring workspace
- `http://127.0.0.1:5173/#library` - scene library
- `http://127.0.0.1:5173/#effects` - primitive detail
- `http://127.0.0.1:5173/#assets` - asset manager
- `http://127.0.0.1:5173/#export` - export targets and queue
- `http://127.0.0.1:5173/#settings` - appearance and runtime settings

## AI Director Keys

Copy `.env.example` to `.env`.

```bash
PHOSPHOR_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

OpenAI is also supported:

```bash
PHOSPHOR_AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.2
```

If no key is present, the app uses the local mock director so the authoring flow still works.

## Verification

```bash
npm run typecheck
npm run test:engine
npm run build
```

## Architecture Rules

1. Scene logic writes only to `Grid`.
2. `PhosphorBuffer` owns decay and max-merge intensity.
3. Renderers consume `PhosphorBuffer`; they do not parse scenes.
4. The DSL tolerates invalid lines and renders all valid lines.
5. Exports should consume `.me` source plus engine/runtime boundaries, not React components.
