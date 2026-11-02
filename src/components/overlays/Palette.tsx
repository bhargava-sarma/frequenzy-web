/**
 * The command palette — ⌘K anywhere.
 *
 * Every page, every playback verb and every setting is a line you can type
 * a few letters of; underneath, the library is searched live. Enter does the
 * obvious thing, ⇧Enter queues instead.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Artwork } from '../Artwork';
import { Spinner } from '../controls';
import {
  AlbumIcon, ArtistIcon, BrowseIcon, ClockIcon, CommandIcon, DiceIcon, DownloadIcon, GenreIcon, HeartIcon,
  HistoryIcon, HomeIcon, InfinityIcon, InfoIcon, KeyboardIcon, LogoutIcon, LoopIcon, LyricsIcon, MoonIcon,
  NextIcon, NoteIcon, PauseIcon, PlaylistIcon, PlusIcon, PreviousIcon, QueueIcon, RadioIcon, RefreshIcon,
  RepeatIcon, SearchIcon, SettingsIcon, ShuffleIcon, SpeedIcon, StatsIcon, SunIcon, TrashIcon, VolumeMuteIcon,
} from '../Icons';
import { connection } from '../../lib/connection';
import { albumArtist, songArtist } from '../../lib/format';
import { navigate } from '../../lib/nav';
import { useSearch } from '../../lib/queries';
import { artistCover } from '../../lib/song';
import { startScan } from '../../lib/subsonic';
import * as act from '../../state/actions';
import { player } from '../../state/player';
import { updateSettings, type Accent } from '../../state/settings';
import { MOD } from '../../state/shortcuts';
import { ui, useUI } from '../../state/ui';

interface Command {
  id: string;
  title: string;
  group: string;
  icon?: ReactNode;
  art?: { coverArt?: string; name: string; round?: boolean };
  subtitle?: string;
  keywords?: string;
  hint?: string;
  run: () => void;
  alt?: () => void;
}

/** Subsequence match with a bonus for hits at word starts; -1 means no match. */
function score(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (t.startsWith(q)) return 100 - t.length * 0.1;
  const wordHit = t.indexOf(` ${q}`);
  if (wordHit >= 0) return 80 - wordHit * 0.1;
  if (t.includes(q)) return 60;
  // Initials and the like: "atq" for "add to queue". The first letter has to
  // begin a word, or three letters match half the list.
  const words = t.split(/[\s:·–-]+/).filter(Boolean);
  if (!words.some((word) => word.startsWith(q[0]))) return -1;
  let ti = 0;
  let points = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    points += found === 0 || t[found - 1] === ' ' ? 3 : 1;
    ti = found + 1;
  }
  return points;
}

const ACCENTS: Accent[] = ['orange', 'blue', 'green', 'yellow', 'red', 'pink', 'mono'];

