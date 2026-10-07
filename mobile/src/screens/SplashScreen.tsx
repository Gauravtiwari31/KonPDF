import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { AppText, LogoMark, Screen } from '../components/ui';

/** Shown for a moment on launch while preferences and history load. */
export function SplashScreen() {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  return (
    <Screen>
      <View style={styles.center}>
        <Animated.View
          style={{
            transform: [
              {
                translateY: bounce.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                }),
              },
            ],
          }}
        >
          <LogoMark size={96} />
        </Animated.View>
        <AppText
          variant="label"
          color="textMuted"
          uppercase
          style={styles.caption}
        >
          Getting things ready…
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { marginTop: 20 },
});
