import NativeDevice from '../native/NativeDevice';

/** A file KonPDF holds a copy of, in its cache folder. */
export interface LocalFile {
  /** file:// URI, for <Image> and uploads. */
  uri: string;
  path: string;
  name: string;
  mime: string;
  size: number;
}

/** Thrown by file actions; `code` comes from DeviceModule.kt. */
export class FileActionError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function native() {
  if (!NativeDevice) {
    throw new FileActionError('unavailable', 'Files are not available here');
  }
  return NativeDevice;
}

const parse = (json: string): LocalFile[] => {
  try {
    const list = JSON.parse(json);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof FileActionError) {
      throw error;
    }
    const e = error as { code?: string; message?: string };
    throw new FileActionError(e.code ?? 'failed', e.message ?? '');
  }
}

/** One MIME type for a share: exact if all match, "image/*" for mixed images, else any. */
export function sharedMime(list: LocalFile[]): string {
  const types = new Set(list.map(f => f.mime));
  if (types.size === 1) {
    return list[0].mime;
  }
  const families = new Set(list.map(f => f.mime.split('/')[0]));
  return families.size === 1 ? `${[...families][0]}/*` : '*/*';
}

export const files = {
  pick: (mimeTypes: string[] = ['*/*'], multiple = true) =>
    call(async () => parse(await native().pickFiles(mimeTypes, multiple))),

  takeShared: () => call(async () => parse(await native().takeSharedFiles())),

  download: (url: string, fileName: string, headers: Record<string, string>) =>
    call(
      async () =>
        JSON.parse(
          await native().downloadFile(url, fileName, JSON.stringify(headers)),
        ) as LocalFile,
    ),

  save: (file: LocalFile) =>
    call(() => native().saveFile(file.path, file.name, file.mime)),

  share: (list: LocalFile[]) =>
    call(() =>
      native().shareFiles(
        list.map(f => f.path),
        sharedMime(list),
      ),
    ),

  open: (file: LocalFile) =>
    call(() => native().openFile(file.path, file.mime)),

  remove: async (file: LocalFile) => {
    try {
      await native().deleteFile(file.path);
    } catch {
      // A cache copy that can't be removed is cleared by Android eventually.
    }
  },
};
