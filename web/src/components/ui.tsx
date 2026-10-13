import { useId, type ReactNode } from 'react';
import type { FriendlyError } from '../lib/engine';
import { Icon, type IconName } from './Icon';

export function Button({
  children,
  icon,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
}: {
  children: ReactNode;
  icon?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  type?: 'button' | 'submit';
}) {
  return (
    <button type={type} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {icon ? <Icon name={icon} size={20} /> : null}
      <span>{children}</span>
    </button>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** One choice out of a few, as a row of chips. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  label,
  color,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  color?: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="chip"
          style={o.value === value && color ? { background: color } : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: 'text' | 'password';
  inputMode?: 'decimal' | 'numeric' | 'text';
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        onChange={e => onChange(e.target.value)}
      />
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        {hint ? <span className="hint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Section({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="block">
      {title ? (
        <div className="block-head">
          <h2 className="label">{title}</h2>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ErrorCard({ error }: { error: FriendlyError }) {
  return (
    <div className="card error-card" role="alert">
      <strong>{error.title}</strong>
      <p>{error.message}</p>
      {error.hint ? <p className="hint">{error.hint}</p> : null}
      {error.code && !['SERVER_UNREACHABLE', 'TIMEOUT', 'INTERNAL'].includes(error.code) ? (
        <a className="link" href={`/nw?error=${encodeURIComponent(error.code)}`}>
          Ask NW what to do →
        </a>
      ) : null}
    </div>
  );
}

/** Page title block of a tool. */
export function ToolHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="tool-head">
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      {children ? <p className="lead">{children}</p> : null}
    </header>
  );
}
