// me-timeline.jsx — the timeline panel shared by both hero views.
// Tracks: scene layers. Ticks at 30 Hz. Keyframes as magenta diamonds.
// Playhead is amber vertical line.

window.MeTimeline = function MeTimeline() {
  const T = window.ME_T;
  const F = window.ME_FONTS;
  const durTicks = 72; // 2.4s @ 30Hz
  const playTick = 36;

  // track definitions
  const tracks = [
    { name: 'status · line 1', effect: 'type', tone: T.phos, start: 0,  len: 18, keys: [0, 18] },
    { name: 'status · line 2', effect: 'type', tone: T.phos, start: 12, len: 18, keys: [12, 30] },
    { name: 'status · line 3', effect: 'type', tone: T.phos, start: 24, len: 18, keys: [24, 42] },
    { name: 'warming phosphor', effect: 'pulse', tone: T.amber, start: 36, len: 18, keys: [36, 45, 54] },
    { name: 'SYSTEM READY', effect: 'reveal', tone: T.phos, start: 56, len: 4, keys: [56, 60] },
    { name: 'glitch burst', effect: 'glitch', tone: T.magenta, start: 58, len: 4, keys: [58, 62] },
    { name: 'cursor', effect: 'cursor-blink', tone: T.ink, start: 60, len: 12, keys: [60, 66, 72] },
  ];

  return (
    <window.MePanel
      title="TIMELINE"
      flags="30 Hz · 72 ticks · 2.4s"
      tools={
        <>
          <window.MeBtn>tick</window.MeBtn>
          <window.MeBtn active>frame</window.MeBtn>
          <window.MeBtn>ms</window.MeBtn>
          <div style={{ width: 1, height: 16, background: T.bezel, margin: '0 4px' }} />
          <window.MeBtn>− zoom</window.MeBtn>
          <window.MeBtn>+ zoom</window.MeBtn>
        </>
      }
      flush
      style={{ height: '100%' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, fontFamily: F.ui, fontSize: 10 }}>
        {/* ruler */}
        <div style={{
          display: 'grid', gridTemplateColumns: '170px 1fr', borderBottom: `1px solid ${T.bezel}`, background: T.bg,
        }}>
          <div style={{ padding: '4px 10px', color: T.inkMuted, letterSpacing: '0.14em', textTransform: 'uppercase', borderRight: `1px solid ${T.bezel}` }}>track</div>
          <div style={{ position: 'relative', height: 22 }}>
            {Array.from({ length: durTicks / 6 + 1 }).map((_, i) => {
              const tick = i * 6;
              const pct = (tick / durTicks) * 100;
              const isSec = tick % 30 === 0;
              return (
                <div key={i} style={{
                  position: 'absolute', left: `${pct}%`, top: 0, bottom: 0,
                  borderLeft: `1px solid ${isSec ? T.bezelHi : T.bezel}`,
                  paddingLeft: 4, fontSize: 9,
                  color: isSec ? T.inkDim : T.inkMuted,
                }}>{isSec ? `${(tick/30).toFixed(1)}s` : tick}</div>
              );
            })}
            {/* playhead on ruler */}
            <div style={{
              position: 'absolute', left: `${(playTick/durTicks)*100}%`, top: 0, bottom: 0,
              width: 1, background: T.ink2, boxShadow: T.glowA,
            }} />
          </div>
        </div>

        {/* tracks */}
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          {tracks.map((tr, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '170px 1fr',
              borderBottom: `1px solid ${T.bezelLo}`,
              background: i === 3 ? 'rgba(255,169,75,0.04)' : 'transparent',
            }}>
              <div style={{
                padding: '6px 10px', borderRight: `1px solid ${T.bezel}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: T.inkMuted, fontSize: 9 }}>◉</span>
                <span style={{ color: T.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.name}</span>
                <span style={{ color: tr.tone, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{tr.effect}</span>
              </div>
              <div style={{ position: 'relative', height: 24 }}>
                {/* bar */}
                <div style={{
                  position: 'absolute',
                  left: `${(tr.start/durTicks)*100}%`,
                  width: `${(tr.len/durTicks)*100}%`,
                  top: 5, bottom: 5,
                  background: `${tr.tone}22`,
                  border: `1px solid ${tr.tone}66`,
                }} />
                {/* keyframes */}
                {tr.keys.map((k, j) => (
                  <div key={j} style={{
                    position: 'absolute',
                    left: `${(k/durTicks)*100}%`, top: '50%',
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    width: 8, height: 8, background: T.magenta, boxShadow: T.glowM,
                  }} />
                ))}
                {/* playhead line */}
                {playTick >= tr.start && playTick <= tr.start + tr.len && (
                  <div style={{
                    position: 'absolute', left: `${(playTick/durTicks)*100}%`, top: 0, bottom: 0,
                    width: 1, background: T.ink2, boxShadow: T.glowA,
                  }} />
                )}
              </div>
            </div>
          ))}
          {/* full-height playhead */}
          <div style={{
            position: 'absolute', left: `calc(170px + ${(playTick/durTicks)*100}% - 170px * ${playTick/durTicks})`,
            top: 0, bottom: 0, width: 1, pointerEvents: 'none',
          }} />
        </div>
      </div>
    </window.MePanel>
  );
};
