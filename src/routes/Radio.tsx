/**
 * Stations.
 *
 * Without a streaming catalogue there is nothing to license, so a station here
 * is simply an endless shuffle over a slice of your own library — by genre, by
 * decade, or across everything.
 */

import { useNavigate } from 'react-router-dom';

import { Page } from '../components/Page';
import { PlayIcon, RadioIcon } from '../components/Icons';
import { getGenres, getRandomSongs, getStarred } from '../lib/subsonic';
import { hashHue } from '../lib/format';
import { useAsync } from '../hooks/useAsync';
import { usePlayer } from '../state/player';

interface Station {
  id: string;
  name: string;
  description: string;
  load: () => Promise<import('../lib/types').Song[]>;
}

export function Radio({ onMenuClick }: { onMenuClick?: () => void }) {
  const { actions } = usePlayer();
  const navigate = useNavigate();
  const genres = useAsync((signal) => getGenres(signal), []);

  const stations: Station[] = [
    {
      id: 'everything',
      name: 'Everything',
      description: 'A shuffle across your whole library',
      load: () => getRandomSongs({ size: 200 }),
    },
    {
      id: 'favourites',
      name: 'Favourites',
      description: 'Only the tracks you have hearted',
      load: async () => {
        const starred = await getStarred();
        return [...starred.song].sort(() => Math.random() - 0.5);
      },
    },
    {
      id: 'nineties',
      name: 'The Nineties',
      description: 'Everything released between 1990 and 1999',
      load: () => getRandomSongs({ size: 200, fromYear: 1990, toYear: 1999 }),
    },
    {
      id: 'noughties',
      name: 'The Two-Thousands',
      description: 'Everything released between 2000 and 2009',
      load: () => getRandomSongs({ size: 200, fromYear: 2000, toYear: 2009 }),
    },
    ...(genres.data ?? [])
      .filter((g) => (g.songCount ?? 0) > 12)
      .sort((a, b) => (b.songCount ?? 0) - (a.songCount ?? 0))
      .slice(0, 18)
      .map((genre) => ({
        id: `genre-${genre.value}`,
        name: genre.value,
        description: `${genre.songCount?.toLocaleString()} songs`,
        load: () => getRandomSongs({ size: 200, genre: genre.value }),
      })),
  ];

  const play = async (station: Station) => {
    const songs = await station.load();
    if (songs.length) actions.playQueue(songs, 0, { kind: 'Station', name: station.name });
  };

  return (
    <Page title="Stations" subtitle="Endless shuffles built from your own library." onMenuClick={onMenuClick}>
      <div className="fz-grid fz-stagger">
        {stations.map((station) => (
          <button
            key={station.id}
            type="button"
            className="fz-card"
            onClick={() => void play(station)}
            onDoubleClick={() => navigate('/browse')}
          >
            <div
              className="fz-card__art fz-art"
              style={{
                background: `linear-gradient(150deg, hsl(${hashHue(station.name)} 72% 52%), hsl(${(hashHue(station.name) + 48) % 360} 68% 34%))`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <RadioIcon style={{ width: 42, height: 42, color: 'rgba(255,255,255,0.9)' }} />
              <span className="fz-play-overlay" aria-hidden="true"><PlayIcon /></span>
            </div>
            <div>
              <div className="fz-card__title fz-truncate">{station.name}</div>
              <div className="fz-card__subtitle fz-truncate">{station.description}</div>
            </div>
          </button>
        ))}
      </div>
    </Page>
  );
}
