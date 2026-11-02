/**
 * The shell.
 *
 * Two genuinely different arrangements share one set of routes: a sidebar,
 * a docked deck and a side panel on a desktop; a tab bar, a mini player and a
 * sheet player on a phone. Every page scrolls inside one element, so a
 * position can be put back when you go Back.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import { LoginScreen } from './components/LoginScreen';
import { Spinner } from './components/controls';
import { MenuHost } from './components/overlays/Menu';
import { DialogHost } from './components/overlays/Dialogs';
import { PaletteHost } from './components/overlays/Palette';
import { ToastHost } from './components/overlays/Toasts';
import { FullPlayerHost } from './components/player/FullPlayer';
import { Deck } from './components/shell/Deck';
import { Inspector } from './components/shell/Inspector';
import { MiniPlayer } from './components/shell/MiniPlayer';
import { Sidebar } from './components/shell/Sidebar';
import { TabBar } from './components/shell/TabBar';
import { connection } from './lib/connection';
import { registerNavigate } from './lib/nav';
import { usePullToRefresh } from './hooks/useGestures';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useIsCompact, useIsTouch, useIsWide } from './hooks/useLayout';
import { ScrollerProvider, useScrollRestoration } from './hooks/useScroller';
import { Home } from './routes/Home';
import { Browse } from './routes/Browse';
import { Radio } from './routes/Radio';
import { Search } from './routes/Search';
import { LibraryHome } from './routes/LibraryHome';
import {
  Albums, Artists, Favourites, GenreDetail, Genres, History, Playlists, RecentlyAdded, Songs,
} from './routes/Library';
import { AlbumDetail } from './routes/AlbumDetail';
import { ArtistDetail } from './routes/ArtistDetail';
import { PlaylistDetail } from './routes/PlaylistDetail';
import { Downloads } from './routes/Downloads';
import { startLibrary } from './state/library';
import { usePlayer } from './state/player';
import { startQueueSync } from './state/queueSync';
import { useSignedIn } from './state/session';
import { ui, useUI } from './state/ui';

// The rarely visited, heavier pages load on demand.
const Settings = lazy(() => import('./routes/Settings').then((m) => ({ default: m.Settings })));
const Stats = lazy(() => import('./routes/Stats').then((m) => ({ default: m.Stats })));

export function App() {
  const signedIn = useSignedIn();
  useEffect(() => {
    connection.start();
  }, []);
  if (!signedIn) return <LoginScreen />;
  return <Shell />;
}

function Shell() {
  const compact = useIsCompact();
  const wide = useIsWide();
  const inspector = useUI((s) => s.inspector);
  const hasCurrent = usePlayer((s) => s.current !== null);
  const routerNavigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    registerNavigate((to, options) => (typeof to === 'number' ? routerNavigate(to) : routerNavigate(to, options)));
    return () => registerNavigate(null);
  }, [routerNavigate]);

  useEffect(() => {
    startLibrary();
    startQueueSync();
  }, []);

  useKeyboardShortcuts();

  // Moving somewhere closes whatever was floating over the old page.
  useEffect(() => {
    ui.closeMenu();
    if (compact) ui.closeFullPlayer();
  }, [compact, location.pathname]);

  const docked = !compact && inspector !== null && wide;

  // Floating things outside the shell (toasts, the selection bar) place
  // themselves by these.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.layout = compact ? 'compact' : 'desktop';
    root.dataset.mini = compact && hasCurrent ? 'on' : 'off';
  }, [compact, hasCurrent]);

  return (
    <div
      className={`app ${compact ? 'app--compact' : 'app--desktop'} ${docked ? 'has-inspector' : ''} ${
        compact && hasCurrent ? 'has-mini' : ''
      }`}
    >
      {!compact && <Sidebar />}
      <Main />
      {!compact && <Inspector />}
      {compact ? (
        <>
          <MiniPlayer />
          <TabBar />
        </>
      ) : (
        <Deck />
      )}
      <FullPlayerHost />
      <MenuHost />
      <DialogHost />
      <PaletteHost />
      <ToastHost />
    </div>
  );
}

function Main() {
  const ref = useRef<HTMLElement | null>(null);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const refresh = useRef<(() => Promise<unknown> | void) | null>(null);
  const [refreshable, setRefreshable] = useState(false);
  const touch = useIsTouch();

  const setRef = useCallback((node: HTMLElement | null) => {
    ref.current = node;
    setElement(node);
  }, []);

  const registerRefresh = useCallback((fn: (() => Promise<unknown> | void) | null) => {
    refresh.current = fn;
    setRefreshable(fn !== null);
  }, []);

  useScrollRestoration(ref);
  const pull = usePullToRefresh(ref, refresh, touch && refreshable);

  return (
    <main className="main" ref={setRef} id="main" tabIndex={-1}>
      {(pull.pull > 0 || pull.refreshing) && (
        <div
          className={`pull ${pull.ready ? 'is-ready' : ''} ${pull.refreshing ? 'is-refreshing' : ''}`}
          style={{ transform: `translate(-50%, ${Math.min(pull.pull, 80) - 34}px)`, opacity: Math.min(1, pull.pull / 40) }}
          aria-hidden="true"
        >
          <span className="pull__dial" style={{ transform: `rotate(${pull.pull * 4}deg)` }} />
        </div>
      )}
      <div className="main__inner" style={pull.pull > 0 ? { transform: `translate3d(0, ${pull.pull}px, 0)` } : undefined}>
        <ScrollerProvider element={element} onRefreshChange={registerRefresh}>
          <Suspense fallback={<PageFallback />}>
            <AppRoutes />
          </Suspense>
        </ScrollerProvider>
      </div>
    </main>
  );
}

function PageFallback() {
  return (
    <div className="page-fallback">
      <Spinner large />
    </div>
  );
}

/** Remount a detail page when its id changes, so no state leaks between items. */
function Keyed({ children }: { children: (id: string) => ReactNode }) {
  const params = useParams();
  const id = params.id ?? params.name ?? '';
  return <KeyedInner key={id}>{children(decodeURIComponent(id))}</KeyedInner>;
}

function KeyedInner({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function AppRoutes() {
  const compact = useIsCompact();
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/browse" element={<Browse />} />
      <Route path="/radio" element={<Radio />} />
      <Route path="/search" element={<Search />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/library" element={compact ? <LibraryHome /> : <Navigate to="/library/albums" replace />} />
      <Route path="/library/albums" element={<Albums />} />
      <Route path="/library/artists" element={<Artists />} />
      <Route path="/library/songs" element={<Songs />} />
      <Route path="/library/genres" element={<Genres />} />
      <Route path="/library/playlists" element={<Playlists />} />
      <Route path="/library/favourites" element={<Favourites />} />
      <Route path="/library/recent" element={<RecentlyAdded />} />
      <Route path="/library/history" element={<History />} />
      <Route path="/library/downloads" element={<Downloads />} />
      <Route path="/album/:id" element={<Keyed>{(id) => <AlbumDetail id={id} />}</Keyed>} />
      <Route path="/artist/:id" element={<Keyed>{(id) => <ArtistDetail id={id} />}</Keyed>} />
      <Route path="/playlist/:id" element={<Keyed>{(id) => <PlaylistDetail id={id} />}</Keyed>} />
      <Route path="/genre/:name" element={<Keyed>{(name) => <GenreDetail genre={name} />}</Keyed>} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
