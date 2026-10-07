import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { engine } from '../api/engine';
import { toFriendlyError } from '../api/errors';
import { ChipOption, ChipRow } from '../components/ChipRow';
import { ErrorCard } from '../components/ErrorCard';
import { FilePicker } from '../components/FilePicker';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AppText,
  BrutalBox,
  Button,
  Icon,
  Screen,
  SectionLabel,
} from '../components/ui';
import { ACCEPT } from '../features/tools/catalog';
import { phaseLabel, useJob } from '../hooks/useJob';
import { useLang } from '../hooks/useLang';
import type { ScreenProps } from '../navigation/types';
import type { LocalFile } from '../services/files';
import { useAppSelector } from '../store/hooks';
import { familyColors, palette, useTheme } from '../theme';

const PRESETS: ChipOption<string>[] = [
  { value: 'none', label: 'None' },
  { value: 'auto', label: 'Auto enhance' },
  { value: 'document', label: 'Document' },
  { value: 'bw_document', label: 'B&W document' },
  { value: 'low_light', label: 'Low light' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'denoise', label: 'Denoise' },
  { value: 'upscale_2x', label: 'Upscale 2×' },
];
const FILTERS: ChipOption<string>[] = [
  'none',
  'grayscale',
  'sepia',
  'vintage',
  'vivid',
  'cool',
  'warm',
  'fade',
  'noir',
  'invert',
  'blur',
].map(f => ({ value: f, label: f === 'none' ? 'None' : f[0].toUpperCase() + f.slice(1) }));

const SLIDERS = ['brightness', 'contrast', 'saturation', 'sharpness', 'warmth'] as const;
type Adjust = Record<(typeof SLIDERS)[number], number>;
const NO_ADJUST: Adjust = { brightness: 0, contrast: 0, saturation: 0, sharpness: 0, warmth: 0 };

