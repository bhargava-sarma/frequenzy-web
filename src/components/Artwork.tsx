/**
 * Album artwork with a graceful placeholder.
 *
 * Real covers fade in once decoded; until then (or if the track has none) a
 * monogram tile stands in, tinted from a hash of the title so the same album
 * always gets the same colour.
 */

import { useEffect, useRef, useState } from 'react';
import { coverArtUrl } from '../lib/subsonic';
import { localArtUrl } from '../lib/downloads';
import { hashHue, initials } from '../lib/format';

interface ArtworkProps {
  coverArt?: string;
  name: string;
  size?: number;
  className?: string;
  rounded?: boolean;
  children?: React.ReactNode;
}

export function Artwork({ coverArt, name, size = 300, className = '', rounded, children }: ArtworkProps) {
  const remote = coverArtUrl(coverArt, size);
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState(remote);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    setSrc(remote);
  }, [remote]);

  // Blob URLs created for the offline fallback are ours to release.
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  /** The server is unreachable — try the copy stored with a download. */
  const onError = async () => {
    setLoaded(false);
    if (!coverArt || objectUrl.current) return;
    const local = await localArtUrl(coverArt);
    if (local) {
      objectUrl.current = local;
      setSrc(local);
    }
  };

  return (
    <div
      className={`fz-art ${rounded ? 'fz-art--rounded' : ''} ${className}`}
      style={{ ['--ph-hue' as string]: hashHue(name) }}
    >
      {!loaded && <div className="fz-art__placeholder" style={{ fontSize: Math.max(11, size / 6) }}>{initials(name)}</div>}
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={loaded ? 'is-loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => void onError()}
        />
      )}
      {children}
    </div>
  );
}
