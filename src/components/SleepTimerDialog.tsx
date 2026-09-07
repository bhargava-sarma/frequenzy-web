/** Pick how long the music should keep going before it fades out. */

import { useEffect, useState } from 'react';

import { Dialog } from './Dialog';
import { CheckIcon, MoonIcon } from './Icons';
import { usePlayer } from '../state/player';

const PRESETS = [5, 15, 30, 45, 60, 90];

function remainingLabel(endsAt: number): string {
  const seconds = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')} remaining`;
}

export function SleepTimerDialog({ onClose }: { onClose: () => void }) {
  const { sleepTimer, actions } = usePlayer();
  const [, force] = useState(0);

  // Tick once a second so the countdown in the dialog stays honest.
  useEffect(() => {
    if (!sleepTimer || sleepTimer.mode !== 'countdown') return;
    const handle = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(handle);
  }, [sleepTimer]);

  const choose = (minutes: number) => {
    actions.setSleepTimer({ mode: 'countdown', endsAt: Date.now() + minutes * 60_000 });
    onClose();
  };

  return (
    <Dialog
      title="Sleep Timer"
      onClose={onClose}
      actions={
        sleepTimer ? (
          <button
            type="button"
            className="fz-btn"
            onClick={() => {
              actions.setSleepTimer(null);
              onClose();
            }}
          >
            Turn Off
          </button>
        ) : undefined
      }
    >
      {sleepTimer && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 9, fontSize: 13,
            color: 'var(--accent)', fontWeight: 600,
          }}
        >
          <MoonIcon style={{ width: 16, height: 16 }} />
          {sleepTimer.mode === 'endOfTrack' ? 'Stopping at the end of this track' : remainingLabel(sleepTimer.endsAt)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {PRESETS.map((minutes) => (
          <button key={minutes} type="button" className="fz-btn" style={{ height: 40 }} onClick={() => choose(minutes)}>
            {minutes} min
          </button>
        ))}
      </div>

      <button
        type="button"
        className="fz-menu__item"
        style={{ height: 44 }}
        onClick={() => {
          actions.setSleepTimer({ mode: 'endOfTrack', endsAt: 0 });
          onClose();
        }}
      >
        {sleepTimer?.mode === 'endOfTrack' ? <CheckIcon /> : <MoonIcon />}
        <span>Stop at the end of this track</span>
      </button>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Playback fades out over three seconds rather than cutting off.
      </div>
    </Dialog>
  );
}
