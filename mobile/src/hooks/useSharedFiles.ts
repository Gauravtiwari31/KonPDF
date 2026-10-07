import { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { files } from '../services/files';

/**
 * "Share to KonPDF" from another app: each time KonPDF comes to the
 * foreground, pick up shared files and open them on the Convert screen,
 * where every format they can become is offered.
 */
export function useSharedFiles(
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>,
  ready: boolean,
) {
  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const shared = await files.takeShared();
        if (cancelled || shared.length === 0) {
          return;
        }
        // The navigator may still be mounting on a cold start.
        const open = () => {
          if (navigation.isReady()) {
            navigation.navigate('Convert', { toolId: 'any', files: shared });
          } else {
            setTimeout(open, 100);
          }
        };
        open();
      } catch {
        // Unreadable shares are ignored; the person can still pick the file.
      }
    };
    check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        check();
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [navigation, ready]);
}
