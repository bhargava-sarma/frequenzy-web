/** Home: what you have been playing, what is new, and a few ways to start. */

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';

import { AlbumCard, ArtistCard, Shelf, SkeletonCards } from '../components/Cards';
import { Artwork } from '../components/Artwork';
import { DiceIcon, PlayIcon, RadioIcon, ShuffleIcon, SparkleIcon } from '../components/Icons';
import { Empty, Page, Section } from '../components/Page';
import { formatTime, songArtist } from '../lib/format';
import { navigate } from '../lib/nav';
import { useAlbumList, useStarredItems } from '../lib/queries';
import { onRepeat, songFromMeta } from '../lib/stats';
import type { Album } from '../lib/types';
import { useHistory, useStatsVersion } from '../hooks/useData';
import { useConnection } from '../hooks/useConnection';
import * as act from '../state/actions';
import { player, usePlayer } from '../state/player';

function greeting(hour: number): string {
  if (hour < 5) return 'good night';
  if (hour < 12) return 'good morning';
  if (hour < 18) return 'good afternoon';
  return 'good evening';
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const handle = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(handle);
  }, []);
  return now;
}

export function Home() {
  const now = useNow();
  const connection = useConnection();
  const recent = useAlbumList('recent', { size: 18 });
  const newest = useAlbumList('newest', { size: 18 });
  const frequent = useAlbumList('frequent', { size: 18 });
  const random = useAlbumList('random', { size: 18 }, 30 * 60_000);
  const starred = useStarredItems();
  const history = useHistory();
  const statsVersion = useStatsVersion();
  const repeat = useMemo(() => onRepeat(30, 12), [statsVersion]);
  const hasQueue = usePlayer((s) => s.queue.length > 0);
  const playing = usePlayer((s) => s.playing);
  const current = usePlayer((s) => s.current);

  const empty =
    !recent.loading && !newest.loading && (recent.data?.length ?? 0) === 0 && (newest.data?.length ?? 0) === 0 && !newest.error;

  const seed = current ?? history[0]?.song;
  const dateLine = now
    .toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
    .toLowerCase();
  const clock = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  // Sections are numbered as they appear, so a missing one leaves no gap.
  const sections: { key: string; render: (index: number) => ReactNode }[] = [];
  const visible = (state: { data?: unknown[]; loading: boolean }) => state.loading || (state.data?.length ?? 0) > 0;

  if (visible(recent)) {
    sections.push({ key: 'recent', render: (i) => <AlbumShelf index={i} title="recently played" state={recent} link="/library/albums?sort=recent" /> });
  }
  if (repeat.length > 0) {
    sections.push({
      key: 'repeat',
      render: (i) => (
        <Section index={i} title="on repeat" action={<span className="meta">last 30 days</span>}>
          <div className="songtiles">
            {repeat.map((entry, n) => {
              const song = songFromMeta(entry.id, entry.meta);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="songtile"
                  onClick={() => act.playSongs(repeat.map((r) => songFromMeta(r.id, r.meta)), n, { kind: 'Mix', name: 'on repeat' })}
                >
                  <Artwork coverArt={song.coverArt} name={song.title} size={44} className="songtile__art" />
                  <span className="songtile__text">
                    <span className="songtile__title truncate">{song.title}</span>
                    <span className="songtile__sub truncate">{songArtist(song)}</span>
                  </span>
                  <span className="songtile__count tnum">×{entry.plays}</span>
                </button>
              );
            })}
          </div>
        </Section>
      ),
    });
  }
  if (visible(newest)) {
    sections.push({ key: 'newest', render: (i) => <AlbumShelf index={i} title="recently added" state={newest} link="/library/recent" /> });
  }
  if ((starred.data?.album.length ?? 0) > 0) {
    sections.push({
      key: 'fav-albums',
      render: (i) => (
        <Section index={i} title="favourite albums" action={<SeeAll to="/library/favourites?tab=albums" />}>
          <Shelf>
            {starred.data!.album.slice(0, 18).map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </Shelf>
        </Section>
      ),
    });
  }
  if ((starred.data?.artist.length ?? 0) > 0) {
    sections.push({
      key: 'fav-artists',
      render: (i) => (
        <Section index={i} title="favourite artists" action={<SeeAll to="/library/favourites?tab=artists" />}>
          <Shelf>
            {starred.data!.artist.slice(0, 18).map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </Shelf>
        </Section>
      ),
    });
  }
  if (visible(frequent)) {
    sections.push({ key: 'frequent', render: (i) => <AlbumShelf index={i} title="most played" state={frequent} link="/library/albums?sort=frequent" /> });
  }
  if (visible(random)) {
    sections.push({
      key: 'random',
      render: (i) => (
        <Section
          index={i}
          title="rediscover"
          action={
            <button type="button" className="section__link" onClick={() => void random.reload()}>
              <DiceIcon /> reshuffle
            </button>
          }
        >
          <Shelf>{random.loading ? <SkeletonCards /> : (random.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}</Shelf>
        </Section>
      ),
    });
  }
  if (history.length > 0) {
    sections.push({
      key: 'history',
      render: (i) => (
        <Section index={i} title="history on this device" action={<SeeAll to="/library/history" />}>
          <div className="songtiles">
            {history.slice(0, 8).map((entry, n) => (
              <button
                key={entry.song.id}
                type="button"
                className="songtile"
                onClick={() =>
                  act.playSongs(history.slice(0, 50).map((e) => e.song), n, { kind: 'Library', name: 'history', route: '/library/history' })
                }
              >
                <Artwork coverArt={entry.song.coverArt} name={entry.song.title} size={44} className="songtile__art" />
                <span className="songtile__text">
                  <span className="songtile__title truncate">{entry.song.title}</span>
                  <span className="songtile__sub truncate">{songArtist(entry.song)}</span>
                </span>
                <span className="songtile__count tnum">{formatTime(entry.song.duration)}</span>
              </button>
            ))}
          </div>
        </Section>
      ),
    });
  }

  return (
    <Page
      root
      title={greeting(now.getHours())}
      onRefresh={() => Promise.all([recent.reload(), newest.reload(), frequent.reload(), random.reload(), starred.reload()])}
      head={
        <div className="home-head">
          <div className="home-head__line meta">
            <span>{dateLine}</span>
            <span className="tnum">{clock}</span>
            <span className="home-head__net">
              <span className={`led is-on ${connection.status === 'online' ? 'led--green' : connection.status === 'offline' ? 'led--red' : 'led--yellow'}`} />
              {connection.status === 'online' ? connection.label : connection.status === 'offline' ? 'offline' : 'connecting'}
            </span>
          </div>
          <h1 className="page-head__title">{greeting(now.getHours())}</h1>
          <div className="home-keys">
            <button type="button" className="key key--orange key--lg" onClick={() => void act.shuffleLibrary()}>
              <ShuffleIcon /> shuffle all
            </button>
            <button type="button" className="key key--blue key--lg" onClick={() => void act.playRandomAlbum()}>
              <DiceIcon /> random album
            </button>
            <button
              type="button"
              className="key key--green key--lg"
              onClick={() =>
                seed && !seed.isRadio
                  ? void act.startRadio({ kind: 'song', id: seed.id, name: seed.title, genre: seed.genre, song: seed })
                  : navigate('/radio')
              }
            >
              <RadioIcon /> {seed && !seed.isRadio ? 'station' : 'radio'}
            </button>
            {hasQueue && !playing && (
              <button type="button" className="key key--yellow key--lg" onClick={() => player.resume()}>
                <PlayIcon /> resume
              </button>
            )}
          </div>
        </div>
      }
    >
      {empty && (
        <Empty icon={<SparkleIcon />} title="the library is empty">
          Point Navidrome at your music folder and run a scan — it is under settings → library.
        </Empty>
      )}

      {sections.map((section, i) => (
        <Fragment key={section.key}>{section.render(i + 1)}</Fragment>
      ))}
    </Page>
  );
}

export function SeeAll({ to, label = 'see all' }: { to: string; label?: string }) {
  return (
    <button type="button" className="section__link" onClick={() => navigate(to)}>
      {label} →
    </button>
  );
}

function AlbumShelf({
  index, title, state, link,
}: {
  index: number;
  title: string;
  state: { data?: Album[]; loading: boolean };
  link: string;
}) {
  if (!state.loading && (state.data?.length ?? 0) === 0) return null;
  return (
    <Section index={index} title={title} action={<SeeAll to={link} />}>
      <Shelf>{state.loading ? <SkeletonCards /> : (state.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}</Shelf>
    </Section>
  );
}
