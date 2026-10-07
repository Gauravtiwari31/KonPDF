import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { engine, extensionOf, Formats } from '../api/engine';
import { toFriendlyError } from '../api/errors';
import { ChipOption, ChipRow } from '../components/ChipRow';
import { ErrorCard } from '../components/ErrorCard';
import { FilePicker } from '../components/FilePicker';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AppText,
  Button,
  Chip,
  Screen,
  SectionLabel,
} from '../components/ui';
import { ACCEPT, familyOfFormat, findTool } from '../features/tools/catalog';
import { phaseLabel, useJob } from '../hooks/useJob';
import { useLang } from '../hooks/useLang';
import type { ScreenProps } from '../navigation/types';
import type { LocalFile } from '../services/files';
import { useAppSelector } from '../store/hooks';
import { familyColors } from '../theme';
import { formatLabel } from '../utils/format';

/** The conversion matrix rarely changes; fetch it once per app run. */
let formatsCache: Promise<Formats> | null = null;
const loadFormats = () => {
  formatsCache ??= engine.formats().catch(error => {
    formatsCache = null;
    throw error;
  });
  return formatsCache;
};

/** Formats every picked file can become (an intersection), in the engine's order. */
export function commonTargets(picked: LocalFile[], formats: Formats | null) {
  if (!formats || picked.length === 0) {
    return [];
  }
  const lists = picked.map(f => formats.matrix[extensionOf(f.name)] ?? []);
  return lists.reduce((acc, list) => acc.filter(x => list.includes(x)));
}

type Option = ChipOption<string>;
const QUALITY: Option[] = [
  { value: 'high', label: 'Best' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'small', label: 'Smallest' },
];
const QUALITY_VALUE: Record<string, number> = { high: 95, balanced: 82, small: 62 };
const PAGE_SIZES: Option[] = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: 'fit', label: 'Fit image' },
];
const DPI: Option[] = [
  { value: '72', label: '72 DPI' },
  { value: '150', label: '150 DPI' },
  { value: '300', label: '300 DPI' },
];
const IMAGE_FORMATS = ['jpg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'ico', 'avif'];

export function ConvertScreen({ navigation, route }: ScreenProps<'Convert'>) {
  const tool = findTool(route.params?.toolId);
  const lang = useLang();
  const defaultQuality = useAppSelector(s => s.preferences.quality);
  const [picked, setPicked] = useState<LocalFile[]>(route.params?.files ?? []);
  const [formats, setFormats] = useState<Formats | null>(null);
  const [target, setTarget] = useState<string | null>(
    route.params?.target ?? tool?.target ?? null,
  );
  const [quality, setQuality] = useState(
    defaultQuality >= 90 ? 'high' : defaultQuality >= 75 ? 'balanced' : 'small',
  );
  const [pageSize, setPageSize] = useState('a4');
  const [combine, setCombine] = useState('one');
  const [dpi, setDpi] = useState('150');
  const job = useJob();
  const { setError } = job;

  useEffect(() => {
    loadFormats()
      .then(setFormats)
      .catch(e => setError(toFriendlyError(e, lang)));
  }, [lang, setError]);

  const targets = useMemo(() => commonTargets(picked, formats), [picked, formats]);
  const chosen = target && targets.includes(target) ? target : null;

  // Keep the tool's suggestion when the files allow it, otherwise the first option.
  useEffect(() => {
    if (targets.length && (!target || !targets.includes(target))) {
      const preferred = tool?.target && targets.includes(tool.target);
      setTarget(preferred ? tool!.target! : targets[0]);
    }
  }, [targets, target, tool]);

  const inputKinds = new Set(
    picked.map(f => formats?.kinds[extensionOf(f.name)] ?? 'unknown'),
  );
  const fromImages = inputKinds.size === 1 && inputKinds.has('image');
  const fromPdf = inputKinds.size === 1 && inputKinds.has('pdf');
  const toImage = !!chosen && IMAGE_FORMATS.includes(chosen);
  const unsupported =
    !!formats && picked.length > 0 && targets.length === 0;

  const convert = () => {
    if (!chosen) {
      return;
    }
    const options: Record<string, unknown> = {
      quality: QUALITY_VALUE[quality],
    };
    if (fromImages && chosen === 'pdf') {
      options.page_size = pageSize;
      options.combine = combine === 'one';
    }
    if (fromPdf && toImage) {
      options.dpi = Number(dpi);
    }
    const from = [...new Set(picked.map(f => formatLabel(extensionOf(f.name))))];
    job.run(
      picked,
      {
        title: `${from.join(' + ')} → ${formatLabel(chosen)}`,
        family: familyOfFormat(chosen),
      },
      progress => engine.convert(picked, chosen, options, progress),
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader kicker="Convert" title={tool?.title ?? 'Any file'} />

        <FilePicker
          files={picked}
          onChange={setPicked}
          accept={tool?.accept ?? ACCEPT.any}
          onError={e => setError(e)}
        />

        {unsupported ? (
          <AppText color="textMuted" style={styles.note}>
            These files can't all become the same format. Try converting them
            in separate groups.
          </AppText>
        ) : null}

        {targets.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>Convert to</SectionLabel>
            <View style={styles.chips}>
              {targets.map(fmt => (
                <Chip
                  key={fmt}
                  label={formatLabel(fmt)}
                  selected={fmt === chosen}
                  color={familyColors[familyOfFormat(fmt)]}
                  onPress={() => setTarget(fmt)}
                />
              ))}
            </View>
            {!formats?.office && picked.some(f => ['pptx', 'ppt', 'odp', 'doc'].includes(extensionOf(f.name))) ? (
              <AppText variant="caption" color="textMuted" style={styles.note}>
                Heads-up: this engine has no LibreOffice, so PowerPoint and old
                Word files may not convert.
              </AppText>
            ) : null}
          </View>
        ) : null}

        {chosen && (toImage || chosen === 'pdf' || chosen === 'webp') ? (
          <View style={styles.section}>
            <SectionLabel>Quality</SectionLabel>
            <ChipRow options={QUALITY} value={quality} onChange={setQuality} />
          </View>
        ) : null}

        {fromImages && chosen === 'pdf' ? (
          <View style={styles.section}>
            <SectionLabel>Page</SectionLabel>
            <ChipRow options={PAGE_SIZES} value={pageSize} onChange={setPageSize} />
            {picked.length > 1 ? (
              <View style={styles.spaced}>
                <ChipRow
                  options={[
                    { value: 'one', label: 'One PDF' },
                    { value: 'each', label: 'One per image' },
                  ]}
                  value={combine}
                  onChange={setCombine}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {fromPdf && toImage ? (
          <View style={styles.section}>
            <SectionLabel>Sharpness</SectionLabel>
            <ChipRow options={DPI} value={dpi} onChange={setDpi} />
          </View>
        ) : null}

        {job.error ? (
          <ErrorCard
            error={job.error}
            style={styles.section}
            onAskNw={() =>
              navigation.navigate('Nw', { errorCode: job.error!.code })
            }
          />
        ) : null}

        <Button
          title={
            job.busy
              ? phaseLabel(job.phase, job.progress)
              : chosen
              ? `Convert to ${formatLabel(chosen)}`
              : 'Convert'
          }
          icon="convert"
          onPress={convert}
          disabled={!chosen || picked.length === 0 || job.busy}
          style={styles.section}
          testID="convert-run"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spaced: { marginTop: 10 },
  note: { marginTop: 12 },
});
