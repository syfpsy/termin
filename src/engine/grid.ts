import type { BufferCell, GridCell, ToneName } from './types';

const EMPTY_CELL: GridCell = {
  char: ' ',
  fg: 'ink',
  bg: 'transparent',
  intensity: 0,
};

export class Grid {
  readonly cols: number;
  readonly rows: number;
  private readonly cells: GridCell[];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: cols * rows }, () => ({ ...EMPTY_CELL }));
  }

  clear() {
    for (const cell of this.cells) {
      cell.char = ' ';
      cell.fg = 'ink';
      cell.bg = 'transparent';
      cell.intensity = 0;
    }
  }

  index(c: number, r: number) {
    return r * this.cols + c;
  }

  inBounds(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  cell(c: number, r: number): GridCell {
    if (!this.inBounds(c, r)) return EMPTY_CELL;
    return this.cells[this.index(c, r)];
  }

  set(c: number, r: number, char: string, fg: ToneName = 'ink', intensity = 1) {
    if (!this.inBounds(c, r)) return;
    const cell = this.cells[this.index(c, r)];
    cell.char = char || ' ';
    cell.fg = fg;
    cell.bg = 'transparent';
    cell.intensity = clamp01(intensity);
  }

  writeText(c: number, r: number, text: string, fg: ToneName = 'ink', intensity = 1) {
    for (let i = 0; i < text.length; i += 1) {
      this.set(c + i, r, text[i], fg, intensity);
    }
  }

  forEach(fn: (cell: GridCell, c: number, r: number) => void) {
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        fn(this.cells[this.index(c, r)], c, r);
      }
    }
  }
}

export class PhosphorBuffer {
  readonly cols: number;
  readonly rows: number;
  private readonly cells: BufferCell[];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: cols * rows }, () => ({ ...EMPTY_CELL }));
  }

  reset() {
    for (const cell of this.cells) {
      cell.char = ' ';
      cell.fg = 'ink';
      cell.bg = 'transparent';
      cell.intensity = 0;
    }
  }

  index(c: number, r: number) {
    return r * this.cols + c;
  }

  cell(c: number, r: number): BufferCell {
    return this.cells[this.index(c, r)];
  }

  forEach(fn: (cell: BufferCell, c: number, r: number) => void) {
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        fn(this.cells[this.index(c, r)], c, r);
      }
    }
  }

  update(grid: Grid, dtMs: number, decayMs: number) {
    const decayFactor = decayMs <= 0 ? 0 : Math.exp(-dtMs / decayMs);

    for (const cell of this.cells) {
      cell.intensity *= decayFactor;
      if (cell.intensity < 0.015) {
        cell.intensity = 0;
        cell.char = ' ';
      }
    }

    grid.forEach((source, c, r) => {
      if (source.intensity <= 0) return;
      const target = this.cells[this.index(c, r)];
      if (source.intensity >= target.intensity || target.char === ' ') {
        target.char = source.char;
        target.fg = source.fg;
        target.bg = source.bg;
      }
      target.intensity = Math.max(target.intensity, source.intensity);
    });
  }
}

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
