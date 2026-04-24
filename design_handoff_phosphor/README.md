# Handoff: Phosphor — Terminal Motion Engine

## Overview

**Phosphor** is a standalone motion-design tool for terminal / CRT aesthetics. It is *not* a filter applied to traditional animation — it's a different kind of animation engine where:

- Time is **discrete** (ticks at 30 Hz, not rAF frames)
- Space is **discrete** (a character-cell grid, not pixels)
- Values are **discrete** (a 6-tone phosphor palette, ordered dithering for ramps)
- Motion blur is **phosphor decay** (a per-cell intensity buffer that falls off each tick)

The authoring surface is **vibe-coded**: a motion designer describes a scene in prose, an AI "director" drafts notation in a readable DSL (`.me` files), and the user edits the notation live against a preview. Claude is not an assistant glued on after the fact — it's the primary authoring input for the target user.

## About the design files

The files in this bundle are **design references created in HTML** — hi-fi prototypes demonstrating the intended look, vocabulary, layout, and authoring flow. They are **not production code to copy directly**.

Your task is to **build Phosphor as a new product** from scratch, using the framework of your choice. The HTML prototypes define the UI surface, visual language, and behavior contracts. The *engine itself* (phosphor buffer, tick clock, effect primitives, renderer) is described conceptually in the "Engine architecture" section below — implement it to match the described contracts.

## Fidelity

**High-fidelity on the UI.** Colors, typography, spacing, phosphor palette, layout, and copy are settled. Lift exact hex values, font choices, and label wording from the HTML.

**Conceptual on the engine.** The architecture section tells you *what to build*, not *how to implement it*. Pick the tech stack that fits your team (suggestions at the bottom).

## The product in one paragraph

A motion designer opens Phosphor. They're looking at a preview-dominant workspace: a CRT display center stage, a director chat panel on the left, a timeline on the bottom, phosphor knobs + effect palette on the right. They type *"make a 2 second boot sequence that types in three status OKs, then glitches and reveals SYSTEM READY"*. The director drafts notation in a readable DSL. The preview plays the scene immediately. The designer tweaks: *"slow line 3"*, *"make the glitch 80ms not 120"*. Each tweak mutates the notation, preview re-renders at 30 Hz. When done, they export to MP4, GIF, SVG, HTML embed, or a shareable loop URL.

## 8 surfaces to build (in order of importance)

Open `Phosphor · Motion Engine.html` in a browser to see every surface rendered.

### Hero · authoring view (2 variations — pick or support both)

**V1 — AI-native** (`MeHeroV1` in `motion-engine/me-hero-v1.jsx`)
- Director chat is the **primary left panel** — a real conversational UI with user/assistant turns, proposed DSL edits rendered inline with commit/rewrite/preview-only actions, and suggest-pills below the input (*"add glitch burst," "slow it down," "loop it," "make 1-bit"*).
- Preview center, timeline bottom, phosphor knobs + effect palette right.
- **Target user:** motion designers who think visually and speak their intent.

**V2 — Notation-native** (`MeHeroV2` in `motion-engine/me-hero-v2.jsx`)
- Left is split: scene tree (top) + notation editor (bottom, large). The DSL is the primary authoring surface.
- Right stack: inspector for the selected event → phosphor knobs → director "peek" drawer (collapsible, invoked with ⌘K).
- Same preview + timeline layout.
- **Target user:** motion designers fluent enough in the notation to write it directly; AI is on-demand.

**Recommendation:** ship V1 first — it matches the "vibe coding" posture. Let V2 emerge as a **toggle** in the titlebar (already designed in both mocks: `mode: AI · vibe / notation`). The two views share ~70% of their panels; the split is just which column is primary.

### Other surfaces (one version each)

