import { AxiosError, AxiosHeaders } from 'axios';
import { LANGUAGES } from '../../i18n/languages';
import { FileActionError } from '../../services/files';
import { appError, toFriendlyError } from '../errors';

const engineError = {
  code: 'FILE_TOO_LARGE',
  title: 'That file is a bit too big',
  message: 'Files can be up to 50 MB.',
  hint: 'Try compressing it first.',
  action: 'compress',
};

function axiosError(status?: number, data?: unknown, code?: string) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    'Request failed with status code ' + status,
    code,
    config,
    {},
    status === undefined
      ? undefined
      : { status, statusText: '', headers: {}, config, data },
  );
}

/** Nothing a person sees may contain a status code or library jargon. */
function expectFriendly(text: string) {
  expect(text).not.toMatch(/\b[45]\d\d\b/);
  expect(text).not.toMatch(/axios|ECONN|status code|Network Error|undefined/i);
}

describe('toFriendlyError', () => {
  it('passes through the engine’s own friendly error', () => {
    expect(
      toFriendlyError(axiosError(413, { ok: false, error: engineError }), 'en'),
    ).toEqual(engineError);
  });

  it('maps no response to "can’t reach", and a timeout to "waking up"', () => {
    expect(toFriendlyError(axiosError(), 'en').code).toBe('SERVER_UNREACHABLE');
    expect(
      toFriendlyError(axiosError(undefined, undefined, 'ECONNABORTED'), 'en')
        .code,
    ).toBe('SERVER_WAKING');
  });

  it('treats a host’s 502/503/504 page as the engine waking up', () => {
    const e = toFriendlyError(axiosError(503, '<html>Service Unavailable</html>'), 'en');
    expect(e.code).toBe('SERVER_WAKING');
    expectFriendly(e.title + e.message);
  });

  it('never shows a 404 or 402', () => {
    for (const status of [402, 404, 500]) {
      const e = toFriendlyError(axiosError(status, 'Not Found'), 'en');
      expectFriendly(`${e.title} ${e.message} ${e.hint ?? ''}`);
    }
  });

  it('reads the engine error from a failed download body', () => {
    const e = new FileActionError(
      'http_410',
      JSON.stringify({ ok: false, error: { ...engineError, code: 'RESULT_EXPIRED' } }),
    );
    expect(toFriendlyError(e, 'en').code).toBe('RESULT_EXPIRED');
  });

  it('maps native file errors', () => {
    expect(toFriendlyError(new FileActionError('no_app', ''), 'en').code).toBe('NO_APP');
    expect(toFriendlyError(new FileActionError('network', ''), 'en').code).toBe(
      'SERVER_UNREACHABLE',
    );
  });

  it('turns anything else into a calm INTERNAL message', () => {
    const e = toFriendlyError(new TypeError("Cannot read properties of undefined (reading 'x')"), 'en');
    expect(e.code).toBe('INTERNAL');
    expectFriendly(e.message);
  });
});

describe('app error catalogue', () => {
  it('has every message in every language', () => {
    for (const code of [
      'SERVER_UNREACHABLE',
      'SERVER_WAKING',
      'NO_APP',
      'FILE_GONE',
      'TOO_BIG_TO_SEND',
      'INTERNAL',
    ] as const) {
      for (const { code: lang } of LANGUAGES) {
        const e = appError(code, lang);
        expect(e.title.length).toBeGreaterThan(3);
        expect(e.message.length).toBeGreaterThan(3);
        expectFriendly(`${e.title} ${e.message}`);
      }
    }
  });

  it('answers in the requested language', () => {
    expect(appError('SERVER_WAKING', 'hi').title).toMatch(/[ऀ-ॿ]/);
    expect(appError('SERVER_WAKING', 'es').title).toMatch(/conversor/);
  });
});
