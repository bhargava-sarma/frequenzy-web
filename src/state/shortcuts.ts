/**
 * Every keyboard shortcut, as data. The handler and the shortcuts sheet both
 * read this table, so the sheet can never describe a key that does nothing.
 */

import { navigate } from '../lib/nav';
import * as act from './actions';
import { player } from './player';
import { ui, uiStore } from './ui';

export interface Shortcut {
  /** Keys as printed on the caps, in order. */
  keys: string[];
  label: string;
  group: 'playback' | 'queue & panels' | 'go to' | 'app';
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = isMac ? '⌘' : 'Ctrl';

export const SHORTCUTS: Shortcut[] = [
  { group: 'playback', keys: ['Space'], label: 'play / pause' },
  { group: 'playback', keys: ['N'], label: 'next track' },
  { group: 'playback', keys: ['P'], label: 'previous track' },
  { group: 'playback', keys: ['→'], label: 'forward 5 seconds' },
  { group: 'playback', keys: ['←'], label: 'back 5 seconds' },
  { group: 'playback', keys: ['⇧', '→'], label: 'forward 30 seconds' },
  { group: 'playback', keys: ['⇧', '←'], label: 'back 30 seconds' },
  { group: 'playback', keys: ['0', '–', '9'], label: 'jump to 0–90%' },
  { group: 'playback', keys: ['+'], label: 'volume up' },
  { group: 'playback', keys: ['−'], label: 'volume down' },
  { group: 'playback', keys: ['M'], label: 'mute' },
  { group: 'playback', keys: ['S'], label: 'shuffle' },
  { group: 'playback', keys: ['R'], label: 'repeat: off / all / one' },
  { group: 'playback', keys: ['A'], label: 'autoplay similar music' },
  { group: 'playback', keys: ['B'], label: 'A–B loop: set A, set B, clear' },
  { group: 'playback', keys: ['['], label: 'slower' },
  { group: 'playback', keys: [']'], label: 'faster' },
  { group: 'playback', keys: ['\\'], label: 'normal speed' },
  { group: 'playback', keys: ['H'], label: 'favourite this track' },
  { group: 'queue & panels', keys: ['F'], label: 'full-screen player' },
  { group: 'queue & panels', keys: ['L'], label: 'lyrics' },
  { group: 'queue & panels', keys: ['Q'], label: 'queue' },
  { group: 'queue & panels', keys: ['I'], label: 'track info' },
  { group: 'queue & panels', keys: ['T'], label: 'sleep timer' },
  { group: 'go to', keys: ['G', 'H'], label: 'home' },
  { group: 'go to', keys: ['G', 'B'], label: 'browse' },
  { group: 'go to', keys: ['G', 'R'], label: 'radio' },
  { group: 'go to', keys: ['G', 'A'], label: 'albums' },
  { group: 'go to', keys: ['G', 'I'], label: 'artists' },
  { group: 'go to', keys: ['G', 'S'], label: 'songs' },
  { group: 'go to', keys: ['G', 'P'], label: 'playlists' },
  { group: 'go to', keys: ['G', 'F'], label: 'favourites' },
  { group: 'go to', keys: ['G', 'Y'], label: 'history' },
  { group: 'go to', keys: ['G', 'D'], label: 'downloads' },
  { group: 'go to', keys: ['G', 'T'], label: 'stats' },
  { group: 'go to', keys: ['G', ','], label: 'settings' },
  { group: 'app', keys: [MOD, 'K'], label: 'command palette' },
  { group: 'app', keys: ['/'], label: 'search' },
  { group: 'app', keys: [MOD, 'A'], label: 'select every track in a list' },
  { group: 'app', keys: ['?'], label: 'this sheet' },
  { group: 'app', keys: ['Esc'], label: 'close / clear the selection' },
];

const GO_TO: Record<string, string> = {
  h: '/',
  b: '/browse',
  r: '/radio',
  a: '/library/albums',
  i: '/library/artists',
  s: '/library/songs',
  p: '/library/playlists',
  f: '/library/favourites',
  y: '/library/history',
  d: '/library/downloads',
  t: '/stats',
  ',': '/settings',
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

let goPending = 0;

/** Returns true when the event was handled. */
export function handleShortcut(event: KeyboardEvent, opts: { compact: boolean }): boolean {
  const state = uiStore.get();
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key;

  if (mod && key.toLowerCase() === 'k') {
    ui.togglePalette();
    return true;
  }

  // The palette and dialogs own the keyboard while they are open.
  if (state.palette || state.dialog) return false;

  if (key === 'Escape') {
    if (state.menu) {
      ui.closeMenu();
      return true;
    }
    if (state.fullPlayer) {
      ui.closeFullPlayer();
      return true;
    }
    return false;
  }

  if (state.menu) return false;
  if (isTyping(event.target) || event.altKey) return false;
  // Holding a toggle key down must not flap it; held arrows and volume may repeat.
  if (event.repeat && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(key)) {
    return key === ' ' || /^[a-z0-9]$/i.test(key);
  }
  if (mod) {
    if (key === 'ArrowRight') {
      player.next();
      return true;
    }
    if (key === 'ArrowLeft') {
      player.previous();
      return true;
    }
    if (key === 'ArrowUp') {
      player.nudgeVolume(0.05);
      return true;
    }
    if (key === 'ArrowDown') {
      player.nudgeVolume(-0.05);
      return true;
    }
    return false;
  }

  const lower = key.toLowerCase();

  if (goPending && Date.now() - goPending < 1200) {
    goPending = 0;
    const route = GO_TO[lower];
    if (route) {
      ui.closeFullPlayer();
      navigate(route);
      return true;
    }
    return false;
  }

  const current = player.store.get().current;

  switch (key) {
    case ' ':
      player.toggle();
      return true;
    case 'ArrowRight':
      player.seekBy(event.shiftKey ? 30 : 5);
      return true;
    case 'ArrowLeft':
      player.seekBy(event.shiftKey ? -30 : -5);
      return true;
    case '+':
    case '=':
      player.nudgeVolume(0.05);
      return true;
    case '-':
    case '_':
      player.nudgeVolume(-0.05);
      return true;
    case '[':
      player.setRate(player.store.get().rate - 0.1);
      ui.toast(`speed ${player.store.get().rate.toFixed(2)}×`);
      return true;
    case ']':
      player.setRate(player.store.get().rate + 0.1);
      ui.toast(`speed ${player.store.get().rate.toFixed(2)}×`);
      return true;
    case '\\':
      player.setRate(1);
      ui.toast('speed 1.00×');
      return true;
    case '?':
      ui.openDialog({ type: 'shortcuts' });
      return true;
    case '/':
      ui.openPalette();
      return true;
    default:
      break;
  }

  if (/^[0-9]$/.test(key) && !event.shiftKey) {
    player.seekFraction(Number(key) / 10);
    return true;
  }

  switch (lower) {
    case 'g':
      goPending = Date.now();
      return true;
    case 'n':
      player.next();
      return true;
    case 'p':
      player.previous();
      return true;
    case 'm':
      player.toggleMute();
      return true;
    case 's':
      player.toggleShuffle();
      ui.toast(player.store.get().shuffle ? 'shuffle on' : 'shuffle off');
      return true;
    case 'r': {
      player.cycleRepeat();
      const repeat = player.store.get().repeat;
      ui.toast(repeat === 'off' ? 'repeat off' : repeat === 'all' ? 'repeat all' : 'repeat one');
      return true;
    }
    case 'a':
      player.toggleAutoplay();
      ui.toast(player.store.get().autoplay ? 'autoplay on' : 'autoplay off');
      return true;
    case 'b':
      player.cycleLoop();
      return true;
    case 'h':
      if (current && !current.isRadio) void act.toggleFavourite('song', current.id);
      return true;
    case 'f':
      if (!current) return false;
      if (state.fullPlayer) ui.closeFullPlayer();
      else ui.openFullPlayer();
      return true;
    case 'l':
      if (!current) return false;
      if (opts.compact || state.fullPlayer) ui.openFullPlayer(state.playerTab === 'lyrics' ? 'none' : 'lyrics');
      else ui.toggleInspector('lyrics');
      return true;
    case 'q':
      if (opts.compact || state.fullPlayer) ui.openFullPlayer(state.playerTab === 'queue' ? 'none' : 'queue');
      else ui.toggleInspector('queue');
      return true;
    case 'i':
      if (current && !current.isRadio) act.showInfo(current);
      return true;
    case 't':
      ui.openDialog({ type: 'sleep' });
      return true;
    default:
      return false;
  }
}