3. **Scene Library** (`MeLibrary`) — 99 scenes across 6 shelves (boot sequences, loading loops, transitions, errors & alerts, type reveals, backdrops). Each card is a live preview thumbnail. Fork any scene into your workspace.
4. **Effect Palette · detail** (`MeEffectDetail`) — deep-dive on a single primitive (the mock shows `glitch`). List of 12 primitives left, demo area center with 3 live variations at different param values, notation snippet, and param editor right.
5. **Asset Manager** (`MeAssets`) — manages fonts, palettes, ASCII kits, scan patterns, tones, keybinds. The mock shows fonts (with live type specimens) and palettes (as colored stripes with names).
6. **Export + Render Queue** (`MeExport`) — 8 export targets (MP4, WebM, GIF, SVG, HTML, PNG seq, Loop URL, JSON source). Per-target options below, live queue on the right with progress bars.
7. **Onboarding · first signal** (`MeOnboarding`) — 3 promises + 3-step setup with a live preview of the boot sequence already running.
8. **Settings · Appearance** (`MeSettings`) — preview chrome picker (bezel/flat/none), phosphor knobs (decay/bloom/scanlines/curvature/flicker/chromatic), typography picker.
9. **Empty · New Scene** (`MeEmpty`) — director prompt front and center, suggestion pills, three alt paths (open notation, fork from library, import file), recent scenes gallery.

## The DSL — "vibe notation"

The DSL must be **readable like stage directions**, not config. Syntax rules:

```
scene boot_sequence_v3 2.4s
# three status OKs stagger in, typed one glyph per tick
at 0ms    type "phosphor buffer · 240×67 cells" slowly
at 400ms  type "palette loaded · 6 tones"
at 800ms  type "clock locked · 30 Hz"

# warming beat — amber pulse that breathes for 600ms
at 1200ms pulse "warming phosphor" amber 600ms

# glitch + land the system ready
at 2000ms glitch "SYSTEM READY" 80ms burst
at 2080ms reveal "SYSTEM READY"
at 2080ms cursor "_" blink 500ms
```

Characteristics:
- **Time anchors** (`at 1200ms`) not durations — simpler to reason about and reorder
- **Comments as first-class** (`#`) — the AI uses them liberally; they narrate intent
- **English-adjacent modifiers** (`slowly`, `amber 600ms`, `80ms burst`) — no `{param: value}` syntax
- **One line = one event** — no nesting, no blocks, no closures
- **No variables, no expressions** in v1 — you can add `@fast = 30ms/char` later

**Parser requirement:** the editor shows the *parsed* reading live. Invalid lines are dim with a red `◇` in the gutter, but *never block preview* — the preview renders whatever parsed successfully.

**Director output format:** when Claude generates DSL, it should output in exactly this syntax and nothing else — no backtick fences, no language tags, no prose around it. The UI already wraps it in the proposal card.

## Engine architecture

Build the engine in three layers. **Keep them strictly separate** — this is what makes the engine future-proof.

### Layer 1 — the cell grid

```
Grid {
  cols, rows
  cell(c, r) → { char, fg, bg, intensity }
}
```

Every scene rasterizes to a single `Grid` per tick. The grid is the only output of the scene-logic layer.

### Layer 2 — the phosphor buffer

```
PhosphorBuffer {
  cols, rows
  intensity(c, r) → 0..1
  decayRate     // per-tick falloff, e.g. 0.88 (means 88% remains each tick)

  update(grid, dt) {
    // 1. multiply all cells by decayRate
    // 2. for each cell in `grid` with intensity > 0, max-merge into buffer
  }
}
```

**This is the single most important thing to get right.** It's what makes motion feel like a CRT instead of like CSS. Tune `decayRate` so trails persist ~200–400ms by default.

### Layer 3 — the renderer (separate from 1+2)

Two renderers, interchangeable:

1. **Monochrome canvas renderer** — reads the phosphor buffer, draws glyphs as sprites with alpha = intensity. Fast. Accessible (use it for the a11y-friendly preview mode).
2. **WebGL phosphor renderer** — reads the buffer, applies a fragment shader with: bloom (Gaussian blur pass), scanlines (2px/1px dark), curvature (radial barrel distort), flicker (whole-screen intensity × noise), chromatic aberration (RGB channel offset).

Both renderers take the same `PhosphorBuffer` input. The same scene should look good in both.

### Effect primitives (ship 12)

These compose to cover most terminal motion. Each primitive is a function `(scene, ctxTick) → writes to Grid`:

