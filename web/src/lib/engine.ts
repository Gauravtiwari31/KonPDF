import site from '../../site.config.json';

/** The KonPDF engine. VITE_ENGINE_URL overrides site.config.json (e.g. a local engine). */
export const ENGINE = (import.meta.env.VITE_ENGINE_URL || site.engine).replace(/\/+$/, '');

/** Jobs can take a while; a sleeping free server also needs up to a minute to wake. */
const JOB_TIMEOUT_MS = 240_000;
const REQUEST_TIMEOUT_MS = 90_000;

/** The engine's plain-language error ({ code, title, message, hint }). */
export interface FriendlyError {
  code: string;
  title: string;
  message: string;
  hint?: string;
}

export class EngineError extends Error {
  constructor(readonly friendly: FriendlyError) {
    super(friendly.title);
  }
}

export const friendlyOf = (e: unknown): FriendlyError =>
  e instanceof EngineError
    ? e.friendly
    : {
        code: 'INTERNAL',
        title: 'Something went wrong',
        message: 'That didn’t work. Please try again.',
      };

const UNREACHABLE: FriendlyError = {
  code: 'SERVER_UNREACHABLE',
  title: 'Can’t reach the converter',
  message: 'Check your internet connection and try again.',
  hint: 'If you are online, the converter may be restarting. Wait a minute and try again.',
};

const TIMED_OUT: FriendlyError = {
  code: 'TIMEOUT',
  title: 'That took too long',
  message: 'The converter didn’t answer in time.',
  hint: 'Try fewer or smaller files at once.',
};

export interface RemoteFile {
  name: string;
  size: number;
  mime: string;
  /** Path below /api, e.g. "files/<job>/<name>". */
  url: string;
}

export interface JobResponse {
  job: string;
  files: RemoteFile[];
  notes: string[];
}

export interface FileInfo {
  name: string;
  kind: string;
  format: string;
  size: number;
  width?: number;
  height?: number;
  pages?: number;
  encrypted?: boolean;
}

export interface Formats {
  matrix: Record<string, string[]>;
  kinds: Record<string, string>;
  office: boolean;
}

export interface NwStep {
  tool: string;
  params: Record<string, unknown>;
}

export interface NwPlan {
  steps: NwStep[];
  summary: string;
}

export interface NwReply {
  lang: string;
  reply: string;
  plan: NwPlan | null;
  suggestions: string[];
  /** Something only the Android app does ("scan", "read_text"). */
  open?: string | null;
}

export type Progress = (phase: 'upload' | 'work', ratio: number) => void;

/** XMLHttpRequest rather than fetch, for upload progress. */
function request<T>(
  method: string,
  path: string,
  body?: FormData | object,
  options: { timeout?: number; onProgress?: Progress } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${ENGINE}/api${path}`);
    xhr.timeout = options.timeout ?? REQUEST_TIMEOUT_MS;
    xhr.setRequestHeader('Accept-Language', 'en');
    let payload: XMLHttpRequestBodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const ratio = e.loaded / e.total;
          options.onProgress?.(ratio < 1 ? 'upload' : 'work', ratio);
        }
      };
      xhr.upload.onload = () => options.onProgress?.('work', 1);
    } else if (body) {
      payload = JSON.stringify(body);
      xhr.setRequestHeader('Content-Type', 'application/json');
    }
    xhr.onload = () => {
      let data: { ok?: boolean; error?: FriendlyError } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // A proxy page while the server starts, not the engine's JSON.
      }
      if (xhr.status >= 200 && xhr.status < 300 && data && data.ok !== false) {
        resolve(data as T);
      } else if (data?.error) {
        reject(new EngineError(data.error));
      } else {
        reject(new EngineError(xhr.status >= 500 ? UNREACHABLE : friendlyOf(null)));
      }
    };
    xhr.onerror = () => reject(new EngineError(UNREACHABLE));
    xhr.ontimeout = () => reject(new EngineError(TIMED_OUT));
    xhr.send(payload);
  });
}

function form(files: File[], fields: Record<string, unknown>) {
  const data = new FormData();
  for (const file of files) {
    data.append('files', file, file.name);
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      data.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }
  return data;
}

const job = (path: string, files: File[], fields: Record<string, unknown>, onProgress?: Progress) =>
  request<JobResponse>('POST', path, form(files, fields), { timeout: JOB_TIMEOUT_MS, onProgress });

/** Full address of a result file, for links and previews. */
export const fileUrl = (file: RemoteFile) => `${ENGINE}/api/${file.url}`;

export const engine = {
  health: () => request<{ version: string; office: boolean }>('GET', '/health', undefined, { timeout: JOB_TIMEOUT_MS }),
  formats: () => request<Formats>('GET', '/formats'),
  info: async (files: File[]) =>
    (await request<{ files: FileInfo[] }>('POST', '/info', form(files, {}), { timeout: JOB_TIMEOUT_MS })).files,
  convert: (files: File[], target: string, options: Record<string, unknown>, p?: Progress) =>
    job('/convert', files, { target, options }, p),
  resize: (files: File[], options: Record<string, unknown>, p?: Progress) => job('/resize', files, { options }, p),
  enhance: (files: File[], options: Record<string, unknown>, p?: Progress) => job('/enhance', files, { options }, p),
  pdf: (tool: string, files: File[], options: Record<string, unknown>, p?: Progress) =>
    job(`/pdf/${tool}`, files, { options }, p),
  run: (files: File[], plan: NwPlan, p?: Progress) => job('/run', files, { plan }, p),
  nwChat: (body: {
    message: string;
    files: { name: string; mime: string; size: number }[];
    history: { role: 'user' | 'nw'; text: string }[];
  }) => request<NwReply>('POST', '/nw/chat', { ...body, client: 'web' }),
  nwExplain: (code: string) => request<NwReply>('GET', `/nw/explain/${encodeURIComponent(code)}`),
  /** Deletes a job's files on the engine now (they expire after 30 minutes anyway). */
  discard: (id: string) => request('DELETE', `/files/${encodeURIComponent(id)}`).catch(() => undefined),
};

/** Downloads a result back into a File, e.g. a small preview copy to send again. */
export async function fetchFile(file: RemoteFile): Promise<File> {
  const res = await fetch(fileUrl(file));
  if (!res.ok) {
    throw new EngineError(UNREACHABLE);
  }
  return new File([await res.blob()], file.name, { type: file.mime });
}

/** Lower-case extension ("Scan.JPEG" → "jpeg"), '' if none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}
