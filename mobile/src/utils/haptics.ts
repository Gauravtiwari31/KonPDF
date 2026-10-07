import { Vibration } from 'react-native';

/** A tiny tactile "tick" for satisfying moments, like finishing a task. */
export function tick() {
  Vibration.vibrate(12);
}
