// me-hero-v2.jsx — NOTATION-NATIVE authoring view.
// DSL editor + scene tree left. Preview center. Knobs + effect palette right.
// Claude is a collapsible drawer on the right edge (shown in peek state).
// Timeline bottom. Target: motion designer fluent in the notation.

window.MeHeroV2 = function MeHeroV2() {
  const T = window.ME_T;
  const F = window.ME_FONTS;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: T.bg,
      display: 'grid',
      gridTemplateColumns: '320px 1fr 280px',
      gridTemplateRows: '34px 1fr 180px 20px',
      gap: 1, fontFamily: F.ui, color: T.ink,
    }}>
      {/* titlebar */}
      <div style={{
        gridColumn: '1 / -1', background: T.bg, borderBottom: `1px solid ${T.bezel}`,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 14,
        fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.inkDim,
      }}>
        <span style={{ color: T.phos, textShadow: T.glow, fontSize: 12, letterSpacing: '0.2em' }}>◼ PHOSPHOR</span>
        <span style={{ color: T.inkMuted }}>·</span>
        <span style={{ color: T.ink }}>boot_sequence_v3</span>
        <span style={{ color: T.inkMuted }}>·</span>
        <span>saved 12s ago</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: T.inkMuted }}>mode</span>
        <span style={{ color: T.inkMuted }}>AI</span>
        <span style={{ color: T.inkMuted, marginLeft: 4 }}>/</span>
        <span style={{ color: T.ink2, textShadow: T.glowA }}>notation ·  vibe</span>
        <div style={{ width: 1, height: 16, background: T.bezel, margin: '0 4px' }} />
        <window.MeBtn>◐ preview</window.MeBtn>
        <window.MeBtn tone="prim">↗ export</window.MeBtn>
      </div>

      {/* ── left: SCENE TREE + DSL EDITOR stacked ───────────── */}
      <div style={{ gridRow: '2 / 4', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
        <window.MePanel title="SCENE" flags="7 layers" dense style={{ flex: '0 0 180px', minHeight: 0 }} flush>
          <div style={{ overflowY: 'auto', padding: '4px 0', fontSize: 11 }}>
            <TreeRow depth={0} glyph="◆" name="boot_sequence_v3" meta="2.4s" bold />
            <TreeRow depth={1} glyph="▎" name="status · line 1"  effect="type"    tone={T.phos} />
            <TreeRow depth={1} glyph="▎" name="status · line 2"  effect="type"    tone={T.phos} />
            <TreeRow depth={1} glyph="▎" name="status · line 3"  effect="type"    tone={T.phos} />
            <TreeRow depth={1} glyph="◐" name="warming phosphor" effect="pulse"   tone={T.amber} selected />
            <TreeRow depth={1} glyph="▚" name="SYSTEM READY"     effect="reveal"  tone={T.phos} />
            <TreeRow depth={1} glyph="◈" name="glitch burst"     effect="glitch"  tone={T.magenta} />
            <TreeRow depth={1} glyph="▮" name="cursor"           effect="cursor-blink" tone={T.ink} />
          </div>
        </window.MePanel>

        <window.MePanel
          title="NOTATION"
          flags="vibe.dsl · 12 lines"
          tools={<><window.MeBtn>↻ reformat</window.MeBtn><window.MeBtn>◎ parse</window.MeBtn></>}
          style={{ flex: 1, minHeight: 0 }}
          flush
          footer="⌘ + S  commit  ·  ⌘ + P  parse"
        >
          <div style={{
            flex: 1, overflow: 'auto', padding: '10px 12px',
            fontFamily: F.ui, fontSize: 11.5, lineHeight: 1.55,
            background: '#0a0e0b', minHeight: 0,
          }}>
            <DslLine ln={1} kw="scene" name="boot_sequence_v3" val="2.4s" />
            <DslLine ln={2} comment="# three status OKs stagger in, typed one glyph per tick" />
            <DslLine ln={3} at="0ms"    cmd="type" str="phosphor buffer · 240×67 cells" mod="slowly" />
            <DslLine ln={4} at="400ms"  cmd="type" str="palette loaded · 6 tones" />
            <DslLine ln={5} at="800ms"  cmd="type" str="clock locked · 30 Hz" />
            <DslLine ln={6} blank />
            <DslLine ln={7} comment="# warming beat — amber pulse that breathes for 600ms" selected />
            <DslLine ln={8} at="1200ms" cmd="pulse" str="warming phosphor" mod="amber 600ms" selected caret />
            <DslLine ln={9} blank />
            <DslLine ln={10} comment="# glitch + land the system ready" />
            <DslLine ln={11} at="2000ms" cmd="glitch" str="SYSTEM READY" mod="80ms burst" />
            <DslLine ln={12} at="2080ms" cmd="reveal" str="SYSTEM READY" />
            <DslLine ln={13} at="2080ms" cmd="cursor" str="_" mod="blink 500ms" />
          </div>
          <div style={{
            borderTop: `1px solid ${T.bezel}`, padding: '6px 10px', background: T.bg,
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: T.inkMuted, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            <span style={{ color: T.green, textShadow: T.glowG }}>● parsed</span>
            <span>7 tracks · 11 events</span>
            <div style={{ flex: 1 }} />
            <span>ln 8, col 14</span>
          </div>
        </window.MePanel>
      </div>

      {/* ── center: PREVIEW ────────────────────────────────── */}
      <div style={{ gridRow: '2 / 3', position: 'relative', minHeight: 0, background: T.workspace, borderLeft: `1px solid ${T.bezel}`, borderRight: `1px solid ${T.bezel}` }}>
        <div style={{ position: 'absolute', top: 10, left: 14, right: 14, zIndex: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <window.MeLabel>chrome</window.MeLabel>
          <window.MeBtn>bezel</window.MeBtn>
          <window.MeBtn active>flat</window.MeBtn>
          <window.MeBtn>none</window.MeBtn>
          <div style={{ flex: 1 }} />
          <window.MeLabel>mode</window.MeLabel>
          <window.MeBtn active>color</window.MeBtn>
          <window.MeBtn>1-bit</window.MeBtn>
          <div style={{ width: 1, height: 18, background: T.bezel, margin: '0 4px' }} />
          <window.MeLabel>tick</window.MeLabel>
          <window.MeBtn>24</window.MeBtn>
          <window.MeBtn active>30</window.MeBtn>
          <window.MeBtn>60</window.MeBtn>
        </div>
        <div style={{ position: 'absolute', inset: '48px 40px 60px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 780, aspectRatio: '4 / 3' }}>
            <window.MePreview chrome="flat" scene="typewriter" intensity={0.65} playhead="0:01.200" />
          </div>
        </div>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          borderTop: `1px solid ${T.bezel}`, background: T.bg,
          display: 'flex', alignItems: 'center', padding: '8px 14px', gap: 10, height: 46, boxSizing: 'border-box',
        }}>
          <window.MeBtn>⏮</window.MeBtn>
          <window.MeBtn tone="prim" style={{ padding: '6px 14px' }}>▶ play</window.MeBtn>
          <window.MeBtn>⏭</window.MeBtn>
          <window.MeBtn active>◐ loop</window.MeBtn>
          <div style={{ width: 1, height: 18, background: T.bezel, margin: '0 6px' }} />
          <window.Phos sz={22} tone="amber">00:01.200</window.Phos>
          <span style={{ color: T.inkMuted, fontSize: 11 }}>/ 00:02.400</span>
          <div style={{ flex: 1 }} />
          <window.MeLabel>diff</window.MeLabel>
          <span style={{ fontSize: 10, color: T.green, textShadow: T.glowG }}>+2 ev</span>
          <span style={{ fontSize: 10, color: T.red, textShadow: T.glowR }}>−1 ev</span>
        </div>
      </div>

      {/* ── right: KNOBS + EFFECT PALETTE + CLAUDE PEEK ─────── */}
      <div style={{ gridRow: '2 / 4', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
        <window.MePanel title="INSPECTOR" flags="pulse" dense style={{ flex: '0 0 auto' }}>
          <InspectRow k="target" v="warming phosphor" />
          <InspectRow k="at" v="1200ms" />
          <InspectRow k="effect" v="pulse" tone={T.amber} />
          <InspectRow k="color" v="amber" swatch={T.amber} />
          <InspectRow k="duration" v="600ms" editable />
          <InspectRow k="curve" v="steps(8)" editable />
          <InspectRow k="intensity" v="0.8 → 0.2" editable />
          <InspectRow k="loop" v="off" />
        </window.MePanel>

        <window.MePanel title="PHOSPHOR" dense style={{ flex: '0 0 auto' }}>
          <MiniKnob label="decay" val="240" pct={0.45} />
          <MiniKnob label="bloom" val="1.8" pct={0.60} />
          <MiniKnob label="scanlines" val="0.65" pct={0.65} />
          <MiniKnob label="curvature" val="0.00" pct={0.00} dim />
        </window.MePanel>

        <window.MePanel title="DIRECTOR" flags="peek · ⌘K" accent={T.cyan} dense style={{ flex: 1, minHeight: 0 }} flush>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, color: T.inkDim, lineHeight: 1.5 }}>
              ask the director to edit the selection.
            </div>
            <div style={{
              border: `1px solid ${T.bezelHi}`, background: T.bg, padding: '6px 8px',
              fontSize: 11, color: T.inkDim,
            }}>
              <span style={{ color: T.phos, textShadow: T.glow }}>&gt; </span>make it breathe twice
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: T.inkMuted, textTransform: 'uppercase' }}>recent</div>
            <HistPill>slow down line 3</HistPill>
            <HistPill>add glitch at 2000ms</HistPill>
            <HistPill>loop scene</HistPill>
          </div>
        </window.MePanel>
      </div>

      {/* timeline */}
      <div style={{ gridColumn: '2 / 3', gridRow: '3 / 4', minHeight: 0 }}>
        <window.MeTimeline />
      </div>

      {/* statusbar */}
      <div style={{
        gridColumn: '1 / -1', gridRow: '4 / 5', background: T.bg, borderTop: `1px solid ${T.bezel}`,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 14,
        fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.inkMuted,
      }}>
        <span style={{ color: T.green, textShadow: T.glowG }}>● running</span>
        <span>30 Hz · 72 ticks · 240 × 67</span>
        <div style={{ flex: 1 }} />
        <span>notation · 11 events · 7 tracks</span>
        <span style={{ color: T.inkDim }}>|</span>
        <span>⌘/ help</span>
      </div>
    </div>
  );
};

function TreeRow({ depth, glyph, name, meta, effect, tone, selected, bold }) {
  const T = window.ME_T;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: `3px ${8 + depth * 12}px 3px ${8 + depth * 12}px`,
      background: selected ? 'rgba(255,169,75,0.08)' : 'transparent',
      borderLeft: `2px solid ${selected ? T.ink2 : 'transparent'}`,
    }}>
      <span style={{ color: tone || T.inkMuted, fontFamily: window.ME_FONTS.display, fontSize: 14, width: 12 }}>{glyph}</span>
      <span style={{ flex: 1, color: T.ink, fontWeight: bold ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {effect && <span style={{ color: tone, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{effect}</span>}
      {meta && <span style={{ color: T.inkMuted, fontSize: 9.5 }}>{meta}</span>}
    </div>
  );
}

function DslLine({ ln, kw, name, val, comment, at, cmd, str, mod, blank, selected, caret }) {
  const T = window.ME_T;
  if (blank) {
    return (
      <div style={{ display: 'flex', gap: 10 }}>
        <span style={{ color: T.inkFaint, width: 22, textAlign: 'right' }}>{ln}</span>
        <span>&nbsp;</span>
      </div>
    );
  }
  if (comment) {
    return (
      <div style={{ display: 'flex', gap: 10, background: selected ? 'rgba(255,169,75,0.05)' : 'transparent' }}>
        <span style={{ color: T.inkFaint, width: 22, textAlign: 'right' }}>{ln}</span>
        <span style={{ color: T.inkMuted, fontStyle: 'italic' }}>{comment}</span>
      </div>
    );
  }
  if (kw) {
    return (
      <div style={{ display: 'flex', gap: 10 }}>
        <span style={{ color: T.inkFaint, width: 22, textAlign: 'right' }}>{ln}</span>
        <span><span style={{ color: T.cyan, textShadow: T.glowC }}>{kw}</span> <span style={{ color: T.ink }}>{name}</span> <span style={{ color: T.inkDim }}>{val}</span></span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 10, background: selected ? 'rgba(255,169,75,0.06)' : 'transparent', borderLeft: `2px solid ${selected ? T.ink2 : 'transparent'}`, paddingLeft: selected ? 0 : 2 }}>
      <span style={{ color: T.inkFaint, width: 22, textAlign: 'right' }}>{ln}</span>
      <span>
        <span style={{ color: T.magenta, textShadow: T.glowM }}>at {at}</span>{'  '}
        <span style={{ color: T.ink }}>{cmd}</span>{'  '}
        <span style={{ color: T.phos, textShadow: T.glow }}>"{str}"</span>
        {mod && <> <span style={{ color: T.inkDim }}>{mod}</span></>}
        {caret && <span style={{ background: T.ink2, color: '#000', padding: '0 2px', marginLeft: 2 }}>_</span>}
      </span>
    </div>
  );
}

function InspectRow({ k, v, tone, swatch, editable }) {
  const T = window.ME_T;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 2px', fontSize: 10.5 }}>
      <div style={{ width: 76, color: T.inkMuted, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 9.5 }}>{k}</div>
      {swatch && <span style={{ width: 8, height: 8, background: swatch, boxShadow: `0 0 4px ${swatch}88` }} />}
      <div style={{
        flex: 1, textAlign: 'right', color: tone || T.ink,
        textShadow: tone ? `0 0 4px ${tone}66` : 'none',
        borderBottom: editable ? `1px dotted ${T.bezelHi}` : 'none',
      }}>{v}</div>
    </div>
  );
}

function MiniKnob({ label, val, pct, dim }) {
  const T = window.ME_T;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px', fontSize: 10 }}>
      <div style={{ width: 66, color: dim ? T.inkMuted : T.inkDim, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 9.5 }}>{label}</div>
      <div style={{ flex: 1, height: 4, background: T.bg, border: `1px solid ${T.bezel}`, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: dim ? T.inkFaint : T.phos, boxShadow: dim ? 'none' : T.glow }} />
      </div>
      <div style={{ width: 40, textAlign: 'right', color: dim ? T.inkMuted : T.ink, fontSize: 10 }}>{val}</div>
    </div>
  );
}

function HistPill({ children }) {
  const T = window.ME_T;
  return (
    <div style={{
      fontSize: 10.5, color: T.inkDim,
      border: `1px solid ${T.bezel}`, padding: '3px 8px', cursor: 'pointer',
    }}>{children}</div>
  );
}
