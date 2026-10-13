import type { OcrLine, OcrPage } from '../../../services/scan';
import { layoutText } from '../layout';

const line = (
  text: string,
  left: number,
  top: number,
  right: number,
  bottom = top + 20,
): OcrLine => ({
  text,
  box: [left, top, right, bottom],
});

/** A page as the reader returns it: blocks in its own (often odd) order. */
const page = (blocks: OcrLine[][], text = 'raw'): OcrPage => ({
  text,
  width: 1000,
  height: 1400,
  blocks: blocks.map(lines => ({
    text: lines.map(l => l.text).join('\n'),
    box: [],
    lines,
  })),
});

describe('layoutText', () => {
  it('puts form labels and their values back on one row', () => {
    // The reader found the labels as one block and the values as another.
    const labels = [
      line('Name:', 50, 100, 150),
      line('Date:', 50, 140, 150),
      line('Amount:', 50, 180, 170),
    ];
    const values = [
      line('Asha Verma', 400, 102, 560),
      line('12 Oct 2026', 400, 141, 560),
      line('₹ 1,250', 400, 181, 520),
    ];
    expect(layoutText(page([values, labels]))).toBe(
      'Name:    Asha Verma\nDate:    12 Oct 2026\nAmount:    ₹ 1,250',
    );
  });

  it('keeps a long form row by row, not as two columns', () => {
    const labels = [
      'Name:',
      'Date of birth:',
      'Phone:',
      'Address:',
      'City:',
      'PIN code:',
      'Email:',
      'Signed:',
    ];
    const values = [
      'Asha',
      '01/02/1999',
      '98100 00000',
      '12 MG Road, Sector 4',
      'Pune',
      '411001',
      'a@b.in',
      'Yes',
    ];
    const left = labels.map((t, i) =>
      line(t, 50, 100 + i * 40, 50 + t.length * 18),
    );
    const right = values.map((t, i) =>
      line(t, 500, 101 + i * 40, 500 + t.length * 18),
    );
    const rows = layoutText(page([right, left])).split('\n');
    expect(rows).toHaveLength(8);
    expect(rows[1]).toBe('Date of birth:    01/02/1999');
    expect(rows[3]).toBe('Address:    12 MG Road, Sector 4');
  });

  it('reads two columns one after the other, heading first', () => {
    const heading = [line('City news and weather for today', 50, 40, 950)];
    const left = [
      'Left one',
      'Left two',
      'Left three',
      'Left four',
      'Left five',
    ].map((t, i) => line(t, 50, 100 + i * 30, 450));
    const right = [
      'Right one',
      'Right two',
      'Right three',
      'Right four',
      'Right five',
    ].map((t, i) => line(t, 550, 100 + i * 30, 950));
    expect(layoutText(page([right, left, heading]))).toBe(
      'City news and weather for today\n\nLeft one\nLeft two\nLeft three\nLeft four\nLeft five\n\n' +
        'Right one\nRight two\nRight three\nRight four\nRight five',
    );
  });

  it('keeps paragraphs apart and joins words split at a line end', () => {
    const lines = [
      line('The first para-', 50, 100, 600),
      line('graph goes on.', 50, 125, 400),
      line('A new paragraph.', 50, 200, 450),
    ];
    expect(layoutText(page([lines]))).toBe(
      'The first paragraph goes on.\n\nA new paragraph.',
    );
  });

  it('keeps a hyphen that is really a dash or a list', () => {
    const lines = [
      line('Pages 1-', 50, 100, 300),
      line('3 only', 50, 125, 200),
    ];
    expect(layoutText(page([lines]))).toBe('Pages 1-\n3 only');
  });

  it('falls back to the reader’s text when there are no line positions', () => {
    expect(
      layoutText({ text: ' hello ', width: 10, height: 10, blocks: [] }),
    ).toBe('hello');
  });
});
