/**
 * Stats: what you have actually been listening to on this device.
 *
 * Built from the local listening log — Subsonic only keeps play counts — and
 * printed the way a piece of test equipment would: big dot-matrix numbers, a
 * grid of LEDs for every day, and bars.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Artwork } from '../components/Artwork';
import { Segmented } from '../components/controls';
import { FireIcon, PlayIcon, StatsIcon } from '../components/Icons';
import { Empty, Page, Section } from '../components/Page';
import { navigate } from '../lib/nav';
import { dayKey, songFromMeta, summarize, type StatsRange } from '../lib/stats';
import { useStatsVersion } from '../hooks/useData';
import * as act from '../state/actions';

/** One LED and its gap; the grid shows as many whole weeks as fit, within limits. */
const CELL_PITCH = 20;
const MIN_WEEKS = 8;
const MAX_WEEKS = 26;
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function hours(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(seconds < 36000 ? 1 : 0)}h`;
}

function Bars({ values, labels, highlight }: { values: number[]; labels: string[]; highlight?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="bars" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
      {values.map((value, i) => (
        <div key={i} className={`bars__col ${i === highlight ? 'is-now' : ''}`} title={`${labels[i]} · ${hours(value)}`}>
          <div className="bars__bar" style={{ height: `${Math.max(2, (value / max) * 100)}%` }} />
          <span className="bars__label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function Stats() {
  const version = useStatsVersion();
  const [range, setRange] = useState<StatsRange>('30d');
  const summary = useMemo(() => summarize(range, 10), [range, version]);
  const empty = summary.plays === 0 && Object.keys(summary.byDay).length === 0;

  // Fit the week grid to its box, so the newest weeks never fall off the edge.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [weeks, setWeeks] = useState(18);
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      setWeeks(Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, Math.floor((width + 4) / CELL_PITCH))));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [empty]);

  const heat = useMemo(() => {
    // Columns are weeks, rows are days, ending with today.
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
    const cells: { key: string; value: number; future: boolean; label: string }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < weeks * 7; i++) {
      const key = dayKey(cursor);
      cells.push({
        key,
        value: summary.byDay[key] ?? 0,
        future: cursor > today,
        label: cursor.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    const max = Math.max(1, ...cells.map((c) => c.value));
    return { cells, max };
  }, [summary.byDay, weeks]);

  const hourLabels = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? String(h).padStart(2, '0') : ''));
  const busiestHour = summary.byHour.indexOf(Math.max(...summary.byHour));
  const topSongs = summary.topSongs.map((entry) => songFromMeta(entry.id, entry.meta));

  return (
    <Page
      title="stats"
      eyebrow="this device"
      meta={summary.firstAt ? `since ${new Date(summary.firstAt * 1000).toLocaleDateString()}` : undefined}
      toolbar={
        <div className="toolbar">
          <Segmented<StatsRange>
            label="Range"
            mono
            value={range}
            onChange={setRange}
            options={[
              { value: '7d', label: '7d' },
              { value: '30d', label: '30d' },
              { value: '365d', label: '1y' },
              { value: 'all', label: 'all' },
            ]}
          />
        </div>
      }
    >
      {empty ? (
        <Empty icon={<StatsIcon />} title="nothing logged yet">
          A listen counts after thirty seconds, or half of a short track. Play something and come back.
        </Empty>
      ) : (
        <>
          <div className="readouts">
            <Readout value={summary.plays.toLocaleString()} label="listens" />
            <Readout value={hours(summary.seconds)} label="listened" />
            <Readout value={summary.uniqueArtists.toLocaleString()} label="artists" />
            <Readout value={summary.uniqueSongs.toLocaleString()} label="songs" />
            <Readout value={String(summary.streak)} label="day streak" icon={summary.streak > 1 ? <FireIcon /> : undefined} />
          </div>

          <Section index={1} title="every day" action={<span className="meta">last {weeks} weeks</span>}>
            <div className="heat">
              <div className="heat__days">
                {WEEKDAYS.map((d, i) => (
                  <span key={d}>{i % 2 === 0 ? d : ''}</span>
                ))}
              </div>
              <div ref={gridRef} className="heat__grid" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
                {heat.cells.map((cell) => {
                  const level = cell.value === 0 ? 0 : Math.min(4, Math.ceil((cell.value / heat.max) * 4));
                  return (
                    <span
                      key={cell.key}
                      className={`heat__cell heat__cell--${level} ${cell.future ? 'is-future' : ''}`}
                      title={`${cell.label} · ${hours(cell.value)}`}
                    />
                  );
                })}
              </div>
            </div>
          </Section>

          {summary.plays > 0 && (
            <>
              <div className="stats-split">
                <Section index={2} title="by hour">
                  <Bars values={summary.byHour} labels={hourLabels} highlight={busiestHour} />
                </Section>
                <Section index={3} title="by weekday">
                  <Bars values={summary.byWeekday} labels={WEEKDAYS} />
                </Section>
              </div>

              <Section
                index={4}
                title="top songs"
                action={
                  topSongs.length > 0 ? (
                    <button type="button" className="section__link" onClick={() => act.playSongs(topSongs, 0, { kind: 'Mix', name: 'top songs' })}>
                      <PlayIcon /> play these
                    </button>
                  ) : undefined
                }
              >
                <ol className="ranks">
                  {summary.topSongs.map((entry, i) => (
                    <li key={entry.id}>
                      <button type="button" className="rank" onClick={() => act.playSongs(topSongs, i, { kind: 'Mix', name: 'top songs' })}>
                        <span className="rank__n tnum">{String(i + 1).padStart(2, '0')}</span>
                        <Artwork coverArt={entry.meta.c} name={entry.meta.t} size={36} className="rank__art" />
                        <span className="rank__text">
                          <span className="rank__title truncate">{entry.meta.t}</span>
                          <span className="rank__sub truncate">{entry.meta.a}</span>
                        </span>
                        <span className="rank__bar">
                          <span style={{ transform: `scaleX(${entry.plays / (summary.topSongs[0]?.plays || 1)})` }} />
                        </span>
                        <span className="rank__count tnum">{entry.plays}×</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section index={5} title="top artists">
                <ol className="ranks">
                  {summary.topArtists.map((artist, i) => (
                    <li key={artist.id ?? artist.name}>
                      <button
                        type="button"
                        className="rank"
                        onClick={() => artist.id && navigate(`/artist/${encodeURIComponent(artist.id)}`)}
                      >
                        <span className="rank__n tnum">{String(i + 1).padStart(2, '0')}</span>
                        <Artwork coverArt={artist.coverArt} name={artist.name} size={36} round className="rank__art" />
                        <span className="rank__text">
                          <span className="rank__title truncate">{artist.name}</span>
                          <span className="rank__sub">{hours(artist.seconds)}</span>
                        </span>
                        <span className="rank__bar">
                          <span style={{ transform: `scaleX(${artist.plays / (summary.topArtists[0]?.plays || 1)})` }} />
                        </span>
                        <span className="rank__count tnum">{artist.plays}×</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section index={6} title="top albums">
                <div className="grid">
                  {summary.topAlbums.map((album) => (
                    <button key={album.id} type="button" className="card" onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}>
                      <div className="card__art-wrap">
                        <Artwork coverArt={album.coverArt} name={album.name} size={200} className="card__art" />
                        <span className="card__badge tnum">{album.plays}×</span>
                      </div>
                      <div className="card__meta">
                        <div className="card__title clamp-2">{album.name}</div>
                        <div className="card__sub truncate">{album.artist}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>

              {summary.topGenres.length > 0 && (
                <Section index={7} title="genres">
                  <div className="chips">
                    {summary.topGenres.map((genre) => (
                      <button key={genre.name} type="button" className="chip" onClick={() => navigate(`/genre/${encodeURIComponent(genre.name)}`)}>
                        {genre.name} <span className="chip__count">{genre.plays}</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
}

function Readout({ value, label, icon }: { value: string; label: string; icon?: JSX.Element }) {
  return (
    <div className="readout-card">
      <div className="readout-card__value">{value}</div>
      <div className="readout-card__label label">
        {icon}
        {label}
      </div>
    </div>
  );
}
