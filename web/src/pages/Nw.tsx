import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { EngineStatus, Results, useJob } from '../components/job';
import { Button, ErrorCard } from '../components/ui';
import { engine, friendlyOf, type FriendlyError, type NwPlan, type NwReply } from '../lib/engine';
import { formatBytes } from '../lib/format';

interface Message {
  id: number;
  role: 'user' | 'nw';
  text: string;
  plan?: NwPlan | null;
  suggestions?: string[];
  /** Something only the Android app does. */
  open?: string | null;
  /** NW's greeting, dropped once the conversation starts. */
  intro?: boolean;
  /** Yours: the files sent with it. NW's: the files its plan works on. */
  files?: File[];
}

const TOOL_LABELS: Record<string, string> = {
  convert: 'Convert',
  resize: 'Resize',
  enhance: 'Enhance',
  compress_pdf: 'Compress PDF',
  merge: 'Merge',
  split: 'Split',
  rotate: 'Rotate',
  extract: 'Keep pages',
  delete: 'Delete pages',
  protect: 'Add password',
  unlock: 'Remove password',
  watermark: 'Watermark',
  page_numbers: 'Page numbers',
};

/** { max_kb: 100, to: "pdf" } → "under 100 KB · to PDF". */
function describe(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'password' && k !== 'mode')
    .map(([k, v]) => {
      if (k === 'max_kb' || k === 'target_kb') return `under ${v} KB`;
      if (k === 'min_kb') return `over ${v} KB`;
      if (k === 'to') return `to ${String(v).toUpperCase()}`;
      return typeof v === 'object' ? JSON.stringify(v) : `${k.replace(/_/g, ' ')} ${v}`;
    })
    .join(' · ');
}

const fileMeta = (files: File[]) =>
  files.map(f => ({ name: f.name, mime: f.type || 'application/octet-stream', size: f.size }));

let nextId = 0;

export function Nw() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  // The files the conversation is about: follow-ups use them again.
  const [context, setContext] = useState<File[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const job = useJob();
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const addReply = (reply: NwReply, files: File[] = [], intro = false) =>
    setMessages(m => [
      ...m,
      {
        id: ++nextId,
        role: 'nw',
        text: reply.reply,
        plan: reply.plan,
        suggestions: reply.suggestions,
        open: reply.open,
        intro,
        files,
      },
    ]);

  // Greeting, or an explanation when sent here from an error.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    setThinking(true);
    (code ? engine.nwExplain(code) : engine.nwChat({ message: '', files: [], history: [] }))
      .then(reply => addReply(reply, [], !code))
      .catch(e => setError(friendlyOf(e)))
      .finally(() => setThinking(false));
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, thinking, job.result]);

  const ask = async (text: string, history: Message[], files: File[]) => {
    setThinking(true);
    setError(null);
    try {
      addReply(
        await engine.nwChat({
          message: text,
          files: fileMeta(files),
          history: history.slice(-8).map(m => ({ role: m.role, text: m.text })),
        }),
        files,
      );
    } catch (e) {
      setError(friendlyOf(e));
    } finally {
      setThinking(false);
    }
  };

  const send = (text = draft) => {
    const message = text.trim();
    if (!message || thinking) {
      return;
    }
    const files = pending.length ? pending : context;
    const history = messages.filter(m => !m.intro);
    setMessages([...history, { id: ++nextId, role: 'user', text: message, files: pending.length ? pending : undefined }]);
    setDraft('');
    setPending([]);
    setContext(files);
    ask(message, history, files);
  };

  const attach = (list: FileList | null) => {
    // Copy now: clearing the input afterwards empties the FileList.
    const added = Array.from(list ?? []);
    if (added.length) {
      setPending(p => [...p, ...added].slice(0, 20));
    }
  };

  return (
    <div className="nw">
      <header className="tool-head">
        <p className="kicker">Assistant</p>
        <h1>Ask NW</h1>
        <p className="lead">
          Attach files and say what you need, in English, Hindi, Hinglish, Spanish, French, German or Portuguese. NW
          sees only file names and sizes; nothing runs until you click Run.
        </p>
      </header>
      <EngineStatus />

      <div className="chat" aria-live="polite">
        {messages.map(m =>
          m.role === 'user' ? (
            <div key={m.id} className="bubble mine">
              {m.text ? <p>{m.text}</p> : null}
              {m.files?.length ? (
                <div className="file-chips">
                  {m.files.map((f, i) => (
                    <span key={i} className="file-chip">
                      {f.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div key={m.id} className="bubble theirs">
              <p>{m.text}</p>
              {m.plan?.steps.length ? (
                <div className="plan">
                  <ol>
                    {m.plan.steps.map((s, i) => (
                      <li key={i}>
                        <strong>{TOOL_LABELS[s.tool] ?? s.tool}</strong>
                        <span className="muted"> {describe(s.params)}</span>
                      </li>
                    ))}
                  </ol>
                  {m.files?.length ? (
                    <Button icon="check" disabled={job.busy} onClick={() => job.run(p => engine.run(m.files!, m.plan!, p))}>
                      {job.busy ? job.label : `Run on ${m.files.length} file${m.files.length === 1 ? '' : 's'}`}
                    </Button>
                  ) : (
                    <p className="hint">Attach your files with + and send again.</p>
                  )}
                </div>
              ) : null}
              {m.open ? (
                <a className="btn btn-secondary btn-small" href="/download">
                  <Icon name="phone" size={18} />
                  <span>Get the Android app</span>
                </a>
              ) : null}
              {m.suggestions?.length && m === messages[messages.length - 1] ? (
                <div className="chips">
                  {m.suggestions.map(s => (
                    <button key={s} type="button" className="chip" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ),
        )}
        {thinking ? <div className="bubble theirs typing">NW is thinking…</div> : null}
        {error ? <ErrorCard error={error} /> : null}
        {job.error ? <ErrorCard error={job.error} /> : null}
        {job.result ? <Results result={job.result} onDone={job.clear} /> : null}
        <div ref={end} />
      </div>

      <form
        className="composer card"
        onSubmit={e => {
          e.preventDefault();
          send();
        }}
      >
        {pending.length ? (
          <div className="file-chips">
            {pending.map((f, i) => (
              <span key={i} className="file-chip">
                {f.name} <span className="muted">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setPending(p => p.filter((_, j) => j !== i))}
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="composer-row">
          <button type="button" className="icon-btn big" aria-label="Attach files" onClick={() => input.current?.click()}>
            <Icon name="plus" />
          </button>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={e => {
              attach(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            className="composer-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="e.g. make this photo under 50 KB"
            aria-label="Message to NW"
            maxLength={2000}
          />
          <button type="submit" className="icon-btn big send" aria-label="Send" disabled={!draft.trim() || thinking}>
            <Icon name="send" />
          </button>
        </div>
      </form>
    </div>
  );
}
