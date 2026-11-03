/**
 * The sidebar: a brand plate, the search key, the menu, the library, pinned
 * things, playlists, and the network module at the foot.
 */

import { NavLink } from 'react-router-dom';

import { Artwork } from '../Artwork';
import {
  AlbumIcon, ArtistIcon, BrowseIcon, ClockIcon, DownloadIcon, GenreIcon, HeartIcon, HistoryIcon, HomeIcon,
  NoteIcon, PlaylistIcon, PlusIcon, RadioIcon, SearchIcon, SettingsIcon, StatsIcon,
} from '../Icons';
import { NetworkStatus } from './NetworkStatus';
import { songsOf, type DragPayload } from '../../lib/dnd';
import { artistCover } from '../../lib/song';
import type { Playlist } from '../../lib/types';
import { useDropTarget } from '../../hooks/useDropTarget';
import { useItemMenu } from '../../hooks/useItemMenu';
import * as act from '../../state/actions';
import { usePlaylists, usePlaylistsLoaded } from '../../state/library';
import { playlistHeader, playlistMenu } from '../../state/menus';
import { pinRoute, togglePin, unpin, usePins, type Pin } from '../../state/pins';
import { MOD } from '../../state/shortcuts';
import { ui } from '../../state/ui';

const MENU = [
  { to: '/', label: 'home', icon: <HomeIcon />, end: true },
  { to: '/browse', label: 'browse', icon: <BrowseIcon /> },
  { to: '/radio', label: 'radio', icon: <RadioIcon /> },
  { to: '/stats', label: 'stats', icon: <StatsIcon /> },
];

const LIBRARY = [
  { to: '/library/albums', label: 'albums', icon: <AlbumIcon /> },
  { to: '/library/artists', label: 'artists', icon: <ArtistIcon /> },
  { to: '/library/songs', label: 'songs', icon: <NoteIcon /> },
  { to: '/library/genres', label: 'genres', icon: <GenreIcon /> },
  { to: '/library/favourites', label: 'favourites', icon: <HeartIcon /> },
  { to: '/library/recent', label: 'recently added', icon: <ClockIcon /> },
  { to: '/library/history', label: 'history', icon: <HistoryIcon /> },
  { to: '/library/downloads', label: 'downloads', icon: <DownloadIcon /> },
];

