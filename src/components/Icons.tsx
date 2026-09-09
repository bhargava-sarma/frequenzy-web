/**
 * The icon set.
 *
 * Drawn in the spirit of SF Symbols: one 24×24 grid, one stroke weight, round
 * joins, and a shared optical centre so a row of them lines up. Strokes are
 * deliberately light — an icon here labels a control, it never competes with
 * the artwork or the type next to it. Only the transport glyphs are filled,
 * because those are the ones you aim at without reading.
 *
 * Every glyph draws in `currentColor`, so weight and tone are decided by the
 * button that owns it rather than baked in here.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** The house stroke. Anything heavier starts to shout at 17px. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** For the few glyphs that are pure geometry — chevrons, plus, close. */
const bold = { ...stroke, strokeWidth: 1.7 };

function Svg({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ transport */

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M8.6 6.1v11.8c0 .84.93 1.35 1.64.9l9.2-5.9a1.06 1.06 0 0 0 0-1.8l-9.2-5.9a1.06 1.06 0 0 0-1.64.9Z"
      fill="currentColor"
    />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7.1" y="5.4" width="3.6" height="13.2" rx="1.5" fill="currentColor" />
    <rect x="13.3" y="5.4" width="3.6" height="13.2" rx="1.5" fill="currentColor" />
  </Svg>
);

export const NextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.8 7v10c0 .78.86 1.25 1.5.82l7.4-5a1 1 0 0 0 0-1.64l-7.4-5A1 1 0 0 0 4.8 7Z" fill="currentColor" />
    <rect x="16.6" y="6.2" width="2.3" height="11.6" rx="1.15" fill="currentColor" />
  </Svg>
);

export const PreviousIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.2 7v10c0 .78-.86 1.25-1.5.82l-7.4-5a1 1 0 0 1 0-1.64l7.4-5a1 1 0 0 1 1.5.82Z" fill="currentColor" />
    <rect x="5.1" y="6.2" width="2.3" height="11.6" rx="1.15" fill="currentColor" />
  </Svg>
);

export const ShuffleIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M3.5 7h2.6c1.15 0 2.22.58 2.86 1.54l4.08 6.12A3.43 3.43 0 0 0 15.9 17h4.6" />
      <path d="M3.5 17h2.6c1.15 0 2.22-.58 2.86-1.54" />
      <path d="M15.9 7h4.6" />
      <path d="m18.4 4.7 2.3 2.3-2.3 2.3M18.4 14.7l2.3 2.3-2.3 2.3" />
    </g>
  </Svg>
);

export const RepeatIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M7.4 5.6h8.4a3.6 3.6 0 0 1 3.6 3.6v1.2" />
      <path d="m16.9 3.2 2.4 2.4-2.4 2.4" />
      <path d="M16.6 18.4H8.2a3.6 3.6 0 0 1-3.6-3.6v-1.2" />
      <path d="m7.1 20.8-2.4-2.4 2.4-2.4" />
    </g>
  </Svg>
);

export const RepeatOneIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M7.4 5.6h8.4a3.6 3.6 0 0 1 3.6 3.6v1.2" />
      <path d="m16.9 3.2 2.4 2.4-2.4 2.4" />
      <path d="M16.6 18.4H8.2a3.6 3.6 0 0 1-3.6-3.6v-1.2" />
      <path d="m7.1 20.8-2.4-2.4 2.4-2.4" />
      <path d="M11.1 10.4 12.6 9.5v5.2" />
    </g>
  </Svg>
);

/* --------------------------------------------------------------------- volume */

/** One speaker body, shared by all three states so they never jump. */
const speaker = (
  <path
    d="M11 5.6 7.4 8.6H4.9a1 1 0 0 0-1 1v4.8a1 1 0 0 0 1 1h2.5l3.6 3c.65.55 1.65.09 1.65-.77V6.37c0-.86-1-1.32-1.65-.77Z"
    fill="currentColor"
  />
);

export const VolumeHighIcon = (p: IconProps) => (
  <Svg {...p}>
    {speaker}
    <g {...stroke}>
      <path d="M16.4 9.5a3.6 3.6 0 0 1 0 5" />
      <path d="M18.9 7.2a7 7 0 0 1 0 9.6" />
    </g>
  </Svg>
);

export const VolumeLowIcon = (p: IconProps) => (
  <Svg {...p}>
    {speaker}
    <path d="M16.4 9.5a3.6 3.6 0 0 1 0 5" {...stroke} />
  </Svg>
);

export const VolumeMuteIcon = (p: IconProps) => (
  <Svg {...p}>
    {speaker}
    <path d="m16.4 9.8 4.2 4.4M20.6 9.8l-4.2 4.4" {...stroke} />
  </Svg>
);

/* ---------------------------------------------------------------------- lists */

