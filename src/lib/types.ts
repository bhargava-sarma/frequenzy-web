/** Subsonic / OpenSubsonic entities as returned by Navidrome. */

export interface Song {
  id: string;
  parent?: string;
  title: string;
  album?: string;
  artist?: string;
  albumId?: string;
  artistId?: string;
  track?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  genres?: { name: string }[];
  coverArt?: string;
  size?: number;
  contentType?: string;
  suffix?: string;
  duration?: number;
  bitRate?: number;
  bitDepth?: number;
  samplingRate?: number;
  channelCount?: number;
  path?: string;
  playCount?: number;
  played?: string;
  starred?: string;
  userRating?: number;
  isVideo?: boolean;
  type?: string;
  created?: string;
  comment?: string;
  sortName?: string;
  musicBrainzId?: string;
  replayGain?: {
    trackGain?: number;
    albumGain?: number;
    trackPeak?: number;
    albumPeak?: number;
  };
  /** OpenSubsonic multi-artist support */
  artists?: { id: string; name: string }[];
  albumArtists?: { id: string; name: string }[];
  displayArtist?: string;
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  songCount?: number;
  duration?: number;
  playCount?: number;
  created?: string;
  year?: number;
  genre?: string;
  genres?: { name: string }[];
  starred?: string;
  userRating?: number;
  song?: Song[];
  isCompilation?: boolean;
  musicBrainzId?: string;
  recordLabels?: { name: string }[];
  displayArtist?: string;
  releaseTypes?: string[];
  originalReleaseDate?: { year?: number; month?: number; day?: number };
}

export interface Artist {
  id: string;
  name: string;
  coverArt?: string;
  artistImageUrl?: string;
  albumCount?: number;
  starred?: string;
  userRating?: number;
  album?: Album[];
}

export interface ArtistInfo {
  biography?: string;
  musicBrainzId?: string;
  lastFmUrl?: string;
  smallImageUrl?: string;
  mediumImageUrl?: string;
  largeImageUrl?: string;
  similarArtist?: Artist[];
}

export interface Playlist {
  id: string;
  name: string;
  comment?: string;
  owner?: string;
  public?: boolean;
  songCount?: number;
  duration?: number;
  created?: string;
  changed?: string;
  coverArt?: string;
  entry?: Song[];
}

export interface Genre {
  value: string;
  songCount?: number;
  albumCount?: number;
}

export interface SearchResult {
  artist: Artist[];
  album: Album[];
  song: Song[];
}

export interface ScanStatus {
  scanning: boolean;
  count?: number;
  folderCount?: number;
  lastScan?: string;
}
