/** The transport: previous, play, next — and the shuffle / repeat function keys. */

import { FKey } from '../controls';
import {
  NextIcon, PauseIcon, PlayIcon, PreviousIcon, RepeatIcon, RepeatOneIcon, SeekBackIcon, SeekForwardIcon, ShuffleIcon,
} from '../Icons';
import { player, usePlayer } from '../../state/player';
import { ui } from '../../state/ui';

export function PlayKey({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering && s.playing);
  const hasCurrent = usePlayer((s) => s.current !== null);
  return (
    <button
      type="button"
      className={`tkey tkey--play tkey--${size} ${buffering ? 'is-buffering' : ''} ${className}`}
      aria-label={playing ? 'Pause' : 'Play'}
      disabled={!hasCurrent}
      onClick={() => player.toggle()}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

export function PrevKey({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const hasCurrent = usePlayer((s) => s.current !== null);
  return (
    <button type="button" className={`tkey tkey--${size}`} aria-label="Previous" disabled={!hasCurrent} onClick={() => player.previous()}>
      <PreviousIcon />
    </button>
  );
}

export function NextKey({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const hasCurrent = usePlayer((s) => s.current !== null);
  return (
    <button
      type="button"
      className={`tkey tkey--${size} ${className}`}
      aria-label="Next"
      disabled={!hasCurrent}
      onClick={() => player.next()}
    >
      <NextIcon />
    </button>
  );
}

export function SeekKeys() {
  const radio = usePlayer((s) => s.current?.isRadio ?? true);
  return (
    <>
      <button type="button" className="ibtn" aria-label="Back 15 seconds" disabled={radio} onClick={() => player.seekBy(-15)}>
        <SeekBackIcon />
      </button>
      <button type="button" className="ibtn" aria-label="Forward 15 seconds" disabled={radio} onClick={() => player.seekBy(15)}>
        <SeekForwardIcon />
      </button>
    </>
  );
}

export function ShuffleKey() {
  const shuffle = usePlayer((s) => s.shuffle);
  return (
    <FKey
      icon={<ShuffleIcon />}
      label="shuf"
      on={shuffle}
      title={shuffle ? 'Shuffle on' : 'Shuffle off'}
      onClick={() => player.toggleShuffle()}
    />
  );
}

export function RepeatKey() {
  const repeat = usePlayer((s) => s.repeat);
  return (
    <FKey
      icon={repeat === 'one' ? <RepeatOneIcon /> : <RepeatIcon />}
      label={repeat === 'one' ? 'rpt 1' : 'rpt'}
      on={repeat !== 'off'}
      title={`Repeat: ${repeat}`}
      onClick={() => {
        player.cycleRepeat();
        const next = player.store.get().repeat;
        ui.toast(next === 'off' ? 'repeat off' : next === 'all' ? 'repeat all' : 'repeat one');
      }}
    />
  );
}

export function Transport({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`transport transport--${size}`}>
      <ShuffleKey />
      <PrevKey size={size} />
      <PlayKey size={size} />
      <NextKey size={size} />
      <RepeatKey />
    </div>
  );
}
