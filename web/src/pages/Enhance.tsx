import { useEffect, useRef, useState } from 'react';
import { FilePicker } from '../components/FilePicker';
import { Icon } from '../components/Icon';
import { EngineStatus, JobFooter, useJob } from '../components/job';
import { ChipRow, ErrorCard, Section, ToolHeader, type Option } from '../components/ui';
import { ACCEPT } from '../lib/catalog';
import { engine, fetchFile, fileUrl, friendlyOf, type FriendlyError } from '../lib/engine';

const PRESETS: Option<string>[] = [
  { value: 'none', label: 'None' },
  { value: 'auto', label: 'Auto enhance' },
  { value: 'document', label: 'Document' },
  { value: 'bw_document', label: 'B&W document' },
  { value: 'low_light', label: 'Low light' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'denoise', label: 'Denoise' },
  { value: 'upscale_2x', label: 'Upscale 2×' },
];
const FILTERS: Option<string>[] = ['none', 'grayscale', 'sepia', 'vintage', 'vivid', 'cool', 'warm', 'fade', 'noir', 'invert', 'blur'].map(
  f => ({ value: f, label: f === 'none' ? 'None' : f[0].toUpperCase() + f.slice(1) }),
);
const SLIDERS = ['brightness', 'contrast', 'saturation', 'sharpness', 'warmth'] as const;
type Adjust = Record<(typeof SLIDERS)[number], number>;
const NO_ADJUST: Adjust = { brightness: 0, contrast: 0, saturation: 0, sharpness: 0, warmth: 0 };

export function Enhance() {
  const [files, setFiles] = useState<File[]>([]);
  const [preset, setPreset] = useState('auto');
  const [filter, setFilter] = useState('none');
  const [adjust, setAdjust] = useState<Adjust>(NO_ADJUST);
  // A small JPEG copy of the first image: quick to send for every preview.
  const [proxy, setProxy] = useState<{ file: File; url: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [previewError, setPreviewError] = useState<FriendlyError | null>(null);
  const job = useJob();
  const latest = useRef(0);
  const first = files[0];

  const options = {
    preset: preset === 'none' ? undefined : preset,
    filter: filter === 'none' ? undefined : filter,
    adjust,
    quality: 85,
  };
  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    setProxy(null);
    setPreview(null);
    setPreviewError(null);
    if (!first) {
      return;
    }
    let cancelled = false;
    engine
      .resize([first], { mode: 'longest', longest: 900, format: 'jpg', quality: 85 })
      .then(async r => {
        const file = await fetchFile(r.files[0]);
        if (!cancelled) {
          setProxy({ file, url: fileUrl(r.files[0]) });
        }
      })
      .catch(e => !cancelled && setPreviewError(friendlyOf(e)));
    return () => {
      cancelled = true;
    };
  }, [first]);

  useEffect(() => {
    if (!proxy) {
      return;
    }
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const r = await engine.enhance([proxy.file], { ...JSON.parse(optionsKey), preview: true });
        if (id === latest.current) {
          setPreview(fileUrl(r.files[0]));
        }
      } catch (e) {
        if (id === latest.current) {
          setPreviewError(friendlyOf(e));
        }
      } finally {
        if (id === latest.current) {
          setPreviewing(false);
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [proxy, optionsKey]);

  const changed = preset !== 'none' || filter !== 'none' || SLIDERS.some(k => adjust[k] !== 0);
  const shown = comparing ? proxy?.url : preview ?? proxy?.url;

  return (
    <>
      <ToolHeader kicker="Image studio" title="Enhance photos">
        One-tap fixes for dark photos and paper scans, filters, and fine-tuning, with a live preview.
      </ToolHeader>
      <EngineStatus />

      {first ? (
        <div className="preview card">
          {shown ? <img src={shown} alt="Preview of the first image" /> : <p className="muted">Preparing the preview…</p>}
          {previewing ? <span className="spinner" aria-label="Updating the preview" /> : null}
          {proxy ? (
            <button
              type="button"
              className="badge compare"
              onPointerDown={() => setComparing(true)}
              onPointerUp={() => setComparing(false)}
              onPointerLeave={() => setComparing(false)}
              onKeyDown={e => e.key === ' ' && setComparing(true)}
              onKeyUp={() => setComparing(false)}
            >
              {comparing ? 'Before' : 'After · hold to compare'}
            </button>
          ) : null}
        </div>
      ) : null}
      {previewError ? <ErrorCard error={previewError} /> : null}

      <Section>
        <FilePicker
          files={files}
          onChange={setFiles}
          accept={ACCEPT.images}
          note={files.length > 1 ? 'The preview shows the first image; the same settings apply to all.' : undefined}
        />
      </Section>

      <Section title="One-tap fix">
        <ChipRow options={PRESETS} value={preset} onChange={setPreset} label="One-tap fix" color="var(--lavender)" />
      </Section>
      <Section title="Filter">
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} label="Filter" color="var(--lavender)" />
      </Section>
      <Section
        title="Fine-tune"
        right={
          SLIDERS.some(k => adjust[k] !== 0) ? (
            <button type="button" className="link" onClick={() => setAdjust(NO_ADJUST)}>
              Reset
            </button>
          ) : null
        }
      >
        <div className="sliders">
          {SLIDERS.map(k => (
            <label key={k} className="slider">
              <span>{k[0].toUpperCase() + k.slice(1)}</span>
              <input
                type="range"
                min={-100}
                max={100}
                step={10}
                value={adjust[k]}
                onChange={e => setAdjust(a => ({ ...a, [k]: Number(e.target.value) }))}
              />
              <span className="mono">{adjust[k] > 0 ? `+${adjust[k]}` : adjust[k]}</span>
            </label>
          ))}
        </div>
      </Section>

      <JobFooter
        job={job}
        title="Save enhanced"
        ready={files.length > 0 && changed}
        onRun={() => job.run(p => engine.enhance(files, options, p))}
      />
      {!files.length ? (
        <p className="hint center">
          <Icon name="image" size={16} /> JPG, PNG, WEBP, HEIC and more.
        </p>
      ) : null}
    </>
  );
}
