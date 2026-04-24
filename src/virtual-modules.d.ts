declare module 'virtual:phosphor-player' {
  const source: string;
  export default source;
}

declare module 'gifenc' {
  export type GifencFormat = 'rgba4444' | 'rgb444' | 'rgb565' | 'rgba';
  export type GifencPalette = number[][];

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: GifencFormat; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number },
  ): GifencPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifencPalette,
    format?: GifencFormat,
  ): Uint8Array;

  export interface GifencEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: GifencPalette;
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
        first?: boolean;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    buffer: ArrayBuffer;
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifencEncoder;
}
