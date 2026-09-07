/**
 * Five-star rating, written straight through to Navidrome.
 *
 * Clicking the star you already rated clears the rating, which is how every
 * five-star control anyone has used behaves.
 */

import { useEffect, useState } from 'react';

import { StarIcon } from './Icons';
import { setRating } from '../lib/subsonic';
import type { Song } from '../lib/types';

export function StarRating({ song, compact }: { song: Song; compact?: boolean }) {
  const [rating, setLocalRating] = useState(song.userRating ?? 0);
  const [hover, setHover] = useState(0);

  useEffect(() => setLocalRating(song.userRating ?? 0), [song.id, song.userRating]);

  const apply = async (value: number) => {
    const next = value === rating ? 0 : value;
    setLocalRating(next);
    try {
      await setRating(song.id, next);
    } catch {
      setLocalRating(rating); // put it back if the server disagreed
    }
  };

  const shown = hover || rating;

  return (
    <div
      className="fz-stars"
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHover(0)}
      style={compact ? { gap: 2 } : undefined}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={rating === value}
          aria-label={`${value} star${value === 1 ? '' : 's'}`}
          className={`fz-star ${value <= shown ? 'is-on' : ''}`}
          onMouseEnter={() => setHover(value)}
          onClick={() => void apply(value)}
        >
          <StarIcon filled={value <= shown} />
        </button>
      ))}
    </div>
  );
}
