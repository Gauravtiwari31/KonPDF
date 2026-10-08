import { markdownTables, tablesToCsv } from '../markdown';

const READING = `Marks — Class 9

| Name | Maths | Science |
|------|:-----:|--------:|
| Asha | 91 | 88 |
| Ravi, K | 78 | 95 |

Signed: Principal

| Item | Qty |
| --- | --- |
| Pens | 4 |`;

it('finds every Markdown table the AI reader wrote', () => {
  const tables = markdownTables(READING);
  expect(tables).toHaveLength(2);
  expect(tables[0]).toEqual([
    ['Name', 'Maths', 'Science'],
    ['Asha', '91', '88'],
    ['Ravi, K', '78', '95'],
  ]);
  expect(tables[1][1]).toEqual(['Pens', '4']);
});

it('ignores text that only looks a bit like a table', () => {
  expect(markdownTables('a | b\nno divider here\n| x |')).toEqual([]);
});

it('writes CSV with quoting where needed', () => {
  const csv = tablesToCsv(markdownTables(READING));
  expect(csv.split('\n')[0]).toBe('Name,Maths,Science');
  expect(csv).toContain('"Ravi, K",78,95');
  expect(csv).toContain('\n\nItem,Qty\nPens,4');
});
