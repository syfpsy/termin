// me-preview.jsx — the CRT preview component used across all surfaces.
// Renders a static demo frame of terminal content with chrome variants:
//   chrome: 'bezel' | 'flat' | 'none'
// content is a small catalog of canned "scenes" the designs can reference.

window.MePreview = function MePreview({ chrome = 'bezel', scene = 'boot', width, height, intensity = 0.7, playhead = '0:02.400' }) {
  const T = window.ME_T;
  const content = window.ME_SCENES[scene] || window.ME_SCENES.boot;

  const inner = (
    <div style={{
      width: '100%', height: '100%', background: '#050604', position: 'relative',
      fontFamily: window.ME_FONTS.display,
      color: T.ink, textShadow: T.glow,
      overflow: 'hidden',
    }}>
      <window.MeScan intensity={intensity} curve={chrome === 'bezel'} style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: chrome === 'bezel' ? '28px 36px' : '20px 26px', position: 'relative', zIndex: 1 }}>
          {content(T)}
        </div>
      </window.MeScan>
    </div>
  );

  if (chrome === 'none') {
    return <div style={{ width: width || '100%', height: height || '100%', background: '#050604' }}>{inner}</div>;
  }
  if (chrome === 'flat') {
    return (
      <div style={{
        width: width || '100%', height: height || '100%',
        border: `1px dashed ${T.bezelHi}`, padding: 6, background: T.bg, boxSizing: 'border-box',
      }}>
        <div style={{ width: '100%', height: '100%', border: `1px solid ${T.bezel}` }}>{inner}</div>
      </div>
    );
  }
  // bezel — rounded CRT hardware
  return (
    <div style={{
      width: width || '100%', height: height || '100%',
      background: 'linear-gradient(180deg, #1a221c 0%, #0e1310 100%)',
      padding: 18, boxSizing: 'border-box', borderRadius: 14,
      boxShadow: 'inset 0 0 0 1px #000, inset 0 0 20px rgba(0,0,0,0.6), 0 2px 16px rgba(0,0,0,0.5)',
      position: 'relative',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden',
        boxShadow: 'inset 0 0 0 2px #000, inset 0 0 24px rgba(0,0,0,0.7)',
      }}>{inner}</div>
      <div style={{
        position: 'absolute', bottom: 4, right: 14,
        fontFamily: window.ME_FONTS.ui, fontSize: 9, color: T.inkMuted, letterSpacing: '0.12em',
      }}>t {playhead}</div>
    </div>
  );
};

// ── scene catalog ─────────────────────────────────────────────
// Each scene is a function of theme → JSX. Static "frozen frame" of the animation
// at a specific moment. Used in previews across the tool.
window.ME_SCENES = {
  boot: (T) => (
    <div style={{ lineHeight: 1.15, fontSize: 20 }}>
      <div style={{ color: T.phos, textShadow: T.glow, fontSize: 28, marginBottom: 4 }}>REMZI OS v0.4.1</div>
      <div style={{ color: T.inkDim, fontSize: 16, marginBottom: 16 }}>CRT workstation · boot sequence</div>
      <div style={{ color: T.green, textShadow: T.glowG }}>[OK] phosphor buffer · 240×67 cells</div>
      <div style={{ color: T.green, textShadow: T.glowG }}>[OK] palette loaded · 6 phosphor tones</div>
      <div style={{ color: T.green, textShadow: T.glowG }}>[OK] clock locked · 30 Hz</div>
      <div style={{ color: T.ink2, textShadow: T.glowA }}>[..] warming phosphor</div>
      <div style={{ marginTop: 18, color: T.ink, fontSize: 16 }}>
        &gt; SYSTEM READY<span style={{ background: T.ink, color: '#000', marginLeft: 4, padding: '0 6px' }}>_</span>
      </div>
    </div>
  ),
  typewriter: (T) => (
    <div style={{ lineHeight: 1.2, fontSize: 22 }}>
      <div style={{ color: T.phos, textShadow: T.glow, fontSize: 36, letterSpacing: '0.04em' }}>MEMORIES · 147</div>
      <div style={{ color: T.inkDim, fontSize: 14, marginTop: 2, marginBottom: 22 }}>loading dispatch</div>
      <div style={{ color: T.ink, fontSize: 18 }}>
        <span style={{ color: T.inkMuted }}>&gt; </span>
        the agent remembered<span style={{ background: T.ink, color: '#000', padding: '0 4px', marginLeft: 2 }}>_</span>
      </div>
    </div>
  ),
  glitch: (T) => (
    <div style={{ fontSize: 22, lineHeight: 1.2 }}>
      <div style={{ color: T.red, textShadow: T.glowR, fontSize: 28 }}>S█STEM F▓ULT</div>
      <div style={{ color: T.inkDim, fontSize: 14, marginBottom: 12 }}>cell corruption · re-render</div>
      <div style={{ color: T.ink, fontSize: 16 }}>
        <span style={{ color: T.red }}>E</span>rr<span style={{ color: T.magenta, textShadow: T.glowM }}>░</span>r : phos<span style={{ color: T.cyan, textShadow: T.glowC }}>▒</span>hor buffer
      </div>
      <div style={{ color: T.inkMuted, fontSize: 14 }}>retry in <span style={{ color: T.ink2 }}>0.2s</span>...</div>
    </div>
  ),
  scan: (T) => (
    <div style={{ fontSize: 18, lineHeight: 1.2, position: 'relative' }}>
      <div style={{ color: T.phos, fontSize: 28, textShadow: T.glow }}>SCAN</div>
      <div style={{ color: T.inkDim, fontSize: 14, marginBottom: 16 }}>row 14/67</div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ color: i === 3 ? T.ink2 : T.inkDim, textShadow: i === 3 ? T.glowA : 'none' }}>
          {['░░░░░░░░░░░░░░░░', '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒', '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', '████████████████', '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒'][i]}
        </div>
      ))}
    </div>
  ),
  cursor: (T) => (
    <div style={{ fontSize: 26, lineHeight: 1.3 }}>
      <div style={{ color: T.inkDim, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>&gt; await input</div>
      <div style={{ color: T.ink }}>
        enter command<span style={{ background: T.ink, color: '#000', padding: '0 8px', marginLeft: 6 }}>_</span>
      </div>
    </div>
  ),
  loop: (T) => (
    <div style={{ fontSize: 18, lineHeight: 1.3 }}>
      <div style={{ color: T.phos, textShadow: T.glow, fontSize: 28, marginBottom: 10 }}>STANDBY</div>
      <div style={{ color: T.cyan, textShadow: T.glowC }}>◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣</div>
      <div style={{ color: T.inkDim, marginTop: 14 }}>loop · 00:02 / 00:02</div>
    </div>
  ),
};
