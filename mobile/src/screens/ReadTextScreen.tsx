import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { engine } from '../api/engine';
import { FriendlyError, toFriendlyError } from '../api/errors';
import { ErrorCard } from '../components/ErrorCard';
import { FilePicker } from '../components/FilePicker';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AppText,
  BrutalBox,
  Button,
  Chip,
  Icon,
  ProgressRing,
  Screen,
  SectionLabel,
  Segmented,
  useToast,
} from '../components/ui';
import { checkDevice } from '../features/devmode/model';
import { getDeviceInfo, isAiReaderReady } from '../features/devmode/useAiReaderModel';
import { setReader } from '../features/preferences/preferencesSlice';
import { baseName, joinPages, preparePages, STANDARD_MAX_SIDE } from '../features/scan/pages';
import { ACCEPT } from '../features/tools/catalog';
import { phaseLabel, useJob } from '../hooks/useJob';
import { useLang } from '../hooks/useLang';
import { useLocalResult } from '../hooks/useLocalResult';
import type { ScreenProps } from '../navigation/types';
import { AI_PAGE_MAX_SIDE, aiReader } from '../services/aiReader';
import { files, LocalFile } from '../services/files';
import { OcrPage, ocrLines, scan, Script } from '../services/scan';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useTheme } from '../theme';
import { markdownTables, tablesToCsv } from '../utils/markdown';

type Reader = 'standard' | 'ai';
type Stage = 'setup' | 'reading' | 'done';

/**
 * Reads the text on photos, scans and PDFs, on the phone.
 *
 * Standard: Google's reader (ML Kit), a second or two a page, and it knows
 * where every line sits, which is what a searchable PDF needs.
 * AI (Developer Mode): Qwen3-VL 2B, slower but better with tables, columns
 * and messy pages; it writes tables as Markdown, which can become a sheet.
 */
