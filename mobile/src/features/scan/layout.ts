import { OcrLine, OcrPage, ocrLines } from '../../services/scan';

/**
 * A page's text in reading order, rebuilt from where each line sits.
 *
 * The standard reader's own text lists its blocks in an order that scrambles
 * forms, bills and tables ("Name:" in one place, the name far below it) and
 * mixes up two-column pages. So the lines are laid out again:
 *  - a two-column page is read column by column (full-width headings first);
 *  - lines side by side on one row are joined left to right, with a wider
 *    space where there's a gap (label … value, table cells);
 *  - a bigger gap between rows becomes a blank line (a new paragraph);
 *  - a word split with a hyphen at the end of a line is joined again.
 */
export function layoutText(page: OcrPage): string {
  const lines = ocrLines(page);
  if (lines.length === 0) {
    return page.text.trim();
  }
  const lineHeight = median(lines.map(l => l.box[3] - l.box[1])) || 1;
  const columns = splitColumns(lines, lineHeight);
  const text = columns
    .map(col => rowsToText(rows(col, lineHeight), lineHeight))
    .join('\n\n');
  return joinHyphenated(text).trim();
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/**
 * One list of lines, or [left, right] when the page has two columns: an
 * empty vertical strip near the middle that only full-width lines cross.
 */
function splitColumns(lines: OcrLine[], lineHeight: number): OcrLine[][] {
  const left = Math.min(...lines.map(l => l.box[0]));
  const right = Math.max(...lines.map(l => l.box[2]));
  const width = right - left;
  if (lines.length < 8 || width <= 0) {
    return [lines];
  }
  const wide = (l: OcrLine) => l.box[2] - l.box[0] > width * 0.6;
  const narrow = lines.filter(l => !wide(l));
  // Try gutter positions across the middle of the text, widest gap wins.
  let best: { x: number; gap: number } | null = null;
  for (let x = left + width * 0.3; x <= left + width * 0.7; x += width / 100) {
    if (narrow.some(l => l.box[0] < x && l.box[2] > x)) {
      continue;
    }
    const leftEdge = Math.max(
      left,
      ...narrow.filter(l => l.box[2] <= x).map(l => l.box[2]),
    );
    const rightEdge = Math.min(
      right,
      ...narrow.filter(l => l.box[0] >= x).map(l => l.box[0]),
    );
    const gap = rightEdge - leftEdge;
    if (!best || gap > best.gap) {
      best = { x, gap };
    }
  }
  if (!best || best.gap < lineHeight * 1.5) {
    return [lines];
  }
  const gutter = best.x;
  const leftCol = narrow.filter(l => l.box[2] <= gutter);
  const rightCol = narrow.filter(l => l.box[0] >= gutter);
  // Real columns run down the page side by side; a few stray lines on one
  // side (a form's values) are rows, not a column.
  const enough = (col: OcrLine[]) =>
    col.length >= Math.max(4, narrow.length * 0.25);
  const overlap =
    Math.min(
      Math.max(...leftCol.map(l => l.box[3])),
      Math.max(...rightCol.map(l => l.box[3])),
    ) -
    Math.max(
      Math.min(...leftCol.map(l => l.box[1])),
      Math.min(...rightCol.map(l => l.box[1])),
    );
  // Lines on the same rows on both sides look like a form (label | value),
  // unless both sides are filled with text to their edge, like prose columns.
  const sameRows = leftCol.filter(l =>
    rightCol.some(r => Math.abs(center(l) - center(r)) < lineHeight * 0.5),
  ).length;
  const prose = isProse(leftCol) && isProse(rightCol);
  if (
    !enough(leftCol) ||
    !enough(rightCol) ||
    overlap < lineHeight * 4 ||
    (sameRows > leftCol.length * 0.6 && !prose)
  ) {
    return [lines];
  }
  const headings = lines.filter(wide);
  return [[...headings, ...leftCol], rightCol];
}

const center = (l: OcrLine) => (l.box[1] + l.box[3]) / 2;

/** Most lines run (nearly) the full width of their column, like paragraphs do. */
function isProse(col: OcrLine[]): boolean {
  const left = Math.min(...col.map(l => l.box[0]));
  const span = Math.max(...col.map(l => l.box[2])) - left;
  const full = col.filter(l => l.box[2] - l.box[0] >= span * 0.75).length;
  return full >= col.length * 0.7;
}

/** Lines grouped into rows (same height on the page), top to bottom. */
function rows(lines: OcrLine[], lineHeight: number): OcrLine[][] {
  const sorted = [...lines].sort((a, b) => center(a) - center(b));
  const out: OcrLine[][] = [];
  for (const line of sorted) {
    const row = out[out.length - 1];
    const rowCenter = row
      ? row.reduce((s, l) => s + center(l), 0) / row.length
      : 0;
    if (row && Math.abs(center(line) - rowCenter) < lineHeight * 0.5) {
      row.push(line);
    } else {
      out.push([line]);
    }
  }
  return out.map(row => row.sort((a, b) => a.box[0] - b.box[0]));
}

function rowsToText(list: OcrLine[][], lineHeight: number): string {
  let out = '';
  let lastBottom: number | null = null;
  for (const row of list) {
    const top = Math.min(...row.map(l => l.box[1]));
    if (lastBottom !== null) {
      out += top - lastBottom > lineHeight * 1.1 ? '\n\n' : '\n';
    }
    out += row
      .map((line, i) => {
        if (i === 0) {
          return line.text.trim();
        }
        const gap = line.box[0] - row[i - 1].box[2];
        return (gap > lineHeight * 1.5 ? '    ' : ' ') + line.text.trim();
      })
      .join('');
    lastBottom = Math.max(...row.map(l => l.box[3]));
  }
  return out;
}

/** "infor-\nmation" → "information" (only between letters, lower case after). */
const joinHyphenated = (text: string) =>
  text.replace(/([A-Za-zÀ-ÿ])-\n([a-zà-ÿ])/g, '$1$2');
