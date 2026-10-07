import axios from 'axios';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DEFAULT_API_URL, LOCAL_API_URL } from '../config';
import { server, useServerUrl } from '../services/server';
import { displayHost, normalizeApiUrl } from '../utils/url';
import { palette, useTheme } from '../theme';
import {
  AppText,
  Banner,
  Button,
  Icon,
  Sheet,
  TextField,
  useToast,
} from './ui';

type Check =
  | { state: 'idle' | 'checking' }
  | { state: 'ok' | 'error'; message: string };

/** Pings `/health` so people can confirm the address before saving it. */
async function checkServer(url: string): Promise<Check> {
  try {
    const { data } = await axios.get<{ status?: string; office?: boolean }>(
      `${url}/health`,
      { timeout: 8000 },
    );
    return data.status === 'ok'
      ? {
          state: 'ok',
          message: data.office
            ? 'Connected. Every converter is ready.'
            : 'Connected. Office files (PPT, DOC) need LibreOffice on that engine.',
        }
      : { state: 'error', message: 'The engine answered, but it is not ready.' };
  } catch {
    return {
      state: 'error',
      message: 'No KonPDF engine answered at that address.',
    };
  }
}

/**
 * Compact "server" pill that opens a sheet for changing the API address.
 * Shown on the welcome and settings screens.
 */
export function ServerButton() {
  const t = useTheme();
  const toast = useToast();
  const url = useServerUrl();
  const label = displayHost(url);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(url);
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  const normalized = normalizeApiUrl(draft);
  const invalid = draft.trim().length > 0 && !normalized;

  const show = () => {
    setDraft(url);
    setCheck({ state: 'idle' });
    setOpen(true);
  };

  const test = async () => {
    if (!normalized) {
      return;
    }
    setCheck({ state: 'checking' });
    setCheck(await checkServer(normalized));
  };

  const save = async (next: string) => {
    await server.save(next);
    setOpen(false);
    toast({ message: `Using ${displayHost(next)}`, tone: 'success' });
  };

  return (
    <>
      <Pressable
        onPress={show}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Server address: ${label}. Change`}
        style={[
          styles.pill,
          { borderColor: t.colors.line, backgroundColor: t.colors.surface },
        ]}
      >
        <Icon name="server" size={14} color={t.colors.textMuted} />
        <AppText
          variant="mono"
          color="textMuted"
          numberOfLines={1}
          style={styles.pillText}
        >
          {label}
        </AppText>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Server">
        <View style={styles.body}>
          <AppText color="textMuted">
            Where the KonPDF engine is running. Keep the default unless you run
            your own: then use 10.0.2.2:8000 on the Android emulator, or your
            computer's Wi-Fi IP on a phone.
          </AppText>
          <TextField
            label="API address"
            icon="server"
            value={draft}
            onChangeText={text => {
              setDraft(text);
              setCheck({ state: 'idle' });
            }}
            placeholder="http://192.168.1.20:8000/api"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={invalid ? 'That doesn’t look like an address' : null}
            hint={
              normalized && normalized !== draft.trim()
                ? `Will use ${normalized}`
                : undefined
            }
          />
          {check.state === 'ok' || check.state === 'error' ? (
            <Banner
              message={check.message}
              tone={check.state === 'ok' ? 'info' : 'error'}
            />
          ) : null}
          <View style={styles.actions}>
            <Button
              title="Test"
              variant="outline"
              size="md"
              onPress={test}
              loading={check.state === 'checking'}
              disabled={!normalized}
              style={styles.flex}
            />
            <Button
              title="Save"
              variant="dark"
              size="md"
              onPress={() => normalized && save(normalized)}
              disabled={!normalized}
              style={styles.flex}
            />
          </View>
          {url !== DEFAULT_API_URL ? (
            <Pressable
              onPress={() => save(DEFAULT_API_URL)}
              hitSlop={8}
              style={styles.reset}
            >
              <AppText variant="label" uppercase color={palette.violet}>
                Reset to default ({displayHost(DEFAULT_API_URL)})
              </AppText>
            </Pressable>
          ) : null}
          {url !== LOCAL_API_URL && DEFAULT_API_URL !== LOCAL_API_URL ? (
            <Pressable
              onPress={() => {
                setDraft(LOCAL_API_URL);
                setCheck({ state: 'idle' });
              }}
              hitSlop={8}
              style={styles.reset}
            >
              <AppText variant="label" uppercase color="textMuted">
                Use my computer ({displayHost(LOCAL_API_URL)})
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    maxWidth: 190,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  pillText: { flexShrink: 1 },
  body: { gap: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  reset: { alignSelf: 'center', paddingVertical: 4 },
});
