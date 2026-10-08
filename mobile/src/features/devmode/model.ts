/**
 * Developer Mode's AI reader: Qwen3-VL 2B Instruct (Apache-2.0), run on the
 * phone by llama.cpp (llama.rn). Two files from Qwen's official GGUF builds on
 * Hugging Face, public downloads with no account or key: the language model
 * (4-bit) and its vision part (8-bit). SHA-256 values are Hugging Face's own.
 */
export interface ModelFile {
  name: string;
  url: string;
  sha256: string;
  size: number;
}

const HF = 'https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main';

export const AI_READER = {
  name: 'Qwen3-VL 2B',
  licence: 'Apache-2.0',
  files: [
    {
      name: 'Qwen3VL-2B-Instruct-Q4_K_M.gguf',
      url: `${HF}/Qwen3VL-2B-Instruct-Q4_K_M.gguf`,
      sha256: '089d75c52f4b7ffc56ba998ffc50aae89fcafc755f9e7208aacca281dca6c2ae',
      size: 1_107_409_952,
    },
    {
      name: 'mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf',
      url: `${HF}/mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf`,
      sha256: 'f9a68fabba69c3b81e153367b2c7521030b0fa8bb0de400c9599c8e6725f9c82',
      size: 445_053_216,
    },
  ] as ModelFile[],
};

export const AI_READER_BYTES = AI_READER.files.reduce((s, f) => s + f.size, 0);

/** What the phone tells us about itself (ModelModule.kt). */
export interface DeviceInfo {
  is64Bit: boolean;
  abis: string[];
  ramMb: number;
  availableRamMb: number;
  freeStorageMb: number;
  sdk: number;
  onUnmeteredNetwork: boolean;
  playServices: boolean;
  model: string;
}

export type CheckLevel = 'ok' | 'warn' | 'fail';

export interface DeviceCheck {
  id: 'cpu' | 'memory' | 'storage';
  level: CheckLevel;
  label: string;
  detail: string;
}

/** Below this the model and a page don't fit in memory together. */
export const MIN_RAM_MB = 3800;
/** Comfortable: other apps can stay open while it reads. */
export const GOOD_RAM_MB = 5800;
/** The download plus room to spare. */
export const NEEDED_STORAGE_MB = Math.ceil(AI_READER_BYTES / 1048576) + 400;

const gb = (mb: number) => `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;

/**
 * Whether this phone can run the AI reader, item by item. `alreadyDownloaded`
 * skips the storage check (the space is already used).
 */
export function checkDevice(
  info: DeviceInfo,
  alreadyDownloaded = false,
): { ok: boolean; checks: DeviceCheck[] } {
  const checks: DeviceCheck[] = [
    info.is64Bit
      ? { id: 'cpu', level: 'ok', label: '64-bit processor', detail: 'Supported' }
      : {
          id: 'cpu',
          level: 'fail',
          label: '64-bit processor',
          detail: 'This phone has a 32-bit processor, which can’t run the AI reader.',
        },
    info.ramMb >= GOOD_RAM_MB
      ? { id: 'memory', level: 'ok', label: 'Memory', detail: `${gb(info.ramMb)} RAM` }
      : info.ramMb >= MIN_RAM_MB
      ? {
          id: 'memory',
          level: 'warn',
          label: 'Memory',
          detail: `${gb(info.ramMb)} RAM: it will work, but close other apps while it reads.`,
        }
      : {
          id: 'memory',
          level: 'fail',
          label: 'Memory',
          detail: `${gb(info.ramMb)} RAM: the AI reader needs at least 4 GB.`,
        },
    alreadyDownloaded || info.freeStorageMb >= NEEDED_STORAGE_MB
      ? {
          id: 'storage',
          level: 'ok',
          label: 'Storage',
          detail: alreadyDownloaded ? 'Model downloaded' : `${gb(info.freeStorageMb)} free`,
        }
      : {
          id: 'storage',
          level: 'fail',
          label: 'Storage',
          detail: `${gb(info.freeStorageMb)} free: needs ${gb(NEEDED_STORAGE_MB)}. Free up some space first.`,
        },
  ];
  return { ok: checks.every(c => c.level !== 'fail'), checks };
}
