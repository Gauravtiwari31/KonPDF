/**
 * The AI reader writes tables as Markdown. These helpers find them and turn
 * them into CSV, so a table on paper can become a spreadsheet.
 */

const isRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(c => c.trim());

/** Every Markdown table in `text`, as rows of cells (header row first). */
export function markdownTables(text: string): string[][][] {
  const lines = text.split(/\r?\n/);
  const tables: string[][][] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (isRow(lines[i]) && isDivider(lines[i + 1])) {
      const rows = [cells(lines[i])];
      let j = i + 2;
      while (j < lines.length && isRow(lines[j])) {
        rows.push(cells(lines[j]));
        j++;
      }
      tables.push(rows);
      i = j - 1;
    }
  }
  return tables;
}

const csvCell = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Tables as one CSV, separated by a blank row. */
export function tablesToCsv(tables: string[][][]): string {
  return tables
    .map(rows => rows.map(r => r.map(csvCell).join(',')).join('\n'))
    .join('\n\n');
}
