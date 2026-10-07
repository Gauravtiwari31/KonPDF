import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { engine, FileInfo } from '../api/engine';
import { toFriendlyError } from '../api/errors';
import { ChipOption, ChipRow } from '../components/ChipRow';
import { ErrorCard } from '../components/ErrorCard';
import { FilePicker } from '../components/FilePicker';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AppText,
  BrutalBox,
  Button,
  Chip,
  IconName,
  Screen,
  TextField,
} from '../components/ui';
import { ACCEPT } from '../features/tools/catalog';
import { phaseLabel, useJob } from '../hooks/useJob';
import { useLang } from '../hooks/useLang';
import type { ScreenProps } from '../navigation/types';
import type { LocalFile } from '../services/files';
import { familyColors } from '../theme';
import { formatBytes } from '../utils/format';

interface PdfTool {
  id: string;
  label: string;
  icon: IconName;
  /** Done words for the history title. */
  done: string;
  multi?: boolean;
}

const TOOLS: PdfTool[] = [
  { id: 'merge', label: 'Merge', icon: 'layers', done: 'Merged PDF', multi: true },
  { id: 'split', label: 'Split', icon: 'scissors', done: 'Split PDF' },
  { id: 'compress', label: 'Compress', icon: 'compress', done: 'Compressed PDF', multi: true },
  { id: 'extract', label: 'Keep pages', icon: 'file', done: 'Kept pages' },
  { id: 'delete', label: 'Delete pages', icon: 'trash', done: 'Deleted pages' },
  { id: 'rotate', label: 'Rotate', icon: 'rotate', done: 'Rotated PDF', multi: true },
  { id: 'reorder', label: 'Reorder', icon: 'sliders', done: 'Reordered PDF' },
  { id: 'protect', label: 'Add password', icon: 'lock', done: 'Locked PDF', multi: true },
  { id: 'unlock', label: 'Remove password', icon: 'unlock', done: 'Unlocked PDF', multi: true },
  { id: 'watermark', label: 'Watermark', icon: 'droplet', done: 'Watermarked PDF', multi: true },
  { id: 'page-numbers', label: 'Page numbers', icon: 'hash', done: 'Numbered PDF', multi: true },
  { id: 'info', label: 'Info', icon: 'info', done: '' , multi: true },
];

const SPLIT_MODES: ChipOption<string>[] = [
  { value: 'each', label: 'Every page' },
  { value: 'every', label: 'Every N pages' },
  { value: 'ranges', label: 'Custom ranges' },
];
const LEVELS: ChipOption<string>[] = [
  { value: 'low', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'strong', label: 'Strong' },
  { value: 'target', label: 'Target size' },
];
const ANGLES: ChipOption<string>[] = [
  { value: '90', label: '90° right' },
  { value: '180', label: '180°' },
  { value: '270', label: '90° left' },
];
const POSITIONS: ChipOption<string>[] = [
  { value: 'bottom-center', label: 'Bottom centre' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'top-right', label: 'Top right' },
];
const NUMBER_STYLES: ChipOption<string>[] = [
  { value: 'n', label: '1, 2, 3' },
  { value: 'page_n_of_total', label: 'Page 1 of 9' },
];
const WATERMARK_STYLES: ChipOption<string>[] = [
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'center', label: 'Centre' },
  { value: 'bottom', label: 'Bottom' },
];
const OPACITY: ChipOption<string>[] = [
  { value: '0.15', label: 'Faint' },
  { value: '0.3', label: 'Soft' },
  { value: '0.5', label: 'Strong' },
];

