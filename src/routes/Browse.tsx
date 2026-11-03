/** Browse the whole library by release, decade and genre. */

import { useState } from 'react';

import { AlbumCard, Grid, Shelf, SkeletonCards, Tile } from '../components/Cards';
import { Segmented } from '../components/controls';
import { DiceIcon } from '../components/Icons';
import { Page, Section } from '../components/Page';
import { navigate } from '../lib/nav';
import { useAlbumList, useGenres } from '../lib/queries';
import * as act from '../state/actions';
import { SeeAll } from './Home';

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950];

export function Browse() {
  const newest = useAlbumList('newest', { size: 20 });
  const highest = useAlbumList('highest', { size: 20 });
  const random = useAlbumList('random', { size: 12 }, 30 * 60_000);
  const genres = useGenres();
  const [decade, setDecade] = useState<number>(() => {
    try {
      return Number(sessionStorage.getItem('frequenzy.decade')) || 2010;
    } catch {
      return 2010;
    }
  });
  const byDecade = useAlbumList('byYear', { size: 40, fromYear: decade, toYear: decade + 9 });

  const topGenres = (genres.data ?? [])
    .filter((g) => (g.albumCount ?? 0) > 0)
    .sort((a, b) => (b.albumCount ?? 0) - (a.albumCount ?? 0))
    .slice(0, 24);

  return (
    <Page
      root
      title="browse"
      eyebrow="the whole library"
      onRefresh={() => Promise.all([newest.reload(), highest.reload(), random.reload(), genres.reload(), byDecade.reload()])}
    >
      <Section index={1} title="new releases" action={<SeeAll to="/library/recent" />}>
        <Shelf>{newest.loading ? <SkeletonCards /> : (newest.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}</Shelf>
      </Section>

      {(highest.loading || (highest.data?.length ?? 0) > 0) && (
        <Section index={2} title="top rated" action={<SeeAll to="/library/albums?sort=highest" />}>
          <Shelf>{highest.loading ? <SkeletonCards /> : (highest.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}</Shelf>
        </Section>
      )}

      <Section index={3} title="by decade">
        <div className="scroll-x">
          <Segmented
            label="Decade"
            mono
            value={String(decade)}
            onChange={(value) => {
              setDecade(Number(value));
              try {
                sessionStorage.setItem('frequenzy.decade', value);
              } catch {
                /* ignore */
              }
            }}
            options={DECADES.map((year) => ({ value: String(year), label: `${year}s` }))}
          />
        </div>
        {byDecade.loading ? (
          <Grid>
            <SkeletonCards count={6} />
          </Grid>
        ) : (byDecade.data?.length ?? 0) === 0 ? (
          <div className="tracks-empty">nothing from the {decade}s in your library</div>
        ) : (
          <Shelf>
            {(byDecade.data ?? []).map((album) => (
              <AlbumCard key={album.id} album={album} subtitle={album.year ? `${album.artist ?? ''} · ${album.year}` : undefined} />
            ))}
          </Shelf>
        )}
      </Section>

      <Section index={4} title="genres" action={<SeeAll to="/library/genres" />}>
        <div className="tiles">
          {topGenres.map((genre, i) => (
            <Tile
              key={genre.value}
              index={i + 1}
              title={genre.value}
              subtitle={`${genre.albumCount ?? 0} albums · ${genre.songCount ?? 0} songs`}
              onClick={() => navigate(`/genre/${encodeURIComponent(genre.value)}`)}
            />
          ))}
        </div>
      </Section>

      <Section
        index={5}
        title="something random"
        action={
          <button type="button" className="section__link" onClick={() => void random.reload()}>
            <DiceIcon /> reshuffle
          </button>
        }
      >
        <Grid>
          {random.loading ? <SkeletonCards count={6} /> : (random.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
        </Grid>
        <div className="section__foot">
          <button type="button" className="key" onClick={() => void act.openRandomAlbum()}>
            <DiceIcon /> open a random album
          </button>
        </div>
      </Section>
    </Page>
  );
}
