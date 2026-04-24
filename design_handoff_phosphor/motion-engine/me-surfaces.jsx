// me-surfaces.jsx — non-hero surfaces for the motion engine.
// Library, Effect detail, Assets, Export, Onboarding, Settings, Empty state.

// ─── Scene Library / Preset Gallery ──────────────────────────
window.MeLibrary = function MeLibrary() {
  const T = window.ME_T;
  const F = window.ME_FONTS;

  const shelves = [
    { name: 'boot sequences', count: 14, items: ['boot_classic', 'boot_dec_vt320', 'boot_severance', 'boot_glitched'] },
    { name: 'loading loops',  count: 22, items: ['pulse_loop', 'sweep_loop', 'dot_breath', 'standby_wave'] },
    { name: 'transitions',    count: 18, items: ['wipe_diag', 'fade_stipple', 'melt_down', 'tear_across'] },
    { name: 'errors & alerts',count: 11, items: ['fault_red', 'warn_amber', 'retry_anim', 'panic_flash'] },
    { name: 'type reveals',   count: 26, items: ['type_slow', 'type_stagger', 'reveal_bayer', 'fax_in'] },
    { name: 'backdrops',      count: 8,  items: ['starfield', 'rain_char', 'noise_bed', 'grid_drift'] },
  ];

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg, color: T.ink, fontFamily: F.ui,
      display: 'grid', gridTemplateRows: '44px 1fr 22px', gap: 1,
    }}>
      <div style={{ padding: '0 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${T.bezel}` }}>
        <span style={{ color: T.phos, textShadow: T.glow, fontSize: 12, letterSpacing: '0.2em' }}>◼ LIBRARY</span>
        <span style={{ color: T.inkMuted }}>·</span>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: T.inkDim, textTransform: 'uppercase' }}>99 scenes · 6 shelves · built-in + community</span>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, border: `1px solid ${T.bezelHi}`, padding: '5px 10px', color: T.inkDim, minWidth: 260 }}>
          <span style={{ color: T.phos, textShadow: T.glow }}>&gt;</span> <span style={{ color: T.inkMuted }}>search scenes…</span>
        </div>
        <window.MeBtn icon="+" tone="prim">new from scratch</window.MeBtn>
      </div>

      <div style={{ overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {shelves.map((s, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
              <window.Phos sz={24}>{s.name}</window.Phos>
              <span style={{ color: T.inkMuted, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{s.count} scenes</span>
              <div style={{ flex: 1, borderBottom: `1px dashed ${T.bezelHi}`, marginLeft: 8, marginBottom: 6 }} />
              <span style={{ color: T.inkDim, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>see all →</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {s.items.map((it, j) => <LibCard key={j} name={it} shelf={s.name} idx={j} />)}
            </div>
          </div>
        ))}
      </div>

      <Statusbar text="BROWSE · 99 / 99 · ⏎ open · F fork · ␣ preview loop" />
    </div>
  );
};

function LibCard({ name, shelf, idx }) {
  const T = window.ME_T;
  // alternate scene content across cards
  const scenes = ['boot', 'typewriter', 'glitch', 'scan', 'cursor', 'loop'];
  const scene = scenes[idx % scenes.length];
  return (
    <div style={{ border: `1px solid ${T.bezel}`, background: T.panel, display: 'flex', flexDirection: 'column' }}>
      <div style={{ aspectRatio: '16 / 10', overflow: 'hidden', position: 'relative' }}>
        <window.MePreview chrome="none" scene={scene} intensity={0.55} />
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${T.bezel}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.ink, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ color: T.inkMuted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{shelf} · 2.{idx % 9}s</div>
        </div>
        <span style={{ color: T.inkDim, fontSize: 10 }}>◉ {14 + idx * 3}</span>
      </div>
    </div>
  );
}

// ─── Effect Palette Detail ───────────────────────────────────
window.MeEffectDetail = function MeEffectDetail() {
  const T = window.ME_T;
  const F = window.ME_FONTS;

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg, color: T.ink, fontFamily: F.ui,
      display: 'grid', gridTemplateColumns: '220px 1fr 340px', gridTemplateRows: '44px 1fr 22px', gap: 1,
    }}>
      <div style={{ gridColumn: '1 / -1', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${T.bezel}` }}>
        <span style={{ color: T.phos, textShadow: T.glow, fontSize: 12, letterSpacing: '0.2em' }}>◼ EFFECTS</span>
        <span style={{ color: T.inkMuted }}>·</span>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: T.inkDim, textTransform: 'uppercase' }}>12 built-in primitives · composable · source-editable</span>
        <div style={{ flex: 1 }} />
        <window.MeBtn>+ new primitive</window.MeBtn>
      </div>

      {/* list */}
      <window.MePanel title="PRIMITIVES" flush dense style={{ gridRow: '2 / 3', borderRight: `1px solid ${T.bezel}` }}>
        <div style={{ overflowY: 'auto', padding: '4px 0' }}>
          {[
            { g: '▎', n: 'type', sub: 'glyph per tick', t: T.phos },
            { g: '▮', n: 'cursor-blink', sub: 'duty 50%', t: T.ink },
            { g: '▬', n: 'scan-line', sub: 'row sweep', t: T.cyan },
            { g: '◈', n: 'glitch', sub: 'random cell swap', t: T.magenta, sel: true },
            { g: '◐', n: 'pulse', sub: 'intensity ramp', t: T.amber },
            { g: '▓', n: 'decay-trail', sub: 'path + phosphor', t: T.phos },
            { g: '▞', n: 'dither', sub: 'ramp via bayer', t: T.ink },
            { g: '~', n: 'wave', sub: 'row offset sin', t: T.cyan },
            { g: '▚', n: 'wipe', sub: 'distance-field reveal', t: T.phos },
            { g: '⟲', n: 'loop', sub: 'seamless restart', t: T.green },
            { g: '≡', n: 'shake', sub: 'horizontal tear', t: T.red },
            { g: '✱', n: 'flash', sub: 'whole-screen spike', t: T.ink2 },
          ].map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
              background: e.sel ? 'rgba(255,169,75,0.07)' : 'transparent',
              borderLeft: `2px solid ${e.sel ? T.ink2 : 'transparent'}`,
            }}>
              <span style={{ fontFamily: F.display, fontSize: 18, color: e.t, width: 14, textShadow: `0 0 4px ${e.t}44` }}>{e.g}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.ink, fontSize: 11 }}>{e.n}</div>
                <div style={{ color: T.inkMuted, fontSize: 9 }}>{e.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </window.MePanel>

      {/* demo area */}
      <div style={{ gridRow: '2 / 3', background: T.workspace, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div>
          <window.MeLabel>primitive</window.MeLabel>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <window.Phos sz={42} tone="magenta">◈ glitch</window.Phos>
            <span style={{ color: T.inkDim, fontSize: 12 }}>random cell swap · 80ms burst</span>
          </div>
          <div style={{ color: T.inkDim, fontSize: 11.5, lineHeight: 1.55, marginTop: 10, maxWidth: 620 }}>
            corrupts N random cells for K ticks with random glyphs from a pool, then restores. pairs well with
            <span style={{ color: T.ink }}> reveal</span>,
            <span style={{ color: T.ink }}> type</span>, and
            <span style={{ color: T.ink }}> shake</span>. cheap — O(N) per tick.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ border: `1px solid ${T.bezel}`, background: T.panel }}>
              <div style={{ aspectRatio: '16 / 10' }}>
                <window.MePreview chrome="none" scene="glitch" intensity={0.5 + i * 0.15} />
              </div>
              <div style={{ padding: '6px 10px', fontSize: 10, color: T.inkDim, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                <span>burst · {4 + i * 4} cells</span><span style={{ color: T.ink2 }}>{60 + i * 40}ms</span>
              </div>
            </div>
          ))}
        </div>

        <div>
          <window.MeLabel>notation</window.MeLabel>
          <div style={{
            marginTop: 6, border: `1px solid ${T.bezel}`, background: '#0a0e0b',
            padding: '10px 12px', fontSize: 11.5, lineHeight: 1.6,
          }}>
            <div><span style={{ color: T.magenta }}>at 2000ms</span> <span style={{ color: T.ink }}>glitch</span> <span style={{ color: T.phos }}>"SYSTEM READY"</span> <span style={{ color: T.inkDim }}>80ms burst</span></div>
            <div style={{ color: T.inkMuted }}>  cells: 8   pool: "█▓▒░▞▚◈◆"   restore: true</div>
          </div>
        </div>
      </div>

      {/* params */}
      <window.MePanel title="PARAMS" dense style={{ gridRow: '2 / 3' }}>
        <ParamRow k="cells" v="8" range="1 – 64" />
        <ParamRow k="duration" v="80ms" range="20 – 400ms" />
        <ParamRow k="pool" v='"█▓▒░▞▚◈◆"' mono />
        <ParamRow k="restore" v="true" />
        <ParamRow k="tone" v="magenta" swatch={T.magenta} />
        <ParamRow k="glow" v="0.6" />
        <ParamRow k="seed" v="—" />
        <div style={{ height: 1, background: T.bezel, margin: '8px 0' }} />
        <ParamRow k="combines with" v="type · reveal · shake" dim />
        <ParamRow k="cpu hint" v="O(N) / tick" dim />
      </window.MePanel>

      <Statusbar text="EFFECTS · glitch selected · ⏎ insert in scene · E edit source" colStart="1 / -1" />
    </div>
  );
};

function ParamRow({ k, v, range, mono, swatch, dim }) {
  const T = window.ME_T;
  return (
    <div style={{ padding: '4px 2px', fontSize: 10.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 86, color: T.inkMuted, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 9.5 }}>{k}</div>
        {swatch && <span style={{ width: 8, height: 8, background: swatch, boxShadow: `0 0 4px ${swatch}66` }} />}
        <div style={{ flex: 1, textAlign: 'right', color: dim ? T.inkMuted : T.ink, fontFamily: mono ? window.ME_FONTS.ui : 'inherit' }}>{v}</div>
      </div>
      {range && <div style={{ textAlign: 'right', color: T.inkFaint, fontSize: 9 }}>{range}</div>}
    </div>
  );
}

// ─── Asset Manager ───────────────────────────────────────────
window.MeAssets = function MeAssets() {
  const T = window.ME_T;
  const F = window.ME_FONTS;

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg, color: T.ink, fontFamily: F.ui,
      display: 'grid', gridTemplateColumns: '200px 1fr', gridTemplateRows: '44px 1fr 22px', gap: 1,
    }}>
      <div style={{ gridColumn: '1 / -1', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${T.bezel}` }}>
        <span style={{ color: T.phos, textShadow: T.glow, fontSize: 12, letterSpacing: '0.2em' }}>◼ ASSETS</span>
        <span style={{ color: T.inkMuted }}>·</span>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: T.inkDim, textTransform: 'uppercase' }}>fonts · palettes · ascii kits · used across all scenes</span>
        <div style={{ flex: 1 }} />
        <window.MeBtn icon="↥">import</window.MeBtn>
        <window.MeBtn tone="prim" icon="+">new</window.MeBtn>
      </div>

      {/* sidebar */}
      <div style={{ gridRow: '2 / 3', background: T.panel, borderRight: `1px solid ${T.bezel}`, padding: '8px 0' }}>
        {[
          ['fonts', 9, true], ['palettes', 6], ['ascii kits', 14], ['scan patterns', 4], ['tones', 7], ['keybinds', 3],
        ].map(([n, c, sel], i) => (
          <div key={i} style={{
            padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: sel ? 'rgba(255,169,75,0.07)' : 'transparent',
            borderLeft: `2px solid ${sel ? T.ink2 : 'transparent'}`,
            fontSize: 11, color: T.ink,
          }}>
            <span>{n}</span><span style={{ color: T.inkMuted, fontSize: 9.5 }}>{c}</span>
          </div>
        ))}
      </div>

      {/* fonts */}
      <div style={{ gridRow: '2 / 3', overflowY: 'auto', padding: '14px 18px' }}>
        <window.MeLabel>fonts · 9</window.MeLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 10 }}>
          {[
            ['VT323',                      'display', 'The', 44, true, 'vt323'],
            ['IBM Plex Mono',              'ui',      'The', 32, false, "'IBM Plex Mono', monospace"],
            ['JetBrains Mono',             'ui',      'The', 32, false, "'JetBrains Mono', monospace"],
            ['Atkinson Hyperlegible Mono', 'ui · a11y','The',32, false, "'Atkinson Hyperlegible Mono', monospace"],
            ['Fira Code',                  'ui',      'The', 32, false, "'Fira Code', monospace"],
            ['Space Mono',                 'ui',      'The', 32, false, "'Space Mono', monospace"],
            ['Instrument Serif italic',    'accent',  'Th',  44, false, "'Instrument Serif', serif"],
            ['Terminus',                   'display', 'The', 36, false, "'Courier New', monospace"],
            ['upload custom…',             '',        '+',   36, false, null],
          ].map(([name, role, sample, sz, sel, family], i) => {
            const isUpload = i === 8;
            return (
              <div key={i} style={{
                border: `1px ${isUpload ? 'dashed' : 'solid'} ${sel ? T.ink2 : T.bezel}`,
                background: isUpload ? 'transparent' : T.panel, padding: 14,
                background: sel ? 'rgba(255,169,75,0.06)' : (isUpload ? 'transparent' : T.panel),
              }}>
                <div style={{
                  fontFamily: family || F.display, fontSize: sz,
                  color: isUpload ? T.inkMuted : T.ink, textShadow: sel ? T.glowA : (isUpload ? 'none' : T.glow),
                  fontStyle: name.includes('italic') ? 'italic' : 'normal',
                  lineHeight: 1.05, marginBottom: 10,
                }}>{sample}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 10.5, color: T.ink }}>{name}</span>
                  {role && <span style={{ fontSize: 9, color: T.inkMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{role}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ height: 1, background: T.bezel, margin: '22px 0' }} />

        <window.MeLabel>palettes · 6</window.MeLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 10 }}>
          {[
            ['chartreuse · default', ['#E8FF59', '#FFA94B', '#FF6B6B', '#7FE093', '#7FE3E0', '#E77FD9']],
            ['amber monochrome',     ['#FFC985', '#FFA94B', '#a86a2a', '#4d5b36', '#2a2418', '#0a0604']],
            ['green DEC',            ['#7FE093', '#33CC55', '#1a8844', '#0a5522', '#062011', '#000805']],
            ['cyan broadcast',       ['#7FE3E0', '#4AC5C3', '#2a8a88', '#144545', '#082020', '#040a0a']],
            ['ice · 1-bit',          ['#E9F1F8', '#7A8DA5', '#2C3A4A', '#0C1218', '#050709', '#000000']],
            ['custom…',              []],
          ].map(([name, cols], i) => (
            <div key={i} style={{ border: `1px ${cols.length ? 'solid' : 'dashed'} ${T.bezel}`, background: cols.length ? T.panel : 'transparent', padding: 10 }}>
              <div style={{ display: 'flex', height: 36, marginBottom: 8 }}>
                {cols.length ? cols.map((c, j) => (
                  <div key={j} style={{ flex: 1, background: c, boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.4)` }} />
                )) : <div style={{ flex: 1, color: T.inkMuted, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+ define</div>}
              </div>
              <div style={{ fontSize: 10.5, color: cols.length ? T.ink : T.inkMuted }}>{name}</div>
            </div>
          ))}
        </div>
      </div>

      <Statusbar text="ASSETS · 9 fonts · 6 palettes · 14 ascii kits · ⏎ apply  E edit" colStart="1 / -1" />
    </div>
  );
};

// ─── Export / Render Queue ───────────────────────────────────
window.MeExport = function MeExport() {
  const T = window.ME_T;
  const F = window.ME_FONTS;

  const targets = [
    ['MP4',     'mp4', 'H.264 · 60fps · 1920×1080',    'video · embed anywhere', true],
    ['WebM',    'webm','VP9 · transparent-capable',     'video · modern web'],
    ['GIF',     'gif', '256 colors · optimized',        'video · everywhere'],
    ['SVG',     'svg', 'animated · inline-safe',        'vector · scales crisp'],
    ['HTML',    'html','self-contained · offline',      'embed · iframe-ready'],
    ['PNG seq', 'png', 'per-tick frames · zip',         'video edit · After Effects'],
    ['Loop URL','url', 'shareable · readonly',          'send · preview anywhere'],
    ['JSON',    '.me', 'scene source · diffable',       'version control'],
  ];

  const queue = [
    ['boot_sequence_v3',  'MP4', '1920×1080',  'rendering', 72, 48, T.cyan],
    ['standby_loop',      'GIF', '640×400',    'rendering', 120, 108, T.cyan],
    ['memories_reveal',   'HTML','responsive', 'done',    100, 100, T.green],
    ['error_glitch_v2',   'WebM','1280×720',   'done',    100, 100, T.green],
    ['fault_alert',       'PNG seq','720×480', 'queued',  0, 0, T.inkMuted],
    ['chime_pulse',       'SVG', 'vector',     'failed',  40, 40, T.red],
  ];

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg, color: T.ink, fontFamily: F.ui,
      display: 'grid', gridTemplateColumns: '1fr 380px', gridTemplateRows: '44px 1fr 22px', gap: 1,
    }}>
      <div style={{ gridColumn: '1 / -1', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${T.bezel}` }}>
        <span style={{ color: T.phos, textShadow: T.glow, fontSize: 12, letterSpacing: '0.2em' }}>◼ EXPORT</span>
        <span style={{ color: T.inkMuted }}>·</span>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: T.inkDim, textTransform: 'uppercase' }}>8 targets · 2 running · 1 failed</span>
        <div style={{ flex: 1 }} />
        <window.MeBtn>pause queue</window.MeBtn>
        <window.MeBtn tone="prim" icon="+">new export</window.MeBtn>
      </div>

      {/* targets */}
      <div style={{ gridRow: '2 / 3', padding: 18, overflowY: 'auto' }}>
        <window.MeLabel>targets</window.MeLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
          {targets.map(([title, ext, spec, use, sel], i) => (
            <div key={i} style={{
              border: `1px solid ${sel ? T.ink2 : T.bezel}`,
              background: sel ? 'rgba(255,169,75,0.06)' : T.panel,
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                <window.Phos sz={26} tone={sel ? 'amber' : 'phos'}>{title}</window.Phos>
                <span style={{ color: T.inkMuted, fontSize: 10, letterSpacing: '0.12em' }}>.{ext}</span>
              </div>
              <div style={{ color: T.inkDim, fontSize: 10.5 }}>{spec}</div>
              <div style={{ color: T.inkMuted, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>{use}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
          <window.MeLabel>options · MP4</window.MeLabel>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <OptTile label="RESOLUTION" val="1920×1080" />
            <OptTile label="FRAMERATE" val="60 fps" />
            <OptTile label="TICK RATE" val="30 Hz" />
            <OptTile label="LOOP COUNT" val="1" />
            <OptTile label="POST-FX" val="on" tone={T.green} />
            <OptTile label="BEZEL" val="off" />
            <OptTile label="BG" val="transparent" />
            <OptTile label="AUDIO" val="none" />
          </div>
        </div>
      </div>

      {/* queue */}
      <window.MePanel title="QUEUE" flags="6 jobs" style={{ gridRow: '2 / 3' }} flush>
        <div style={{ overflowY: 'auto' }}>
          {queue.map(([name, fmt, spec, status, total, prog, tone], i) => (
            <div key={i} style={{
              padding: '10px 14px', borderBottom: `1px solid ${T.bezelLo}`,
              background: i === 0 ? 'rgba(255,169,75,0.04)' : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: tone, textShadow: tone === T.cyan ? T.glowC : tone === T.green ? T.glowG : tone === T.red ? T.glowR : 'none', fontSize: 10 }}>●</span>
                <span style={{ color: T.ink, fontSize: 11.5, flex: 1 }}>{name}</span>
                <span style={{ color: T.inkMuted, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{fmt}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 10, color: T.inkMuted, marginBottom: 4 }}>
                <span>{spec}</span><span style={{ color: tone }}>{status}</span>
                {status === 'rendering' && <span style={{ marginLeft: 'auto', color: T.ink2 }}>frame {prog}/{total}</span>}
              </div>
              <div style={{ height: 3, background: T.bg, border: `1px solid ${T.bezel}`, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(prog/total)*100}%`, background: tone, boxShadow: tone === T.cyan ? T.glowC : tone === T.green ? T.glowG : tone === T.red ? T.glowR : 'none' }} />
              </div>
            </div>
          ))}
        </div>
      </window.MePanel>

      <Statusbar text="EXPORT · 2 running  48% · eta 0:40 · writes to ~/Motion/out/" colStart="1 / -1" />
    </div>
  );
};

function OptTile({ label, val, tone }) {
  const T = window.ME_T;
  return (
    <div style={{ border: `1px solid ${T.bezel}`, background: T.panel, padding: '8px 10px' }}>
      <div style={{ color: T.inkMuted, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: tone || T.ink, fontSize: 13, marginTop: 2, fontFamily: window.ME_FONTS.display, textShadow: tone ? `0 0 4px ${tone}66` : T.glow }}>{val}</div>
    </div>
  );
}

// ─── Onboarding ──────────────────────────────────────────────
window.MeOnboarding = function MeOnboarding() {
  const T = window.ME_T;
  const F = window.ME_FONTS;

  return (
    <div style={{ width: '100%', height: '100%', background: T.bg, color: T.ink, fontFamily: F.ui, display: 'grid', gridTemplateColumns: '1fr 420px', gridTemplateRows: '1fr 22px' }}>
      <div style={{ padding: '48px 56px', overflowY: 'auto' }}>
        <div style={{ color: T.inkMuted, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>◼ phosphor · v0.1 · first signal</div>
        <div style={{ marginTop: 14, fontFamily: F.display, color: T.ink, fontSize: 86, lineHeight: 0.95, textShadow: T.glow }}>a motion engine</div>
        <div style={{ fontFamily: F.display, color: T.ink2, fontSize: 86, lineHeight: 0.95, textShadow: T.glowA, fontStyle: 'italic' }}>for terminals.</div>
        <div style={{ marginTop: 18, color: T.inkDim, fontSize: 13, lineHeight: 1.6, maxWidth: 620 }}>
          phosphor is a terminal-native motion engine — character cells, tick-based time, phosphor decay as built-in motion blur. you describe scenes in notation or just talk to the director.
        </div>

        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 880 }}>
          <Promise num="01" title="the grid, not pixels" body="cell-based. every value discrete. no bezier curves unless you ask." />
          <Promise num="02" title="talk it into being" body="the director drafts notation from prose. ship a 2s boot sequence in 30 seconds." />
          <Promise num="03" title="export anywhere" body="MP4, GIF, SVG, HTML, PNG seq, shareable URLs. your scene is a .me file, not a lock-in." />
        </div>

        <div style={{ marginTop: 40 }}>
          <window.MeLabel>setup · 1 of 3</window.MeLabel>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <SetupStep done n="1" title="pick a starting palette" sub="chartreuse default. you can change later in assets." />
            <SetupStep active n="2" title="run your first scene" sub="press ▶ below to play the boot sequence. welcome.">
              <window.MeBtn tone="prim" style={{ marginTop: 6 }}>▶ play · 2.4s</window.MeBtn>
            </SetupStep>
            <SetupStep n="3" title="connect an export target" sub="optional. local folder by default — you can add Frame.io or s3 later." />
          </div>
        </div>
      </div>

      <div style={{ background: T.workspace, borderLeft: `1px solid ${T.bezel}`, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', aspectRatio: '4 / 3', maxWidth: 360 }}>
          <window.MePreview chrome="bezel" scene="boot" intensity={0.75} playhead="0:00.600" />
        </div>
      </div>

      <Statusbar text="FIRST SIGNAL · skip tour  ⌘/ · continue  ⏎" colStart="1 / -1" />
    </div>
  );
};

function Promise({ num, title, body }) {
  const T = window.ME_T;
  return (
    <div style={{ borderLeft: `2px solid ${T.bezel}`, paddingLeft: 14 }}>
      <div style={{ color: T.phos, textShadow: T.glow, fontFamily: window.ME_FONTS.display, fontSize: 28 }}>{num}</div>
      <div style={{ color: T.ink, fontSize: 14, marginTop: 2 }}>{title}</div>
      <div style={{ color: T.inkDim, fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>{body}</div>
    </div>
  );
}

function SetupStep({ n, title, sub, done, active, children }) {
  const T = window.ME_T;
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '10px 0',
      borderBottom: `1px dashed ${T.bezel}`,
      opacity: done ? 0.55 : 1,
    }}>
      <div style={{
        width: 22, height: 22, border: `1px solid ${done ? T.green : active ? T.ink2 : T.bezelHi}`,
        color: done ? T.green : active ? T.ink2 : T.inkDim,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: window.ME_FONTS.display, fontSize: 14,
        textShadow: done ? window.ME_T.glowG : active ? window.ME_T.glowA : 'none',
      }}>{done ? '✓' : n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: T.ink, fontSize: 12 }}>{title}</div>
        <div style={{ color: T.inkDim, fontSize: 10.5, marginTop: 2 }}>{sub}</div>
        {children}
      </div>
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────
window.MeSettings = function MeSettings() {
  const T = window.ME_T;
  const F = window.ME_FONTS;

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg, color: T.ink, fontFamily: F.ui,
      display: 'grid', gridTemplateColumns: '220px 1fr', gridTemplateRows: '44px 1fr 22px',
    }}>
      <div style={{ gridColumn: '1 / -1', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${T.bezel}` }}>
        <span style={{ color: T.phos, textShadow: T.glow, fontSize: 12, letterSpacing: '0.2em' }}>◼ SETTINGS</span>
        <span style={{ color: T.inkMuted }}>·</span>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: T.inkDim, textTransform: 'uppercase' }}>appearance · behavior · a11y · keybinds</span>
      </div>

      <div style={{ gridRow: '2 / 3', background: T.panel, borderRight: `1px solid ${T.bezel}`, padding: '8px 0' }}>
        {['appearance','director (ai)','playback','a11y · contrast','keybinds','exports','storage','about'].map((n, i) => (
          <div key={i} style={{
            padding: '8px 16px',
            background: i === 0 ? 'rgba(255,169,75,0.07)' : 'transparent',
            borderLeft: `2px solid ${i === 0 ? T.ink2 : 'transparent'}`,
            fontSize: 11, color: T.ink,
          }}>{n}</div>
        ))}
      </div>

      <div style={{ gridRow: '2 / 3', overflowY: 'auto', padding: '22px 28px' }}>
        <window.Phos sz={32}>appearance</window.Phos>
        <div style={{ color: T.inkDim, fontSize: 11.5, marginTop: 2 }}>chrome + type. applies globally, saves per-user.</div>

        <Section title="PREVIEW CHROME">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[['bezel','hardware CRT', true],['flat','workshop frame'],['none','raw phosphor']].map(([n, d, sel], i) => (
              <div key={i} style={{
                border: `1px solid ${sel ? T.ink2 : T.bezel}`,
                background: sel ? 'rgba(255,169,75,0.05)' : T.panel,
                padding: 10,
              }}>
                <div style={{ aspectRatio: '16 / 10', marginBottom: 8 }}>
                  <window.MePreview chrome={n} scene="cursor" intensity={0.55} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: sel ? T.ink2 : T.ink }}>{n}</span>
                  <span style={{ fontSize: 9, color: T.inkMuted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{d}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="PHOSPHOR">
          <SettingKnob k="decay"      v="240ms"  pct={0.45} desc="how long the previous frame lingers. zero = no ghost trail." />
          <SettingKnob k="bloom"      v="1.8×"   pct={0.60} desc="phosphor spread radius. hardware-perfect ≈ 1.0×." />
          <SettingKnob k="scanlines"  v="0.70"   pct={0.70} desc="2px / 1px dark lines. set 0 to disable entirely." />
          <SettingKnob k="curvature"  v="0.35"   pct={0.35} desc="CRT bulge vignette. off = flat panel." />
          <SettingKnob k="flicker"    v="0.12"   pct={0.12} desc="60Hz mains hum. below 0.10 is imperceptible." />
          <SettingKnob k="chromatic"  v="0.00"   pct={0.00} desc="RGB misalignment. off by default — cheap but costume-y." />
        </Section>

        <Section title="TYPOGRAPHY">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[['VT323', 'vt323', true],['IBM Plex Mono','plex'],['JetBrains Mono','jet'],['Atkinson Hyperlegible','atkinson'],['Fira Code','fira'],['Space Mono','space']].map(([name, key, sel], i) => (
              <div key={i} style={{
                border: `1px solid ${sel ? T.ink2 : T.bezel}`,
                background: sel ? 'rgba(255,169,75,0.05)' : T.panel,
                padding: 10,
              }}>
                <div style={{ fontFamily: key === 'vt323' ? window.ME_FONTS.display : `'${name}', monospace`, fontSize: key === 'vt323' ? 32 : 22, color: sel ? T.ink2 : T.ink, textShadow: sel ? T.glowA : T.glow, marginBottom: 6 }}>Aa Il1 ◆</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10.5, color: T.ink }}>{name}</span>
                  <span style={{ fontSize: 9, color: T.inkMuted, letterSpacing: '0.12em' }}>{key}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Statusbar text="SETTINGS · appearance · changes apply instantly · ⌘S save" colStart="1 / -1" />
    </div>
  );
};

function Section({ title, children }) {
  const T = window.ME_T;
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <window.MeLabel>{title}</window.MeLabel>
        <div style={{ flex: 1, borderBottom: `1px dashed ${T.bezel}`, marginBottom: 4 }} />
      </div>
      {children}
    </div>
  );
}

function SettingKnob({ k, v, pct, desc }) {
  const T = window.ME_T;
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px dashed ${T.bezelLo}`, display: 'grid', gridTemplateColumns: '120px 1fr 60px', gap: 14, alignItems: 'center' }}>
      <div>
        <div style={{ color: T.ink, fontSize: 11 }}>{k}</div>
        <div style={{ color: T.inkMuted, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{desc.split('.')[0]}</div>
      </div>
      <div style={{ height: 6, background: T.bg, border: `1px solid ${T.bezel}`, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: T.phos, boxShadow: T.glow }} />
      </div>
      <div style={{ textAlign: 'right', fontFamily: window.ME_FONTS.display, fontSize: 18, color: T.ink, textShadow: T.glow }}>{v}</div>
    </div>
  );
}

// ─── Empty / New Project ─────────────────────────────────────
window.MeEmpty = function MeEmpty() {
  const T = window.ME_T;
  const F = window.ME_FONTS;

  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg, color: T.ink, fontFamily: F.ui,
      display: 'grid', gridTemplateRows: '44px 1fr 22px',
    }}>
      <div style={{ padding: '0 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${T.bezel}` }}>
        <span style={{ color: T.phos, textShadow: T.glow, fontSize: 12, letterSpacing: '0.2em' }}>◼ PHOSPHOR</span>
        <span style={{ color: T.inkMuted }}>·</span>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: T.inkDim, textTransform: 'uppercase' }}>new scene · untitled · 0 events</span>
        <div style={{ flex: 1 }} />
        <window.MeBtn>◉ recent</window.MeBtn>
      </div>

      <div style={{ padding: '36px 48px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36 }}>
        <div>
          <window.Phos sz={40}>start with the director</window.Phos>
          <div style={{ color: T.inkDim, fontSize: 12, marginTop: 6, lineHeight: 1.55, maxWidth: 460 }}>
            describe the motion you want. the director drafts notation, shows it live, and asks what to change. most scenes take three turns.
          </div>
          <div style={{
            marginTop: 18, border: `1px solid ${T.bezelHi}`, background: T.panel,
            padding: '12px 14px', fontSize: 12,
          }}>
            <span style={{ color: T.phos, textShadow: T.glow }}>&gt; </span>
            <span style={{ color: T.inkMuted }}>describe a motion…</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {['a 2s hardware boot sequence','a looping ATM standby','error glitch then reboot','hand-typed reveal of "HELLO"','scan across a list of 10 items','dithered fade-in on a logo'].map((p, i) => (
              <div key={i} style={{ border: `1px solid ${T.bezel}`, padding: '4px 8px', fontSize: 10.5, color: T.inkDim, cursor: 'pointer' }}>{p}</div>
            ))}
          </div>

          <div style={{ height: 1, background: T.bezel, margin: '28px 0' }} />

          <window.MeLabel>or</window.MeLabel>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StartRow title="open notation editor" sub="write .me by hand" kbd="⌘ N" />
            <StartRow title="fork from library" sub="99 scenes · 6 shelves" kbd="⌘ L" />
            <StartRow title="import .me file" sub="drag on the workspace" kbd="⌘ O" />
          </div>
        </div>

        <div>
          <window.MeLabel>recent</window.MeLabel>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['boot_sequence_v3','boot', '2m ago'],['memories_reveal','typewriter','1h'],['error_glitch_v2','glitch','yday'],['standby_loop','loop','3d']].map(([n, s, t], i) => (
              <div key={i} style={{ border: `1px solid ${T.bezel}`, background: T.panel }}>
                <div style={{ aspectRatio: '16 / 10' }}>
                  <window.MePreview chrome="none" scene={s} intensity={0.55} />
                </div>
                <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 10.5, borderTop: `1px solid ${T.bezel}` }}>
                  <span style={{ color: T.ink }}>{n}</span>
                  <span style={{ color: T.inkMuted }}>{t}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Statusbar text="NEW · blank scene · cursor ready" />
    </div>
  );
};

function StartRow({ title, sub, kbd }) {
  const T = window.ME_T;
  return (
    <div style={{ border: `1px solid ${T.bezel}`, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: T.ink, fontSize: 11.5 }}>{title}</div>
        <div style={{ color: T.inkMuted, fontSize: 10 }}>{sub}</div>
      </div>
      <span style={{ color: T.inkDim, fontSize: 9.5, letterSpacing: '0.14em' }}>{kbd}</span>
    </div>
  );
}

// ─── statusbar shared ────────────────────────────────────────
function Statusbar({ text, colStart }) {
  const T = window.ME_T;
  return (
    <div style={{
      gridColumn: colStart || '1 / -1',
      background: T.bg, borderTop: `1px solid ${T.bezel}`,
      display: 'flex', alignItems: 'center', padding: '0 14px',
      fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.inkMuted,
      height: 22, gap: 10,
    }}>
      <span style={{ color: T.green, textShadow: T.glowG }}>●</span>
      <span>{text}</span>
    </div>
  );
}
