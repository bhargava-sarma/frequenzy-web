/** Tiny data-fetching hook with abort handling and a manual refresh. */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options: { skip?: boolean } = {},
): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (options.skip) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);

    fnRef
      .current(controller.signal)
      .then((result) => {
        if (!alive) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive || controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
    // `deps` is spread deliberately: callers own the dependency list, and `fn`
    // is read through a ref so it never needs to be one.
  }, [...deps, nonce, options.skip]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
