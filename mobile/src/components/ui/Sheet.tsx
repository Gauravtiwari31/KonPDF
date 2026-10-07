import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './Button';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
}

/**
 * Height of the on-screen keyboard while it is open, otherwise 0. A sheet is
 * an edge-to-edge window that Android doesn't resize for the keyboard, so the
 * panel has to make room for it itself.
 */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', e =>
      setHeight(e.endCoordinates.height),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}

/** Bottom sheet: dimmed backdrop + panel that slides up from the bottom edge. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: PropsWithChildren<SheetProps>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  // Keep the Modal mounted until the closing animation has finished.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(progress, {
        toValue: 1,
        useNativeDriver: true,
        speed: 16,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: t.colors.background,
            borderColor: t.colors.line,
            borderWidth: t.border,
            // React Native reports the keyboard height without the navigation
            // bar. While the keyboard is open the panel may also grow up to the
            // status bar, so fields and buttons stay above the keyboard instead
            // of being cut off by the usual height cap.
            paddingBottom: insets.bottom + 20 + keyboardHeight,
            ...(keyboardHeight > 0 && {
              maxHeight: windowHeight - insets.top - 8,
            }),
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: t.colors.lineSoft }]} />
        <View style={styles.header}>
          <AppText variant="heading">{title}</AppText>
          <IconButton icon="x" label="Close" onPress={onClose} size={38} />
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,10,10,0.55)',
  },
  panel: {
    position: 'absolute',
    left: -2,
    right: -2,
    bottom: -2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
});
