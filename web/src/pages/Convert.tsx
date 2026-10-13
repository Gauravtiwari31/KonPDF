import { useEffect, useMemo, useState } from 'react';
import { FilePicker } from '../components/FilePicker';
import { EngineStatus, JobFooter, useJob } from '../components/job';
import { ChipRow, ErrorCard, Section, ToolHeader, type Option } from '../components/ui';
import { CONVERT_TOOLS, FAMILY_COLOR, familyOfFormat } from '../lib/catalog';
import { engine, extensionOf, friendlyOf, type Formats, type FriendlyError } from '../lib/engine';
import { formatLabel } from '../lib/format';
import { useParam } from '../lib/useParam';

const QUALITY: Option<string>[] = [
  { value: '95', label: 'Best' },
  { value: '82', label: 'Balanced' },
  { value: '62', label: 'Smallest' },
];
const PAGE_SIZES: Option<string>[] = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: 'fit', label: 'Fit image' },
];
const DPI: Option<string>[] = [
  { value: '72', label: '72 DPI' },
  { value: '150', label: '150 DPI' },
  { value: '300', label: '300 DPI' },
];
const IMAGE_FORMATS = ['jpg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'ico', 'avif'];

/** Formats every picked file can become (an intersection), in the engine's order. */
function commonTargets(files: File[], formats: Formats | null) {
  if (!formats || files.length === 0) {
    return [];
  }
  return files
    .map(f => formats.matrix[extensionOf(f.name)] ?? [])
    .reduce((acc, list) => acc.filter(x => list.includes(x)));
}

export function Convert() {
  const toolId = useParam('tool');
  const tool = CONVERT_TOOLS.find(t => t.id === toolId) ?? CONVERT_TOOLS[0];
  const [files, setFiles] = useState<File[]>([]);
  const [formats, setFormats] = useState<Formats | null>(null);
  const [loadError, setLoadError] = useState<FriendlyError | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [quality, setQuality] = useState('82');
  const [pageSize, setPageSize] = useState('a4');
  const [combine, setCombine] = useState('one');
  const [dpi, setDpi] = useState('150');
  const job = useJob();

  useEffect(() => {
    engine.formats().then(setFormats, e => setLoadError(friendlyOf(e)));
  }, []);

  const targets = useMemo(() => commonTargets(files, formats), [files, formats]);
  const chosen = target && targets.includes(target) ? target : (tool.target && targets.includes(tool.target) ? tool.target : targets[0]) ?? null;

  const kinds = new Set(files.map(f => formats?.kinds[extensionOf(f.name)] ?? 'unknown'));
  const fromImages = kinds.size === 1 && kinds.has('image');
  const fromPdf = kinds.size === 1 && kinds.has('pdf');
  const toImage = !!chosen && IMAGE_FORMATS.includes(chosen);
  const unsupported = !!formats && files.length > 0 && targets.length === 0;

  const convert = () => {
    if (!chosen) {
      return;
    }
    const options: Record<string, unknown> = { quality: Number(quality) };
    if (fromImages && chosen === 'pdf') {
      options.page_size = pageSize;
      options.combine = combine === 'one';
    }
    if (fromPdf && toImage) {
      options.dpi = Number(dpi);
    }
    job.run(p => engine.convert(files, chosen, options, p));
  };

  return (
    <>
      <ToolHeader kicker="Convert" title={tool.id === 'any' ? 'Convert any file' : tool.title}>
        Images, PDFs, Word, Excel, PowerPoint, CSV and more, in any direction the file allows.
      </ToolHeader>
      <EngineStatus />

      <Section>
        <FilePicker files={files} onChange={setFiles} accept={tool.accept} />
      </Section>

      {loadError ? <ErrorCard error={loadError} /> : null}
      {unsupported ? (
        <p className="note">These files can’t all become the same format. Try converting them in separate groups.</p>
      ) : null}

      {targets.length ? (
        <Section title="Convert to">
          <div className="chips" role="radiogroup" aria-label="Convert to">
            {targets.map(fmt => (
              <button
                key={fmt}
                type="button"
                role="radio"
                aria-checked={fmt === chosen}
                className="chip"
                style={fmt === chosen ? { background: FAMILY_COLOR[familyOfFormat(fmt)] } : undefined}
                onClick={() => setTarget(fmt)}
              >
                {formatLabel(fmt)}
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      {chosen && (toImage || chosen === 'pdf') ? (
        <Section title="Quality">
          <ChipRow options={QUALITY} value={quality} onChange={setQuality} label="Quality" />
        </Section>
      ) : null}

      {fromImages && chosen === 'pdf' ? (
        <Section title="Page">
          <ChipRow options={PAGE_SIZES} value={pageSize} onChange={setPageSize} label="Page size" />
          {files.length > 1 ? (
            <ChipRow
              options={[
                { value: 'one', label: 'One PDF' },
                { value: 'each', label: 'One per image' },
              ]}
              value={combine}
              onChange={setCombine}
              label="Combine"
            />
          ) : null}
        </Section>
      ) : null}

      {fromPdf && toImage ? (
        <Section title="Sharpness">
          <ChipRow options={DPI} value={dpi} onChange={setDpi} label="Sharpness" />
        </Section>
      ) : null}

      <JobFooter
        job={job}
        title={chosen ? `Convert to ${formatLabel(chosen)}` : 'Convert'}
        ready={!!chosen && files.length > 0}
        onRun={convert}
      />
    </>
  );
}
