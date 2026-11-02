/** Signed in or not, and what signing out has to tidy up. */

import { clearQueries } from '../lib/query';
import { createStore, useStore } from '../lib/store';
import { isAuthenticated, setCredentials, type Credentials } from '../lib/subsonic';
import { resetLibrary } from './library';
import { player } from './player';
import { ui } from './ui';

const sessionStore = createStore({ signedIn: isAuthenticated() });

export function useSignedIn(): boolean {
  return useStore(sessionStore, (s) => s.signedIn);
}

export function signIn(credentials: Credentials): void {
  setCredentials(credentials);
  sessionStore.set({ signedIn: true });
}

export function signOut(): void {
  player.pause();
  player.clearAll();
  setCredentials(null);
  clearQueries();
  resetLibrary();
  ui.closeFullPlayer();
  ui.closeDialog();
  ui.closeMenu();
  sessionStore.set({ signedIn: false });
}
