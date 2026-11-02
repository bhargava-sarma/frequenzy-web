/**
 * Interface state that is not about music: which menu, dialog, sheet or panel
 * is open, and the toasts that confirm what just happened.
 *
 * One store for all of it means there is only ever one menu open, one dialog,
 * and that any button anywhere can raise one without threading props through
 * the tree — and the overlays render from a single place at the root, so no
 * transform or overflow on some ancestor can ever clip them.
 */

import type { ReactNode } from 'react';

import { createStore, useStore } from '../lib/store';
import type { Song } from '../lib/types';
import { getSettings } from './settings';

/* ------------------------------------------------------------------- menus */

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  /** Opens a nested list in place of this one (playlists, speeds…). */
  submenu?: () => MenuEntry[];
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  /** Keyboard hint shown at the end of the row. */
  hint?: string;
}

export type MenuEntry =
  | MenuItem
  | { id: string; separator: true }
  | { id: string; label: string; heading: true };

export interface MenuHeader {
  title: string;
  subtitle?: string;
  coverArt?: string;
  round?: boolean;
}

export interface MenuRequest {
  entries: MenuEntry[];
  /** Viewport point the menu opens from. */
  x: number;
  y: number;
  /** When opened from a button, the menu aligns to it and can flip above. */
  anchor?: { left: number; top: number; right: number; bottom: number };
  header?: MenuHeader;
}

/* ----------------------------------------------------------------- dialogs */

export type DialogRequest =
  | { type: 'addToPlaylist'; songs: Song[] }
  | {
      type: 'prompt';
      title: string;
      label: string;
      initialValue: string;
      confirmLabel: string;
      placeholder?: string;
      multiline?: boolean;
      onConfirm: (value: string) => void;
    }
  | {
      type: 'confirm';
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    }
  | { type: 'trackInfo'; song: Song }
  | { type: 'sleep' }
  | { type: 'shortcuts' }
  | { type: 'lyricsSearch'; song: Song };

/* ------------------------------------------------------------------ toasts */

export interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'error';
  action?: { label: string; run: () => void };
  duration: number;
}

/* ------------------------------------------------------------------- state */

export type InspectorPanel = 'queue' | 'lyrics' | 'info';
export type PlayerTab = 'none' | 'lyrics' | 'queue';

interface UIState {
  menu: MenuRequest | null;
  dialog: DialogRequest | null;
  toasts: Toast[];
  palette: boolean;
  fullPlayer: boolean;
  playerTab: PlayerTab;
  /** The desktop side panel. */
  inspector: InspectorPanel | null;
  sidebarOpen: boolean;
}

export const uiStore = createStore<UIState>({
  menu: null,
  dialog: null,
  toasts: [],
  palette: false,
  fullPlayer: false,
  playerTab: 'none',
  inspector: loadInspector(),
  sidebarOpen: false,
});

function loadInspector(): InspectorPanel | null {
  try {
    const value = localStorage.getItem('frequenzy.inspector.v1');
    return value === 'queue' || value === 'lyrics' || value === 'info' ? value : null;
  } catch {
    return null;
  }
}

let toastId = 0;
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

export const ui = {
  openMenu(entries: MenuEntry[], at: { x: number; y: number } | Element, header?: MenuHeader): void {
    if (entries.length === 0) return;
    if (at instanceof Element) {
      const rect = at.getBoundingClientRect();
      uiStore.set({
        menu: {
          entries,
          x: rect.left,
          y: rect.bottom + 6,
          anchor: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
          header,
        },
      });
    } else {
      uiStore.set({ menu: { entries, x: at.x, y: at.y, header } });
    }
  },

  closeMenu(): void {
    uiStore.set({ menu: null });
  },

  openDialog(dialog: DialogRequest): void {
    uiStore.set({ dialog, menu: null, palette: false });
  },

  closeDialog(): void {
    uiStore.set({ dialog: null });
  },

  toast(
    message: string,
    options: { action?: { label: string; run: () => void }; tone?: 'default' | 'error'; duration?: number } = {},
  ): number {
    const id = ++toastId;
    const duration = options.duration ?? (options.action ? 5200 : 2600);
    const toast: Toast = { id, message, tone: options.tone ?? 'default', action: options.action, duration };
    // Three at most; the oldest makes way.
    uiStore.set((state) => ({ toasts: [...state.toasts.slice(-2), toast] }));
    toastTimers.set(id, setTimeout(() => ui.dismissToast(id), duration));
    return id;
  },

  error(message: string): number {
    return ui.toast(message, { tone: 'error', duration: 4200 });
  },

  dismissToast(id: number): void {
    const timer = toastTimers.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.delete(id);
    uiStore.set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  openPalette(): void {
    uiStore.set({ palette: true, menu: null });
  },

  closePalette(): void {
    uiStore.set({ palette: false });
  },

  togglePalette(): void {
    uiStore.set((state) => ({ palette: !state.palette, menu: null }));
  },

  openFullPlayer(tab: PlayerTab = uiStore.get().playerTab): void {
    uiStore.set({ fullPlayer: true, playerTab: tab, menu: null });
  },

  closeFullPlayer(): void {
    uiStore.set({ fullPlayer: false });
  },

  setPlayerTab(tab: PlayerTab): void {
    uiStore.set({ playerTab: tab });
  },

  setInspector(panel: InspectorPanel | null): void {
    uiStore.set({ inspector: panel });
    try {
      if (panel) localStorage.setItem('frequenzy.inspector.v1', panel);
      else localStorage.removeItem('frequenzy.inspector.v1');
    } catch {
      /* ignore */
    }
  },

  toggleInspector(panel: InspectorPanel): void {
    ui.setInspector(uiStore.get().inspector === panel ? null : panel);
  },

  setSidebar(open: boolean): void {
    uiStore.set({ sidebarOpen: open });
  },
};

export function useUI<T>(selector: (state: UIState) => T): T {
  return useStore(uiStore, selector);
}

/** A short buzz on devices that have one, when the listener has not opted out. */
export function haptic(pattern: number | number[] = 8): void {
  if (!getSettings().haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
