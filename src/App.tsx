/**
 * The shell.
 *
 * Two genuinely different arrangements share one set of routes: a sidebar with
 * a docked transport on desktop, a tab bar with a mini player and a sheet
 * player on a phone. Which one you get is a layout mode, not a pile of
 * breakpoints inside every component.
 */

import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { FullPlayer, type PlayerPanel } from './components/FullPlayer';
import { LoginScreen } from './components/LoginScreen';
import { NowPlayingBar } from './components/NowPlayingBar';
import { Sidebar } from './components/Sidebar';
import { MiniPlayer } from './components/mobile/MiniPlayer';
import { TabBar } from './components/mobile/TabBar';
import { connection } from './lib/connection';
import { isAuthenticated } from './lib/subsonic';
import { useIsCompact } from './hooks/useLayout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { AlbumDetail } from './routes/AlbumDetail';
import { ArtistDetail } from './routes/ArtistDetail';
import { Browse } from './routes/Browse';
import { Downloads } from './routes/Downloads';
import {
  GenreDetail, LibraryAlbums, LibraryArtists, LibraryFavourites, LibraryGenres,
  LibraryHistory, LibraryPlaylists, LibraryRecent, LibrarySongs,
} from './routes/Library';
import { LibraryHome } from './routes/LibraryHome';
import { ListenNow } from './routes/ListenNow';
import { PlaylistDetail } from './routes/PlaylistDetail';
import { Radio } from './routes/Radio';
import { Search } from './routes/Search';
import { Settings } from './routes/Settings';
import { DialogsProvider } from './state/dialogs';
import { LibraryProvider } from './state/library';
import { PlayerProvider, usePlayer } from './state/player';

export function App() {
  const [signedIn, setSignedIn] = useState(isAuthenticated);

  useEffect(() => {
    if (signedIn) connection.start();
  }, [signedIn]);

  if (!signedIn) {
    return <LoginScreen onSignedIn={() => setSignedIn(true)} />;
  }

  return (
    <PlayerProvider>
      <LibraryProvider enabled={signedIn}>
        <DialogsProvider>
          <Shell onSignedOut={() => setSignedIn(false)} />
        </DialogsProvider>
      </LibraryProvider>
    </PlayerProvider>
  );
}

function AppRoutes({ onSignedOut, onMenuClick }: { onSignedOut: () => void; onMenuClick?: () => void }) {
  const compact = useIsCompact();

  return (
    <Routes>
      <Route path="/" element={<ListenNow onMenuClick={onMenuClick} />} />
      <Route path="/browse" element={<Browse onMenuClick={onMenuClick} />} />
      <Route path="/radio" element={<Radio onMenuClick={onMenuClick} />} />
      <Route path="/search" element={<Search onMenuClick={onMenuClick} />} />
      {/* The Library index only exists on a phone; on desktop the sidebar is it. */}
      <Route path="/library" element={compact ? <LibraryHome /> : <Navigate to="/library/albums" replace />} />
      <Route path="/library/recent" element={<LibraryRecent onMenuClick={onMenuClick} />} />
      <Route path="/library/artists" element={<LibraryArtists onMenuClick={onMenuClick} />} />
      <Route path="/library/albums" element={<LibraryAlbums onMenuClick={onMenuClick} />} />
      <Route path="/library/songs" element={<LibrarySongs onMenuClick={onMenuClick} />} />
      <Route path="/library/genres" element={<LibraryGenres onMenuClick={onMenuClick} />} />
      <Route path="/library/favourites" element={<LibraryFavourites onMenuClick={onMenuClick} />} />
      <Route path="/library/history" element={<LibraryHistory onMenuClick={onMenuClick} />} />
      <Route path="/library/playlists" element={<LibraryPlaylists onMenuClick={onMenuClick} />} />
      <Route path="/library/downloads" element={<Downloads onMenuClick={onMenuClick} />} />
      <Route path="/album/:id" element={<AlbumDetail />} />
      <Route path="/artist/:id" element={<ArtistDetail />} />
      <Route path="/playlist/:id" element={<PlaylistDetail />} />
      <Route path="/genre/:name" element={<GenreDetail />} />
      <Route path="/settings" element={<Settings onSignedOut={onSignedOut} onMenuClick={onMenuClick} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Shell({ onSignedOut }: { onSignedOut: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const compact = useIsCompact();
  const { current } = usePlayer();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fullPlayer, setFullPlayer] = useState(false);
  const [panel, setPanel] = useState<PlayerPanel>('none');

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const toggleFullPlayer = useCallback(() => {
    if (current) setFullPlayer((open) => !open);
  }, [current]);

  const focusSearch = useCallback(() => navigate('/search'), [navigate]);

  useKeyboardShortcuts({ onToggleFullPlayer: toggleFullPlayer, onFocusSearch: focusSearch });

  // The player covers the whole screen on a phone; navigating underneath it
  // would leave you looking at the wrong thing when it closes.
  useEffect(() => {
    if (compact) setFullPlayer(false);
  }, [compact, location.pathname]);

  // Nothing to expand once the queue is empty.
  useEffect(() => {
    if (!current) setFullPlayer(false);
  }, [current]);

  const changePanel = useCallback(
    (next: PlayerPanel) => {
      setPanel(next);
      if (next !== 'none' && current) setFullPlayer(true);
    },
    [current],
  );

  if (compact) {
    return (
      <>
        <div className="fz-app fz-app--compact">
          <AppRoutes onSignedOut={onSignedOut} />
          {current && <MiniPlayer onExpand={() => setFullPlayer(true)} />}
          <TabBar />
        </div>
        {fullPlayer && current && (
          <FullPlayer panel={panel} onPanelChange={setPanel} onClose={() => setFullPlayer(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="fz-app">
        <Sidebar open={sidebarOpen} onNavigate={closeSidebar} />
        {sidebarOpen && <div className="fz-scrim" onClick={closeSidebar} />}
        <AppRoutes onSignedOut={onSignedOut} onMenuClick={() => setSidebarOpen(true)} />
        <NowPlayingBar onExpand={() => setFullPlayer(true)} panel={panel} onPanelChange={changePanel} />
      </div>
      {fullPlayer && current && (
        <FullPlayer panel={panel} onPanelChange={setPanel} onClose={() => setFullPlayer(false)} />
      )}
    </>
  );
}
