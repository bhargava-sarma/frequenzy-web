/**
 * Shows which server we landed on and how fast it answered. Clicking re-runs
 * the race — useful right after switching networks, though it happens on its own.
 */

import { useState } from 'react';
import { GlobeIcon, WifiIcon } from './Icons';
import { connection } from '../lib/connection';
import { useConnection } from '../hooks/useConnection';

export function ConnectionBadge() {
  const state = useConnection();
  const [expanded, setExpanded] = useState(false);

  const dotClass =
    state.status === 'online' ? 'fz-conn__dot--online'
    : state.status === 'resolving' ? 'fz-conn__dot--resolving'
    : state.status === 'offline' ? 'fz-conn__dot--offline'
    : '';

  const label =
    state.status === 'online' ? (state.label ?? 'Connected')
    : state.status === 'resolving' ? 'Finding server…'
    : state.status === 'offline' ? 'No server reachable'
    : 'Idle';

  const isLan = state.candidateId === 'lan';

  return (
    <div style={{ padding: '6px 10px 10px', borderTop: '1px solid var(--separator)', flex: 'none' }}>
      <button
        type="button"
        className="fz-conn"
        style={{ width: '100%' }}
        onClick={() => setExpanded((v) => !v)}
        title="Frequenzy picks the fastest reachable server automatically"
      >
        <span className={`fz-conn__dot ${dotClass}`} />
        {state.status === 'online' && (isLan ? <WifiIcon style={{ width: 13, height: 13 }} /> : <GlobeIcon style={{ width: 13, height: 13 }} />)}
        <span className="fz-truncate" style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        {state.latencyMs !== null && state.status === 'online' && (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{state.latencyMs} ms</span>
        )}
      </button>

      {expanded && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {state.candidates.map((candidate) => {
            const probe = state.lastProbes.find((p) => p.candidate.id === candidate.id);
            return (
              <div key={candidate.id} style={{ display: 'flex', gap: 6 }}>
                <span
                  className="fz-conn__dot"
                  style={{
                    marginTop: 4,
                    background: probe ? (probe.ok ? '#34c759' : '#ff453a') : 'var(--text-tertiary)',
                  }}
                />
                <span className="fz-truncate" style={{ flex: 1 }}>{candidate.label}</span>
                <span>{probe ? (probe.ok ? `${probe.latencyMs} ms` : 'no route') : '—'}</span>
              </div>
            );
          })}
          <button
            type="button"
            className="fz-chip"
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
            onClick={() => void connection.resolve(true)}
          >
            Re-check now
          </button>
        </div>
      )}
    </div>
  );
}
