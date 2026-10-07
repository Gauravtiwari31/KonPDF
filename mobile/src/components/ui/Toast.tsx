import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, shadowFor, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

type Tone = 'info' | 'success' | 'error';

interface ToastOptions {
  message: string;
  tone?: Tone;
  /** Optional inline action, e.g. "Undo". */
  action?: { label: string; onPress: () => void };
  durationMs?: number;
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => {});

/** `const toast = useToast(); toast({ message: 'Saved', tone: 'success' })` */
export const useToast = () => useContext(ToastContext);

const TONE: Record<Tone, { color: string; icon: IconName }> = {
  info: { color: palette.sky, icon: 'sparkle' },
  success: { color: palette.volt, icon: 'check' },
  error: { color: palette.rose, icon: 'alert' },
};

/** Snackbar host. One toast at a time; a new one replaces the current. */
export function ToastProvider({ children }: PropsWithChildren) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(
    null,
  );
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 8,
    }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(
      hide,
      toast.durationMs ?? (toast.action ? 4500 : 2800),
    );
    return () => clearTimeout(timer.current);
  }, [toast, anim, hide]);

  const value = useMemo(() => show, [show]);
  const tone = TONE[toast?.tone ?? 'info'];

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          style={[
            styles.host,
            {
              bottom: insets.bottom + 100,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.shadowWrap}>
            <View
              style={[
                styles.shadow,
                {
                  backgroundColor: shadowFor(t, t.colors.inverse),
                  borderRadius: t.radius.md,
                },
              ]}
            />
            <View
              accessibilityLiveRegion="polite"
              style={[
                styles.toast,
                {
                  backgroundColor: t.colors.inverse,
                  borderColor: t.colors.line,
                  borderRadius: t.radius.md,
                },
              ]}
            >
              <View style={[styles.badge, { backgroundColor: tone.color }]}>
                <Icon
                  name={tone.icon}
                  size={15}
                  color={palette.ink}
                  strokeWidth={2.8}
                />
              </View>
              <AppText
                variant="bodyStrong"
                color={t.colors.onInverse}
                style={styles.message}
                numberOfLines={2}
              >
                {toast.message}
              </AppText>
              {toast.action ? (
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    toast.action?.onPress();
                    hide();
                  }}
                  style={[
                    styles.action,
                    { backgroundColor: t.colors.highlight },
                  ]}
                >
                  <AppText variant="label" color={palette.ink} uppercase>
                    {toast.action.label}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    pointerEvents: 'box-none',
  },
  shadowWrap: { paddingRight: 4, paddingBottom: 4 },
  shadow: { position: 'absolute', top: 4, left: 4, right: 0, bottom: 0 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 2,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { flex: 1 },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
});
