import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { engine } from '../api/engine';
import { ChipOption, ChipRow, ToggleRow } from '../components/ChipRow';
import { ErrorCard } from '../components/ErrorCard';
import { FilePicker } from '../components/FilePicker';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AppText,
  Button,
  Chip,
  Screen,
  SectionLabel,
  TextField,
} from '../components/ui';
import { ACCEPT } from '../features/tools/catalog';
import { findPreset, PRESET_GROUPS } from '../features/tools/presets';
import { phaseLabel, useJob } from '../hooks/useJob';
import type { ScreenProps } from '../navigation/types';
import type { LocalFile } from '../services/files';
import { useAppSelector } from '../store/hooks';
import { familyColors } from '../theme';

type Mode = 'filesize' | 'pixels' | 'percent' | 'print' | 'preset';
type Fit = 'fit' | 'fill' | 'stretch';
type Unit = 'cm' | 'mm' | 'in';
type OutFormat = 'keep' | 'jpg' | 'png' | 'webp';

const MODES: ChipOption<Mode>[] = [
  { value: 'filesize', label: 'File size (KB)' },
  { value: 'pixels', label: 'Pixels' },
  { value: 'percent', label: 'Percent' },
  { value: 'print', label: 'Print size' },
  { value: 'preset', label: 'Presets' },
];
const FITS: ChipOption<Fit>[] = [
  { value: 'fit', label: 'Fit (pad)' },
  { value: 'fill', label: 'Fill (crop)' },
  { value: 'stretch', label: 'Stretch' },
];
const UNITS: ChipOption<Unit>[] = [
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
  { value: 'in', label: 'inch' },
];
const FORMATS: ChipOption<OutFormat>[] = [
  { value: 'keep', label: 'Same as now' },
  { value: 'jpg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WEBP' },
];

