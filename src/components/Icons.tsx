/**
 * The icon set.
 *
 * Drawn the way the labels on a piece of hardware are printed: one 24×24 grid,
 * one stroke weight, round ends, simple geometry and nothing decorative. Only
 * the transport glyphs are solid, because those are the ones you aim at
 * without reading. Every glyph draws in `currentColor`; the control that owns
 * it decides its colour and weight.
 */

import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

function stroked(d: string | string[]) {
  const paths = Array.isArray(d) ? d : [d];
  return function StrokedIcon(p: IconProps) {
    return (
      <Svg {...p}>
        <g {...line}>
          {paths.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
      </Svg>
    );
  };
}

/* ------------------------------------------------------------------ transport */

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.6v12.8a1 1 0 0 0 1.52.86l10.24-6.4a1 1 0 0 0 0-1.72L9.52 4.74A1 1 0 0 0 8 5.6Z" fill="currentColor" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.4" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" />
    <rect x="13.8" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" />
  </Svg>
);

export const StopIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </Svg>
);

export const NextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.8 6.3v11.4a.9.9 0 0 0 1.4.75l8.5-5.7a.9.9 0 0 0 0-1.5L6.2 5.55a.9.9 0 0 0-1.4.75Z" fill="currentColor" />
    <rect x="16.6" y="5.6" width="2.5" height="12.8" rx="1.25" fill="currentColor" />
  </Svg>
);

export const PreviousIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.2 6.3v11.4a.9.9 0 0 1-1.4.75l-8.5-5.7a.9.9 0 0 1 0-1.5l8.5-5.7a.9.9 0 0 1 1.4.75Z" fill="currentColor" />
    <rect x="4.9" y="5.6" width="2.5" height="12.8" rx="1.25" fill="currentColor" />
  </Svg>
);

export const ShuffleIcon = stroked([
  'M3.5 7h2.6c1.15 0 2.22.58 2.86 1.54l4.08 6.12A3.43 3.43 0 0 0 15.9 16.2h4.6',
  'M3.5 16.2h2.6c1.15 0 2.22-.58 2.86-1.54',
  'M15.9 7h4.6',
  'm18.2 4.7 2.3 2.3-2.3 2.3',
  'm18.2 13.9 2.3 2.3-2.3 2.3',
]);

export const RepeatIcon = stroked([
  'M4 11.2V9.6A3.6 3.6 0 0 1 7.6 6H19.5',
  'm16.7 3.2 2.8 2.8-2.8 2.8',
  'M20 12.8v1.6a3.6 3.6 0 0 1-3.6 3.6H4.5',
  'M7.3 20.8 4.5 18l2.8-2.8',
]);

export const RepeatOneIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...line}>
      <path d="M4 11.2V9.6A3.6 3.6 0 0 1 7.6 6H19.5" />
      <path d="m16.7 3.2 2.8 2.8-2.8 2.8" />
      <path d="M20 12.8v1.6a3.6 3.6 0 0 1-3.6 3.6H4.5" />
      <path d="M7.3 20.8 4.5 18l2.8-2.8" />
      <path d="M11.2 10.4 12.6 9.6v4.8" strokeWidth={1.5} />
    </g>
  </Svg>
);

export const SeekBackIcon = stroked(['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4 3.8v4.4h4.4', 'M10 10v4.5', 'M13 10h2v4.5h-2z']);
export const SeekForwardIcon = stroked(['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M20 3.8v4.4h-4.4', 'M9 10v4.5', 'M12 10h2v4.5h-2z']);

/* --------------------------------------------------------------------- volume */

export const VolumeHighIcon = stroked([
  'M4.2 9.4h2.9l4.4-3.9v13l-4.4-3.9H4.2a.9.9 0 0 1-.9-.9V10.3a.9.9 0 0 1 .9-.9Z',
  'M15.4 9a4.2 4.2 0 0 1 0 6',
  'M18.1 6.4a7.8 7.8 0 0 1 0 11.2',
]);
export const VolumeLowIcon = stroked([
  'M4.2 9.4h2.9l4.4-3.9v13l-4.4-3.9H4.2a.9.9 0 0 1-.9-.9V10.3a.9.9 0 0 1 .9-.9Z',
  'M15.4 9a4.2 4.2 0 0 1 0 6',
]);
export const VolumeMuteIcon = stroked([
  'M4.2 9.4h2.9l4.4-3.9v13l-4.4-3.9H4.2a.9.9 0 0 1-.9-.9V10.3a.9.9 0 0 1 .9-.9Z',
  'm15.5 9.5 5 5',
  'm20.5 9.5-5 5',
]);

