import { useEffect, useState } from 'react';
import { drive } from '../../services/drive';

let known: boolean | null = null;

/**
 * Whether this phone can use Google Drive backup (it needs Google Play
 * services). Null while checking; asked once per app run.
 */
export function useDriveAvailable(): boolean | null {
  const [available, setAvailable] = useState(known);

  useEffect(() => {
    if (known === null) {
      drive.isAvailable().then(value => {
        known = value;
        setAvailable(value);
      });
    }
  }, []);

  return available;
}
