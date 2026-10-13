import { useRef, useState } from 'react';
import { formatBytes } from '../lib/format';
import { Icon } from './Icon';

/** The engine's limits (engine/app/config.py). */
export const MAX_FILE_MB = 50;
export const MAX_FILES = 20;

/** Pick or drop files. Shows the list with sizes; each can be removed. */
export function FilePicker({
  files,
  onChange,
  accept,
  multiple = true,
  note,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  note?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const add = (list: FileList | null) => {
    if (!list?.length) {
      return;
    }
    const picked = Array.from(list);
    const tooBig = picked.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    const ok = picked.filter(f => !tooBig.includes(f));
    let next = multiple ? [...files, ...ok] : ok.slice(0, 1);
    let message = tooBig.length
      ? `${tooBig.map(f => f.name).join(', ')} ${tooBig.length > 1 ? 'are' : 'is'} over ${MAX_FILE_MB} MB, the most the converter takes.`
      : null;
    if (next.length > MAX_FILES) {
      next = next.slice(0, MAX_FILES);
      message = `Up to ${MAX_FILES} files at a time.`;
    }
    setProblem(message);
    onChange(next);
  };

  return (
    <div className="picker">
      <div
        className={`drop${over ? ' over' : ''}`}
        onDragOver={e => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        <Icon name="upload" size={28} />
        <p>
          <strong>Drop {multiple ? 'files' : 'a file'} here</strong> or
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()}>
          <span>Choose {multiple ? 'files' : 'a file'}</span>
        </button>
        <input
          ref={input}
          type="file"
          hidden
          multiple={multiple}
          accept={accept || undefined}
          onChange={e => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="hint">Up to {MAX_FILE_MB} MB each. Files are deleted from the converter after 30 minutes.</p>
      </div>
      {problem ? <p className="problem">{problem}</p> : null}
      {files.length ? (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`}>
              <span className="file-name">{f.name}</span>
              <span className="mono muted">{formatBytes(f.size)}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {note && files.length ? <p className="hint">{note}</p> : null}
    </div>
  );
}
