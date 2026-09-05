/**
 * Icon set, drawn in the spirit of SF Symbols: 24×24 grid, rounded joins,
 * consistent optical weight. Filled shapes for transport controls, strokes for
 * everything else.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.14v13.72c0 .83.92 1.33 1.62.88l10.79-6.86a1.05 1.05 0 0 0 0-1.76L9.62 4.26A1.05 1.05 0 0 0 8 5.14Z" fill="currentColor" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="4.75" width="4" height="14.5" rx="1.35" fill="currentColor" />
    <rect x="13.5" y="4.75" width="4" height="14.5" rx="1.35" fill="currentColor" />
  </Svg>
);

export const NextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.2v11.6c0 .8.88 1.28 1.55.85l8.2-5.8a1 1 0 0 0 0-1.7l-8.2-5.8A1 1 0 0 0 4 6.2Z" fill="currentColor" />
    <rect x="17.4" y="5" width="2.6" height="14" rx="1.3" fill="currentColor" />
  </Svg>
);

export const PreviousIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6.2v11.6c0 .8-.88 1.28-1.55.85l-8.2-5.8a1 1 0 0 1 0-1.7l8.2-5.8A1 1 0 0 1 20 6.2Z" fill="currentColor" />
    <rect x="4" y="5" width="2.6" height="14" rx="1.3" fill="currentColor" />
  </Svg>
);

export const ShuffleIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M3 6.8h3.1c1.2 0 2.3.6 3 1.6l5 7.2c.7 1 1.8 1.6 3 1.6H21" />
      <path d="M3 17.2h3.1c1.2 0 2.3-.6 3-1.6l5-7.2c.7-1 1.8-1.6 3-1.6H21" />
      <path d="m18.4 4.2 2.6 2.6-2.6 2.6M18.4 14.6l2.6 2.6-2.6 2.6" />
    </g>
  </Svg>
);

export const RepeatIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M7 4.8h9.2A3.8 3.8 0 0 1 20 8.6v1.6" />
      <path d="m17.6 2.4 2.5 2.4-2.5 2.4" />
      <path d="M17 19.2H7.8A3.8 3.8 0 0 1 4 15.4v-1.6" />
      <path d="m6.4 21.6-2.5-2.4 2.5-2.4" />
    </g>
  </Svg>
);

export const RepeatOneIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M7 4.8h9.2A3.8 3.8 0 0 1 20 8.6v1.6" />
      <path d="m17.6 2.4 2.5 2.4-2.5 2.4" />
      <path d="M17 19.2H7.8A3.8 3.8 0 0 1 4 15.4v-1.6" />
      <path d="m6.4 21.6-2.5-2.4 2.5-2.4" />
    </g>
    <text x="12" y="14.6" textAnchor="middle" fontSize="8.4" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">1</text>
  </Svg>
);

export const VolumeHighIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.2 4.6 6.9 8.2H4.2c-.7 0-1.2.5-1.2 1.2v5.2c0 .7.5 1.2 1.2 1.2h2.7l4.3 3.6c.7.6 1.8.1 1.8-.9V5.5c0-1-1.1-1.5-1.8-.9Z" fill="currentColor" />
    <g {...stroke}>
      <path d="M16.6 9.1a4.1 4.1 0 0 1 0 5.8" />
      <path d="M19.2 6.5a7.8 7.8 0 0 1 0 11" />
    </g>
  </Svg>
);

export const VolumeLowIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.2 4.6 6.9 8.2H4.2c-.7 0-1.2.5-1.2 1.2v5.2c0 .7.5 1.2 1.2 1.2h2.7l4.3 3.6c.7.6 1.8.1 1.8-.9V5.5c0-1-1.1-1.5-1.8-.9Z" fill="currentColor" />
    <path d="M16.6 9.1a4.1 4.1 0 0 1 0 5.8" {...stroke} />
  </Svg>
);

export const VolumeMuteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.2 4.6 6.9 8.2H4.2c-.7 0-1.2.5-1.2 1.2v5.2c0 .7.5 1.2 1.2 1.2h2.7l4.3 3.6c.7.6 1.8.1 1.8-.9V5.5c0-1-1.1-1.5-1.8-.9Z" fill="currentColor" />
    <path d="m16.4 9.6 4.4 4.8M20.8 9.6l-4.4 4.8" {...stroke} />
  </Svg>
);

export const LyricsIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4.5 5.5h15M4.5 10h11M4.5 14.5h15M4.5 19h8" />
    </g>
  </Svg>
);

export const QueueIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4 6.5h10M4 11h10M4 15.5h6" />
      <path d="M17.6 15.4V7.2l3.4-.9" />
      <circle cx="15.9" cy="16.6" r="1.9" />
    </g>
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.6 15.6 4 4" />
    </g>
  </Svg>
);

export const ListenNowIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M10.2 9.1v5.8l4.7-2.9z" fill="currentColor" strokeWidth="1.2" />
    </g>
  </Svg>
);

export const BrowseIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <rect x="3.8" y="3.8" width="7" height="7" rx="2" />
      <rect x="13.2" y="3.8" width="7" height="7" rx="2" />
      <rect x="3.8" y="13.2" width="7" height="7" rx="2" />
      <rect x="13.2" y="13.2" width="7" height="7" rx="2" />
    </g>
  </Svg>
);

export const RadioIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="2.1" />
      <path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 15.8a5.4 5.4 0 0 0 0-7.6" />
      <path d="M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 18.6a9.3 9.3 0 0 0 0-13.2" />
    </g>
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.2V12l3.2 1.9" />
    </g>
  </Svg>
);

export const ArtistIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="8.4" r="3.7" />
      <path d="M5.2 19.6a6.8 6.8 0 0 1 13.6 0" />
    </g>
  </Svg>
);

export const AlbumIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="2.3" />
    </g>
  </Svg>
);

export const NoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M9.4 17.4V5.9l9.2-2.3v11.2" />
      <circle cx="7" cy="17.8" r="2.6" />
      <circle cx="16.2" cy="15.4" r="2.6" />
    </g>
  </Svg>
);

export const GenreIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4.5 15.5V9a1 1 0 0 1 1-1h3l3.4-2.8a.8.8 0 0 1 1.3.6v12.4a.8.8 0 0 1-1.3.6L8.5 16h-3a1 1 0 0 1-1-1Z" />
      <path d="M17 9.4a4 4 0 0 1 0 5.2" />
    </g>
  </Svg>
);

export const PlaylistIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4 6.5h12M4 11h12M4 15.5h7" />
      <path d="M18.4 18.5v-6.2l2.6-.7" />
      <circle cx="16.9" cy="19.4" r="1.6" />
    </g>
  </Svg>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="M12 20.2s-7.6-4.6-7.6-9.7A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.6 2.9c0 5.1-7.6 9.7-7.6 9.7Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
    />
  </Svg>
);

export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="m12 4 2.42 4.9 5.41.79-3.92 3.82.93 5.39L12 16.36 7.16 18.9l.93-5.39-3.92-3.82 5.41-.79Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </Svg>
);

export const EllipsisIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.4" cy="12" r="1.75" fill="currentColor" />
    <circle cx="12" cy="12" r="1.75" fill="currentColor" />
    <circle cx="18.6" cy="12" r="1.75" fill="currentColor" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="m14.6 5.4-6.6 6.6 6.6 6.6" {...stroke} strokeWidth={2} /></Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="m9.4 5.4 6.6 6.6-6.6 6.6" {...stroke} strokeWidth={2} /></Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}><path d="m5.4 9.4 6.6 6.6 6.6-6.6" {...stroke} strokeWidth={2} /></Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" {...stroke} strokeWidth={1.9} /></Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="m4.8 12.6 4.7 4.7L19.2 7.6" {...stroke} strokeWidth={2} /></Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}><path d="m6 6 12 12M18 6 6 18" {...stroke} strokeWidth={1.9} /></Svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M12 3.8v10.6" />
      <path d="m7.6 10.4 4.4 4.4 4.4-4.4" />
      <path d="M4.6 17.4v1.4a1.6 1.6 0 0 0 1.6 1.6h11.6a1.6 1.6 0 0 0 1.6-1.6v-1.4" />
    </g>
  </Svg>
);

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 11v5.2" />
      <circle cx="12" cy="8" r=".9" fill="currentColor" stroke="none" />
    </g>
  </Svg>
);

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="2.9" />
      <path d="M19.3 14.6a1.5 1.5 0 0 0 .3 1.65l.06.06a1.8 1.8 0 1 1-2.55 2.55l-.06-.06a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37v.17a1.8 1.8 0 1 1-3.6 0v-.09a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.06.06a1.8 1.8 0 1 1-2.55-2.55l.06-.06a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9h-.17a1.8 1.8 0 1 1 0-3.6h.09a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.06-.06A1.8 1.8 0 1 1 8.11 4.9l.06.06a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .9-1.37v-.17a1.8 1.8 0 1 1 3.6 0v.09a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.06-.06a1.8 1.8 0 1 1 2.55 2.55l-.06.06a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.9h.17a1.8 1.8 0 1 1 0 3.6h-.09a1.5 1.5 0 0 0-1.37.9Z" />
    </g>
  </Svg>
);

export const GripIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}><path d="M8.5 7.5h7M8.5 12h7M8.5 16.5h7" /></g>
  </Svg>
);

export const WifiIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M2.6 8.8a14.4 14.4 0 0 1 18.8 0" />
      <path d="M6 12.4a9.4 9.4 0 0 1 12 0" />
      <path d="M9.4 16a4.4 4.4 0 0 1 5.2 0" />
      <circle cx="12" cy="19.2" r=".9" fill="currentColor" stroke="none" />
    </g>
  </Svg>
);

export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M3.6 12h16.8" />
      <path d="M12 3.6a13 13 0 0 1 0 16.8 13 13 0 0 1 0-16.8Z" />
    </g>
  </Svg>
);

export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.4 13.7 9l5.6 1.7-5.6 1.7L12 18l-1.7-5.6L4.7 10.7 10.3 9Z" fill="currentColor" />
    <path d="m18.6 3 .8 2.6 2.6.8-2.6.8-.8 2.6-.8-2.6-2.6-.8 2.6-.8Z" fill="currentColor" opacity=".7" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M4.8 6.6h14.4" />
      <path d="M9.2 6.6V5.2a1.4 1.4 0 0 1 1.4-1.4h2.8a1.4 1.4 0 0 1 1.4 1.4v1.4" />
      <path d="M6.6 6.6 7.4 19a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3l.8-12.4" />
    </g>
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M15.6 4.8 19.2 8.4 8.6 19H5v-3.6Z" />
      <path d="m13.8 6.6 3.6 3.6" />
    </g>
  </Svg>
);

export const LanguageIcon = (p: IconProps) => (
  <Svg {...p}>
    <g {...stroke}>
      <path d="M3.6 6h8.8" />
      <path d="M8 4.2V6" />
      <path d="M10.4 6c0 3.6-2.6 7-6.8 8.4" />
      <path d="M5.4 9.6c1.2 2.2 3.2 3.8 5.6 4.6" />
      <path d="m12.8 20 3.6-9 3.6 9" />
      <path d="M13.9 17.4h5" />
    </g>
  </Svg>
);
