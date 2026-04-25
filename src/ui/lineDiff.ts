/**
 * Tiny line-level diff for previewing director proposals.
 *
 * Computes an LCS table over two arrays of lines, then walks back through it
 * to produce a sequence of `keep` / `add` / `remove` rows. Output is suitable
 * for unified-style rendering (added rows from the proposal, removed rows from
 * the current source, kept rows shown once).
 */

export type DiffRow =
  | { kind: 'keep'; text: string; oldIndex: number; newIndex: number }
  | { kind: 'add'; text: string; newIndex: number }
  | { kind: 'remove'; text: string; oldIndex: number };

export type DiffSummary = {
  rows: DiffRow[];
  added: number;
  removed: number;
  kept: number;
};

export function diffLines(oldText: string, newText: string): DiffSummary {
  const oldLines = oldText.replace(/\r\n/g, '\n').split('\n');
  const newLines = newText.replace(/\r\n/g, '\n').split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS lengths.
  const dp: Uint16Array[] = [];
  for (let i = 0; i <= m; i += 1) dp.push(new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ kind: 'keep', text: oldLines[i], oldIndex: i, newIndex: j });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: 'remove', text: oldLines[i], oldIndex: i });
      i += 1;
    } else {
      rows.push({ kind: 'add', text: newLines[j], newIndex: j });
      j += 1;
    }
  }
  while (i < m) {
    rows.push({ kind: 'remove', text: oldLines[i], oldIndex: i });
    i += 1;
  }
  while (j < n) {
    rows.push({ kind: 'add', text: newLines[j], newIndex: j });
    j += 1;
  }

  return {
    rows,
    added: rows.filter((row) => row.kind === 'add').length,
    removed: rows.filter((row) => row.kind === 'remove').length,
    kept: rows.filter((row) => row.kind === 'keep').length,
  };
}
