/**
 * The shell: sidebar, routed content, the now-playing bar, and the full-screen
 * player that slides over all of it.
 */

import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { FullPlayer, type PlayerPanel } from './components/FullPlayer';
import { LoginScreen } from './components/LoginScreen';
import { NowPlayingBar } from './components/NowPlayingBar';
import { Sidebar } from './components/Sidebar';
import { connection } from './lib/connection';
import { isAuthenticated } from './lib/subsonic';
import { AlbumDetail } from './routes/AlbumDetail';
import { ArtistDetail } from './routes/ArtistDetail';
import { Browse } from './routes/Browse';
import {
  GenreDetail, LibraryAlbums, LibraryArtists, LibraryFavourites, LibraryGenres,
  LibraryRecent, LibrarySongs,
} from './routes/Library';
import { ListenNow } from './routes/ListenNow';
import { PlaylistDetail } from './routes/PlaylistDetail';
import { Radio } from './routes/Radio';
import { Search } from './routes/Search';
import { Settings } from './routes/Settings';
import { DialogsProvider } from './state/dialogs';
import { LibraryProvider } from './state/library';
import { PlayerProvider, usePlayer } from './state/player';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

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

function Shell({ onSignedOut }: { onSignedOut: () => void }) {
  const navigate = useNavigate();
  const { current } = usePlayer();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fullPlayer, setFullPlayer] = useState(false);
  const [panel, setPanel] = useState<PlayerPanel>('none');

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const toggleFullPlayer = useCallback(() => {
    if (current) setFullPlayer((open) => !open);
  }, [current]);

  const focusSearch = useCallback(() => {
    navigate('/search');
  }, [navigate]);

  useKeyboardShortcuts({ onToggleFullPlayer: toggleFullPlayer, onFocusSearch: focusSearch });

  // Opening lyrics or the queue from the bottom bar implies the big player.
  const changePanel = useCallback(
    (next: PlayerPanel) => {
      setPanel(next);
      if (next !== 'none' && current) setFullPlayer(true);
    },
    [current],
  );

  const menuButton = () => setSidebarOpen(true);

  return (
    <>
      <div className="fz-app">
        <Sidebar open={sidebarOpen} onNavigate={closeSidebar} />
        {sidebarOpen && <div className="fz-scrim" onClick={closeSidebar} />}

        <Routes>
          <Route path="/" element={<ListenNow onMenuClick={menuButton} />} />
          <Route path="/browse" element={<Browse onMenuClick={menuButton} />} />
          <Route path="/radio" element={<Radio onMenuClick={menuButton} />} />
          <Route path="/search" element={<Search onMenuClick={menuButton} />} />
          <Route path="/library/recent" element={<LibraryRecent onMenuClick={menuButton} />} />
          <Route path="/library/artists" element={<LibraryArtists onMenuClick={menuButton} />} />
          <Route path="/library/albums" element={<LibraryAlbums onMenuClick={menuButton} />} />
          <Route path="/library/songs" element={<LibrarySongs onMenuClick={menuButton} />} />
          <Route path="/library/genres" element={<LibraryGenres onMenuClick={menuButton} />} />
          <Route path="/library/favourites" element={<LibraryFavourites onMenuClick={menuButton} />} />
          <Route path="/album/:id" element={<AlbumDetail />} />
          <Route path="/artist/:id" element={<ArtistDetail />} />
          <Route path="/playlist/:id" element={<PlaylistDetail />} />
          <Route path="/genre/:name" element={<GenreDetail />} />
          <Route path="/settings" element={<Settings onSignedOut={onSignedOut} onMenuClick={menuButton} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <NowPlayingBar
          onExpand={() => setFullPlayer(true)}
          panel={panel}
          onPanelChange={changePanel}
        />
      </div>

      {fullPlayer && current && (
        <FullPlayer panel={panel} onPanelChange={setPanel} onClose={() => setFullPlayer(false)} />
      )}
    </>
  );
}