export function ReadTextScreen({ route }: ScreenProps<'ReadText'>) {
  const t = useTheme();
  const lang = useLang();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const finish = useLocalResult();
  const job = useJob();
  const developerMode = useAppSelector(s => s.preferences.developerMode);
  const preferred = useAppSelector(s => s.preferences.reader);

  const [inputs, setInputs] = useState<LocalFile[]>(route.params?.files ?? []);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [reader, setReaderState] = useState<Reader>('standard');
  const [script, setScript] = useState<Script>(lang === 'hi' ? 'devanagari' : 'latin');
  const [stage, setStage] = useState<Stage>('setup');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState('');
  const [text, setText] = useState('');
  const [usedReader, setUsedReader] = useState<Reader>('standard');
  const [pages, setPages] = useState<LocalFile[]>([]);
  const [ocr, setOcr] = useState<OcrPage[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<FriendlyError | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!developerMode) {
      return;
    }
    (async () => {
      const [ready, info] = await Promise.all([isAiReaderReady(), getDeviceInfo()]);
      const ok = ready && !!info && checkDevice(info, true).ok;
      setAiAvailable(ok);
      if (ok && preferred === 'ai') {
        setReaderState('ai');
      }
    })();
  }, [developerMode, preferred]);

  // Free the model's memory when leaving the screen mid-read.
  useEffect(
    () => () => {
      cancelled.current = true;
      aiReader.stop();
    },
    [],
  );

  const chooseReader = (next: Reader) => {
    setReaderState(next);
    dispatch(setReader(next));
  };

  const tables = useMemo(
    () => (usedReader === 'ai' ? markdownTables(text) : []),
    [text, usedReader],
  );
  const words = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);
  const name = baseName(inputs);

  const read = async () => {
    setError(null);
    cancelled.current = false;
    setStage('reading');
    setProgress(0);
    setLive('');
    const using = reader;
    try {
      setStatus('Getting the pages ready…');
      const prepared = await preparePages(
        inputs,
        using === 'ai' ? AI_PAGE_MAX_SIDE : STANDARD_MAX_SIDE,
        n => setStatus(`Getting page ${n} ready…`),
      );
      setSkipped(prepared.skipped);
      const texts: string[] = [];
      const readings: OcrPage[] = [];
      for (const [i, page] of prepared.pages.entries()) {
        if (cancelled.current) {
          break;
        }
        const of = `page ${i + 1} of ${prepared.pages.length}`;
        setStatus(`Reading ${of}…`);
        setProgress(i / prepared.pages.length);
        if (using === 'ai') {
          let last = 0;
          const pageText = await aiReader.read(
            page,
            soFar => {
              // A few screen updates a second is plenty while the model writes.
              const now = Date.now();
              if (now - last > 150) {
                last = now;
                setLive(soFar);
              }
            },
            ratio => setStatus(`Loading the AI reader… ${Math.round(ratio * 100)} %`),
          );
          texts.push(pageText);
          setLive('');
        } else {
          const reading = await scan.readText(page, script);
          readings.push(reading);
          texts.push(reading.text);
        }
      }
      setPages(prepared.pages.slice(0, texts.length));
      setOcr(readings);
      setUsedReader(using);
      setText(joinPages(texts));
      setProgress(1);
      setStage('done');
    } catch (e) {
      setError(toFriendlyError(e, lang));
      setStage('setup');
    }
  };

  const stop = () => {
    cancelled.current = true;
    aiReader.stop();
  };

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setError(null);
    try {
      await fn();
      if (done) {
        toast({ message: done, tone: 'success' });
      }
    } catch (e) {
      setError(toFriendlyError(e, lang));
    }
  };

  const textFile = () => scan.writeText(text, `${name}.txt`);

  const saveText = () =>
    act(async () => {
      finish(inputs, [await textFile()], { title: `Text · ${name}`, family: 'document', kind: 'text' });
    });

  const toWord = () =>
    act(async () => {
      const txt = await textFile();
      await job.run([txt], { title: 'Text → Word', family: 'document', kind: 'text' }, p =>
        engine.convert([txt], 'docx', {}, p),
      );
    });

  const toSheet = () =>
    act(async () => {
      const csv = await scan.writeText(tablesToCsv(tables), `${name} tables.csv`);
      await job.run([csv], { title: 'Tables → Excel', family: 'sheet', kind: 'text' }, p =>
        engine.convert([csv], 'xlsx', {}, p),
      );
    });

  const toSearchablePdf = () =>
    job.run(pages, { title: 'Searchable PDF', family: 'pdf', kind: 'text' }, p =>
      engine.pdf(
        'searchable',
        pages,
        {
          name,
          ocr: ocr.map(page => ({
            width: page.width,
            height: page.height,
            lines: ocrLines(page).map(l => ({ text: l.text, box: l.box })),
          })),
        },
        p,
      ),
    );

  const busy = stage === 'reading' || job.busy;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader kicker="On your phone" title="Read text" />

        {stage !== 'done' ? (
          <>
            <FilePicker
              files={inputs}
              onChange={setInputs}
              accept={[...ACCEPT.images, ...ACCEPT.pdf]}
              onError={setError}
            />

            <SectionLabel style={styles.section}>Reader</SectionLabel>
            <Segmented<Reader>
              value={reader}
              onChange={next => (next === 'standard' || aiAvailable) && chooseReader(next)}
              options={[
                { value: 'standard', label: 'Standard', icon: 'bolt' },
                { value: 'ai', label: 'AI reader', icon: 'chip' },
              ]}
            />
            <AppText variant="caption" color="textMuted" style={styles.hint}>
              {reader === 'ai'
                ? 'Qwen3-VL on your phone: better with tables and messy pages, about 20–90 s a page.'
                : aiAvailable
                ? 'Fast, and keeps where each line sits (needed for a searchable PDF).'
                : developerMode
                ? 'Fast and accurate. The AI reader needs its model: download it in Developer Mode.'
                : 'Fast and accurate. For tables and messy pages, turn on Developer Mode in Settings.'}
            </AppText>

            {reader === 'standard' ? (
              <>
                <SectionLabel style={styles.section}>Writing</SectionLabel>
                <View style={styles.chips}>
                  <Chip
                    label="English & Latin letters"
                    selected={script === 'latin'}
                    onPress={() => setScript('latin')}
                  />
                  <Chip
                    label="हिन्दी · Devanagari"
                    selected={script === 'devanagari'}
                    onPress={() => setScript('devanagari')}
                  />
                </View>
                <AppText variant="caption" color="textMuted" style={styles.hint}>
                  Devanagari also reads English mixed in, like on forms and bills.
                </AppText>
              </>
            ) : null}

            {error ? (
              <ErrorCard
                error={error}
                style={styles.section}
                onRetry={
                  reader === 'ai'
                    ? () => {
                        chooseReader('standard');
                        setError(null);
                      }
                    : undefined
                }
                retryLabel="Use the standard reader"
              />
            ) : null}

            {stage === 'reading' ? (
              <BrutalBox style={styles.section} contentStyle={styles.reading}>
                <View style={styles.readingHead}>
                  <ProgressRing progress={progress} size={44} label="Reading" />
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {status}
                  </AppText>
                </View>
                {live ? (
                  <AppText variant="mono" color="textMuted" numberOfLines={8}>
                    {live}
                  </AppText>
                ) : null}
                <Button title="Stop" variant="outline" size="md" icon="pause" onPress={stop} />
              </BrutalBox>
            ) : (
              <Button
                title="Read text"
                icon="text"
                onPress={read}
                disabled={inputs.length === 0}
                style={styles.section}
                testID="read-start"
              />
            )}
          </>
        ) : (
          <>
            <View style={styles.meta}>
              <AppText variant="mono" color="textMuted">
                {pages.length} {pages.length === 1 ? 'page' : 'pages'} · {words} words ·{' '}
                {usedReader === 'ai' ? 'AI reader' : 'standard reader'}
              </AppText>
              <Button
                title="Read again"
                variant="outline"
                size="md"
                icon="refresh"
                iconPosition="left"
                onPress={() => setStage('setup')}
              />
            </View>
            {usedReader === 'ai' ? (
              <View style={[styles.note, { borderColor: t.colors.line }]}>
                <Icon name="info" size={18} color={t.colors.text} />
                <AppText variant="caption" style={styles.flex}>
                  AI reading: check names, numbers and dates before you rely on them.
                </AppText>
              </View>
            ) : null}
            {skipped > 0 ? (
              <AppText variant="caption" color="textMuted" style={styles.hint}>
                Read the first {pages.length} pages; {skipped} more were left out. Split
                the PDF to read the rest.
              </AppText>
            ) : null}
            {!text.trim() ? (
              <AppText color="textMuted" style={styles.hint}>
                No text found. Try a sharper photo, more light, or the other reader.
              </AppText>
            ) : null}

            <BrutalBox offset={3} style={styles.editorBox} contentStyle={styles.editorFace}>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                style={[styles.editor, { color: t.colors.text }]}
                accessibilityLabel="The text, which you can edit"
                testID="read-result"
              />
            </BrutalBox>
            <AppText variant="caption" color="textFaint" style={styles.hint}>
              You can fix mistakes here before copying or saving.
            </AppText>

            {error ? <ErrorCard error={error} style={styles.section} /> : null}

            <View style={[styles.section, styles.actions]}>
              <View style={styles.row}>
                <Button
                  title="Copy"
                  icon="copy"
                  iconPosition="left"
                  size="md"
                  onPress={() => act(() => scan.copy(text), 'Copied')}
                  disabled={!text.trim() || busy}
                  style={styles.flex}
                />
                <Button
                  title="Share"
                  icon="share"
                  iconPosition="left"
                  variant="outline"
                  size="md"
                  onPress={() => act(async () => files.share([await textFile()]))}
                  disabled={!text.trim() || busy}
                  style={styles.flex}
                />
              </View>
              <Button
                title={job.busy ? phaseLabel(job.phase, job.progress) : 'Save as Word'}
                icon="doc"
                variant="dark"
                onPress={toWord}
                disabled={!text.trim() || busy}
                loading={job.busy}
              />
              {usedReader === 'standard' && ocr.length > 0 ? (
                <Button
                  title="Make a searchable PDF"
                  icon="search"
                  variant="outline"
                  onPress={toSearchablePdf}
                  disabled={busy}
                />
              ) : null}
              {tables.length > 0 ? (
                <Button
                  title={`${tables.length === 1 ? 'Table' : `${tables.length} tables`} → Excel`}
                  icon="sheet"
                  variant="highlight"
                  onPress={toSheet}
                  disabled={busy}
                />
              ) : null}
              <Button
                title="Save as text file"
                icon="save"
                variant="outline"
                size="md"
                onPress={saveText}
                disabled={!text.trim() || busy}
              />
            </View>
            {job.error ? <ErrorCard error={job.error} style={styles.section} /> : null}
            <AppText variant="caption" color="textFaint" align="center" style={styles.section}>
              Reading happened on your phone. Word, Excel and searchable PDF are
              made by the converter.
            </AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 24 },
  hint: { marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reading: { padding: 16, gap: 14 },
  readingHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderWidth: 2,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  editorBox: { marginTop: 14 },
  editorFace: { padding: 4 },
  editor: { minHeight: 260, maxHeight: 460, padding: 10, fontSize: 15, lineHeight: 22 },
  actions: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
});
