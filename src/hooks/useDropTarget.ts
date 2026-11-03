/** Accept our own drags (songs, albums, artists, playlists) on an element. */

import { useRef, useState, type DragEvent } from 'react';

import { currentDrag, isOurDrag, type DragPayload } from '../lib/dnd';

export function useDropTarget(onDrop: (payload: DragPayload) => void, accepts?: (payload: DragPayload) => boolean) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const ok = (event: DragEvent) => {
    if (!isOurDrag(event)) return false;
    const payload = currentDrag();
    return payload !== null && (!accepts || accepts(payload));
  };

  return {
    over,
    handlers: {
      onDragEnter: (event: DragEvent) => {
        if (!ok(event)) return;
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      },
      onDragOver: (event: DragEvent) => {
        if (!ok(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      },
      onDrop: (event: DragEvent) => {
        depth.current = 0;
        setOver(false);
        const payload = currentDrag();
        if (!payload || !ok(event)) return;
        event.preventDefault();
        onDrop(payload);
      },
    },
  };
}