| Primitive | Notation | What it does |
|---|---|---|
| `type` | `type "str" [slowly]` | Reveal glyphs one per tick, optionally with a jitter char that lands on the final |
| `cursor-blink` | `cursor "_" blink 500ms` | Toggle on/off at the duty cycle |
| `scan-line` | `scan row [0..rows] 400ms` | Bright line sweeps through rows; phosphor decays behind it |
| `glitch` | `glitch "str" 80ms burst` | Corrupt N random cells with random glyphs for K ticks |
| `pulse` | `pulse "str" amber 600ms` | Ramp intensity up-and-down once |
| `decay-trail` | `trail path(points) 30ms/step` | Write a moving path; phosphor does the blur |
| `dither` | `dither ramp 0→1 bayer4` | Ramp via ordered dither instead of alpha |
| `wave` | `wave row-offset sin 2s` | Per-row horizontal offset driven by sin |
| `wipe` | `wipe diagonal 400ms` | Distance-field reveal |
| `loop` | `loop` | Wraps a section to restart seamlessly |
| `shake` | `shake 3px 200ms` | Horizontal row offset weighted by noise |
| `flash` | `flash 80ms` | Whole-screen intensity spike |

### Tick clock, not rAF

```
Clock {
  rate: 30 | 24 | 60     // Hz
  tick                   // integer tick count, monotonic
  onTick(fn)             // called at fixed intervals, catches up on missed ticks
}
```

Drive via `setInterval(1000/rate)`. Never `requestAnimationFrame`. The whole engine (scene evaluation, phosphor update, render) happens on tick. This is what makes animations feel authentically terminal — slightly *slower than smooth*.

## Design tokens

### Palette (phosphor-on-black)

```css
/* workspace */
--bg:         #0A0C09;
--workspace:  #0d1110;
--panel:      #121815;
--panel-hi:   #171e1a;
--bezel:      #1e2722;
--bezel-hi:   #2d3a32;
--bezel-lo:   #161d19;

/* phosphor tones */
--phos:       #D6F04A;   /* PRIMARY — chartreuse */
--phos-dim:   #8aa028;
--amber:      #FFA94B;   /* ACTIVE / SELECTED / PLAYHEAD */
--amber-dim:  #a86a2a;
--green:      #7FE093;   /* OK / success */
--red:        #FF6B6B;   /* destructive / error */
--cyan:       #7FE3E0;   /* THINKING / director / preview scanlines */
--magenta:    #E77FD9;   /* KEYFRAMES / notation time-anchors */

/* ink */
--ink:        #CDDDA0;
--ink-dim:    #7A8F56;
--ink-muted:  #4a5834;
--ink-faint:  #2f3a22;
--ink2:       #FFC985;   /* amber-tinted secondary */
```

**Semantic rule:** every color in the UI has a role. Don't invent new ones; pick from this set.

### Glow (at intensity=1; scale by user glow setting 0–1.5×)

```css
--glow-phos:    0 0 4px rgba(214,240,74,0.45),  0 0 10px rgba(214,240,74,0.18);
--glow-amber:   0 0 4px rgba(255,169,75,0.45),  0 0 10px rgba(255,169,75,0.16);
--glow-red:     0 0 4px rgba(255,107,107,0.45), 0 0 10px rgba(255,107,107,0.16);
--glow-green:   0 0 4px rgba(127,224,147,0.45), 0 0 10px rgba(127,224,147,0.16);
--glow-cyan:    0 0 4px rgba(127,227,224,0.45), 0 0 10px rgba(127,227,224,0.16);
--glow-magenta: 0 0 4px rgba(231,127,217,0.45), 0 0 10px rgba(231,127,217,0.16);
```

*Lighter than Remzi's glow.* Tool UIs live at small sizes for hours — don't overdo the costume.

### Typography

```
VT323                         — display (preview titles, big numbers, scene names)
JetBrains Mono                — UI default (panels, labels, lists, notation editor)
IBM Plex Mono                 — UI alternative
Atkinson Hyperlegible Mono    — a11y pick (settings offers this)
Fira Code / Space Mono / Instrument Serif italic — user-selectable accent faces
```