/** "12.5" → 12.5; anything else → undefined. */
const num = (text: string) => {
  const n = Number(text.replace(',', '.'));
  return text.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

export function ResizeScreen({ navigation, route }: ScreenProps<'Resize'>) {
  const quality = useAppSelector(s => s.preferences.quality);
  const [picked, setPicked] = useState<LocalFile[]>(route.params?.files ?? []);
  const [mode, setMode] = useState<Mode>('filesize');
  const [maxKb, setMaxKb] = useState('100');
  const [minKb, setMinKb] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [fit, setFit] = useState<Fit>('fit');
  const [percent, setPercent] = useState('50');
  const [printW, setPrintW] = useState('3.5');
  const [printH, setPrintH] = useState('4.5');
  const [unit, setUnit] = useState<Unit>('cm');
  const [dpi, setDpi] = useState('300');
  const [preset, setPreset] = useState('passport');
  const [format, setFormat] = useState<OutFormat>('keep');
  const [strip, setStrip] = useState(true);
  const job = useJob();

  const options = (): Record<string, unknown> | null => {
    const common = {
      format: format === 'keep' ? undefined : format,
      quality,
      strip_metadata: strip,
    };
    switch (mode) {
      case 'filesize':
        return num(maxKb)
          ? { ...common, mode, max_kb: num(maxKb), min_kb: num(minKb) }
          : null;
      case 'pixels':
        return num(width) || num(height)
          ? { ...common, mode, width: num(width), height: num(height), fit }
          : null;
      case 'percent':
        return num(percent) ? { ...common, mode, percent: num(percent) } : null;
      case 'print':
        return num(printW) && num(printH)
          ? {
              ...common,
              mode,
              print: { width: num(printW), height: num(printH), unit, dpi: num(dpi) ?? 300 },
              fit,
            }
          : null;
      case 'preset':
        return { ...common, mode, preset };
    }
  };

  const title = (): string => {
    switch (mode) {
      case 'filesize':
        return `Resize to under ${maxKb} KB`;
      case 'pixels':
        return `Resize to ${width || 'auto'} × ${height || 'auto'} px`;
      case 'percent':
        return `Resize to ${percent} %`;
      case 'print':
        return `Resize to ${printW} × ${printH} ${unit}`;
      case 'preset':
        return `Resize: ${findPreset(preset)?.label ?? preset}`;
    }
  };

  const ready = options();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader kicker="Image studio" title="Resize" />

        <FilePicker
          files={picked}
          onChange={setPicked}
          accept={ACCEPT.images}
          onError={job.setError}
        />

        <View style={styles.section}>
          <SectionLabel>How</SectionLabel>
          <ChipRow options={MODES} value={mode} onChange={setMode} />
        </View>

        <View style={styles.section}>
          {mode === 'filesize' ? (
            <View style={styles.fields}>
              <TextField
                label="At most (KB)"
                value={maxKb}
                onChangeText={setMaxKb}
                keyboardType="decimal-pad"
                containerStyle={styles.flex}
              />
              <TextField
                label="At least (KB)"
                value={minKb}
                onChangeText={setMinKb}
                keyboardType="decimal-pad"
                placeholder="optional"
                containerStyle={styles.flex}
              />
            </View>
          ) : null}
          {mode === 'filesize' ? (
            <AppText variant="caption" color="textMuted" style={styles.hint}>
              Some forms reject files that are too small, so you can set both.
              1 MB = 1024 KB.
            </AppText>
          ) : null}

          {mode === 'pixels' ? (
            <>
              <View style={styles.fields}>
                <TextField
                  label="Width (px)"
                  value={width}
                  onChangeText={setWidth}
                  keyboardType="number-pad"
                  placeholder="auto"
                  containerStyle={styles.flex}
                />
                <TextField
                  label="Height (px)"
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="number-pad"
                  placeholder="auto"
                  containerStyle={styles.flex}
                />
              </View>
              <AppText variant="caption" color="textMuted" style={styles.hint}>
                Leave one empty to keep the shape. With both, choose how to fit:
              </AppText>
              <ChipRow options={FITS} value={fit} onChange={setFit} />
            </>
          ) : null}

          {mode === 'percent' ? (
            <>
              <TextField
                label="Percent of the current size"
                value={percent}
                onChangeText={setPercent}
                keyboardType="number-pad"
              />
              <View style={[styles.quick, styles.hint]}>
                {['25', '50', '75', '150', '200'].map(p => (
                  <Chip key={p} label={`${p} %`} selected={percent === p} onPress={() => setPercent(p)} />
                ))}
              </View>
            </>
          ) : null}

          {mode === 'print' ? (
            <>
              <View style={styles.fields}>
                <TextField
                  label="Width"
                  value={printW}
                  onChangeText={setPrintW}
                  keyboardType="decimal-pad"
                  containerStyle={styles.flex}
                />
                <TextField
                  label="Height"
                  value={printH}
                  onChangeText={setPrintH}
                  keyboardType="decimal-pad"
                  containerStyle={styles.flex}
                />
                <TextField
                  label="DPI"
                  value={dpi}
                  onChangeText={setDpi}
                  keyboardType="number-pad"
                  containerStyle={styles.flex}
                />
              </View>
              <View style={styles.hint}>
                <ChipRow options={UNITS} value={unit} onChange={setUnit} />
              </View>
              <View style={styles.hint}>
                <ChipRow options={FITS} value={fit} onChange={setFit} />
              </View>
            </>
          ) : null}

          {mode === 'preset'
            ? PRESET_GROUPS.map(group => (
                <View key={group.title} style={styles.group}>
                  <AppText variant="label" uppercase color="textMuted">
                    {group.title}
                  </AppText>
                  <View style={styles.quick}>
                    {group.presets.map(p => (
                      <Chip
                        key={p.id}
                        label={p.label}
                        selected={preset === p.id}
                        color={familyColors.resize}
                        onPress={() => setPreset(p.id)}
                      />
                    ))}
                  </View>
                </View>
              ))
            : null}
          {mode === 'preset' ? (
            <AppText variant="mono" color="textMuted" style={styles.hint}>
              {findPreset(preset)?.detail}
            </AppText>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionLabel>Save as</SectionLabel>
          <ChipRow options={FORMATS} value={format} onChange={setFormat} />
        </View>

        <View style={styles.section}>
          <ToggleRow
            label="Remove hidden details"
            hint="Strips location, camera and date info from the photo."
            checked={strip}
            onToggle={() => setStrip(s => !s)}
          />
        </View>

        {job.error ? (
          <ErrorCard
            error={job.error}
            style={styles.section}
            onAskNw={() => navigation.navigate('Nw', { errorCode: job.error!.code })}
          />
        ) : null}

        <Button
          title={job.busy ? phaseLabel(job.phase, job.progress) : 'Resize'}
          icon="resize"
          onPress={() =>
            ready &&
            job.run(picked, { title: title(), family: 'resize' }, progress =>
              engine.resize(picked, ready, progress),
            )
          }
          disabled={!ready || picked.length === 0 || job.busy}
          style={styles.section}
          testID="resize-run"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 24 },
  fields: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  hint: { marginTop: 10 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  group: { marginBottom: 14 },
});
