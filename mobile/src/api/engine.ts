import axios from 'axios';
import { JOB_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from '../config';
import type { Lang } from '../i18n/languages';
import { files, LocalFile } from '../services/files';
import { server } from '../services/server';

/** HTTP client for the KonPDF engine. The base URL follows Settings at runtime. */
export const api = axios.create({ timeout: REQUEST_TIMEOUT_MS });

/** Language for the engine's errors and NW's replies (set from preferences). */
let language: Lang = 'en';
export const setEngineLanguage = (lang: Lang) => {
  language = lang;
};

api.interceptors.request.use(config => {
  config.baseURL = server.getUrl();
  config.headers['Accept-Language'] = language;
  return config;
});

/** A result file on the engine, before it is downloaded. */
export interface RemoteFile {
  name: string;
  size: number;
  mime: string;
  /** Path below the API base, e.g. "files/<job>/<name>". */
  url: string;
}

export interface JobResponse {
  ok: true;
  job: string;
  files: RemoteFile[];
  /** Plain-language notes, e.g. "We got it to 52 KB, close to your 50 KB target." */
  notes: string[];
}

/** A finished job with its results copied onto the phone. */
export interface JobResult {
  job: string;
  outputs: LocalFile[];
  notes: string[];
}

export interface FileInfo {
  name: string;
  /** image | pdf | document | presentation | sheet | unknown */
  kind: string;
  format: string;
  size: number;
  width?: number;
  height?: number;
  pages?: number;
  encrypted?: boolean;
}

export interface Formats {
  /** Input format → formats it can be converted to. */
  matrix: Record<string, string[]>;
  /** Format → family (image, pdf, document, presentation, sheet). */
  kinds: Record<string, string>;
  office: boolean;
}

export interface Health {
  status: string;
  version: string;
  office: boolean;
  nw: string;
}

export interface NwStep {
  tool: string;
  params: Record<string, unknown>;
}

/** Steps NW proposes; nothing runs until the person taps Run. */
export interface NwPlan {
  steps: NwStep[];
  summary: string;
}

export interface NwRequest {
  message: string;
  /** Names, types and sizes only: NW never sees file contents. */
  files: { name: string; mime: string; size: number }[];
  history: { role: 'user' | 'nw'; text: string }[];
}

export interface NwReply {
  lang: string;
  reply: string;
  plan: NwPlan | null;
  suggestions: string[];
  /** "core", or "llm" when a local model answered. */
  engine: string;
}

export type JobProgress =(phase: 'upload' | 'work' | 'download', ratio: number) => void;

function formData(inputs: LocalFile[], fields: Record<string, unknown>) {
  const form = new FormData();
  for (const file of inputs) {
    // React Native's FormData streams a file:// URI straight from disk.
    form.append('files', {
      uri: file.uri,
      name: file.name,
      type: file.mime,
    } as unknown as Blob);
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }
  return form;
}

/**
 * Uploads `inputs` to an engine endpoint, waits for the job, then downloads
 * every result into the phone's cache.
 */
export async function runJob(
  path: string,
  inputs: LocalFile[],
  fields: Record<string, unknown>,
  onProgress?: JobProgress,
): Promise<JobResult> {
  const { data } = await api.post<JobResponse>(path, formData(inputs, fields), {
    timeout: JOB_TIMEOUT_MS,
    headers: { 'Content-Type': 'multipart/form-data' },
    // Axios can't send FormData through its own serialiser on React Native.
    transformRequest: body => body,
    onUploadProgress: event => {
      if (event.total) {
        const ratio = event.loaded / event.total;
        onProgress?.(ratio < 1 ? 'upload' : 'work', ratio);
      }
    },
  });
  onProgress?.('download', 0);
  const base = server.getUrl();
  const outputs: LocalFile[] = [];
  for (const [i, remote] of data.files.entries()) {
    outputs.push(
      await files.download(`${base}/${remote.url}`, remote.name, {
        'Accept-Language': language,
      }),
    );
    onProgress?.('download', (i + 1) / data.files.length);
  }
  return { job: data.job, outputs, notes: data.notes ?? [] };
}

export const engine = {
  health: async () => (await api.get<Health>('/health')).data,

  formats: async () => (await api.get<Formats>('/formats')).data,

  info: async (inputs: LocalFile[]) =>
    (
      await api.post<{ files: FileInfo[] }>('/info', formData(inputs, {}), {
        timeout: JOB_TIMEOUT_MS,
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: body => body,
      })
    ).data.files,

  convert: (
    inputs: LocalFile[],
    target: string,
    options: Record<string, unknown>,
    onProgress?: JobProgress,
  ) => runJob('/convert', inputs, { target, options }, onProgress),

  resize: (
    inputs: LocalFile[],
    options: Record<string, unknown>,
    onProgress?: JobProgress,
  ) => runJob('/resize', inputs, { options }, onProgress),

  enhance: (
    inputs: LocalFile[],
    options: Record<string, unknown>,
    onProgress?: JobProgress,
  ) => runJob('/enhance', inputs, { options }, onProgress),

  /** A small, fast JPEG of one image with the enhance options applied. */
  enhancePreview: async (input: LocalFile, options: Record<string, unknown>) =>
    (await runJob('/enhance', [input], { options: { ...options, preview: true } }))
      .outputs[0],

  pdf: (
    tool: string,
    inputs: LocalFile[],
    options: Record<string, unknown>,
    onProgress?: JobProgress,
  ) => runJob(`/pdf/${tool}`, inputs, { options }, onProgress),

  /** Runs a multi-step plan from NW over the files. */
  run: (inputs: LocalFile[], plan: NwPlan, onProgress?: JobProgress) =>
    runJob('/run', inputs, { plan }, onProgress),

  nwChat: async (body: NwRequest) =>
    (await api.post<NwReply>('/nw/chat', body)).data,

  nwExplain: async (code: string) =>
    (await api.get<NwReply>(`/nw/explain/${encodeURIComponent(code)}`)).data,

  /** Frees the job's files on the engine straight away (they expire anyway). */
  discard: (job: string) =>
    api.delete(`/files/${encodeURIComponent(job)}`).catch(() => undefined),
};

/** Lower-case extension of a file name, '' if none ("Scan.JPEG" → "jpeg"). */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}
