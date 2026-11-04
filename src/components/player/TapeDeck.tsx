/**
 * The tape display: the song as a cassette.
 *
 * The reels turn while it plays and stop when it doesn't, and the tape moves
 * from one pack to the other as the song goes by — by area, the way a real
 * spool fills, so the take-up reel grows quickly at first and then slows.
 */

import { memo } from 'react';

import { formatTime, songArtist } from '../../lib/format';
import { usePlayer, useProgress } from '../../state/player';

const R_MIN = 17;
const R_MAX = 47;

function packRadius(share: number): number {
  const s = Math.min(1, Math.max(0, share));
  return Math.sqrt(R_MIN * R_MIN + s * (R_MAX * R_MAX - R_MIN * R_MIN));
}

const Hub = memo(function Hub({ cx, cy, speed, running }: { cx: number; cy: number; speed: number; running: boolean }) {
  return (
    <g
      className="tape__hub"
      style={{ animationDuration: `${speed}s`, animationPlayState: running ? 'running' : 'paused' }}
    >
      <circle cx={cx} cy={cy} r={13} className="tape__hub-face" />
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <rect
          key={angle}
          x={cx - 1.6}
          y={cy - 13}
          width={3.2}
          height={5}
          rx={1}
          className="tape__tooth"
          transform={`rotate(${angle} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={4} className="tape__hub-hole" />
    </g>
  );
});

export function TapeDeck() {
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing && !s.buffering);
  const duration = usePlayer((s) => s.duration);
  const time = useProgress((p) => p.time);
  if (!current) return null;

  const radio = current.isRadio;
  const fraction = radio || duration <= 0 ? 0.5 : Math.min(1, time / duration);
  const left = packRadius(1 - fraction);
  const right = packRadius(fraction);
  // A small pack spins faster than a full one for the same tape speed.
  const leftSpeed = Math.max(0.9, (left / R_MAX) * 3.2);
  const rightSpeed = Math.max(0.9, (right / R_MAX) * 3.2);
  // The label holds about 20 characters of the dot face, or 27 set smaller;
  // anything longer is cut with an ellipsis, and the label clips as a backstop.
  const chars = Array.from(current.title);
  const long = chars.length > 20;
  const room = long ? 27 : 20;
  const title = chars.length > room ? `${chars.slice(0, room - 1).join('')}…` : current.title;
  const artistChars = Array.from(songArtist(current));
  const artist = artistChars.length > 42 ? `${artistChars.slice(0, 41).join('')}…` : artistChars.join('');

  return (
    <div className="tape" role="img" aria-label={`Cassette: ${current.title}`}>
      <svg viewBox="0 0 400 252" className="tape__svg">
        <defs>
          <mask id="tape-window">
            <rect x="0" y="0" width="400" height="252" fill="#fff" />
            <rect x="92" y="148" width="216" height="62" rx="31" fill="#000" />
          </mask>
          <clipPath id="tape-label-text">
            <rect x="36" y="42" width="328" height="88" />
          </clipPath>
        </defs>

        <rect x="4" y="4" width="392" height="244" rx="20" className="tape__inside" />
        <circle cx={150} cy={179} r={left} className="tape__pack" />
        <circle cx={250} cy={179} r={right} className="tape__pack" />
        <path d={`M ${150 - left * 0.2} ${179 + left} L 200 222 L ${250 + right * 0.2} ${179 + right}`} className="tape__run" />
        <Hub cx={150} cy={179} speed={leftSpeed} running={playing} />
        <Hub cx={250} cy={179} speed={rightSpeed} running={playing} />

        <rect x="4" y="4" width="392" height="244" rx="20" className="tape__shell" mask="url(#tape-window)" />
        <rect x="92" y="148" width="216" height="62" rx="31" className="tape__window-rim" />

        <rect x="28" y="22" width="344" height="112" rx="10" className="tape__label" />
        <rect x="28" y="22" width="344" height="18" rx="9" className="tape__label-band" />
        <text x="44" y="35" className="tape__side">SIDE A</text>
        <text x="356" y="35" textAnchor="end" className="tape__side">{radio ? 'LIVE' : 'C-60'}</text>
        <g clipPath="url(#tape-label-text)">
          <text x="44" y="76" className={`tape__title ${long ? 'is-long' : ''}`}>
            {title}
          </text>
          <text x="44" y="100" className="tape__artist">
            {artist}
          </text>
        </g>
        <text x="356" y="124" textAnchor="end" className="tape__time">
          {radio ? 'on air' : `${formatTime(time)} / ${formatTime(duration)}`}
        </text>
        <line x1="44" y1="114" x2="230" y2="114" className="tape__rule" />

        <path d="M 120 248 L 136 220 L 264 220 L 280 248" className="tape__foot" />
        {[156, 184, 216, 244].map((x) => (
          <circle key={x} cx={x} cy={236} r={4.5} className="tape__hole" />
        ))}
        {[
          [16, 16],
          [384, 16],
          [16, 236],
          [384, 236],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={6} className="tape__screw" />
            <path d={`M ${x - 3} ${y} L ${x + 3} ${y}`} className="tape__screw-slot" />
          </g>
        ))}
      </svg>
    </div>
  );
}
