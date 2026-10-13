import { useEffect, useState } from 'react';
import { FilePicker } from '../components/FilePicker';
import { Icon, type IconName } from '../components/Icon';
import { EngineStatus, JobFooter, useJob } from '../components/job';
import { Button, ChipRow, ErrorCard, Field, Section, ToolHeader, type Option } from '../components/ui';
import { ACCEPT } from '../lib/catalog';
import { engine, friendlyOf, type FileInfo, type FriendlyError } from '../lib/engine';
import { formatBytes } from '../lib/format';
import { useParam } from '../lib/useParam';

interface PdfTool {
  id: string;
  label: string;
  icon: IconName;
  about: string;
  multi?: boolean;
}

const TOOLS: PdfTool[] = [
  { id: 'merge', label: 'Merge', icon: 'layers', about: 'Join PDFs and images into one PDF, in the order you pick them.', multi: true },
  { id: 'split', label: 'Split', icon: 'scissors', about: 'Every page, every few pages, or your own ranges as separate PDFs.' },
  { id: 'compress', label: 'Compress', icon: 'compress', about: 'Make PDFs smaller, or get them under a size in KB.', multi: true },
  { id: 'extract', label: 'Keep pages', icon: 'pdf', about: 'A new PDF with only the pages you choose.' },
  { id: 'delete', label: 'Delete pages', icon: 'close', about: 'Remove the pages you don’t need.' },
  { id: 'rotate', label: 'Rotate', icon: 'convert', about: 'Turn every page, or just some.', multi: true },
  { id: 'reorder', label: 'Reorder', icon: 'sliders', about: 'Put the pages in a new order.' },
  { id: 'protect', label: 'Add password', icon: 'lock', about: 'Lock PDFs with a password.', multi: true },
  { id: 'unlock', label: 'Remove password', icon: 'lock', about: 'Remove the password from PDFs you can open.', multi: true },
  { id: 'watermark', label: 'Watermark', icon: 'doc', about: 'Stamp text such as CONFIDENTIAL or DRAFT on every page.', multi: true },
  { id: 'page-numbers', label: 'Page numbers', icon: 'pdf', about: 'Number the pages.', multi: true },
  { id: 'info', label: 'Info', icon: 'pdf', about: 'Pages, page size and whether a PDF is locked.', multi: true },
];

const SPLIT_MODES: Option<string>[] = [
  { value: 'each', label: 'Every page' },
  { value: 'every', label: 'Every N pages' },
  { value: 'ranges', label: 'Custom ranges' },
];
const LEVELS: Option<string>[] = [
  { value: 'low', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'strong', label: 'Strong' },
  { value: 'target', label: 'Target size' },
];
const ANGLES: Option<string>[] = [
  { value: '90', label: '90° right' },
  { value: '180', label: '180°' },
  { value: '270', label: '90° left' },
];
const POSITIONS: Option<string>[] = [
  { value: 'bottom-center', label: 'Bottom centre' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'top-right', label: 'Top right' },
];
const NUMBER_STYLES: Option<string>[] = [
  { value: 'n', label: '1, 2, 3' },
  { value: 'page_n_of_total', label: 'Page 1 of 9' },
];
const WATERMARK_STYLES: Option<string>[] = [
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'center', label: 'Centre' },
  { value: 'bottom', label: 'Bottom' },
];
const OPACITY: Option<string>[] = [
  { value: '0.15', label: 'Faint' },
  { value: '0.3', label: 'Soft' },
  { value: '0.5', label: 'Strong' },
];

