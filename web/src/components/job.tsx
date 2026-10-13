import { useCallback, useEffect, useState } from 'react';
import { engine, fileUrl, friendlyOf, type FriendlyError, type JobResponse, type Progress } from '../lib/engine';
import { formatBytes } from '../lib/format';
import { Icon } from './Icon';
import { Button, ErrorCard } from './ui';

type Phase = 'idle' | 'upload' | 'work';

/** One job at a time: progress, the result, or a friendly error. */
export function useJob() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<JobResponse | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  const run = useCallback(async (work: (p: Progress) => Promise<JobResponse>) => {
    setError(null);
    setResult(null);
    setPhase('upload');
    setProgress(0);
    try {
      setResult(
        await work((p, ratio) => {
          setPhase(p);
          setProgress(ratio);
        }),
      );
    } catch (e) {
      setError(friendlyOf(e));
    } finally {
      setPhase('idle');
    }
  }, []);

  const busy = phase !== 'idle';
  const label = phase === 'upload' ? `Sending ${Math.round(progress * 100)} %` : 'Working on it…';
  return { run, busy, label, result, error, setError, clear: () => setResult(null) };
}

/** The finished files, ready to download. */
export function Results({ result, onDone }: { result: JobResponse; onDone: () => void }) {
  const [deleted, setDeleted] = useState(false);
  return (
    <div className="card results" aria-live="polite">
      <div className="results-head">
        <span className="badge">
          <Icon name="check" size={16} /> Done
        </span>
        <span className="muted">
          {result.files.length} file{result.files.length === 1 ? '' : 's'}
        </span>
      </div>
      {result.notes.map(note => (
        <p key={note} className="note">
          {note}
        </p>
      ))}
      {deleted ? (
        <p className="muted">Deleted from the converter.</p>
      ) : (
        <ul className="file-list">
          {result.files.map(f => (
            <li key={f.url}>
              {f.mime.startsWith('image/') && !f.mime.includes('tiff') ? (
                <img className="thumb" src={fileUrl(f)} alt="" loading="lazy" />
              ) : null}
              <span className="file-name">{f.name}</span>
              <span className="mono muted">{formatBytes(f.size)}</span>
              <a className="btn btn-primary btn-small" href={fileUrl(f)} download={f.name}>
                <Icon name="download" size={18} />
                <span>Download</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <Button variant="secondary" onClick={onDone}>
          Start again
        </Button>
        {!deleted ? (
          <Button
            variant="secondary"
            onClick={() => {
              engine.discard(result.job);
              setDeleted(true);
            }}
          >
            Delete from the converter now
          </Button>
        ) : null}
      </div>
      {!deleted ? <p className="hint">Download your files now: they are deleted automatically after 30 minutes.</p> : null}
    </div>
  );
}

/** Error, result and the run button, the same on every tool page. */
export function JobFooter({
  job,
  title,
  ready,
  onRun,
}: {
  job: ReturnType<typeof useJob>;
  title: string;
  ready: boolean;
  onRun: () => void;
}) {
  return (
    <>
      {job.error ? <ErrorCard error={job.error} /> : null}
      {job.result ? (
        <Results result={job.result} onDone={job.clear} />
      ) : (
        <div className="run">
          <Button onClick={onRun} disabled={!ready || job.busy}>
            {job.busy ? job.label : title}
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * Wakes the converter as soon as a tool page opens: on the free plan it
 * sleeps when nobody uses it and takes up to a minute to start.
 */
export function EngineStatus() {
  const [state, setState] = useState<'ok' | 'waking' | 'down'>('ok');
  useEffect(() => {
    let done = false;
    const slow = setTimeout(() => !done && setState('waking'), 2500);
    engine
      .health()
      .then(() => setState('ok'))
      .catch(() => setState('down'))
      .finally(() => {
        done = true;
        clearTimeout(slow);
      });
    return () => clearTimeout(slow);
  }, []);
  if (state === 'ok') {
    return null;
  }
  return (
    <p className={`status ${state}`} role="status">
      {state === 'waking'
        ? 'Starting the converter… The first visit after a quiet spell takes up to a minute. You can pick your files meanwhile.'
        : 'Can’t reach the converter right now. Check your connection, or try again in a minute.'}
    </p>
  );
}
