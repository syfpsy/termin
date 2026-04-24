// me-hero-v1.jsx — AI-NATIVE authoring view.
// Preview center. Claude chat is the primary left panel; DSL is the receipt below.
// Timeline bottom. Knobs + effect palette right.
// Target: motion designer who wants to *talk* a scene into existence.

window.MeHeroV1 = function MeHeroV1() {
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
      {/* ── titlebar ─────────────────────────────────────────── */}
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
        <span style={{ color: T.ink2, textShadow: T.glowA }}>AI · vibe</span>
        <span style={{ color: T.inkMuted, marginLeft: 4 }}>/</span>
        <span style={{ color: T.inkMuted }}>notation</span>
        <div style={{ width: 1, height: 16, background: T.bezel, margin: '0 4px' }} />
        <window.MeBtn>◐ preview</window.MeBtn>
        <window.MeBtn tone="prim">↗ export</window.MeBtn>
      </div>

      {/* ── left: CLAUDE CHAT (primary) ──────────────────────── */}
      <div style={{ gridRow: '2 / 4', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
        <window.MePanel
          title="DIRECTOR"
          flags="haiku-4.5"
          accent={T.cyan}
          style={{ flex: 1, minHeight: 0 }}
          flush
          footer="⌘ + K  focus  ·  ⌘ + ⏎  run last"
        >
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            {/* chat turn: user */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.14em', color: T.inkMuted, textTransform: 'uppercase', marginBottom: 3 }}>you · 14:22</div>
              <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.45 }}>
                make a boot sequence. three OK lines that type in, then warming phosphor pulses amber, then SYSTEM READY appears with a blinking cursor.
              </div>
            </div>

            {/* chat turn: claude */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.14em', color: T.cyan, textShadow: T.glowC, textTransform: 'uppercase', marginBottom: 3 }}>director · 14:22</div>
              <div style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.5, marginBottom: 8 }}>
                drafted a 2.4s sequence. three status lines at 30ms/char, a 600ms amber pulse on "warming phosphor," then the cursor lands at 2000ms. want the OK's to land simultaneously or staggered?
              </div>
              <div style={{
                border: `1px solid ${T.bezel}`, background: '#0a0e0b',
                fontFamily: F.ui, fontSize: 11, padding: '8px 10px',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ color: T.inkMuted, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>proposed · boot_sequence_v3</div>
                <div><span style={{ color: T.magenta }}>at 0ms</span> <span style={{ color: T.ink }}>type</span> <span style={{ color: T.phos }}>"phosphor buffer · 240×67 cells"</span> <span style={{ color: T.inkDim }}>slowly</span></div>
                <div><span style={{ color: T.magenta }}>at 400ms</span> <span style={{ color: T.ink }}>type</span> <span style={{ color: T.phos }}>"palette loaded · 6 tones"</span></div>
                <div><span style={{ color: T.magenta }}>at 800ms</span> <span style={{ color: T.ink }}>type</span> <span style={{ color: T.phos }}>"clock locked · 30 Hz"</span></div>
                <div><span style={{ color: T.magenta }}>at 1200ms</span> <span style={{ color: T.ink2 }}>pulse</span> <span style={{ color: T.phos }}>"warming phosphor"</span> <span style={{ color: T.inkDim }}>amber 600ms</span></div>
                <div><span style={{ color: T.magenta }}>at 2000ms</span> <span style={{ color: T.ink }}>reveal</span> <span style={{ color: T.phos }}>"SYSTEM READY"</span> <span style={{ color: T.inkDim }}>with blinking cursor</span></div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <window.MeBtn tone="prim">✓ commit</window.MeBtn>
                <window.MeBtn>↻ rewrite</window.MeBtn>
                <window.MeBtn>◐ preview only</window.MeBtn>
              </div>
            </div>

            {/* chat turn: user (pending) */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.14em', color: T.inkMuted, textTransform: 'uppercase', marginBottom: 3 }}>you · 14:24</div>
              <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.45 }}>
                stagger the OKs, and make SYSTEM READY glitch for 80ms before settling
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.cyan, fontSize: 11, textShadow: T.glowC }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, background: T.cyan, boxShadow: T.glowC }} />
              drafting
            </div>
          </div>

          {/* chat input */}
          <div style={{ borderTop: `1px solid ${T.bezel}`, padding: 10, background: T.panel }}>
            <div style={{
              border: `1px solid ${T.bezelHi}`, background: T.bg, padding: '8px 10px',
              fontSize: 12, color: T.inkDim, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ color: T.phos, textShadow: T.glow }}>&gt;</span>
              <span style={{ color: T.inkMuted, flex: 1 }}>describe a motion…</span>
              <span style={{ color: T.inkMuted, fontSize: 9, letterSpacing: '0.14em' }}>⌘ ⏎</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <SuggestPill>add glitch burst</SuggestPill>
              <SuggestPill>slow it down</SuggestPill>
              <SuggestPill>loop it</SuggestPill>
              <SuggestPill>make 1-bit</SuggestPill>
            </div>
          </div>
        </window.MePanel>
      </div>

      {/* ── center: PREVIEW ──────────────────────────────────── */}
      <div style={{ gridRow: '2 / 3', position: 'relative', minHeight: 0, background: T.workspace, borderLeft: `1px solid ${T.bezel}`, borderRight: `1px solid ${T.bezel}` }}>
        {/* preview toolbar */}
        <div style={{
          position: 'absolute', top: 10, left: 14, right: 14, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <window.MeLabel>chrome</window.MeLabel>
          <window.MeBtn active>bezel</window.MeBtn>
          <window.MeBtn>flat</window.MeBtn>
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
            <window.MePreview chrome="bezel" scene="boot" intensity={0.7} playhead="0:01.200" />
          </div>
        </div>

        {/* transport */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          borderTop: `1px solid ${T.bezel}`, background: T.bg,
          display: 'flex', alignItems: 'center', padding: '8px 14px', gap: 10, height: 46, boxSizing: 'border-box',
        }}>
          <window.MeBtn>⏮</window.MeBtn>
          <window.MeBtn tone="prim" style={{ padding: '6px 14px' }}>▶ play</window.MeBtn>
          <window.MeBtn>⏭</window.MeBtn>
          <window.MeBtn>◐ loop</window.MeBtn>
          <div style={{ width: 1, height: 18, background: T.bezel, margin: '0 6px' }} />
          <window.Phos sz={22} tone="amber">00:01.200</window.Phos>
          <span style={{ color: T.inkMuted, fontSize: 11 }}>/ 00:02.400</span>
          <div style={{ flex: 1 }} />
          <window.MeLabel>tick</window.MeLabel>
          <window.Phos sz={18}>036</window.Phos>
          <span style={{ color: T.inkMuted, fontSize: 11 }}>/ 072</span>
        </div>
      </div>

      {/* ── right: KNOBS + EFFECTS ───────────────────────────── */}
      <div style={{ gridRow: '2 / 4', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
        <window.MePanel title="PHOSPHOR" dense style={{ flex: '0 0 auto' }}>
          <KnobRow label="decay" value="240ms" pct={0.45} />
          <KnobRow label="bloom" value="1.8" pct={0.60} />
          <KnobRow label="scanlines" value="0.70" pct={0.70} />
          <KnobRow label="curvature" value="0.35" pct={0.35} />
          <KnobRow label="flicker" value="0.12" pct={0.12} />
          <KnobRow label="chromatic" value="0.00" pct={0.00} dim />
        </window.MePanel>

        <window.MePanel title="EFFECTS" flags="12 primitives" dense style={{ flex: 1, minHeight: 0 }} flush>
          <div style={{ overflowY: 'auto', padding: '6px 4px' }}>
            <EffectRow glyph="▎" name="type" sub="glyph per tick" tone={T.phos} used={3} />
            <EffectRow glyph="▮" name="cursor-blink" sub="duty 50%" tone={T.ink} used={1} />
            <EffectRow glyph="▬" name="scan-line" sub="row sweep" tone={T.cyan} />
            <EffectRow glyph="◈" name="glitch" sub="random cell swap" tone={T.magenta} used={1} selected />
            <EffectRow glyph="◐" name="pulse" sub="intensity ramp" tone={T.amber} used={1} />
            <EffectRow glyph="▓" name="decay-trail" sub="path + phosphor" tone={T.phos} />
            <EffectRow glyph="▞" name="dither" sub="ramp via bayer" tone={T.ink} />
            <EffectRow glyph="~" name="wave" sub="row offset sin" tone={T.cyan} />
            <EffectRow glyph="▚" name="wipe" sub="distance-field reveal" tone={T.phos} />
            <EffectRow glyph="⟲" name="loop" sub="seamless restart" tone={T.green} />
            <EffectRow glyph="≡" name="shake" sub="horizontal tear" tone={T.red} />
            <EffectRow glyph="✱" name="flash" sub="whole-screen spike" tone={T.ink2} />
          </div>
        </window.MePanel>
      </div>

      {/* ── bottom: TIMELINE ─────────────────────────────────── */}
      <div style={{ gridColumn: '2 / 3', gridRow: '3 / 4', minHeight: 0 }}>
        <window.MeTimeline />
      </div>

      {/* ── statusbar ────────────────────────────────────────── */}
      <div style={{
        gridColumn: '1 / -1', gridRow: '4 / 5', background: T.bg, borderTop: `1px solid ${T.bezel}`,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 14,
        fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.inkMuted,
      }}>
        <span style={{ color: T.green, textShadow: T.glowG }}>● running</span>
        <span>30 Hz · 72 ticks · 240 × 67</span>
        <div style={{ flex: 1 }} />
        <span>claude · haiku 4.5 · 8 turns · $0.043</span>
        <span style={{ color: T.inkDim }}>|</span>
        <span>⌘/ help</span>
      </div>
    </div>
  );
};

function SuggestPill({ children }) {
  const T = window.ME_T;
  return (
    <span style={{
      fontFamily: window.ME_FONTS.ui, fontSize: 10,
      color: T.inkDim, border: `1px solid ${T.bezel}`,
      padding: '2px 8px', cursor: 'pointer',
    }}>{children}</span>
  );
}

function KnobRow({ label, value, pct, dim }) {
  const T = window.ME_T;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
      <div style={{ width: 68, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: dim ? T.inkMuted : T.inkDim }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: T.bg, border: `1px solid ${T.bezel}`, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: dim ? T.inkFaint : T.phos, boxShadow: dim ? 'none' : T.glow }} />
      </div>
      <div style={{ width: 54, textAlign: 'right', fontFamily: window.ME_FONTS.ui, fontSize: 10.5, color: dim ? T.inkMuted : T.ink }}>{value}</div>
    </div>
  );
}

function EffectRow({ glyph, name, sub, tone, used, selected }) {
  const T = window.ME_T;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
      background: selected ? 'rgba(255,169,75,0.07)' : 'transparent',
      borderLeft: `2px solid ${selected ? T.ink2 : 'transparent'}`,
      fontFamily: window.ME_FONTS.ui, fontSize: 11,
    }}>
      <span style={{ fontFamily: window.ME_FONTS.display, fontSize: 18, color: tone, textShadow: `0 0 4px ${tone}44`, width: 16 }}>{glyph}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: T.ink }}>{name}</div>
        <div style={{ color: T.inkMuted, fontSize: 9.5 }}>{sub}</div>
      </div>
      {used ? (
        <span style={{ color: T.ink2, fontSize: 9.5, letterSpacing: '0.14em' }}>×{used}</span>
      ) : (
        <span style={{ color: T.inkFaint, fontSize: 9.5 }}>—</span>
      )}
    </div>
  );
}
