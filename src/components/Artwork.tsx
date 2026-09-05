/**
 * Album artwork with a graceful placeholder.
 *
 * Real covers fade in once decoded; until then (or if the track has none) a
 * monogram tile stands in, tinted from a hash of the title so the same album
 * always gets the same colour.
 */

import { useEffect, useState } from 'react';
import { coverArtUrl } from '../lib/subsonic';
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
  const src = coverArtUrl(coverArt, size);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

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
          onError={() => setLoaded(false)}
        />
      )}
      {children}
    </div>
  );
}
