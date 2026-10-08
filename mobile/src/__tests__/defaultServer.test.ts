import { DEFAULT_API_URL } from '../config';

it('fresh installs talk to the hosted engine', () => {
  expect(DEFAULT_API_URL).toBe('https://konpdf-engine.onrender.com/api');
});
