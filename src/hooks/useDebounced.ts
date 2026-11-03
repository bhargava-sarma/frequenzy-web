/** A value that settles a moment after it stops changing. */

import { useEffect, useState } from 'react';

export function useDebounced<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(handle);
  }, [delay, value]);
  return settled;
}