/** Lyrics: a quote bubble, so it never reads as another list. */
export const LyricsIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4.6 6.4a2 2 0 0 1 2-2h10.8a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2h-6.3L7 19.4v-3.6H6.6a2 2 0 0 1-2-2Z" />
      <path d="M8.6 8.9h6.8M8.6 12h4.4" />
    </g>
  </Svg>
);

/** Playing Next: a list with a note riding along at the end. */
export const QueueIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4 6.6h10M4 11h10M4 15.4h6.4" />
      <path d="M17.6 16.2V8l3.4-.9" />
      <circle cx="15.9" cy="17" r="1.7" />
    </g>
  </Svg>
);

/** Play Next: the triangle sits against the first line — it jumps the queue. */
export const PlayNextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.2 5.1v3.6c0 .55.61.88 1.07.58l2.8-1.8a.69.69 0 0 0 0-1.16l-2.8-1.8a.69.69 0 0 0-1.07.58Z" fill="currentColor" />
    <g {...stroke}>
      <path d="M10.6 6.9h9.4M4 12.4h16M4 17.6h16" />
    </g>
  </Svg>
);

/** Add to Queue: same glyph, triangle against the last line — it waits its turn. */
export const AddToQueueIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4 6.4h16M4 11.6h16M10.6 17.1h9.4" />
    </g>
    <path d="M4.2 15.3v3.6c0 .55.61.88 1.07.58l2.8-1.8a.69.69 0 0 0 0-1.16l-2.8-1.8a.69.69 0 0 0-1.07.58Z" fill="currentColor" />
  </Svg>
);

/** Playlists are a stack of things, not another list of lines. */
export const PlaylistIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <rect x="4" y="8.6" width="16" height="11.4" rx="2.4" />
      <path d="M6.4 5.8h11.2M8.2 3.4h7.6" />
      <path d="M10.6 16.2v-4.1l3.4 2.05Z" fill="currentColor" strokeWidth="1.2" />
    </g>
  </Svg>
);

/* ------------------------------------------------------------------ navigation */

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="10.9" cy="10.9" r="6.4" />
      <path d="m15.7 15.7 3.8 3.8" />
    </g>
  </Svg>
);

export const ListenNowIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M10.4 9.3v5.4l4.4-2.7Z" fill="currentColor" strokeWidth="1.2" />
    </g>
  </Svg>
);

export const BrowseIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <rect x="3.9" y="3.9" width="7" height="7" rx="2.1" />
      <rect x="13.1" y="3.9" width="7" height="7" rx="2.1" />
      <rect x="3.9" y="13.1" width="7" height="7" rx="2.1" />
      <rect x="13.1" y="13.1" width="7" height="7" rx="2.1" />
    </g>
  </Svg>
);

export const RadioIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="1.9" />
      <path d="M8.4 8.4a5.1 5.1 0 0 0 0 7.2M15.6 15.6a5.1 5.1 0 0 0 0-7.2" />
      <path d="M5.7 5.7a8.9 8.9 0 0 0 0 12.6M18.3 18.3a8.9 8.9 0 0 0 0-12.6" />
    </g>
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.6V12l3 1.8" />
    </g>
  </Svg>
);

export const ArtistIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="8.6" r="3.6" />
      <path d="M5.4 19.6a6.6 6.6 0 0 1 13.2 0" />
    </g>
  </Svg>
);

export const AlbumIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="2.2" />
    </g>
  </Svg>
);

export const NoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M9.6 17V6.2l8.8-2.2V14.8" />
      <circle cx="7.2" cy="17.4" r="2.5" />
      <circle cx="16" cy="15.2" r="2.5" />
    </g>
  </Svg>
);

/** Genres get a waveform: no other glyph in the set is vertical. */
export const GenreIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4.4 10.4v3.2M8.2 7.4v9.2M12 4.8v14.4M15.8 8.4v7.2M19.6 10.8v2.4" />
    </g>
  </Svg>
);

/* ------------------------------------------------------------------- symbols */

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="M12 19.9C9.5 18.2 4.6 14.6 4.6 10.7A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.4 2.7c0 3.9-4.9 7.5-7.4 9.2Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
);

export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="m12 4.4 2.32 4.7 5.18.75-3.75 3.66.89 5.17L12 16.24l-4.64 2.44.89-5.17L4.5 9.85l5.18-.75Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
);

export const EllipsisIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.6" cy="12" r="1.6" fill="currentColor" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <circle cx="18.4" cy="12" r="1.6" fill="currentColor" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="M14.4 5.6 8 12l6.4 6.4" {...bold} /></Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9.6 5.6 16 12l-6.4 6.4" {...bold} /></Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5.6 9.6 12 16l6.4-6.4" {...bold} /></Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 5.2v13.6M5.2 12h13.6" {...bold} /></Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="m5 12.4 4.6 4.6L19 7.2" {...bold} /></Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}><path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6" {...bold} /></Svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M12 4.2v10.2" />
      <path d="m7.9 10.6 4.1 4.1 4.1-4.1" />
      <path d="M4.8 16.8v1.4a1.8 1.8 0 0 0 1.8 1.8h10.8a1.8 1.8 0 0 0 1.8-1.8v-1.4" />
    </g>
  </Svg>
);

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11.2v5" />
      <circle cx="12" cy="8.1" r=".85" fill="currentColor" stroke="none" />
    </g>
  </Svg>
);