VT323 is used *sparingly* — display type only. UI text is JetBrains Mono at 10–12px. This is a deliberate loosening of the Remzi direction: **a tool can't afford to cosplay.**

### Scale

- Display (`Phos`): 18–86px VT323
- Panel titles: 10px uppercase, 0.14em tracking
- UI labels / eyebrows: 9.5px uppercase, 0.14em tracking
- Body data: 11–12px JetBrains Mono
- Keybinds: 9–10px muted

### Spacing / borders

- Panel padding: 8–14px
- Borders: `1px solid var(--bezel)` (not 2px — lighter than Remzi)
- No border-radius except on the CRT bezel preview (14px outer, 10px inner)
- Dashed rules: `1px dashed var(--bezel-hi)`
- Section gutters: 12–28px

## Required controls (chrome / typography)

The **Settings → Appearance** tab exposes everything. These are all global, persist per-user, apply instantly without reload.

### Preview chrome — three discrete modes
- `bezel` — hardware CRT (rounded glass, curvature vignette)
- `flat` — workshop frame (dashed + solid border, no curve)
- `none` — raw phosphor surface (just the content)

### Phosphor knobs — continuous sliders
- `decay` (ms) — 0 to 800, default 240
- `bloom` (×) — 0 to 3.0, default 1.8
- `scanlines` (0..1) — default 0.70
- `curvature` (0..1) — default 0.35
- `flicker` (0..1) — default 0.12
- `chromatic` (0..1) — default 0.00 (off by default)

### Typography
- `font` — discrete pick: VT323, IBM Plex Mono, JetBrains Mono, Atkinson Hyperlegible Mono, Fira Code, Space Mono
- `sizeScale` — 0.75× to 1.4×, default 1.0×

### Preview mode
- `color` (full palette) vs `1-bit` (monochrome phosphor only)

### Tick rate
- 24 / 30 / 60 Hz — 30 is the default and the authentic sweet spot.

## Primitives to port from the HTML

Build these as real components in the target framework:

- **`<Phos tone sz>`** — the VT323 display-text primitive. Every big phosphor number/title uses it.
- **`<MePanel title tools flags footer dense flush>`** — bordered panel with a title bar. Used everywhere.
- **`<MePreview chrome scene intensity>`** — the CRT viewport. Scene is a canned preview; in production, wire this to the actual engine output.
- **`<MeScan intensity curve>`** — the scanline + curvature overlay. Used by `MePreview`.
- **`<MeBtn active tone icon kbd>`** — the small tool button.
- **`<MeLabel tone>`** — the 9.5px uppercase eyebrow.

See `motion-engine/me-core.jsx` for reference implementations.

## Interactions & behavior

- **All transitions are short and abrupt** — 80–120ms linear or stepped. Never smooth easings. "Instant hardware," not "smooth web app."
- **Preview runs live** at the selected tick rate. Every DSL edit re-parses and re-renders within one tick.
- **Timeline playhead** scrubs smoothly across tick boundaries. Keyframes are magenta diamonds.
- **Director chat** posts proposals as *cards* (see V1) with commit / rewrite / preview-only actions. Previewing a proposal doesn't commit it to the DSL — the user has to approve.
- **Notation editor** syntax highlights by token role: time-anchors magenta, commands ink, strings phosphor, modifiers ink-dim, comments ink-muted italic.
- **Effect palette** — clicking inserts the primitive at the current playhead as a new track.
- **Library** — cards autoplay on hover; ⏎ opens in editor, F forks to a copy, ␣ plays a full-size loop.
- **Export** — each job is FIFO queued. Running jobs show per-frame progress. Clicking a done job opens the output file.

## State contract

```ts
type Appearance = {
  chrome: 'bezel' | 'flat' | 'none';
  decay: number;       // 0–800
  bloom: number;       // 0–3
  scanlines: number;   // 0–1
  curvature: number;   // 0–1
  flicker: number;     // 0–1
  chromatic: number;   // 0–1
  font: 'vt323' | 'plex' | 'jet' | 'atkinson' | 'fira' | 'space';
  sizeScale: number;   // 0.75–1.4
  mode: 'color' | '1-bit';
  tickRate: 24 | 30 | 60;
};

type Scene = {
  name: string;
  duration: number;     // ms
  events: Event[];
};

type Event = {
  at: number;           // ms anchor
  effect: string;
  target: string;       // usually a quoted string
  modifiers: string;    // raw modifier tail, parser interprets per-effect
};
```

