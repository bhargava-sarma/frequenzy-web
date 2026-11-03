/**
 * Radio.
 *
 * Internet stations from the server, mixes built from your own library — by
 * decade, by genre, or across everything — and stations seeded from any
 * artist or track, which pick similar music for as long as you let them.
 */

import { ArtistCard, Shelf, Tile } from '../components/Cards';
import { HeartIcon, PlayIcon, RadioIcon, ShuffleIcon, SparkleIcon, WaveIcon } from '../components/Icons';
import { Empty, Page, Section } from '../components/Page';
import { getRandomSongs, getStarred } from '../lib/subsonic';
import { useGenres, useRadioStations, useStarredItems } from '../lib/queries';
import { shuffled } from '../lib/song';
import type { Song } from '../lib/types';
import * as act from '../state/actions';
import { player, usePlayer } from '../state/player';
import { ui } from '../state/ui';

interface Mix {
  id: string;
  name: string;
  description: string;
  colour?: 'orange' | 'blue' | 'green' | 'yellow' | 'grey' | 'red' | 'pink' | 'ink';
  icon?: JSX.Element;
  load: () => Promise<Song[]>;
}

const DECADES: [number, string][] = [
  [1960, 'sixties'],
  [1970, 'seventies'],
  [1980, 'eighties'],
  [1990, 'nineties'],
  [2000, 'two-thousands'],
  [2010, 'twenty-tens'],
  [2020, 'twenty-twenties'],
];

async function playMix(mix: Mix) {
  ui.toast(`tuning in — ${mix.name}`);
  try {
    const songs = await mix.load();
    if (songs.length === 0) {
      ui.toast(`nothing for ${mix.name} in your library`);
      return;
    }
    act.playSongs(songs, 0, { kind: 'Station', name: mix.name, route: '/radio' }, { shuffle: false });
  } catch {
    ui.error("couldn't start the station");
  }
}

export function Radio() {
  const stations = useRadioStations();
  const genres = useGenres();
  const starred = useStarredItems();
  const current = usePlayer((s) => s.current);
  const playingRadio = usePlayer((s) => (s.current?.isRadio ? s.current.id : null));

  const mixes: Mix[] = [
    { id: 'all', name: 'everything', description: 'a shuffle across the whole library', colour: 'orange', icon: <ShuffleIcon />, load: () => getRandomSongs({ size: 300 }) },
    {
      id: 'favs',
      name: 'favourites',
      description: 'only what you have hearted',
      colour: 'red',
      icon: <HeartIcon />,
      load: async () => shuffled((await getStarred()).song),
    },
    ...DECADES.map(([year, name], i) => ({
      id: `decade-${year}`,
      name,
      description: `${year}–${year + 9}`,
      colour: (['blue', 'green', 'yellow', 'grey', 'ink', 'pink', 'orange'] as const)[i % 7],
      load: () => getRandomSongs({ size: 200, fromYear: year, toYear: year + 9 }),
    })),
  ];

  const genreMixes: Mix[] = (genres.data ?? [])
    .filter((g) => (g.songCount ?? 0) >= 10)
    .sort((a, b) => (b.songCount ?? 0) - (a.songCount ?? 0))
    .slice(0, 16)
    .map((genre) => ({
      id: `genre-${genre.value}`,
      name: genre.value,
      description: `${(genre.songCount ?? 0).toLocaleString()} songs`,
      load: () => getRandomSongs({ size: 200, genre: genre.value }),
    }));

  return (
    <Page root title="radio" eyebrow="stations" onRefresh={() => Promise.all([stations.reload(), genres.reload(), starred.reload()])}>
      {current && !current.isRadio && (
        <div className="radio-seed">
          <span className="led is-on" />
          <span className="radio-seed__text truncate">
            start a station from <b>{current.title}</b>
          </span>
          <button
            type="button"
            className="key key--primary key--sm"
            onClick={() => void act.startRadio({ kind: 'song', id: current.id, name: current.title, genre: current.genre, song: current })}
          >
            <RadioIcon /> tune in
          </button>
        </div>
      )}

      <Section index={1} title="internet radio">
        {stations.loading ? (
          <div className="skeleton" style={{ height: 56 }} />
        ) : (stations.data?.length ?? 0) === 0 ? (
          <Empty icon={<RadioIcon />} title="no stations yet">
            Add internet radio stations in Navidrome (settings → radio stations) and they appear here.
          </Empty>
        ) : (
          <div className="stations">
            {stations.data!.map((station, i) => {
              const live = playingRadio === `radio:${station.id}`;
              return (
                <div key={station.id} className={`station ${live ? 'is-live' : ''}`}>
                  <span className="station__num tnum">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`led ${live ? 'is-on is-blinking' : ''}`} />
                  <span className="station__text">
                    <span className="station__name truncate">{station.name}</span>
                    <span className="station__url truncate">{station.homePageUrl ?? station.streamUrl}</span>
                  </span>
                  <button
                    type="button"
                    className={`key key--sm ${live ? '' : 'key--primary'}`}
                    onClick={() => (live ? player.toggle() : player.playStation(station))}
                  >
                    {live ? <WaveIcon /> : <PlayIcon />} {live ? 'on air' : 'listen'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section index={2} title="mixes">
        <div className="tiles">
          {mixes.map((mix, i) => (
            <Tile
              key={mix.id}
              index={i + 1}
              title={mix.name}
              subtitle={mix.description}
              colour={mix.colour}
              icon={mix.icon ?? <SparkleIcon />}
              onClick={() => void playMix(mix)}
            />
          ))}
        </div>
      </Section>

      {genreMixes.length > 0 && (
        <Section index={3} title="genre stations">
          <div className="tiles">
            {genreMixes.map((mix, i) => (
              <Tile key={mix.id} index={i + 1} title={mix.name} subtitle={mix.description} onClick={() => void playMix(mix)} />
            ))}
          </div>
        </Section>
      )}

      {(starred.data?.artist.length ?? 0) > 0 && (
        <Section index={genreMixes.length > 0 ? 4 : 3} title="artist stations" action={<span className="meta">similar music, endlessly</span>}>
          <Shelf>
            {starred.data!.artist.slice(0, 18).map((artist) => (
              <div key={artist.id} className="artist-station">
                <ArtistCard artist={artist} />
                <button
                  type="button"
                  className="key key--sm artist-station__go"
                  onClick={() => void act.startRadio({ kind: 'artist', id: artist.id, name: artist.name })}
                >
                  <RadioIcon /> station
                </button>
              </div>
            ))}
          </Shelf>
        </Section>
      )}
    </Page>
  );
}
