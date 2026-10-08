import type { LlamaContext } from 'llama.rn';
import { AI_READER } from '../features/devmode/model';
import NativeModel from '../native/NativeModel';
import { FileActionError, LocalFile } from './files';

/**
 * Developer Mode's AI reader: Qwen3-VL 2B on the phone, through llama.rn
 * (llama.cpp). Nothing leaves the phone.
 *
 * The model takes ~2 GB of memory while loaded, so it is loaded only when a
 * page is read, and released a little after the last page.
 *
 * llama.rn is required lazily: its native code exists only for 64-bit phones,
 * and loading it on a 32-bit phone would fail. The Developer Mode checks
 * keep those phones from ever getting here.
 */

/** What the model is told to do with every page. */
export const READ_PROMPT =
  'Read all the text in this image exactly as written, from top to bottom. ' +
  'Keep the line breaks and the original language. Write tables as Markdown tables. ' +
  'Do not translate, summarise, explain or add anything. ' +
  'If a word cannot be read, write [unclear]. If there is no text, write [no text].';

/** Page pictures are made this size before reading: enough for print-size text. */
export const AI_PAGE_MAX_SIDE = 1280;
/** The vision part's budget per page; more is sharper but slower. */
const IMAGE_MAX_TOKENS = 1024;
const RELEASE_AFTER_MS = 60_000;

let context: LlamaContext | null = null;
let loading: Promise<LlamaContext> | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

async function paths() {
  if (!NativeModel) {
    throw new FileActionError('ai_failed', 'Not available here');
  }
  const [model, mmproj] = await Promise.all(
    AI_READER.files.map(f => NativeModel!.modelPath(f.name)),
  );
  if (!model || !mmproj) {
    throw new FileActionError('ai_failed', 'Model files are missing');
  }
  return { model, mmproj };
}

async function load(onLoad?: (ratio: number) => void): Promise<LlamaContext> {
  if (context) {
    return context;
  }
  if (!loading) {
    loading = (async () => {
      const { model, mmproj } = await paths();
      const { initLlama } = require('llama.rn') as typeof import('llama.rn');
      const ctx = await initLlama(
        {
          model,
          n_ctx: 4096,
          n_batch: 512,
          // Multimodal models need the image tokens to stay where they are.
          ctx_shift: false,
          // CPU only: the most predictable on the widest range of phones.
          n_gpu_layers: 0,
          use_mlock: false,
        },
        progress => onLoad?.(progress / 100),
      );
      const ok = await ctx.initMultimodal({
        path: mmproj,
        use_gpu: false,
        image_max_tokens: IMAGE_MAX_TOKENS,
      });
      if (!ok) {
        await ctx.release();
        throw new FileActionError('ai_failed', 'Vision part failed to load');
      }
      context = ctx;
      return ctx;
    })().finally(() => {
      loading = null;
    });
  }
  return loading;
}

function scheduleRelease() {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
  }
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    release();
  }, RELEASE_AFTER_MS);
}

/** Frees the model's memory now. */
export async function release() {
  const ctx = context;
  context = null;
  if (ctx) {
    try {
      await ctx.release();
    } catch {
      // Already gone.
    }
  }
}

/** Strips what small models sometimes wrap around their answer. */
export function cleanReading(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const fenced = text.match(/^```[a-z]*\n([\s\S]*?)\n```$/);
  if (fenced) {
    text = fenced[1];
  }
  return text.trim() === '[no text]' ? '' : text.trim();
}

export const aiReader = {
  /**
   * Reads one page picture (already scaled to AI_PAGE_MAX_SIDE). `onText`
   * gets the text so far while the model writes it.
   */
  async read(
    page: LocalFile,
    onText?: (text: string) => void,
    onLoad?: (ratio: number) => void,
  ): Promise<string> {
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    let ctx: LlamaContext;
    try {
      ctx = await load(onLoad);
    } catch (error) {
      throw error instanceof FileActionError
        ? error
        : new FileActionError('ai_failed', String(error));
    }
    try {
      let soFar = '';
      const result = await ctx.completion(
        {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: page.uri } },
                { type: 'text', text: READ_PROMPT },
              ],
            },
          ],
          n_predict: 2048,
          temperature: 0,
          // A little pressure against the loops small models fall into on tables.
          penalty_repeat: 1.05,
          stop: ['<|im_end|>', '<|endoftext|>'],
        },
        data => {
          soFar += data.token;
          onText?.(soFar);
        },
      );
      return cleanReading(result.text ?? soFar);
    } catch (error) {
      await release();
      throw new FileActionError('ai_failed', String(error));
    } finally {
      scheduleRelease();
    }
  },

  /** Stops the page being read; what was read so far is kept. */
  stop: async () => {
    try {
      await context?.stopCompletion();
    } catch {
      // Nothing running.
    }
  },

  release,
};
