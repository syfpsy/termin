# Changelog

Format: `vMAJOR.MINOR.PATCH` — minor = new feature surface, patch = fix or polish, major = breaking/rewrite.

---

## v0.2.1 — 2025-04
**Landing page release**
- `LandingPage.tsx` — animated hero (LoopingPreview, 448×252 CRT bezel), release strip, how-it-works (3 steps with code + static preview), 6-feature grid, 3 live looping examples, Free/Cloud pricing, footer
- `DocsPage` — accordion: scene syntax, effects reference, tones, sound presets, keyboard shortcuts
- `ChangelogPage` — versioned accordion entries
- `App.tsx` auth gate — landing shown when Supabase configured + no session; `enteredApp` flag lets guests skip to studio
- `styles.css` — `crt-breathe`, `hero-glitch`, `mark-glow`, `strip-pulse` keyframes; all landing section layouts; responsive breakpoints at 900px/600px
- `package.json` — version synced to `0.2.1`

## v0.2.0 — 2025-04
**Sound, transitions, timeline UX**
- `audio.ts` — 20 synthesized sound presets via Web Audio; `sound:<preset>` modifier; `setAudioMuted` / `ensureAudioRunning` / `scheduleEventSounds`
- `Timeline.tsx` — transition wedge handles for intro/outro easing (keyboard: Enter/Space); left-resize drag + Arrow key nudge (±10ms/±100ms with Shift); effect picker inline on timeline lane; marquee box-select rewritten to time-range arithmetic (single `getBoundingClientRect`); event bars promoted to native `<button>`; `TONE_HEX` import from shared `tones.ts`
- `tones.ts` (new) — single source of truth for tone hex values, shared between Timeline and EffectControlsPanel
- `EffectControlsPanel.tsx` — removed local `TONE_HEX` duplicate; imports from `tones.ts`
- `styles.css` — `--crt-bg` CSS custom property; `.timeline__bar` reset for `<button>` element; bezel shadow token fix

## v0.1.0 — 2025-01
**Initial release**
- 13 animation primitives: `type`, `cursor`, `pulse`, `glitch`, `wave`, `wipe`, `scan-line`, `dither`, `shake`, `flash`, `counter`, `reveal`, `loop`
- DSL notation editor with live parse feedback
- Canvas renderer: per-cell phosphor glow, bloom, scanline pass, phosphor decay
- Keyframe animation: intensity and timing offset per event, visual timeline diamonds
- AI director panel: plain-language scene editing with preview-before-commit
- Export: HTML embed, `.me` source, PNG sequence, WebM, MP4, GIF, SVG animation, loop URL
- Project model: multi-scene, IndexedDB persistence, import/export `.phosphor.proj`
