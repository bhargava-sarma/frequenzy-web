/**
 * The Library tab on a phone.
 *
 * The sidebar's contents do not fit on a phone, so they become a list you drill
 * into — the same structure Apple Music uses under its Library tab, with the
 * most recently added albums shown underneath.
 */

import { useNavigate } from 'react-router-dom';

import { AlbumCard, CardSkeleton } from '../components/Cards';
import { Artwork } from '../components/Artwork';
import { Page } from '../components/Page';
import {
  AlbumIcon, ArtistIcon, ChevronRightIcon, ClockIcon, DownloadIcon, GenreIcon,
  HeartIcon, HistoryIcon, NoteIcon, PlaylistIcon, PlusIcon,
} from '../components/Icons';
import { formatCount } from '../lib/format';
import { getAlbumList } from '../lib/subsonic';
import { useAsync } from '../hooks/useAsync';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';

const SECTIONS = [
  { to: '/library/playlists', label: 'Playlists', icon: <PlaylistIcon /> },
  { to: '/library/artists', label: 'Artists', icon: <ArtistIcon /> },
  { to: '/library/albums', label: 'Albums', icon: <AlbumIcon /> },
  { to: '/library/songs', label: 'Songs', icon: <NoteIcon /> },
  { to: '/library/genres', label: 'Genres', icon: <GenreIcon /> },
  { to: '/library/favourites', label: 'Favourites', icon: <HeartIcon /> },
  { to: '/library/recent', label: 'Recently Added', icon: <ClockIcon /> },
  { to: '/library/history', label: 'Recently Played', icon: <HistoryIcon /> },
  { to: '/library/downloads', label: 'Downloaded', icon: <DownloadIcon /> },
];

export function LibraryHome() {
  const navigate = useNavigate();
  const { playlists, createPlaylist } = useLibrary();
  const { prompt } = useDialogs();
  const recent = useAsync((signal) => getAlbumList('newest', { size: 12 }, signal), []);

  return (
    <Page title="Library">
      <div className="fz-linklist">
        {SECTIONS.map((section) => (
          <button key={section.to} type="button" className="fz-linkrow" onClick={() => navigate(section.to)}>
            <span className="fz-linkrow__icon">{section.icon}</span>
            <span className="fz-linkrow__label">{section.label}</span>
            <ChevronRightIcon className="fz-linkrow__chevron" />
          </button>
        ))}
      </div>

      <section className="fz-section" style={{ marginTop: 26 }}>
        <div className="fz-section__head">
          <h2 className="fz-section__title">Your Playlists</h2>
          <button
            type="button"
            className="fz-icon-btn"
            style={{ marginLeft: 'auto' }}
            aria-label="New playlist"
            onClick={() =>
              prompt({
                title: 'New Playlist',
                label: 'Name',
                initialValue: 'New Playlist',
                confirmLabel: 'Create',
                onConfirm: (name) => void createPlaylist(name),
              })
            }
          >
            <PlusIcon />
          </button>
        </div>
        {playlists.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            No playlists yet — make one with the + above.
          </div>
        ) : (
          <div className="fz-linklist">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="fz-linkrow"
                onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.id)}`)}
              >
                <Artwork
                  coverArt={playlist.coverArt}
                  name={playlist.name}
                  size={120}
                  className="fz-linkrow__art"
                />
                <span className="fz-linkrow__label">
                  <span className="fz-truncate">{playlist.name}</span>
                  <span className="fz-linkrow__sub">{formatCount(playlist.songCount, 'song')}</span>
                </span>
                <ChevronRightIcon className="fz-linkrow__chevron" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="fz-section">
        <div className="fz-section__head">
          <h2 className="fz-section__title">Recently Added</h2>
          <button type="button" className="fz-section__link" style={{ opacity: 1 }} onClick={() => navigate('/library/recent')}>
            See All
          </button>
        </div>
        <div className="fz-grid">
          {recent.loading
            ? Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)
            : (recent.data ?? []).slice(0, 6).map((album) => <AlbumCard key={album.id} album={album} />)}
        </div>
      </section>
    </Page>
  );
}