export function PdfToolsScreen({ navigation, route }: ScreenProps<'PdfTools'>) {
  const lang = useLang();
  const [toolId, setToolId] = useState(route.params?.tool ?? 'merge');
  const [picked, setPicked] = useState<LocalFile[]>(route.params?.files ?? []);
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
  const [loadingInfo, setLoadingInfo] = useState(false);
  const job = useJob();
  const tool = TOOLS.find(t => t.id === toolId) ?? TOOLS[0];

  const options = (): Record<string, unknown> | null => {
    switch (tool.id) {
      case 'merge':
        return picked.length >= 2 ? {} : null;
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
        return level === 'target'
          ? Number(targetKb) > 0
            ? { target_kb: Number(targetKb) }
            : null
          : { level };
      case 'rotate':
        return { angle: Number(angle), pages: pages.trim() || undefined };
      case 'protect':
        return password.length >= 4 ? { password } : null;
      case 'unlock':
        return password ? { password } : null;
      case 'watermark':
        return text.trim()
          ? { text: text.trim(), style: wmStyle, opacity: Number(opacity) }
          : null;
      case 'page-numbers':
        return { position, style: numberStyle };
      default:
        return {};
    }
  };

  const ready = options();

  const run = async () => {
    if (!ready) {
      return;
    }
    if (tool.id === 'info') {
      setLoadingInfo(true);
      job.setError(null);
      try {
        setInfo(await engine.info(picked));
      } catch (e) {
        job.setError(toFriendlyError(e, lang));
      } finally {
        setLoadingInfo(false);
      }
      return;
    }
    job.run(picked, { title: tool.done, family: 'pdf' }, progress =>
      engine.pdf(tool.id, picked, ready, progress),
    );
  };

  const pagesField = (label: string, placeholder: string, hint: string) => (
    <>
      <TextField
        label={label}
        value={pages}
        onChangeText={setPages}
        placeholder={placeholder}
        autoCapitalize="none"
      />
      <AppText variant="caption" color="textMuted" style={styles.hint}>
        {hint}
      </AppText>
    </>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader kicker="PDF tools" title={tool.label} />

        <View style={styles.tools}>
          {TOOLS.map(t => (
            <Chip
              key={t.id}
              label={t.label}
              icon={t.icon}
              color={familyColors.pdf}
              selected={t.id === tool.id}
              onPress={() => {
                setToolId(t.id);
                setInfo(null);
                setPages('');
              }}
            />
          ))}
        </View>

        <View style={styles.section}>
          <FilePicker
            files={picked}
            onChange={next => {
              setPicked(next);
              setInfo(null);
            }}
            accept={tool.id === 'merge' ? [...ACCEPT.pdf, ...ACCEPT.images] : ACCEPT.pdf}
            multiple={!!tool.multi}
            onError={job.setError}
          />
          {tool.id === 'merge' ? (
            <AppText variant="caption" color="textMuted" style={styles.hint}>
              Files are joined in this order. Images become pages too.
            </AppText>
          ) : null}
        </View>

        <View style={styles.section}>
          {tool.id === 'split' ? (
            <>
              <ChipRow options={SPLIT_MODES} value={splitMode} onChange={setSplitMode} />
              <View style={styles.hint}>
                {splitMode === 'every' ? (
                  <TextField label="Pages per file" value={everyN} onChangeText={setEveryN} keyboardType="number-pad" />
                ) : null}
                {splitMode === 'ranges'
                  ? pagesField('Ranges', '1-3, 4-6, 7', 'Each range becomes its own PDF.')
                  : null}
              </View>
            </>
          ) : null}
          {tool.id === 'extract'
            ? pagesField('Pages to keep', '1-3, 7', 'Use commas and dashes: 1-3, 7, 10-12.')
            : null}
          {tool.id === 'delete'
            ? pagesField('Pages to delete', '2, 5-6', 'Use commas and dashes: 2, 5-6.')
            : null}
          {tool.id === 'reorder'
            ? pagesField('New order', '3, 1, 2', 'List every page in the order you want.')
            : null}
          {tool.id === 'rotate' ? (
            <>
              <ChipRow options={ANGLES} value={angle} onChange={setAngle} />
              <View style={styles.hint}>
                {pagesField('Pages', 'all', 'Leave empty to rotate every page.')}
              </View>
            </>
          ) : null}
          {tool.id === 'compress' ? (
            <>
              <ChipRow options={LEVELS} value={level} onChange={setLevel} />
              {level === 'target' ? (
                <View style={styles.hint}>
                  <TextField
                    label="At most (KB)"
                    value={targetKb}
                    onChangeText={setTargetKb}
                    keyboardType="number-pad"
                  />
                </View>
              ) : null}
            </>
          ) : null}
          {tool.id === 'protect' || tool.id === 'unlock' ? (
            <TextField
              label={tool.id === 'protect' ? 'New password' : 'Current password'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              hint={
                tool.id === 'protect'
                  ? 'At least 4 characters. KonPDF never stores it.'
                  : 'Used once to open the file, never stored.'
              }
            />
          ) : null}
          {tool.id === 'watermark' ? (
            <>
              <TextField label="Text" value={text} onChangeText={setText} />
              <View style={styles.hint}>
                <ChipRow options={WATERMARK_STYLES} value={wmStyle} onChange={setWmStyle} />
              </View>
              <View style={styles.hint}>
                <ChipRow options={OPACITY} value={opacity} onChange={setOpacity} />
              </View>
            </>
          ) : null}
          {tool.id === 'page-numbers' ? (
            <>
              <ChipRow options={POSITIONS} value={position} onChange={setPosition} />
              <View style={styles.hint}>
                <ChipRow options={NUMBER_STYLES} value={numberStyle} onChange={setNumberStyle} />
              </View>
            </>
          ) : null}
        </View>

        {info ? (
          <View style={styles.list}>
            {info.map(f => (
              <BrutalBox key={f.name} offset={3} contentStyle={styles.info}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {f.name}
                </AppText>
                <AppText variant="mono" color="textMuted">
                  {[
                    f.pages !== undefined ? `${f.pages} pages` : null,
                    f.width ? `${f.width} × ${f.height} pt` : null,
                    formatBytes(f.size),
                    f.encrypted ? 'password-protected' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </BrutalBox>
            ))}
          </View>
        ) : null}

        {job.error ? (
          <ErrorCard
            error={job.error}
            style={styles.section}
            onAskNw={() => navigation.navigate('Nw', { errorCode: job.error!.code })}
          />
        ) : null}

        <Button
          title={
            job.busy
              ? phaseLabel(job.phase, job.progress)
              : tool.id === 'info'
              ? 'Show details'
              : tool.label
          }
          icon={tool.icon}
          loading={loadingInfo}
          onPress={run}
          disabled={!ready || picked.length === 0 || job.busy}
          style={styles.section}
          testID="pdf-run"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { marginTop: 24 },
  hint: { marginTop: 10 },
  list: { gap: 10, marginTop: 20 },
  info: { padding: 12, gap: 4 },
});