/* --------------------------------------------------------------------- panels */

export const LyricsIcon = stroked([
  'M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8.6A1.5 1.5 0 0 1 19 16.6h-8.6L6.2 19.8v-3.2H5a1.5 1.5 0 0 1-1.5-1.5V6.5A1.5 1.5 0 0 1 5 5Z',
  'M8 9.4h8',
  'M8 12.4h5',
]);
export const QueueIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...line}>
      <path d="M4 6h12M4 10.6h12M4 15.2h7" />
    </g>
    <path d="M14.6 13.4v6.2a.6.6 0 0 0 .92.5l4.6-3.1a.6.6 0 0 0 0-1l-4.6-3.1a.6.6 0 0 0-.92.5Z" fill="currentColor" />
  </Svg>
);
export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...line}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11.2v5.2" />
    </g>
    <circle cx="12" cy="7.9" r="1.05" fill="currentColor" />
  </Svg>
);

/* ------------------------------------------------------------------ navigation */

export const HomeIcon = stroked('M4 10.6 12 4.2l8 6.4V19a1 1 0 0 1-1 1h-4.4v-5.6H9.4V20H5a1 1 0 0 1-1-1Z');
export const BrowseIcon = stroked([
  'M5.5 4h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3A1.5 1.5 0 0 1 5.5 4Z',
  'M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 14 8.5v-3A1.5 1.5 0 0 1 15.5 4Z',
  'M5.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3A1.5 1.5 0 0 1 5.5 14Z',
  'M17 14v6M14 17h6',
]);
export const RadioIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...line}>
      <path d="M12 13.2V20" />
      <path d="M8.6 7.6a4.8 4.8 0 0 0 0 6.8" />
      <path d="M15.4 7.6a4.8 4.8 0 0 1 0 6.8" />
      <path d="M5.8 4.8a8.8 8.8 0 0 0 0 12.4" />
      <path d="M18.2 4.8a8.8 8.8 0 0 1 0 12.4" />
    </g>
    <circle cx="12" cy="11" r="1.7" fill="currentColor" />
  </Svg>
);
export const SearchIcon = stroked(['M10.8 4.6a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4Z', 'm15.4 15.4 4.6 4.6']);
export const LibraryIcon = stroked(['M5 4v16', 'M9.5 4v16', 'm13.8 4.8 4.4 14.6']);
export const AlbumIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...line}>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3.4a8.6 8.6 0 0 1 6.1 2.5" opacity={0.6} />
    </g>
  </Svg>
);
export const ArtistIcon = stroked([
  'M12 3.6a3 3 0 0 1 3 3v4.6a3 3 0 0 1-6 0V6.6a3 3 0 0 1 3-3Z',
  'M6.2 11a5.8 5.8 0 0 0 11.6 0',
  'M12 16.8v3.6',
  'M9 20.4h6',
]);
export const NoteIcon = stroked([
  'M9.2 17.6V6.2l9.6-2v11.2',
  'M6.7 15.1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
  'M16.3 12.9a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
]);
export const GenreIcon = stroked([
  'M7.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z',
  'M14.5 4h4.5a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',
  'M4 20.2 7.5 14l3.5 6.2Z',
  'M16.8 14v6.2M13.7 17.1h6.2',
]);
export const PlaylistIcon = stroked([
  'M4 6.2h11.5',
  'M4 10.8h11.5',
  'M4 15.4h6',
  'M15.4 15.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Z',
  'M17.5 17.5V10l2.6-.8',
]);
export const ClockIcon = stroked(['M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2Z', 'M12 7.6V12l3 2']);
export const HistoryIcon = stroked(['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4 3.8v4.4h4.4', 'M12 8.2V12l2.6 1.6']);
export const DownloadIcon = stroked(['M12 4v11', 'm7.6 10.8 4.4 4.4 4.4-4.4', 'M5 19.6h14']);
export const StatsIcon = stroked(['M5 20v-8', 'M10 20V5', 'M15 20v-6', 'M20 20V9']);
export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...line}>
      <path d="M6 4v3.6M6 11.6V20M12 4v9.6M12 17.6V20M18 4v.6M18 8.6V20" />
      <circle cx="6" cy="9.6" r="2" />
      <circle cx="12" cy="15.6" r="2" />
      <circle cx="18" cy="6.6" r="2" />
    </g>
  </Svg>
);
export const FolderIcon = stroked(
  'M3.6 7.2a1.6 1.6 0 0 1 1.6-1.6h4.2l2 2.4h7.4a1.6 1.6 0 0 1 1.6 1.6v7.2a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6Z',
);