Persist `Appearance` in localStorage. Persist `Scene` as `.me` files (plain text DSL) + an optional `.me.bundle.json` with assets.

## Export targets

Build these in rough priority:

1. **HTML embed** — self-contained file with the engine + scene inline. Most flexible; no external deps.
2. **MP4** — server-side ffmpeg render from PNG frames. Most-requested.
3. **GIF** — 256-color quantized. Everywhere-compatible.
4. **Loop URL** — read-only hosted preview. Share to slack/twitter.
5. **JSON/.me** — source export. Diffable, version-controllable.
6. **SVG** — animated SVG with `<animate>` elements per track.
7. **PNG seq + zip** — for After Effects / Motion import.
8. **WebM** — VP9 with transparency support.

## Files in this bundle

```
Phosphor · Motion Engine.html         ← main entry — open in a browser to see every surface

motion-engine/
  design-canvas.jsx    ← presentation shell only (NOT needed in the app)
  me-core.jsx          ← palette, fonts, Phos, MePanel, MeScan, MeBtn, MeLabel primitives
  me-preview.jsx       ← MePreview + 6 canned scene rasterizations
  me-timeline.jsx      ← MeTimeline (ruler + tracks + keyframes + playhead)
  me-hero-v1.jsx       ← V1 AI-native authoring view
  me-hero-v2.jsx       ← V2 notation-native authoring view
  me-surfaces.jsx      ← Library, EffectDetail, Assets, Export, Onboarding, Settings, Empty
```

## Port order recommendation

1. **Engine kernel first.** Build Grid + PhosphorBuffer + Clock + one primitive (`type`) + monochrome canvas renderer. Verify the *feel* before you build any UI.
2. **WebGL post-pass.** Add bloom + scanlines + curvature. If the preview doesn't feel right at this point, fix it before moving on — no UI will save a bad preview.
3. **The DSL.** Parser + evaluator. Wire the `type` primitive end-to-end. You can DSL-edit in a plain textarea for now.
4. **Hero V1.** Build the layout with a hardcoded scene. Wire the director chat to a Claude endpoint that outputs DSL.
5. **More primitives** — `cursor-blink`, `glitch`, `pulse`, `reveal`. The DSL stretches as each is added.
6. **Timeline + knobs + effect palette** — now the hero is a real tool.
7. **Scene library + assets + export queue + settings + onboarding + empty** — product surfaces.

## Tech stack recommendation

- **Engine:** TypeScript + Canvas 2D (raster) + WebGL fragment shader (post-pass). No framework.
- **UI:** React or Solid (either is fine — the component tree is shallow). No Next.js needed; it's a single-page app.
- **Persistence:** local-first. IndexedDB for scenes, localStorage for appearance. Sync layer can come later.
- **Director:** Claude Haiku 4.5 via the Anthropic SDK. System prompt grounded in the DSL spec. One-shot per turn with a short example.
- **Export:** local ffmpeg for MP4/WebM/GIF; native canvas export for PNG seq + SVG; static HTML template for embed.
- **Deploy:** anywhere. It's a static frontend + a stateless render worker.

## Naming

The working name in this mock is **Phosphor**. Feel free to rename — the design doesn't hinge on it.

## Notes for the implementer

- The engine architecture (cell grid + phosphor buffer + separate renderers) is non-negotiable. Skip it and you'll build "CSS animations with scanlines" — which is what every other retro-terminal tool already is.
- The DSL is prose-first *on purpose*. If the AI output or the authoring feel isn't good, the DSL grammar is wrong — fix the grammar, not the AI prompt.
- Keep the glow light in the UI chrome. Heavy glow reads great in screenshots and is exhausting to use for four hours. The CRT preview should be the costume; the tool should be the workshop.
- No gradients anywhere except the scanline/curvature overlays.
- No border-radius in the UI. Only the CRT bezel preview rounds.
- Every transition is discrete. Even the timeline scrub should step, not ease.