export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg className={`logo ${className}`} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--on-accent)" strokeWidth="2.2" />
      <path d="M16 16 L21 10.5" stroke="var(--on-accent)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.8" fill="var(--on-accent)" />
    </svg>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const playlists = usePlaylists();
  const loaded = usePlaylistsLoaded();
  const pins = usePins();
  const pinDrop = useDropTarget(
    (payload) => {
      const pin = pinFromPayload(payload);
      if (pin) {
        togglePin(pin);
        ui.toast(`pinned ${pin.name}`);
      }
    },
    (payload) => payload.kind !== 'songs',
  );

  return (
    <aside className="sidebar" aria-label="Navigation">
      <div className="sidebar__brand">
        <Logo />
        <span className="sidebar__word">frequenzy</span>
        <span className="tag sidebar__model">fz-1</span>
      </div>

      <button type="button" className="sidebar__search" onClick={() => ui.openPalette()}>
        <SearchIcon />
        <span>search</span>
        <span className="sidebar__hint">
          <kbd className="kbd">{MOD}</kbd>
          <kbd className="kbd">K</kbd>
        </span>
      </button>

      <nav className="sidebar__scroll">
        <div className="navgroup">
          <div className="navgroup__head label">menu</div>
          {MENU.map((item, i) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) => `nav ${isActive ? 'is-active' : ''}`}
            >
              <span className="led nav__led" />
              {item.icon}
              <span className="nav__label">{item.label}</span>
              <span className="nav__num">{String(i + 1).padStart(2, '0')}</span>
            </NavLink>
          ))}
        </div>

        <div className="navgroup">
          <div className="navgroup__head label">library</div>
          {LIBRARY.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onNavigate} className={({ isActive }) => `nav ${isActive ? 'is-active' : ''}`}>
              <span className="led nav__led" />
              {item.icon}
              <span className="nav__label">{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className={`navgroup ${pinDrop.over ? 'is-drop' : ''}`} {...pinDrop.handlers}>
          <div className="navgroup__head label">pinned</div>
          {pins.length === 0 && <div className="navgroup__empty">drag an album, artist or playlist here</div>}
          {pins.map((pin) => (
            <PinItem key={`${pin.type}:${pin.id}`} pin={pin} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="navgroup">
          <div className="navgroup__head label">
            playlists
            <button type="button" className="ibtn ibtn--sm navgroup__add" aria-label="New playlist" onClick={() => act.promptNewPlaylist()}>
              <PlusIcon />
            </button>
          </div>
          {loaded && playlists.length === 0 && <div className="navgroup__empty">none yet</div>}
          {playlists.map((playlist) => (
            <PlaylistItem key={playlist.id} playlist={playlist} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <div className="sidebar__foot">
        <NetworkStatus />
        <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => `nav nav--foot ${isActive ? 'is-active' : ''}`}>
          <span className="led nav__led" />
          <SettingsIcon />
          <span className="nav__label">settings</span>
        </NavLink>
      </div>
    </aside>
  );
}

function pinFromPayload(payload: DragPayload): Pin | null {
  if (payload.kind === 'album') return { type: 'album', id: payload.album.id, name: payload.album.name, coverArt: payload.album.coverArt };
  if (payload.kind === 'artist') return { type: 'artist', id: payload.artist.id, name: payload.artist.name, coverArt: artistCover(payload.artist) };
  if (payload.kind === 'playlist') return { type: 'playlist', id: payload.playlist.id, name: payload.playlist.name, coverArt: payload.playlist.coverArt };
  return null;
}

function PlaylistItem({ playlist, onNavigate }: { playlist: Playlist; onNavigate?: () => void }) {
  const menu = useItemMenu(() => ({ entries: playlistMenu(playlist), header: playlistHeader(playlist) }));
  const drop = useDropTarget((payload) => {
    void songsOf(payload).then((songs) => act.addToPlaylist(playlist, songs));
  }, (payload) => !(payload.kind === 'playlist' && payload.playlist.id === playlist.id));
  return (
    <NavLink
      to={`/playlist/${encodeURIComponent(playlist.id)}`}
      onClick={(event) => {
        if (menu.consumeClick()) {
          event.preventDefault();
          return;
        }
        onNavigate?.();
      }}
      className={({ isActive }) => `nav nav--item ${isActive ? 'is-active' : ''} ${drop.over ? 'is-drop' : ''}`}
      {...menu.handlers}
      {...drop.handlers}
    >
      <span className="led nav__led" />
      {playlist.coverArt ? (
        <Artwork coverArt={playlist.coverArt} name={playlist.name} size={22} className="nav__art" />
      ) : (
        <PlaylistIcon />
      )}
      <span className="nav__label truncate">{playlist.name}</span>
      <span className="nav__num">{playlist.songCount ?? 0}</span>
    </NavLink>
  );
}

function PinItem({ pin, onNavigate }: { pin: Pin; onNavigate?: () => void }) {
  const menu = useItemMenu(() => ({
    entries: [
      {
        id: 'unpin',
        label: 'unpin',
        onSelect: () => unpin(pin.type, pin.id),
      },
    ],
    header: { title: pin.name, subtitle: pin.type, coverArt: pin.coverArt, round: pin.type === 'artist' },
  }));
  return (
    <NavLink
      to={pinRoute(pin)}
      onClick={(event) => {
        if (menu.consumeClick()) {
          event.preventDefault();
          return;
        }
        onNavigate?.();
      }}
      className={({ isActive }) => `nav nav--item ${isActive ? 'is-active' : ''}`}
      {...menu.handlers}
    >
      <span className="led nav__led" />
      <Artwork coverArt={pin.coverArt} name={pin.name} size={22} round={pin.type === 'artist'} className="nav__art" />
      <span className="nav__label truncate">{pin.name}</span>
      <span className="nav__num">{pin.type.slice(0, 2)}</span>
    </NavLink>
  );
}
