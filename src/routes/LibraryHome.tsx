/**
 * The Library tab on a phone: the sidebar's contents as a list you drill
 * into, with pinned things and playlists underneath.
 */

import { AlbumCard, Grid, SkeletonCards } from '../components/Cards';
import { Artwork } from '../components/Artwork';
import {
  AlbumIcon, ArtistIcon, ChevronRightIcon, ClockIcon, DownloadIcon, GenreIcon, HeartIcon, HistoryIcon, NoteIcon,
  PlaylistIcon, PlusIcon, SettingsIcon, StatsIcon,
} from '../components/Icons';
import { Page, Section } from '../components/Page';
import { NetworkStatus } from '../components/shell/NetworkStatus';
import { formatCount } from '../lib/format';
import { navigate } from '../lib/nav';
import { useAlbumList } from '../lib/queries';
import * as act from '../state/actions';
import { usePlaylists } from '../state/library';
import { pinRoute, usePins } from '../state/pins';
import { SeeAll } from './Home';

const SECTIONS = [
  { to: '/library/playlists', label: 'playlists', icon: <PlaylistIcon /> },
  { to: '/library/albums', label: 'albums', icon: <AlbumIcon /> },
  { to: '/library/artists', label: 'artists', icon: <ArtistIcon /> },
  { to: '/library/songs', label: 'songs', icon: <NoteIcon /> },
  { to: '/library/genres', label: 'genres', icon: <GenreIcon /> },
  { to: '/library/favourites', label: 'favourites', icon: <HeartIcon /> },
  { to: '/library/recent', label: 'recently added', icon: <ClockIcon /> },
  { to: '/library/history', label: 'history', icon: <HistoryIcon /> },
  { to: '/library/downloads', label: 'downloads', icon: <DownloadIcon /> },
  { to: '/stats', label: 'stats', icon: <StatsIcon /> },
  { to: '/settings', label: 'settings', icon: <SettingsIcon /> },
];

export function LibraryHome() {
  const playlists = usePlaylists();
  const pins = usePins();
  const recent = useAlbumList('newest', { size: 12 });

  return (
    <Page root title="library" onRefresh={recent.reload} actions={<NetworkStatus compact />}>
      <div className="linklist">
        {SECTIONS.map((section, i) => (
          <button key={section.to} type="button" className="linkrow" onClick={() => navigate(section.to)}>
            <span className="linkrow__num tnum">{String(i + 1).padStart(2, '0')}</span>
            <span className="linkrow__icon">{section.icon}</span>
            <span className="linkrow__label">{section.label}</span>
            <ChevronRightIcon className="linkrow__chev" />
          </button>
        ))}
      </div>

      {pins.length > 0 && (
        <Section title="pinned">
          <div className="linklist">
            {pins.map((pin) => (
              <button key={`${pin.type}:${pin.id}`} type="button" className="linkrow" onClick={() => navigate(pinRoute(pin))}>
                <Artwork coverArt={pin.coverArt} name={pin.name} size={36} round={pin.type === 'artist'} className="linkrow__art" />
                <span className="linkrow__label">
                  <span className="truncate">{pin.name}</span>
                  <span className="linkrow__sub">{pin.type}</span>
                </span>
                <ChevronRightIcon className="linkrow__chev" />
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="playlists"
        action={
          <button type="button" className="section__link" onClick={() => act.promptNewPlaylist()}>
            <PlusIcon /> new
          </button>
        }
      >
        {playlists.length === 0 ? (
          <div className="tracks-empty">no playlists yet — make one with “new”.</div>
        ) : (
          <div className="linklist">
            {playlists.slice(0, 30).map((playlist) => (
              <button key={playlist.id} type="button" className="linkrow" onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.id)}`)}>
                <Artwork coverArt={playlist.coverArt} name={playlist.name} size={36} className="linkrow__art" />
                <span className="linkrow__label">
                  <span className="truncate">{playlist.name}</span>
                  <span className="linkrow__sub">{formatCount(playlist.songCount, 'song')}</span>
                </span>
                <ChevronRightIcon className="linkrow__chev" />
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="recently added" action={<SeeAll to="/library/recent" />}>
        <Grid>
          {recent.loading ? <SkeletonCards count={4} /> : (recent.data ?? []).slice(0, 6).map((album) => <AlbumCard key={album.id} album={album} />)}
        </Grid>
      </Section>
    </Page>
  );
}
