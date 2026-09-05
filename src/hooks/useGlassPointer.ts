/**
 * Tracks the pointer across a glass surface and exposes its position as CSS
 * custom properties, so the specular highlight can follow the cursor.
 */

import { useCallback, useRef, type PointerEvent } from 'react';

export function useGlassPointer<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  const onPointerMove = useCallback((event: PointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '0%');
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
