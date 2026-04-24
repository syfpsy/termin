export type AssetKind = 'font' | 'palette' | 'ascii' | 'scan' | 'keybind';

export type AssetItem = {
  id: string;
  kind: AssetKind;
  name: string;
  value: string;
  note: string;
};

export const ASSET_CATALOG: AssetItem[] = [
  { id: 'font-vt323', kind: 'font', name: 'VT323', value: 'vt323', note: 'Display face for CRT titles and large phosphor moments.' },
  { id: 'font-jet', kind: 'font', name: 'JetBrains Mono', value: 'jet', note: 'Default dense UI and notation face.' },
  { id: 'font-plex', kind: 'font', name: 'IBM Plex Mono', value: 'plex', note: 'Neutral alternate for longer editing sessions.' },
  { id: 'font-atkinson', kind: 'font', name: 'Atkinson Hyperlegible Mono', value: 'atkinson', note: 'Accessibility-focused preview option.' },
  { id: 'palette-phosphor', kind: 'palette', name: 'Phosphor 6', value: '#D6F04A,#FFA94B,#7FE093,#FF6B6B,#7FE3E0,#E77FD9', note: 'Core ordered phosphor palette.' },
  { id: 'palette-one-bit', kind: 'palette', name: '1-bit phosphor', value: '#D6F04A,#0A0C09', note: 'Monochrome preview and export mode.' },
  { id: 'ascii-boot', kind: 'ascii', name: 'Boot glyphs', value: '[OK] [..] > _', note: 'Status-line kit for boot sequences.' },
  { id: 'ascii-blocks', kind: 'ascii', name: 'Block shade kit', value: '░▒▓█ ▞▚ ◢◣◤◥', note: 'Dither, scan, and loop glyphs.' },
  { id: 'scan-crt', kind: 'scan', name: 'CRT 3px scan', value: '2px light / 1px dark', note: 'Default WebGL and CSS overlay scan pattern.' },
  { id: 'key-run', kind: 'keybind', name: 'Run director', value: 'Ctrl+Enter', note: 'Submit current director prompt.' },
  { id: 'key-focus', kind: 'keybind', name: 'Focus director', value: 'Ctrl+K', note: 'Reserved command entry shortcut.' },
];
