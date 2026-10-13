import { useEffect, useState } from 'react';

/**
 * A query parameter, read after the page has loaded: pages are pre-rendered
 * without one, so the first render must match that HTML.
 */
export function useParam(name: string): string | null {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return value;
}
