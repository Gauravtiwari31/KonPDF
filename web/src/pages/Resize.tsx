import { useState } from 'react';
import { FilePicker } from '../components/FilePicker';
import { EngineStatus, JobFooter, useJob } from '../components/job';
import { ChipRow, Field, Section, Toggle, ToolHeader, type Option } from '../components/ui';
import { ACCEPT, PRESET_GROUPS } from '../lib/catalog';
import { engine } from '../lib/engine';
import { num } from '../lib/format';

type Mode = 'filesize' | 'pixels' | 'percent' | 'print' | 'preset';

const MODES: Option<Mode>[] = [
  { value: 'filesize', label: 'File size (KB)' },
  { value: 'pixels', label: 'Pixels' },
  { value: 'percent', label: 'Percent' },
  { value: 'print', label: 'Print size' },
  { value: 'preset', label: 'Presets' },
];
const FITS: Option<string>[] = [
  { value: 'fit', label: 'Fit (pad)' },
  { value: 'fill', label: 'Fill (crop)' },
  { value: 'stretch', label: 'Stretch' },
];
const UNITS: Option<string>[] = [
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
  { value: 'in', label: 'inch' },
];
const TURNS: Option<string>[] = [
  { value: '0', label: 'No turn' },
  { value: '90', label: '90° right' },
  { value: '180', label: '180°' },
  { value: '270', label: '90° left' },
];
const FLIPS: Option<string>[] = [
  { value: 'none', label: 'No flip' },
  { value: 'horizontal', label: 'Mirror' },
  { value: 'vertical', label: 'Upside down' },
];
const CROPS: Option<string>[] = [
  { value: 'none', label: 'No crop' },
  { value: '1:1', label: 'Square' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
];
const FORMATS: Option<string>[] = [
  { value: 'keep', label: 'Same as now' },
  { value: 'jpg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WEBP' },
];

export function Resize() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>('filesize');
  const [maxKb, setMaxKb] = useState('100');
  const [minKb, setMinKb] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [fit, setFit] = useState('fit');
  const [percent, setPercent] = useState('50');
  const [printW, setPrintW] = useState('3.5');
  const [printH, setPrintH] = useState('4.5');
  const [unit, setUnit] = useState('cm');
  const [dpi, setDpi] = useState('300');
  const [preset, setPreset] = useState('passport');
  const [format, setFormat] = useState('keep');
  const [strip, setStrip] = useState(true);
  const [turn, setTurn] = useState('0');
  const [flip, setFlip] = useState('none');
  const [crop, setCrop] = useState('none');
  const job = useJob();

  const options = (): Record<string, unknown> | null => {
    const common = {
      format: format === 'keep' ? undefined : format,
      quality: 85,
      strip_metadata: strip,
      rotate: turn === '0' ? undefined : Number(turn),
      flip: flip === 'none' ? undefined : flip,
      crop: crop === 'none' ? undefined : crop,
    };
    switch (mode) {
      case 'filesize':
        return num(maxKb) ? { ...common, mode, max_kb: num(maxKb), min_kb: num(minKb) } : null;
      case 'pixels':
        return num(width) || num(height) ? { ...common, mode, width: num(width), height: num(height), fit } : null;
      case 'percent':
        return num(percent) ? { ...common, mode, percent: num(percent) } : null;
      case 'print':
        return num(printW) && num(printH)
          ? { ...common, mode, print: { width: num(printW), height: num(printH), unit, dpi: num(dpi) ?? 300 }, fit }
          : null;
      case 'preset':
        return { ...common, mode, preset };
    }
  };
  const ready = options();
  const presetDetail = PRESET_GROUPS.flatMap(g => g.presets).find(p => p.id === preset)?.detail;

  return (
    <>
      <ToolHeader kicker="Image studio" title="Resize images">
        To an exact file size in KB, pixels, a percentage, a print size in cm or inches, or a ready-made preset.
      </ToolHeader>
      <EngineStatus />

      <Section>
        <FilePicker files={files} onChange={setFiles} accept={ACCEPT.images} />
      </Section>

      <Section title="How">
        <ChipRow options={MODES} value={mode} onChange={setMode} label="How" color="var(--volt)" />
        {mode === 'filesize' ? (
          <>
            <div className="fields">
              <Field label="At most (KB)" value={maxKb} onChange={setMaxKb} inputMode="decimal" />
              <Field label="At least (KB)" value={minKb} onChange={setMinKb} inputMode="decimal" placeholder="optional" />
            </div>
            <p className="hint">Some forms reject files that are too small, so you can set both. 1 MB = 1024 KB.</p>
          </>
        ) : null}
        {mode === 'pixels' ? (
          <>
            <div className="fields">
              <Field label="Width (px)" value={width} onChange={setWidth} inputMode="numeric" placeholder="auto" />
              <Field label="Height (px)" value={height} onChange={setHeight} inputMode="numeric" placeholder="auto" />
            </div>
            <p className="hint">Leave one empty to keep the shape. With both, choose how to fit:</p>
            <ChipRow options={FITS} value={fit} onChange={setFit} label="Fit" />
          </>
        ) : null}
        {mode === 'percent' ? (
          <>
            <Field label="Percent of the current size" value={percent} onChange={setPercent} inputMode="numeric" />
            <ChipRow
              options={['25', '50', '75', '150', '200'].map(p => ({ value: p, label: `${p} %` }))}
              value={percent}
              onChange={setPercent}
              label="Quick percent"
            />
          </>
        ) : null}
        {mode === 'print' ? (
          <>
            <div className="fields">
              <Field label="Width" value={printW} onChange={setPrintW} inputMode="decimal" />
              <Field label="Height" value={printH} onChange={setPrintH} inputMode="decimal" />
              <Field label="DPI" value={dpi} onChange={setDpi} inputMode="numeric" />
            </div>
            <ChipRow options={UNITS} value={unit} onChange={setUnit} label="Unit" />
            <ChipRow options={FITS} value={fit} onChange={setFit} label="Fit" />
          </>
        ) : null}
        {mode === 'preset' ? (
          <>
            {PRESET_GROUPS.map(group => (
              <div key={group.title} className="preset-group">
                <h3 className="label muted">{group.title}</h3>
                <ChipRow
                  options={group.presets.map(p => ({ value: p.id, label: p.label }))}
                  value={preset}
                  onChange={setPreset}
                  label={group.title}
                  color="var(--volt)"
                />
              </div>
            ))}
            <p className="mono muted">{presetDetail}</p>
          </>
        ) : null}
      </Section>

      <Section title="Turn and crop">
        <ChipRow options={TURNS} value={turn} onChange={setTurn} label="Turn" />
        <ChipRow options={FLIPS} value={flip} onChange={setFlip} label="Flip" />
        <ChipRow options={CROPS} value={crop} onChange={setCrop} label="Crop" />
      </Section>

      <Section title="Save as">
        <ChipRow options={FORMATS} value={format} onChange={setFormat} label="Save as" />
      </Section>

      <Section>
        <Toggle
          label="Remove hidden details"
          hint="Strips location, camera and date info from the photo."
          checked={strip}
          onChange={setStrip}
        />
      </Section>

      <JobFooter
        job={job}
        title="Resize"
        ready={!!ready && files.length > 0}
        onRun={() => ready && job.run(p => engine.resize(files, ready, p))}
      />
    </>
  );
}
