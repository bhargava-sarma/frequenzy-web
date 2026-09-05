/** Navigation rail: search, the three top-level destinations, library, playlists. */

import { useState, type MouseEvent } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { Artwork } from './Artwork';
import { ConnectionBadge } from './ConnectionBadge';
import { useContextMenu } from './ContextMenu';
import {
  AlbumIcon, ArtistIcon, BrowseIcon, ClockIcon, GenreIcon, HeartIcon,
  ListenNowIcon, NoteIcon, PlaylistIcon, PlusIcon, RadioIcon, SearchIcon,
  SettingsIcon,
} from './Icons';
import { getPlaylist } from '../lib/subsonic';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';
import { useMediaMenu } from '../hooks/useMediaMenu';

const PRIMARY = [
  { to: '/', label: 'Listen Now', icon: <ListenNowIcon />, end: true },
  { to: '/browse', label: 'Browse', icon: <BrowseIcon /> },
  { to: '/radio', label: 'Stations', icon: <RadioIcon /> },
];

const LIBRARY = [
  { to: '/library/recent', label: 'Recently Added', icon: <ClockIcon /> },
  { to: '/library/artists', label: 'Artists', icon: <ArtistIcon /> },
  { to: '/library/albums', label: 'Albums', icon: <AlbumIcon /> },
  { to: '/library/songs', label: 'Songs', icon: <NoteIcon /> },
  { to: '/library/genres', label: 'Genres', icon: <GenreIcon /> },
  { to: '/library/favourites', label: 'Favourites', icon: <HeartIcon /> },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const navigate = useNavigate();
  const { playlists, createPlaylist, renamePlaylist, deletePlaylist } = useLibrary();
  const { prompt } = useDialogs();
  const { playlistMenu } = useMediaMenu();
  const { open: openMenu, menu } = useContextMenu();
  const [query, setQuery] = useState('');

  const submitSearch = (value: string) => {
    setQuery(value);
    if (value.trim()) navigate(`/search?q=${encodeURIComponent(value.trim())}`);
  };

  const handleNewPlaylist = () => {
    prompt({
      title: 'New Playlist',
      label: 'Name',
      initialValue: 'New Playlist',
      confirmLabel: 'Create',
      onConfirm: (name) => void createPlaylist(name),
    });
  };

  const handlePlaylistMenu = async (event: MouseEvent, playlist: { id: string; name: string }) => {
    event.preventDefault();
    const full = await getPlaylist(playlist.id).catch(() => null);
    openMenu(
      event,
      playlistMenu(playlist, full?.entry ?? [], {
        onRename: () =>
          prompt({
            title: 'Rename Playlist',
            label: 'Name',
            initialValue: playlist.name,
            confirmLabel: 'Rename',
            onConfirm: (name) => void renamePlaylist(playlist.id, name),
          }),
        onDelete: () => void deletePlaylist(playlist.id),
      }),
    );
  };

  return (
    <nav className={`fz-sidebar ${open ? 'is-open' : ''}`} aria-label="Library">
      <div className="fz-sidebar__brand">
        <img src="/icons/icon.svg" alt="" className="fz-sidebar__logo" />
        <span className="fz-sidebar__name">Frequenzy</span>
      </div>

      <div className="fz-sidebar__search">
        <div className="fz-input">
          <SearchIcon />
          <input
            type="search"
            value={query}
            placeholder="Search"
            aria-label="Search your library"
            onChange={(event) => submitSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="fz-sidebar__scroll fz-scroll">
        <div className="fz-nav-group">
          {PRIMARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) => `fz-nav-item ${isActive ? 'is-active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="fz-nav-group">
          <div className="fz-nav-group__title">Library</div>
          {LIBRARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => `fz-nav-item ${isActive ? 'is-active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="fz-nav-group">
          <div className="fz-nav-group__title" style={{ display: 'flex', alignItems: 'center' }}>
            <span>Playlists</span>
            <button
              type="button"
              className="fz-icon-btn"
              style={{ marginLeft: 'auto', width: 22, height: 22 }}
              aria-label="New playlist"
              onClick={handleNewPlaylist}
            >
              <PlusIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>
          {playlists.length === 0 && (
            <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-tertiary)' }}>None yet</div>
          )}
          {playlists.map((playlist) => (
            <NavLink
              key={playlist.id}
              to={`/playlist/${encodeURIComponent(playlist.id)}`}
              onClick={onNavigate}
              onContextMenu={(event) => void handlePlaylistMenu(event, playlist)}
              className={({ isActive }) => `fz-playlist-item ${isActive ? 'is-active' : ''}`}
            >
              {playlist.coverArt ? (
                <Artwork coverArt={playlist.coverArt} name={playlist.name} size={48} className="fz-playlist-item__art" />
              ) : (
                <PlaylistIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)', flex: 'none' }} />
              )}
              <span className="fz-truncate">{playlist.name}</span>
            </NavLink>
          ))}
        </div>

        <div className="fz-nav-group">
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={({ isActive }) => `fz-nav-item ${isActive ? 'is-active' : ''}`}
          >
            <SettingsIcon />
            <span>Settings</span>
          </NavLink>
        </div>
      </div>

      <ConnectionBadge />
      {menu}
    </nav>
  );
}
