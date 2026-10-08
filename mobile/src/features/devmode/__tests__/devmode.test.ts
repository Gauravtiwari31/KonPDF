import { cleanReading } from '../../../services/aiReader';
import { joinPages } from '../../scan/pages';
import { AI_READER_BYTES, checkDevice, DeviceInfo, NEEDED_STORAGE_MB } from '../model';
import { combine } from '../useAiReaderModel';

jest.mock('llama.rn', () => ({}), { virtual: true });

const phone = (over: Partial<DeviceInfo> = {}): DeviceInfo => ({
  is64Bit: true,
  abis: ['arm64-v8a'],
  ramMb: 7800,
  availableRamMb: 3000,
  freeStorageMb: 20000,
  sdk: 30,
  onUnmeteredNetwork: true,
  playServices: true,
  model: 'Test Phone',
  ...over,
});

describe('which phones can run the AI reader', () => {
  it('an 8 GB, 64-bit phone with space is fine', () => {
    const { ok, checks } = checkDevice(phone());
    expect(ok).toBe(true);
    expect(checks.every(c => c.level === 'ok')).toBe(true);
  });

  it('a 32-bit phone cannot', () => {
    const { ok, checks } = checkDevice(phone({ is64Bit: false, abis: ['armeabi-v7a'] }));
    expect(ok).toBe(false);
    expect(checks.find(c => c.id === 'cpu')?.level).toBe('fail');
  });

  it('4 GB works with a warning, 3 GB does not', () => {
    expect(checkDevice(phone({ ramMb: 3700 })).ok).toBe(false);
    const four = checkDevice(phone({ ramMb: 3850 }));
    expect(four.ok).toBe(true);
    expect(four.checks.find(c => c.id === 'memory')?.level).toBe('warn');
  });

  it('needs room for the download, unless it is already there', () => {
    const full = phone({ freeStorageMb: NEEDED_STORAGE_MB - 1 });
    expect(checkDevice(full).ok).toBe(false);
    expect(checkDevice(full, true).ok).toBe(true);
  });
});

describe('download progress over both files', () => {
  const done = { state: 'done' as const, bytes: 10, total: 10 };
  it('is ready only when both are done', () => {
    expect(combine([done, done]).phase).toBe('ready');
    expect(combine([done, { state: 'idle', bytes: 0, total: 0 }]).phase).toBe('paused');
  });
  it('reports a failure with its reason', () => {
    const status = combine([done, { state: 'failed', bytes: 5, total: 9, error: 'needs_wifi' }]);
    expect(status).toMatchObject({ phase: 'failed', error: 'needs_wifi', total: AI_READER_BYTES });
  });
  it('is downloading while either file is', () => {
    expect(combine([{ state: 'running', bytes: 4, total: 9 }, { state: 'idle', bytes: 0, total: 0 }]).phase).toBe(
      'downloading',
    );
  });
  it('starts as nothing downloaded', () => {
    const idle = { state: 'idle' as const, bytes: 0, total: 0 };
    expect(combine([idle, idle]).phase).toBe('none');
  });
});

describe('text from pages', () => {
  it('marks pages only when there are several', () => {
    expect(joinPages(['  Hello  '])).toBe('Hello');
    expect(joinPages(['One', 'Two'])).toBe('— Page 1 —\nOne\n\n— Page 2 —\nTwo');
  });
  it('cleans what the model wraps around its answer', () => {
    expect(cleanReading('```markdown\n| a | b |\n|---|---|\n```')).toBe('| a | b |\n|---|---|');
    expect(cleanReading('[no text]')).toBe('');
    expect(cleanReading('<think>hmm</think>\nInvoice 42')).toBe('Invoice 42');
  });
});