function baseCommands(): Command[] {
  const go = (path: string) => () => {
    ui.closeFullPlayer();
    navigate(path);
  };
  const current = player.store.get().current;
  const list: Command[] = [
    { id: 'p-home', group: 'go to', title: 'home', icon: <HomeIcon />, hint: 'G H', run: go('/') },
    { id: 'p-browse', group: 'go to', title: 'browse', icon: <BrowseIcon />, hint: 'G B', run: go('/browse') },
    { id: 'p-radio', group: 'go to', title: 'radio', icon: <RadioIcon />, hint: 'G R', run: go('/radio') },
    { id: 'p-albums', group: 'go to', title: 'albums', icon: <AlbumIcon />, hint: 'G A', run: go('/library/albums') },
    { id: 'p-artists', group: 'go to', title: 'artists', icon: <ArtistIcon />, hint: 'G I', run: go('/library/artists') },
    { id: 'p-songs', group: 'go to', title: 'songs', icon: <NoteIcon />, hint: 'G S', run: go('/library/songs') },
    { id: 'p-genres', group: 'go to', title: 'genres', icon: <GenreIcon />, run: go('/library/genres') },
    { id: 'p-playlists', group: 'go to', title: 'playlists', icon: <PlaylistIcon />, hint: 'G P', run: go('/library/playlists') },
    { id: 'p-favs', group: 'go to', title: 'favourites', keywords: 'starred loved hearts', icon: <HeartIcon />, hint: 'G F', run: go('/library/favourites') },
    { id: 'p-recent', group: 'go to', title: 'recently added', keywords: 'new', icon: <ClockIcon />, run: go('/library/recent') },
    { id: 'p-history', group: 'go to', title: 'history', keywords: 'recently played', icon: <HistoryIcon />, hint: 'G Y', run: go('/library/history') },
    { id: 'p-downloads', group: 'go to', title: 'downloads', keywords: 'offline', icon: <DownloadIcon />, hint: 'G D', run: go('/library/downloads') },
    { id: 'p-stats', group: 'go to', title: 'stats', keywords: 'listening statistics top', icon: <StatsIcon />, hint: 'G T', run: go('/stats') },
    { id: 'p-settings', group: 'go to', title: 'settings', keywords: 'preferences', icon: <SettingsIcon />, hint: 'G ,', run: go('/settings') },
    { id: 'p-search', group: 'go to', title: 'search page', icon: <SearchIcon />, run: go('/search') },

    { id: 'c-toggle', group: 'playback', title: 'play / pause', icon: <PauseIcon />, hint: 'Space', run: () => player.toggle() },
    { id: 'c-next', group: 'playback', title: 'next track', icon: <NextIcon />, hint: 'N', run: () => player.next() },
    { id: 'c-prev', group: 'playback', title: 'previous track', icon: <PreviousIcon />, hint: 'P', run: () => player.previous() },
    { id: 'c-shuffle', group: 'playback', title: 'toggle shuffle', icon: <ShuffleIcon />, hint: 'S', run: () => player.toggleShuffle() },
    { id: 'c-repeat', group: 'playback', title: 'cycle repeat', icon: <RepeatIcon />, hint: 'R', run: () => player.cycleRepeat() },
    { id: 'c-autoplay', group: 'playback', title: 'toggle autoplay', keywords: 'similar continue', icon: <InfinityIcon />, hint: 'A', run: () => player.toggleAutoplay() },
    { id: 'c-mute', group: 'playback', title: 'mute / unmute', icon: <VolumeMuteIcon />, hint: 'M', run: () => player.toggleMute() },
    { id: 'c-loop', group: 'playback', title: 'a–b loop', keywords: 'repeat section practice', icon: <LoopIcon />, hint: 'B', run: () => player.cycleLoop() },
    { id: 'c-sleep', group: 'playback', title: 'sleep timer…', icon: <MoonIcon />, hint: 'T', run: () => ui.openDialog({ type: 'sleep' }) },
    ...[0.75, 1, 1.25, 1.5, 2].map((rate) => ({
      id: `c-rate-${rate}`,
      group: 'playback',
      title: `speed ${rate.toFixed(2)}×`,
      keywords: 'playback rate tempo',
      icon: <SpeedIcon />,
      run: () => player.setRate(rate),
    })),

    { id: 'q-clear', group: 'queue', title: 'clear up next', icon: <TrashIcon />, run: () => act.clearUpcoming() },
    { id: 'q-shuffle', group: 'queue', title: 'shuffle up next', icon: <ShuffleIcon />, run: () => act.shuffleUpcoming() },
    { id: 'q-save', group: 'queue', title: 'save queue as playlist…', icon: <PlusIcon />, run: () => act.saveQueueAsPlaylist() },
    { id: 'q-stop', group: 'queue', title: 'stop and clear the queue', icon: <TrashIcon />, run: () => act.stopAndClear() },
    { id: 'q-open', group: 'queue', title: 'show queue', icon: <QueueIcon />, hint: 'Q', run: () => ui.openFullPlayer('queue') },

    { id: 'l-shuffle', group: 'library', title: 'shuffle the whole library', icon: <ShuffleIcon />, run: () => void act.shuffleLibrary() },
    { id: 'l-random', group: 'library', title: 'open a random album', keywords: 'surprise dice', icon: <DiceIcon />, run: () => void act.openRandomAlbum() },
    { id: 'l-new', group: 'library', title: 'new playlist…', icon: <PlusIcon />, run: () => act.promptNewPlaylist() },
    {
      id: 'l-scan',
      group: 'library',
      title: 'rescan the music folder',
      icon: <RefreshIcon />,
      run: () =>
        void startScan(false)
          .then(() => ui.toast('scan started'))
          .catch(() => ui.error("couldn't start a scan — admin only")),
    },

    { id: 'a-light', group: 'appearance', title: 'theme: aluminium (light)', icon: <SunIcon />, run: () => updateSettings({ theme: 'light' }) },
    { id: 'a-dark', group: 'appearance', title: 'theme: graphite (dark)', icon: <MoonIcon />, run: () => updateSettings({ theme: 'dark' }) },
    { id: 'a-system', group: 'appearance', title: 'theme: follow the system', icon: <SettingsIcon />, run: () => updateSettings({ theme: 'system' }) },
    ...ACCENTS.map((accent) => ({
      id: `a-${accent}`,
      group: 'appearance',
      title: `accent: ${accent}`,
      keywords: 'colour color',
      icon: <span className={`swatch swatch--${accent}`} />,
      run: () => updateSettings({ accent }),
    })),
    { id: 'a-compact', group: 'appearance', title: 'density: compact', icon: <BrowseIcon />, run: () => updateSettings({ density: 'compact' }) },
    { id: 'a-comfy', group: 'appearance', title: 'density: comfortable', icon: <BrowseIcon />, run: () => updateSettings({ density: 'comfortable' }) },

    { id: 'h-keys', group: 'help', title: 'keyboard shortcuts', icon: <KeyboardIcon />, hint: '?', run: () => ui.openDialog({ type: 'shortcuts' }) },
    { id: 'h-net', group: 'help', title: 're-check servers', icon: <RefreshIcon />, run: () => void connection.resolve(true).then(() => ui.toast('servers re-checked')) },
    {
      id: 'h-signout',
      group: 'help',
      title: 'sign out…',
      icon: <LogoutIcon />,
      run: () => navigate('/settings#account'),
    },
  ];

  if (current && !current.isRadio) {
    list.unshift(
      {
        id: 't-fav',
        group: 'now playing',
        title: 'favourite this track',
        subtitle: current.title,
        icon: <HeartIcon />,
        hint: 'H',
        run: () => void act.toggleFavourite('song', current.id),
      },
      {
        id: 't-radio',
        group: 'now playing',
        title: 'start a station from this track',
        subtitle: current.title,
        icon: <RadioIcon />,
        run: () => void act.startRadio({ kind: 'song', id: current.id, name: current.title, genre: current.genre, song: current }),
      },
      { id: 't-lyrics', group: 'now playing', title: 'show lyrics', icon: <LyricsIcon />, hint: 'L', run: () => ui.openFullPlayer('lyrics') },
      { id: 't-info', group: 'now playing', title: 'track info', icon: <InfoIcon />, hint: 'I', run: () => act.showInfo(current) },
    );
    if (current.albumId) list.unshift({ id: 't-album', group: 'now playing', title: 'go to the album', subtitle: current.album, icon: <AlbumIcon />, run: () => act.goToAlbum(current) });
  }
  return list;
}

