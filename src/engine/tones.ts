import type { ToneName } from './types';

/**
 * Hex swatch values for each tone name.
 * Mirrors the CSS custom properties defined in styles.css :root — update both
 * places if the palette changes. Used for tone-picker swatch buttons that need
 * an inline backgroundColor (CSS variables can't be applied as inline styles
 * directly in React without getComputedStyle).
 */
export const TONE_HEX: Record<ToneName, string> = {
  phos: '#D6F04A',
  phosDim: '#8aa028',
  amber: '#FFA94B',
  amberDim: '#a86a2a',
  green: '#7FE093',
  red: '#FF6B6B',
  cyan: '#7FE3E0',
  magenta: '#E77FD9',
  ink: '#CDDDA0',
  inkDim: '#7A8F56',
  inkMuted: '#7e8d56',
  inkFaint: '#2f3a22',
  ink2: '#FFC985',
};
