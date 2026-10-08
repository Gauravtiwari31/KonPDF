import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { engine, NwPlan, NwReply } from '../api/engine';
import { FriendlyError, toFriendlyError } from '../api/errors';
import { ErrorCard } from '../components/ErrorCard';
import { FileRow } from '../components/FileRow';
import {
  AppText,
  BrutalBox,
  Button,
  Chip,
  IconButton,
  Screen,
  TextField,
} from '../components/ui';
import { phaseLabel, useJob } from '../hooks/useJob';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useLang } from '../hooks/useLang';
import type { ScreenProps } from '../navigation/types';
import { files as fileService, LocalFile } from '../services/files';
import { familyColors, palette, useTheme } from '../theme';

interface Message {
  id: string;
  role: 'user' | 'nw';
  text: string;
  plan?: NwPlan | null;
  suggestions?: string[];
  /** A screen that does this on the phone ("scan", "read_text"). */
  open?: string | null;
  /** NW's greeting: shown until the person sends their first message. */
  intro?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  convert: 'Convert',
  resize: 'Resize',
  enhance: 'Enhance',
  compress_pdf: 'Compress PDF',
  merge: 'Merge',
  split: 'Split',
  rotate: 'Rotate',
  extract: 'Keep pages',
  delete: 'Delete pages',
  protect: 'Add password',
  unlock: 'Remove password',
  watermark: 'Watermark',
  page_numbers: 'Page numbers',
};

/** "max_kb: 100, preset: passport" → "100 KB · passport". */
function describeParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      if (k === 'max_kb' || k === 'target_kb') {
        return `under ${v} KB`;
      }
      if (k === 'min_kb') {
        return `over ${v} KB`;
      }
      if (k === 'to') {
        return `to ${String(v).toUpperCase()}`;
      }
      return typeof v === 'object'
        ? JSON.stringify(v)
        : `${k.replace(/_/g, ' ')} ${v}`;
    })
    .join(' · ');
}

let nextId = 0;
const id = () => `m${++nextId}`;