export function PaletteHost() {
  const open = useUI((s) => s.palette);
  return open ? <Palette /> : null;
}

function Palette() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const commands = useMemo(baseCommands, []);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), 140);
    return () => clearTimeout(handle);
  }, [query]);

  const search = useSearch(debounced.length >= 2 ? debounced : '', { artistCount: 4, albumCount: 6, songCount: 8 }, 'palette');

  const items = useMemo(() => {
    const q = query.trim();
    const matched = q
      ? commands
          .map((command) => ({ command, s: Math.max(score(command.title, q), score(command.keywords ?? '', q) - 10) }))
          .filter((entry) => entry.s >= 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, 7)
          .map((entry) => entry.command)
      : commands.filter((c) => c.group === 'now playing' || c.group === 'go to').slice(0, 12);

    const results: Command[] = [];
    const data = debounced.length >= 2 ? search.data : undefined;
    if (data) {
      for (const artist of data.artist) {
        results.push({
          id: `ar-${artist.id}`,
          group: 'artists',
          title: artist.name,
          subtitle: 'artist',
          art: { coverArt: artistCover(artist), name: artist.name, round: true },
          run: () => navigate(`/artist/${encodeURIComponent(artist.id)}`),
          alt: () => void act.queueArtist(artist, 'last'),
        });
      }
      for (const album of data.album) {
        results.push({
          id: `al-${album.id}`,
          group: 'albums',
          title: album.name,
          subtitle: albumArtist(album),
          art: { coverArt: album.coverArt, name: album.name },
          run: () => navigate(`/album/${encodeURIComponent(album.id)}`),
          alt: () => void act.queueAlbum(album, 'last'),
        });
      }
      for (const song of data.song) {
        results.push({
          id: `so-${song.id}`,
          group: 'songs',
          title: song.title,
          subtitle: songArtist(song),
          art: { coverArt: song.coverArt, name: song.title },
          run: () => act.playSongs([song], 0, { kind: 'Search', name: debounced }),
          alt: () => act.addToQueue([song]),
        });
      }
    }
    // Library hits first once there are any: that is usually what a name means.
    return results.length && q.length > 2 ? [...results, ...matched] : [...matched, ...results];
  }, [commands, debounced, query, search.data]);

  useEffect(() => setActive(0), [query, items.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (command: Command | undefined, alt = false) => {
    if (!command) return;
    ui.closePalette();
    if (alt && command.alt) command.alt();
    else command.run();
  };

  let lastGroup = '';

  return createPortal(
    <div
      className="palette-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) ui.closePalette();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette__input">
          <span className="palette__prompt">&gt;</span>
          <input
            autoFocus
            value={query}
            placeholder="search the library, or type a command"
            aria-label="Command"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((i) => Math.min(items.length - 1, i + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                run(items[active], event.shiftKey);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                ui.closePalette();
              }
            }}
          />
          {search.loading && debounced.length >= 2 && <Spinner />}
          <kbd className="kbd">esc</kbd>
        </div>
        <div className="palette__list" ref={listRef} role="listbox">
          {items.length === 0 && <div className="palette__empty">no match for “{query}”</div>}
          {items.map((item, i) => {
            const heading = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {heading && <div className="palette__group label">{heading}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  className={`palette__item ${i === active ? 'is-active' : ''}`}
                  onPointerMove={() => setActive(i)}
                  onClick={(event) => run(item, event.shiftKey)}
                >
                  {item.art ? (
                    <Artwork coverArt={item.art.coverArt} name={item.art.name} size={30} round={item.art.round} className="palette__art" />
                  ) : (
                    <span className="palette__icon">{item.icon ?? <CommandIcon />}</span>
                  )}
                  <span className="palette__text">
                    <span className="palette__title truncate">{item.title}</span>
                    {item.subtitle && <span className="palette__sub truncate">{item.subtitle}</span>}
                  </span>
                  {item.hint && <span className="palette__hint">{item.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette__foot">
          <span>
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd> move
          </span>
          <span>
            <kbd className="kbd">↵</kbd> open / play
          </span>
          <span>
            <kbd className="kbd">⇧</kbd>
            <kbd className="kbd">↵</kbd> add to queue
          </span>
          <span className="palette__foot-end">
            <kbd className="kbd">{MOD}</kbd>
            <kbd className="kbd">K</kbd>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