/** −100…+100 in steps of 10, with chunky − / + keys. */
function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTheme();
  const key = (delta: number, icon: 'minus' | 'plus') => (
    <Pressable
      onPress={() => onChange(Math.max(-100, Math.min(100, value + delta)))}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${delta > 0 ? 'up' : 'down'}`}
      style={[styles.key, { borderColor: t.colors.line, backgroundColor: t.colors.surface }]}
    >
      <Icon name={icon} size={18} color={t.colors.text} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      <AppText variant="bodyStrong" style={styles.flex}>
        {label[0].toUpperCase() + label.slice(1)}
      </AppText>
      {key(-10, 'minus')}
      <AppText variant="mono" style={styles.value} align="center">
        {value > 0 ? `+${value}` : value}
      </AppText>
      {key(10, 'plus')}
    </View>
  );
}

export function EnhanceScreen({ navigation, route }: ScreenProps<'Enhance'>) {
  const t = useTheme();
  const lang = useLang();
  const quality = useAppSelector(s => s.preferences.quality);
  const [picked, setPicked] = useState<LocalFile[]>(route.params?.files ?? []);
  const [preset, setPreset] = useState('auto');
  const [filter, setFilter] = useState('none');
  const [adjust, setAdjust] = useState<Adjust>(NO_ADJUST);
  const [proxy, setProxy] = useState<LocalFile | null>(null);
  const [preview, setPreview] = useState<LocalFile | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const job = useJob();
  const { setError } = job;
  const latest = useRef(0);

  const options = {
    preset: preset === 'none' ? undefined : preset,
    filter: filter === 'none' ? undefined : filter,
    adjust,
    quality,
  };
  const optionsKey = JSON.stringify(options);
  const first = picked[0];

  // A small copy of the first image makes every preview quick to send.
  useEffect(() => {
    setProxy(null);
    setPreview(null);
    if (!first) {
      return;
    }
    let cancelled = false;
    engine
      .resize([first], { mode: 'longest', longest: 900, format: 'jpg', quality: 85 })
      .then(r => !cancelled && setProxy(r.outputs[0]))
      .catch(e => !cancelled && setError(toFriendlyError(e, lang)));
    return () => {
      cancelled = true;
    };
  }, [first, lang, setError]);

  // Re-render the preview shortly after the settings stop changing.
  useEffect(() => {
    if (!proxy) {
      return;
    }
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const next = await engine.enhancePreview(proxy, JSON.parse(optionsKey));
        if (id === latest.current) {
          setPreview(next);
        }
      } catch (e) {
        if (id === latest.current) {
          setError(toFriendlyError(e, lang));
        }
      } finally {
        if (id === latest.current) {
          setPreviewing(false);
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [proxy, optionsKey, lang, setError]);

  const shown = comparing ? proxy ?? first : preview ?? proxy ?? first;
  const changed = preset !== 'none' || filter !== 'none' || SLIDERS.some(k => adjust[k] !== 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader kicker="Image studio" title="Enhance" />

        {first ? (
          <Pressable
            onPressIn={() => setComparing(true)}
            onPressOut={() => setComparing(false)}
            accessibilityLabel="Preview. Hold to see the original."
          >
            <BrutalBox contentStyle={styles.previewBox}>
              <Image source={{ uri: shown.uri }} style={styles.preview} resizeMode="contain" />
              <View style={[styles.badge, { backgroundColor: comparing ? palette.card : familyColors.enhance }]}>
                <AppText variant="label" uppercase color={palette.ink}>
                  {comparing ? 'Before' : 'After · hold to compare'}
                </AppText>
              </View>
              {previewing ? (
                <ActivityIndicator style={styles.spinner} color={t.colors.primary} />
              ) : null}
            </BrutalBox>
          </Pressable>
        ) : null}

        <View style={first ? styles.section : undefined}>
          <FilePicker
            files={picked}
            onChange={setPicked}
            accept={ACCEPT.images}
            onError={setError}
          />
          {picked.length > 1 ? (
            <AppText variant="caption" color="textMuted" style={styles.hint}>
              The preview shows the first image; the same settings apply to all.
            </AppText>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionLabel>One-tap fix</SectionLabel>
          <ChipRow options={PRESETS} value={preset} onChange={setPreset} />
        </View>

        <View style={styles.section}>
          <SectionLabel>Filter</SectionLabel>
          <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
        </View>

        <View style={styles.section}>
          <SectionLabel
            right={
              SLIDERS.some(k => adjust[k] !== 0) ? (
                <AppText
                  variant="label"
                  uppercase
                  color={t.colors.primary}
                  onPress={() => setAdjust(NO_ADJUST)}
                >
                  Reset
                </AppText>
              ) : null
            }
          >
            Fine-tune
          </SectionLabel>
          <View style={styles.steppers}>
            {SLIDERS.map(k => (
              <Stepper
                key={k}
                label={k}
                value={adjust[k]}
                onChange={v => setAdjust(a => ({ ...a, [k]: v }))}
              />
            ))}
          </View>
        </View>

        {job.error ? (
          <ErrorCard
            error={job.error}
            style={styles.section}
            onAskNw={() => navigation.navigate('Nw', { errorCode: job.error!.code })}
          />
        ) : null}

        <Button
          title={job.busy ? phaseLabel(job.phase, job.progress) : 'Save enhanced'}
          icon="wand"
          onPress={() =>
            job.run(
              picked,
              {
                title: `Enhance: ${[PRESETS.find(p => p.value === preset)?.label, filter !== 'none' ? filter : '']
                  .filter(x => x && x !== 'None')
                  .join(' + ') || 'adjusted'}`,
                family: 'enhance',
              },
              progress => engine.enhance(picked, options, progress),
            )
          }
          disabled={picked.length === 0 || !changed || job.busy}
          style={styles.section}
          testID="enhance-run"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 24 },
  hint: { marginTop: 8 },
  previewBox: { overflow: 'hidden', padding: 0 },
  preview: { width: '100%', height: 300 },
  badge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: palette.ink,
  },
  spinner: { position: 'absolute', top: 12, right: 12 },
  steppers: { gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  key: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { width: 44 },
});