/* ---------------------------------------------------------------------- actions */

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="M12 19.6s-7.4-4.5-7.4-10a4.3 4.3 0 0 1 7.4-3 4.3 4.3 0 0 1 7.4 3c0 5.5-7.4 10-7.4 10Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </Svg>
);

export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="m12 3.8 2.45 5 5.5.8-3.98 3.88.94 5.47L12 16.36l-4.91 2.59.94-5.47L4.05 9.6l5.5-.8Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
);

export const EllipsisIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.8" cy="12" r="1.65" fill="currentColor" />
    <circle cx="12" cy="12" r="1.65" fill="currentColor" />
    <circle cx="18.2" cy="12" r="1.65" fill="currentColor" />
  </Svg>
);

export const ChevronLeftIcon = stroked('m14.5 6-6 6 6 6');
export const ChevronRightIcon = stroked('m9.5 6 6 6-6 6');
export const ChevronDownIcon = stroked('m6 9.5 6 6 6-6');
export const ChevronUpIcon = stroked('m6 14.5 6-6 6 6');
export const ArrowUpIcon = stroked(['M12 19V5', 'm6.5 10.5 5.5-5.5 5.5 5.5']);
export const ArrowDownIcon = stroked(['M12 5v14', 'm6.5 13.5 5.5 5.5 5.5-5.5']);
export const PlusIcon = stroked(['M12 5v14', 'M5 12h14']);
export const MinusIcon = stroked('M5 12h14');
export const CheckIcon = stroked('m5 12.6 4.6 4.6L19 7.6');
export const CloseIcon = stroked(['m6.5 6.5 11 11', 'm17.5 6.5-11 11']);

