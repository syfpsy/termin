// me-core.jsx — Motion Engine shared tokens + primitives.
// Broadcast-adjacent: same palette vocabulary, but loosened for a tool.
// Tools live longer at small sizes, need denser information, and the
// "costume" should recede. So: JetBrains Mono UI, VT323 reserved for
// display-only moments (preview title cards, hero numbers), less glow.

window.ME_T = {
  bg:        '#0A0C09',
  workspace: '#0d1110',   // slightly lifted from bg for the main pane
  panel:     '#121815',   // panel background
  panelHi:   '#171e1a',   // hover / selected row
  bezel:     '#1e2722',   // panel border
  bezelHi:   '#2d3a32',   // emphasized border / dashed rules
  bezelLo:   '#161d19',   // subtle divider

  // phosphor tones — same vocabulary, slightly desaturated for tool use
  phos:      '#D6F04A',   // primary — was #E8FF59, desat a touch
  phosDim:   '#8aa028',
  amber:     '#FFA94B',   // selected / playhead
  amberDim:  '#a86a2a',
  green:     '#7FE093',   // ok / success
  red:       '#FF6B6B',   // destructive / error
  cyan:      '#7FE3E0',   // thinking / agent
  magenta:   '#E77FD9',   // new accent — for motion keyframe markers

  // ink (text)
  ink:       '#CDDDA0',   // body text
  inkDim:    '#7A8F56',   // secondary
  inkMuted:  '#4a5834',   // tertiary / labels
  inkFaint:  '#2f3a22',   // border-weight text
  ink2:      '#FFC985',   // amber-tinted secondary

  glow:   '0 0 4px rgba(214,240,74,0.45), 0 0 10px rgba(214,240,74,0.18)',
  glowA:  '0 0 4px rgba(255,169,75,0.45), 0 0 10px rgba(255,169,75,0.16)',
  glowR:  '0 0 4px rgba(255,107,107,0.45), 0 0 10px rgba(255,107,107,0.16)',
  glowG:  '0 0 4px rgba(127,224,147,0.45), 0 0 10px rgba(127,224,147,0.16)',
  glowM:  '0 0 4px rgba(231,127,217,0.45), 0 0 10px rgba(231,127,217,0.16)',
  glowC:  '0 0 4px rgba(127,227,224,0.45), 0 0 10px rgba(127,227,224,0.16)',
};

window.ME_FONTS = {
  display: "'VT323', 'Courier New', monospace",
  ui:      "'JetBrains Mono', ui-monospace, monospace",
  uiAlt:   "'IBM Plex Mono', monospace",
};

// ── panel primitive ──────────────────────────────────────────
window.MePanel = function MePanel({ title, tools, children, style, accent, flags, flush, dense, footer }) {
  const T = window.ME_T;
  const a = accent || T.phos;
  const glow = a === T.phos ? T.glow : a === T.amber ? T.glowA : a === T.red ? T.glowR
             : a === T.green ? T.glowG : a === T.magenta ? T.glowM : a === T.cyan ? T.glowC : T.glow;
  return (
    <div style={{
      border: `1px solid ${T.bezel}`,
      background: T.panel,
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      minWidth: 0, minHeight: 0,
      ...style,
    }}>
      {(title || tools) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px 6px 10px',
          borderBottom: `1px solid ${T.bezel}`,
          background: T.bg,
          fontFamily: window.ME_FONTS.ui,
          fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: T.inkDim, minHeight: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {title && (
              <>
                <span style={{ color: a, textShadow: glow }}>◼</span>
                <span style={{ color: T.ink }}>{title}</span>
                {flags && <span style={{ color: T.inkMuted, marginLeft: 6 }}>{flags}</span>}
              </>
            )}
          </div>
          {tools && <div style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0 }}>{tools}</div>}
        </div>
      )}
      <div style={{
        flex: 1, minHeight: 0, minWidth: 0,
        padding: flush ? 0 : (dense ? '8px 10px' : '12px 14px'),
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
      {footer && (
        <div style={{
          padding: '5px 10px',
          borderTop: `1px solid ${T.bezel}`,
          background: T.bg,
          fontFamily: window.ME_FONTS.ui,
          fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: T.inkMuted,
        }}>{footer}</div>
      )}
    </div>
  );
};

// ── display phosphor (VT323) ─────────────────────────────────
window.Phos = function Phos({ children, tone = 'phos', sz = 20, style, glow = true }) {
  const T = window.ME_T;
  const c = tone === 'amber' ? T.ink2 : tone === 'red' ? T.red : tone === 'green' ? T.green
          : tone === 'magenta' ? T.magenta : tone === 'cyan' ? T.cyan
          : tone === 'dim' ? T.inkDim : T.ink;
  const g = tone === 'amber' ? T.glowA : tone === 'red' ? T.glowR : tone === 'green' ? T.glowG
          : tone === 'magenta' ? T.glowM : tone === 'cyan' ? T.glowC : T.glow;
  return (
    <span style={{
      fontFamily: window.ME_FONTS.display,
      fontSize: sz, lineHeight: 1, color: c,
      textShadow: glow ? g : 'none',
      ...style,
    }}>{children}</span>
  );
};

// ── label / eyebrow ──────────────────────────────────────────
window.MeLabel = function MeLabel({ children, tone, style }) {
  const T = window.ME_T;
  return (
    <span style={{
      fontFamily: window.ME_FONTS.ui,
      fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: tone === 'active' ? T.ink2 : tone === 'dim' ? T.inkMuted : T.inkDim,
      ...style,
    }}>{children}</span>
  );
};

// ── small button ─────────────────────────────────────────────
window.MeBtn = function MeBtn({ children, active, tone, onClick, style, icon, kbd }) {
  const T = window.ME_T;
  const c = active ? T.ink2 : tone === 'prim' ? T.phos : tone === 'red' ? T.red : T.ink;
  const border = active ? T.amberDim : tone === 'prim' ? T.phosDim : T.bezelHi;
  return (
    <button onClick={onClick} style={{
      fontFamily: window.ME_FONTS.ui, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
      background: active ? 'rgba(255,169,75,0.08)' : 'transparent',
      color: c, border: `1px solid ${border}`,
      padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      ...style,
    }}>
      {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
      {children}
      {kbd && <span style={{ color: T.inkMuted, marginLeft: 4, fontSize: 9 }}>{kbd}</span>}
    </button>
  );
};

// ── scanline overlay ─────────────────────────────────────────
window.MeScan = function MeScan({ children, intensity = 0.5, curve = true, style }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
      {children}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
        background: `repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,0) 2px, rgba(0,0,0,${0.28 * intensity}) 2px, rgba(0,0,0,${0.28 * intensity}) 3px)`,
      }} />
      {curve && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 130% 105% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }} />
      )}
    </div>
  );
};

// ── row hover helper ─────────────────────────────────────────
window.MeRow = function MeRow({ selected, hover, children, style, onClick }) {
  const T = window.ME_T;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '4px 8px',
      fontFamily: window.ME_FONTS.ui, fontSize: 11.5,
      color: T.ink,
      background: selected ? 'rgba(255,169,75,0.07)' : hover ? T.panelHi : 'transparent',
      borderLeft: `2px solid ${selected ? T.ink2 : 'transparent'}`,
      cursor: 'pointer',
      ...style,
    }}>{children}</div>
  );
};
