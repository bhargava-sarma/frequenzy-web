/**
 * Album artwork.
 *
 * Requests are snapped to a handful of sizes so the same cover shown at 48px
 * in a row and 56px in the deck is one download, not two. Until a cover has
 * decoded — or when there is none — a placeholder stands in: a dotted panel
 * with the first letter in the display face. When the server is out of reach
 * the copy stored with a download is used instead.
 */

import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { localArtUrl } from '../lib/downloads';
import { coverArtUrl } from '../lib/subsonic';

const SIZES = [64, 128, 256, 384, 512, 768, 1024];

function requestSize(display: number): number {
  const dpr = typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1) : 1;
  const want = display * dpr;
  return SIZES.find((size) => size >= want) ?? SIZES[SIZES.length - 1];
}

function monogram(name: string): string {
  const trimmed = name.replace(/^(the|a|an)\s+/i, '').trim();
  const first = [...trimmed][0] ?? '·';
  return first.toUpperCase();
}

interface ArtworkProps {
  coverArt?: string;
  name: string;
  /** Rendered size in CSS pixels; picks the request size. */
  size: number;
  className?: string;
  round?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  /** Load straight away rather than when scrolled near. */
  eager?: boolean;
}

export const Artwork = memo(function Artwork({
  coverArt, name, size, className = '', round, children, style, eager,
}: ArtworkProps) {
  const remote = coverArt ? coverArtUrl(coverArt, requestSize(size)) : '';
  // Everything below is keyed to the URL it belongs to, so a new cover never
  // inherits the old one's state. (Resetting in an effect raced the browser: a
  // cached image could finish loading before the reset ran, and then sat
  // hidden behind the placeholder for good.)
  const [local, setLocal] = useState<{ for: string; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState('');
  const src = !remote || failed === remote ? '' : local?.for === remote ? local.url : remote;
  const loaded = src !== '' && loadedSrc === src;
  const triedLocal = useRef<string | null>(null);

  // An object URL lives exactly as long as it is the one in use.
  useEffect(() => {
    if (!local) return;
    const url = local.url;
    return () => URL.revokeObjectURL(url);
  }, [local]);

  const onError = () => {
    const forRemote = remote;
    if (!coverArt || triedLocal.current === forRemote || src !== forRemote) {
      setFailed(forRemote);
      return;
    }
    // The server is out of reach: use the copy stored with a download, if any.
    triedLocal.current = forRemote;
    void localArtUrl(coverArt).then((url) => {
      if (url) setLocal({ for: forRemote, url });
      else setFailed(forRemote);
    });
  };

  return (
    <div className={`art ${round ? 'art--round' : ''} ${loaded ? 'is-loaded' : ''} ${className}`} style={style}>
      {!loaded && (
        <div className="art__ph" aria-hidden="true">
          <span style={{ fontSize: Math.max(12, Math.round(size * 0.38)) }}>{monogram(name)}</span>
        </div>
      )}
      {src && (
        <img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={(event) => setLoadedSrc(event.currentTarget.getAttribute('src') ?? '')}
          onError={onError}
        />
      )}
      {children}
    </div>
  );
});
