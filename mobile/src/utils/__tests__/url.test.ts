import { displayHost, normalizeApiUrl, siteOrigin } from '../url';

describe('normalizeApiUrl', () => {
  it.each([
    ['192.168.1.20:8000', 'http://192.168.1.20:8000/api'],
    ['https://konpdf.example.com/', 'https://konpdf.example.com/api'],
    ['http://10.0.2.2:8000/api', 'http://10.0.2.2:8000/api'],
    ['', null],
    ['not a url at all', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeApiUrl(input)).toBe(expected);
  });
});

describe('siteOrigin and displayHost', () => {
  it('strips the API path', () => {
    expect(siteOrigin('https://konpdf.example.com/api')).toBe(
      'https://konpdf.example.com',
    );
    expect(displayHost('http://10.0.2.2:8000/api')).toBe('10.0.2.2:8000');
  });
});
