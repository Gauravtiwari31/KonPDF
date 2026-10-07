import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { BrutalBox } from './Brutal';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

const ConfirmContext = createContext<
  (options: ConfirmOptions) => Promise<boolean>
>(() => Promise.resolve(false));

/**
 * Promise-based confirmation dialog that matches the app's look (the native
 * Alert would break it):
 *
 *   if (await confirm({ title: 'Delete task?', destructive: true })) { ... }
 */
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: PropsWithChildren) {
  const t = useTheme();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | undefined>(undefined);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = undefined;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        visible={options !== null}
        transparent
        animationType="fade"
        onRequestClose={() => close(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => close(false)}>
          <Pressable onPress={() => undefined} style={styles.center}>
            <BrutalBox
              color={t.colors.surface}
              radius={t.radius.lg}
              contentStyle={styles.card}
            >
              <AppText variant="heading">{options?.title}</AppText>
              {options?.message ? (
                <AppText color="textMuted" style={styles.message}>
                  {options.message}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                <Button
                  title={options?.cancelLabel ?? 'Cancel'}
                  variant="outline"
                  size="md"
                  onPress={() => close(false)}
                  style={styles.flex}
                />
                <Button
                  title={options?.confirmLabel ?? 'Confirm'}
                  variant={options?.destructive ? 'danger' : 'dark'}
                  size="md"
                  onPress={() => close(true)}
                  style={styles.flex}
                />
              </View>
            </BrutalBox>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  center: { width: '100%' },
  card: { padding: 22 },
  message: { marginTop: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  flex: { flex: 1 },
});
