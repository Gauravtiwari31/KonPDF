import type { Formats } from '../../api/engine';
import type { LocalFile } from '../../services/files';
import { formatBytes, formatChange, sizeChangePercent } from '../../utils/format';
import { commonTargets } from '../ConvertScreen';

const file = (name: string): LocalFile => ({
  name,
  uri: `file:///cache/${name}`,
  path: `/cache/${name}`,
  mime: 'application/octet-stream',
  size: 1000,
});

const formats: Formats = {
  matrix: {
    jpg: ['png', 'webp', 'pdf', 'docx'],
    png: ['jpg', 'webp', 'pdf', 'docx'],
    pdf: ['jpg', 'png', 'docx', 'txt'],
  },
  kinds: { jpg: 'image', png: 'image', pdf: 'pdf' },
  office: false,
};

describe('commonTargets', () => {
  it('offers what every picked file can become', () => {
    expect(commonTargets([file('a.jpg'), file('b.PNG')], formats)).toEqual([
      'webp',
      'pdf',
      'docx',
    ]);
  });

  it('is empty for unknown files or mixed families with nothing in common', () => {
    expect(commonTargets([file('notes.xyz')], formats)).toEqual([]);
    expect(commonTargets([], formats)).toEqual([]);
    expect(commonTargets([file('a.jpg')], null)).toEqual([]);
  });
});

describe('size formatting', () => {
  it('formats bytes', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(48_213)).toBe('47 KB');
    expect(formatBytes(2_400_000)).toBe('2.3 MB');
  });

  it('describes the change', () => {
    expect(formatChange(sizeChangePercent(2_400_000, 48_000))).toBe('−98 %');
    expect(formatChange(sizeChangePercent(100, 112))).toBe('+12 %');
    expect(formatChange(sizeChangePercent(0, 5))).toBe('');
  });
});