/** Sliders rather than a gear: a 12-tooth cog turns to mush at 17px. */
export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4 8.2h3.4M12.2 8.2H20" />
      <path d="M4 15.8h7.8M16.6 15.8H20" />
      <circle cx="9.8" cy="8.2" r="2.4" />
      <circle cx="14.2" cy="15.8" r="2.4" />
    </g>
  </Svg>
);

export const GripIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}><path d="M9 8.4h6M9 12h6M9 15.6h6" /></g>
  </Svg>
);

export const WifiIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M3 9a13.6 13.6 0 0 1 18 0" />
      <path d="M6.2 12.4a9 9 0 0 1 11.6 0" />
      <path d="M9.5 15.8a4.2 4.2 0 0 1 5 0" />
      <circle cx="12" cy="19" r=".9" fill="currentColor" stroke="none" />
    </g>
  </Svg>
);

export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.9 12h16.2" />
      <path d="M12 3.8a12.6 12.6 0 0 1 0 16.4 12.6 12.6 0 0 1 0-16.4Z" />
    </g>
  </Svg>
);

export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.2 4.2 12.7 9l4.8 1.5-4.8 1.5-1.5 4.8-1.5-4.8L4.9 10.5 9.7 9Z" fill="currentColor" />
    <path d="m18.4 14.4.75 2.25 2.25.75-2.25.75-.75 2.25-.75-2.25-2.25-.75 2.25-.75Z" fill="currentColor" opacity=".55" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4.8 6.8h14.4" />
      <path d="M9.6 6.8V5.6a1.4 1.4 0 0 1 1.4-1.4h2a1.4 1.4 0 0 1 1.4 1.4v1.2" />
      <path d="M6.9 6.8 7.6 18.6a1.4 1.4 0 0 0 1.4 1.3h6a1.4 1.4 0 0 0 1.4-1.3l.7-11.8" />
      <path d="M10.6 10.2v6M13.4 10.2v6" opacity=".55" />
    </g>
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M15.8 5 19 8.2 8.7 18.5 4.8 19.2l.7-3.9Z" />
      <path d="m13.9 6.9 3.2 3.2" />
    </g>
  </Svg>
);

export const LanguageIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M3.6 6.4h7.6M7.4 4.6v1.8" />
      <path d="M9.6 6.4c0 3.4-2.5 6.4-6 7.6" />
      <path d="M5.2 9.9c1.1 2 2.9 3.4 5 4.2" />
      <path d="m12.6 19.8 3.5-8.4 3.5 8.4" />
      <path d="M13.8 17.2h4.6" />
    </g>
  </Svg>
);

export const InfinityIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M8.5 8.8a3.2 3.2 0 1 0 0 6.4c1.4 0 2.35-.95 3.5-2.35C13.15 11.45 14.1 10.5 15.5 10.5a3.2 3.2 0 1 1 0 6.4c-1.4 0-2.35-.95-3.5-2.35-1.15-1.4-2.1-2.35-3.5-2.35Z"
      {...stroke}
    />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.6 14.4A8.2 8.2 0 0 1 9.6 4.4a8.2 8.2 0 1 0 10 10Z" {...stroke} />
  </Svg>
);

export const SortIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4.8 7h14.4M6.8 12h10.4M9.4 17h5.2" />
    </g>
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <rect x="4.2" y="4.2" width="6.4" height="6.4" rx="1.7" />
      <rect x="13.4" y="4.2" width="6.4" height="6.4" rx="1.7" />
      <rect x="4.2" y="13.4" width="6.4" height="6.4" rx="1.7" />
      <rect x="13.4" y="13.4" width="6.4" height="6.4" rx="1.7" />
    </g>
  </Svg>
);

export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M8.8 6.6h10.6M8.8 12h10.6M8.8 17.4h10.6" />
      <circle cx="5" cy="6.6" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17.4" r="1" fill="currentColor" stroke="none" />
    </g>
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M12 4v10.6" />
      <path d="m8.4 7.4 3.6-3.4 3.6 3.4" />
      <path d="M5.6 12.8v5.8a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6v-5.8" />
    </g>
  </Svg>
);

export const HistoryIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M3.8 4.8v3.9h3.9" />
      <path d="M12 7.8V12l2.9 1.7" />
    </g>
  </Svg>
);

export const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.2 6.4h15.6l-6.1 7v5l-3.4 1.7v-6.7z" {...stroke} />
  </Svg>
);