export function PdfTools() {
  const param = useParam('tool');
  const [toolId, setToolId] = useState('merge');
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState('');
  const [splitMode, setSplitMode] = useState('each');
  const [everyN, setEveryN] = useState('2');
  const [level, setLevel] = useState('medium');
  const [targetKb, setTargetKb] = useState('1000');
  const [angle, setAngle] = useState('90');
  const [password, setPassword] = useState('');
  const [text, setText] = useState('CONFIDENTIAL');
  const [wmStyle, setWmStyle] = useState('diagonal');
  const [opacity, setOpacity] = useState('0.3');
  const [position, setPosition] = useState('bottom-center');
  const [numberStyle, setNumberStyle] = useState('n');
  const [info, setInfo] = useState<FileInfo[] | null>(null);
  const [infoBusy, setInfoBusy] = useState(false);
  const [infoError, setInfoError] = useState<FriendlyError | null>(null);
  const job = useJob();
  const tool = TOOLS.find(t => t.id === toolId) ?? TOOLS[0];

  useEffect(() => {
    if (param && TOOLS.some(t => t.id === param)) {
      setToolId(param);
    }
  }, [param]);

  const pick = (id: string) => {
    setToolId(id);
    setInfo(null);
    setPages('');
    job.clear();
    job.setError(null);
    history.replaceState(null, '', `/pdf-tools?tool=${id}`);
  };

  const options = (): Record<string, unknown> | null => {
    switch (tool.id) {
      case 'merge':
        return files.length >= 2 ? {} : null;
      case 'split':
        if (splitMode === 'each') {
          return { mode: 'each' };
        }
        if (splitMode === 'every') {
          return Number(everyN) > 0 ? { mode: 'every', every: Number(everyN) } : null;
        }
        return pages.trim() ? { mode: 'ranges', ranges: pages } : null;
      case 'extract':
      case 'delete':
        return pages.trim() ? { pages } : null;
      case 'reorder':
        return pages.trim() ? { order: pages } : null;
      case 'compress':
        return level === 'target' ? (Number(targetKb) > 0 ? { target_kb: Number(targetKb) } : null) : { level };
      case 'rotate':
        return { angle: Number(angle), pages: pages.trim() || undefined };
      case 'protect':
        return password.length >= 4 ? { password } : null;
      case 'unlock':
        return password ? { password } : null;
      case 'watermark':
        return text.trim() ? { text: text.trim(), style: wmStyle, opacity: Number(opacity) } : null;
      case 'page-numbers':
        return { position, style: numberStyle };
      default:
        return {};
    }
  };
  const ready = options();

  const showInfo = async () => {
    setInfoBusy(true);
    setInfoError(null);
    try {
      setInfo(await engine.info(files));
    } catch (e) {
      setInfoError(friendlyOf(e));
    } finally {
      setInfoBusy(false);
    }
  };

  const pagesField = (label: string, placeholder: string, hint: string) => (
    <Field label={label} value={pages} onChange={setPages} placeholder={placeholder} hint={hint} />
  );

  return (
    <>
      <ToolHeader kicker="PDF tools" title={`${tool.label} PDF`}>
        {tool.about}
      </ToolHeader>
      <EngineStatus />

      <div className="chips tool-chips" role="tablist" aria-label="PDF tool">
        {TOOLS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tool.id}
            className="chip"
            style={t.id === tool.id ? { background: 'var(--rose)' } : undefined}
            onClick={() => pick(t.id)}
          >
            <Icon name={t.icon} size={16} /> {t.label}
          </button>
        ))}
      </div>

      <Section>
        <FilePicker
          files={files}
          onChange={next => {
            setFiles(next);
            setInfo(null);
          }}
          accept={tool.id === 'merge' ? `${ACCEPT.pdf},${ACCEPT.images}` : ACCEPT.pdf}
          multiple={!!tool.multi}
          note={tool.id === 'merge' ? 'Files are joined in this order. Images become pages too.' : undefined}
        />
      </Section>

      <Section>
        {tool.id === 'split' ? (
          <>
            <ChipRow options={SPLIT_MODES} value={splitMode} onChange={setSplitMode} label="Split" />
            {splitMode === 'every' ? <Field label="Pages per file" value={everyN} onChange={setEveryN} inputMode="numeric" /> : null}
            {splitMode === 'ranges' ? pagesField('Ranges', '1-3, 4-6, 7', 'Each range becomes its own PDF.') : null}
          </>
        ) : null}
        {tool.id === 'extract' ? pagesField('Pages to keep', '1-3, 7', 'Use commas and dashes: 1-3, 7, 10-12.') : null}
        {tool.id === 'delete' ? pagesField('Pages to delete', '2, 5-6', 'Use commas and dashes: 2, 5-6.') : null}
        {tool.id === 'reorder' ? pagesField('New order', '3, 1, 2', 'List every page in the order you want.') : null}
        {tool.id === 'rotate' ? (
          <>
            <ChipRow options={ANGLES} value={angle} onChange={setAngle} label="Angle" />
            {pagesField('Pages', 'all', 'Leave empty to rotate every page.')}
          </>
        ) : null}
        {tool.id === 'compress' ? (
          <>
            <ChipRow options={LEVELS} value={level} onChange={setLevel} label="Compression" />
            {level === 'target' ? <Field label="At most (KB)" value={targetKb} onChange={setTargetKb} inputMode="numeric" /> : null}
          </>
        ) : null}
        {tool.id === 'protect' || tool.id === 'unlock' ? (
          <Field
            label={tool.id === 'protect' ? 'New password' : 'Current password'}
            value={password}
            onChange={setPassword}
            type="password"
            hint={tool.id === 'protect' ? 'At least 4 characters. KonPDF never stores it.' : 'Used once to open the file, never stored.'}
          />
        ) : null}
        {tool.id === 'watermark' ? (
          <>
            <Field label="Text" value={text} onChange={setText} />
            <ChipRow options={WATERMARK_STYLES} value={wmStyle} onChange={setWmStyle} label="Style" />
            <ChipRow options={OPACITY} value={opacity} onChange={setOpacity} label="Strength" />
          </>
        ) : null}
        {tool.id === 'page-numbers' ? (
          <>
            <ChipRow options={POSITIONS} value={position} onChange={setPosition} label="Position" />
            <ChipRow options={NUMBER_STYLES} value={numberStyle} onChange={setNumberStyle} label="Style" />
          </>
        ) : null}
      </Section>

      {tool.id === 'info' ? (
        <>
          {info ? (
            <ul className="file-list">
              {info.map(f => (
                <li key={f.name}>
                  <span className="file-name">{f.name}</span>
                  <span className="mono muted">
                    {[
                      f.pages !== undefined ? `${f.pages} pages` : null,
                      f.width ? `${f.width} × ${f.height} pt` : null,
                      formatBytes(f.size),
                      f.encrypted ? 'password-protected' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {infoError ? <ErrorCard error={infoError} /> : null}
          <div className="run">
            <Button onClick={showInfo} disabled={!files.length || infoBusy}>
              {infoBusy ? 'Reading…' : 'Show details'}
            </Button>
          </div>
        </>
      ) : (
        <JobFooter
          job={job}
          title={tool.label}
          ready={!!ready && files.length > 0}
          onRun={() => ready && job.run(p => engine.pdf(tool.id, files, ready, p))}
        />
      )}
    </>
  );
}