export const PlayNextIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...line}>
      <path d="M11 6.2h9M11 10.8h9M4 15.4h16M4 20h10" />
    </g>
    <path d="M4 4.6v7.6a.6.6 0 0 0 .93.5l5.4-3.8a.6.6 0 0 0 0-1l-5.4-3.8a.6.6 0 0 0-.93.5Z" fill="currentColor" />
  </Svg>
);
export const AddToQueueIcon = stroked(['M4 6h16', 'M4 10.6h16', 'M4 15.2h8.5', 'M17.4 13v7', 'M13.9 16.5h7']);
export const TrashIcon = stroked([
  'M4.8 7h14.4',
  'M9.6 7V5.2a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1V7',
  'm6.4 7 .8 11.9a1.2 1.2 0 0 0 1.2 1.1h7.2a1.2 1.2 0 0 0 1.2-1.1L17.6 7',
  'M10.2 10.8v5.4M13.8 10.8v5.4',
]);
export const PencilIcon = stroked(['m15.4 4.6 4 4L9 19l-4.6 1 1-4.6Z', 'm13.4 6.6 4 4']);
export const CopyIcon = stroked([
  'M10 8h8.4A1.6 1.6 0 0 1 20 9.6V18a1.6 1.6 0 0 1-1.6 1.6H10A1.6 1.6 0 0 1 8.4 18V9.6A1.6 1.6 0 0 1 10 8Z',
  'M15.6 8V5.6A1.6 1.6 0 0 0 14 4H5.6A1.6 1.6 0 0 0 4 5.6V14a1.6 1.6 0 0 0 1.6 1.6h2.8',
]);
export const LinkIcon = stroked([
  'M10.2 13.8a4 4 0 0 0 5.66 0l2.8-2.8a4 4 0 0 0-5.66-5.66l-1 1',
  'M13.8 10.2a4 4 0 0 0-5.66 0l-2.8 2.8a4 4 0 0 0 5.66 5.66l1-1',
]);
export const ShareIcon = stroked(['M12 3.6v11', 'm8 7.6 4-4 4 4', 'M5.2 12v6.4a1.6 1.6 0 0 0 1.6 1.6h10.4a1.6 1.6 0 0 0 1.6-1.6V12']);
export const PinIcon = stroked(['M9 4h6l-1.1 5.2 3.6 3.4H6.5l3.6-3.4Z', 'M12 12.6V20.4']);
export const MoonIcon = stroked('M19.6 14.4A8 8 0 0 1 9.6 4.4a8 8 0 1 0 10 10Z');
export const InfinityIcon = stroked(
  'M7.3 8.6c2.8 0 4.7 6.8 9.4 6.8a3.4 3.4 0 0 0 0-6.8c-4.7 0-6.6 6.8-9.4 6.8a3.4 3.4 0 0 1 0-6.8Z',
);
export const SpeedIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...line}>
      <path d="M4.6 17.4a8.2 8.2 0 1 1 14.8 0" />
      <path d="m12 13.4 4.2-4.4" />
      <path d="M12 6.2v1.2M6.8 8.4l.9.9M17.2 8.4l-.9.9" opacity={0.6} />
    </g>
    <circle cx="12" cy="13.6" r="1.5" fill="currentColor" />
  </Svg>
);
export const LoopIcon = stroked(['M6 5v14', 'M18 5v14', 'M6 12h11.4', 'm14.6 9 3 3-3 3']);
export const TapeIcon = stroked([
  'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
  'M8.5 9.6a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z',
  'M15.5 9.6a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z',
  'M10.4 11.5h3.2',
  'm7.2 18 1.4-2.6h6.8L16.8 18',
]);
export const ArtworkIcon = stroked([
  'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
]);
export const DiceIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3.6" {...line} />
    <circle cx="8.7" cy="8.7" r="1.25" fill="currentColor" />
    <circle cx="15.3" cy="8.7" r="1.25" fill="currentColor" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" />
    <circle cx="8.7" cy="15.3" r="1.25" fill="currentColor" />
    <circle cx="15.3" cy="15.3" r="1.25" fill="currentColor" />
  </Svg>
);
export const SparkleIcon = stroked([
  'M12 3.6c.5 4.2 2.1 5.9 6.4 6.4-4.3.5-5.9 2.2-6.4 6.4-.5-4.2-2.1-5.9-6.4-6.4 4.3-.5 5.9-2.2 6.4-6.4Z',
  'M18.4 15.6c.2 1.7.9 2.4 2.6 2.6-1.7.2-2.4.9-2.6 2.6-.2-1.7-.9-2.4-2.6-2.6 1.7-.2 2.4-.9 2.6-2.6Z',
]);
export const WifiIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...line}>
      <path d="M3.6 9.4a12 12 0 0 1 16.8 0" />
      <path d="M6.6 12.6a7.6 7.6 0 0 1 10.8 0" />
      <path d="M9.6 15.8a3.4 3.4 0 0 1 4.8 0" />
    </g>
    <circle cx="12" cy="18.8" r="1.2" fill="currentColor" />
  </Svg>
);
export const GlobeIcon = stroked([
  'M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2Z',
  'M3.6 12h16.8',
  'M12 3.4c2.3 2.4 3.4 5.3 3.4 8.6s-1.1 6.2-3.4 8.6c-2.3-2.4-3.4-5.3-3.4-8.6s1.1-6.2 3.4-8.6Z',
]);
export const OfflineIcon = stroked(['m4 4 16 16', 'M8.8 15.8a3.4 3.4 0 0 1 4.8 0', 'M6.6 12.6a7.6 7.6 0 0 1 4-2.1', 'M3.6 9.4a12 12 0 0 1 4-2.6', 'M14 10.6a7.6 7.6 0 0 1 3.4 2', 'M12 6a12 12 0 0 1 8.4 3.4']);
export const KeyboardIcon = stroked([
  'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
  'M7 10h.01M10.3 10h.01M13.7 10h.01M17 10h.01',
  'M8 14h8',
]);
export const CommandIcon = stroked(
  'M9 9V6.6A2.4 2.4 0 1 0 6.6 9H9Zm0 0h6m0 0V6.6A2.4 2.4 0 1 1 17.4 9H15Zm0 0v6m0 0h2.4a2.4 2.4 0 1 1-2.4 2.4V15Zm0 0H9m0 0v2.4A2.4 2.4 0 1 1 6.6 15H9Zm0 0V9',
);
export const SortIcon = stroked(['M7.5 4.5v15', 'm4.5 7.5 3-3 3 3', 'M16.5 19.5v-15', 'm13.5 16.5 3 3 3-3']);
export const GridIcon = stroked([
  'M5.5 4h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3A1.5 1.5 0 0 1 5.5 4Z',
  'M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 14 8.5v-3A1.5 1.5 0 0 1 15.5 4Z',
  'M5.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3A1.5 1.5 0 0 1 5.5 14Z',
  'M15.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5Z',
]);
export const ListIcon = stroked(['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.6 6h.01', 'M4.6 12h.01', 'M4.6 18h.01']);
export const FilterIcon = stroked('M4 5h16l-6.2 7.4V19l-3.6-1.8v-4.8Z');
export const ExpandIcon = stroked(['M14 4h6v6', 'M10 20H4v-6', 'm20 4-6.4 6.4', 'm4 20 6.4-6.4']);
export const CollapseIcon = stroked(['M14 10h6', 'M14 10V4', 'M10 14H4', 'M10 14v6', 'M20 4l-6 6', 'M4 20l6-6']);
export const GripIcon = (p: IconProps) => (
  <Svg {...p}>
    {[7, 12, 17].map((y) => (
      <g key={y}>
        <circle cx="9.2" cy={y} r="1.35" fill="currentColor" />
        <circle cx="14.8" cy={y} r="1.35" fill="currentColor" />
      </g>
    ))}
  </Svg>
);
export const RefreshIcon = stroked(['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M20 3.8v4.4h-4.4']);
export const LanguageIcon = stroked([
  'M4 6.2h9',
  'M8.5 4v2.2',
  'M6.2 6.2c.6 3 2.6 5.4 5.8 6.8',
  'M10.8 6.2c-.6 3-2.6 5.4-5.8 6.8',
  'm13 20 3.5-8 3.5 8',
  'M14.2 17.4h4.6',
]);
export const TextSizeIcon = stroked(['M3.6 18.4 8.2 6l4.6 12.4', 'M5.3 14h5.8', 'm13.8 18.4 3.1-7.6 3.1 7.6', 'M14.9 15.9h4']);
export const ServerIcon = stroked([
  'M6 4h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  'M6 13h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z',
  'M8 7.5h.01M8 16.5h.01',
]);
export const SunIcon = stroked([
  'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
  'M12 3v1.6M12 19.4V21M3 12h1.6M19.4 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1',
]);
export const LogoutIcon = stroked(['M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4', 'm10 16-4-4 4-4', 'M6 12h10']);
export const BoltIcon = stroked('M13 3 5 13.4h6L10 21l8-10.4h-6Z');
export const WaveIcon = stroked(['M3 12h1.6', 'M6.6 8.4v7.2', 'M10.2 5v14', 'M13.8 9v6', 'M17.4 7v10', 'M21 11v2']);
export const HeadphonesIcon = stroked([
  'M4 15.6V12a8 8 0 0 1 16 0v3.6',
  'M5.4 14h1.4a1.4 1.4 0 0 1 1.4 1.4v3.2A1.4 1.4 0 0 1 6.8 20H5.4A1.4 1.4 0 0 1 4 18.6v-3.2A1.4 1.4 0 0 1 5.4 14Z',
  'M17.2 14h1.4a1.4 1.4 0 0 1 1.4 1.4v3.2a1.4 1.4 0 0 1-1.4 1.4h-1.4a1.4 1.4 0 0 1-1.4-1.4v-3.2a1.4 1.4 0 0 1 1.4-1.4Z',
]);
export const FireIcon = stroked(
  'M12 3.4c1 3.4 5 5.4 5 10a5 5 0 0 1-10 0c0-2.3 1.1-4 2.4-5.2.2 1.6 1 2.7 2.2 3.2-.5-2.6-.6-5.2.4-8Z',
);
export const CalendarIcon = stroked([
  'M5.6 5.6h12.8a1.6 1.6 0 0 1 1.6 1.6v11.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V7.2a1.6 1.6 0 0 1 1.6-1.6Z',
  'M4 10h16',
  'M8.4 3.6v3.6M15.6 3.6v3.6',
]);
export const ExportIcon = stroked(['M12 15V4', 'm8 8 4-4 4 4', 'M5 15v3.4A1.6 1.6 0 0 0 6.6 20h10.8a1.6 1.6 0 0 0 1.6-1.6V15']);
export const SelectIcon = stroked([
  'M5.6 4h12.8A1.6 1.6 0 0 1 20 5.6v12.8a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V5.6A1.6 1.6 0 0 1 5.6 4Z',
  'm8.4 12.2 2.6 2.6 4.8-5.2',
]);
export const MicIcon = ArtistIcon;
export const ListenNowIcon = HomeIcon;