/** NW: plain-language requests become plans you confirm with one tap. */
export function NwScreen({ navigation, route }: ScreenProps<'Nw'>) {
  const t = useTheme();
  const lang = useLang();
  const [attached, setAttached] = useState<LocalFile[]>(
    route.params?.files ?? [],
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(route.params?.prompt ?? '');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const job = useJob();
  const list = useRef<FlatList<Message>>(null);
  const keyboardHeight = useKeyboardHeight();

  // The keyboard shrinks the chat; keep the latest message in view.
  useEffect(() => {
    if (keyboardHeight > 0) {
      list.current?.scrollToEnd({ animated: true });
    }
  }, [keyboardHeight]);

  const addReply = useCallback((reply: NwReply, intro = false) => {
    setMessages(m => [
      ...m,
      {
        id: id(),
        role: 'nw',
        text: reply.reply,
        plan: reply.plan,
        suggestions: reply.suggestions,
        open: reply.open,
        intro,
      },
    ]);
  }, []);

  const ask = useCallback(
    async (text: string, history: Message[], files: LocalFile[] = attached) => {
      setThinking(true);
      setError(null);
      try {
        addReply(
          await engine.nwChat({
            message: text,
            files: files.map(f => ({
              name: f.name,
              mime: f.mime,
              size: f.size,
            })),
            history: history
              .slice(-8)
              .map(m => ({ role: m.role, text: m.text })),
          }),
        );
      } catch (e) {
        setError(toFriendlyError(e, lang));
      } finally {
        setThinking(false);
      }
    },
    [addReply, attached, lang],
  );

  // Opening line: an error explanation, or NW's greeting.
  const errorCode = route.params?.errorCode;
  useEffect(() => {
    setThinking(true);
    (errorCode
      ? engine.nwExplain(errorCode)
      : engine.nwChat({ message: '', files: [], history: [] })
    )
      .then(reply => addReply(reply, !errorCode))
      .catch(e => setError(toFriendlyError(e, lang)))
      .finally(() => setThinking(false));
    // Only once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (text = draft) => {
    const message = text.trim();
    if (!message || thinking) {
      return;
    }
    const mine: Message = { id: id(), role: 'user', text: message };
    // The greeting has done its job once the conversation starts.
    const history = messages.filter(m => !m.intro);
    setMessages([...history, mine]);
    setDraft('');
    ask(message, history);
  };

  const attach = async () => {
    try {
      const more = await fileService.pick(['*/*'], true);
      if (more.length) {
        const next = [...attached, ...more];
        setAttached(next);
        // Asked before attaching? Plan that request again for these files,
        // so the plan fits them (a PDF job for a PDF, a photo job for a photo).
        const last = [...messages].reverse().find(m => m.role === 'user');
        if (last && !thinking) {
          ask(last.text, messages.slice(0, messages.indexOf(last)), next);
        }
      }
    } catch (e) {
      setError(toFriendlyError(e, lang));
    }
  };

  const runPlan = (plan: NwPlan) => {
    const first = plan.steps[plan.steps.length - 1]?.tool;
    const family =
      first === 'resize'
        ? 'resize'
        : first === 'enhance'
        ? 'enhance'
        : first === 'convert'
        ? 'image'
        : 'pdf';
    job.run(attached, { title: plan.summary, family }, progress =>
      engine.run(attached, plan, progress),
    );
  };

  const renderMessage = ({ item }: { item: Message }) =>
    item.role === 'user' ? (
      <View
        style={[
          styles.bubble,
          styles.mine,
          { backgroundColor: t.colors.inverse },
        ]}
      >
        <AppText color={t.colors.onInverse}>{item.text}</AppText>
      </View>
    ) : (
      <View style={styles.theirsWrap}>
        <BrutalBox
          offset={3}
          color={familyColors.nw}
          contentStyle={styles.bubble}
        >
          <AppText color={palette.ink}>{item.text}</AppText>
        </BrutalBox>
        {item.plan ? (
          <BrutalBox offset={3} contentStyle={styles.plan}>
            <AppText variant="label" uppercase color="textMuted">
              Plan
            </AppText>
            {item.plan.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepNo, { borderColor: t.colors.line }]}>
                  <AppText variant="label">{i + 1}</AppText>
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">
                    {TOOL_LABELS[step.tool] ?? step.tool}
                  </AppText>
                  {Object.keys(step.params).length ? (
                    <AppText variant="mono" color="textMuted">
                      {describeParams(step.params)}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ))}
            {attached.length ? (
              <Button
                title={
                  job.busy
                    ? phaseLabel(job.phase, job.progress)
                    : `Run on ${attached.length} file${
                        attached.length > 1 ? 's' : ''
                      }`
                }
                icon="bolt"
                size="md"
                onPress={() => runPlan(item.plan!)}
                disabled={job.busy}
              />
            ) : (
              <Button
                title="Attach files to run"
                icon="upload"
                size="md"
                variant="outline"
                onPress={attach}
              />
            )}
          </BrutalBox>
        ) : null}
        {item.open === 'scan' || item.open === 'read_text' ? (
          <Button
            title={item.open === 'scan' ? 'Open the scanner' : 'Read text'}
            icon={item.open === 'scan' ? 'scan' : 'text'}
            size="md"
            onPress={() =>
              item.open === 'scan'
                ? navigation.navigate('Main', { screen: 'Scan' })
                : navigation.navigate('ReadText', { files: attached })
            }
          />
        ) : null}
        {item.suggestions?.length ? (
          <View style={styles.suggestions}>
            {item.suggestions.map(s => (
              <Chip key={s} label={s} onPress={() => send(s)} />
            ))}
          </View>
        ) : null}
      </View>
    );

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton
          icon="x"
          label="Close"
          onPress={() => navigation.goBack()}
        />
        <View style={styles.flex}>
          <AppText variant="heading">NW</AppText>
          <AppText variant="label" uppercase color="textMuted">
            Your file assistant · runs on KonPDF
          </AppText>
        </View>
      </View>

      <FlatList
        ref={list}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() =>
          list.current?.scrollToEnd({ animated: true })
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {thinking ? (
              <AppText variant="label" uppercase color="textMuted">
                NW is thinking…
              </AppText>
            ) : null}
            {error ? (
              <ErrorCard
                error={error}
                onRetry={() =>
                  send(
                    messages.filter(m => m.role === 'user').pop()?.text ?? '',
                  )
                }
              />
            ) : null}
            {job.error ? (
              <ErrorCard
                error={job.error}
                onAskNw={() => {
                  const code = job.error!.code;
                  job.setError(null);
                  setThinking(true);
                  engine
                    .nwExplain(code)
                    .then(addReply)
                    .catch(e => setError(toFriendlyError(e, lang)))
                    .finally(() => setThinking(false));
                }}
              />
            ) : null}
          </View>
        }
      />

      {attached.length ? (
        <View style={styles.attached}>
          {attached.slice(0, 3).map((f, i) => (
            <FileRow
              key={`${f.path}-${i}`}
              file={f}
              onRemove={() => setAttached(a => a.filter((_, j) => j !== i))}
            />
          ))}
          {attached.length > 3 ? (
            <AppText variant="mono" color="textMuted">
              + {attached.length - 3} more
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.inputBar, { borderTopColor: t.colors.lineSoft }]}>
        <IconButton icon="plus" label="Attach files" onPress={attach} />
        <TextField
          value={draft}
          onChangeText={setDraft}
          placeholder="Tell NW what you need…"
          onSubmitEditing={() => send()}
          returnKeyType="send"
          containerStyle={styles.flex}
          testID="nw-input"
        />
        <IconButton
          icon="send"
          label="Send"
          color={t.colors.primary}
          onPress={() => send()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  flex: { flex: 1 },
  messages: { padding: 20, gap: 14 },
  bubble: { paddingVertical: 10, paddingHorizontal: 14, maxWidth: '100%' },
  mine: { alignSelf: 'flex-end', borderRadius: 16, maxWidth: '85%' },
  theirsWrap: { alignSelf: 'flex-start', maxWidth: '92%', gap: 10 },
  plan: { padding: 14, gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { gap: 12, marginTop: 4 },
  attached: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 2,
  },
});
