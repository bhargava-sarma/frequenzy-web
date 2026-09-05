/**
 * Sign-in gate.
 *
 * The password is never stored: we derive Subsonic's salted MD5 token once and
 * keep only that, so what sits in localStorage cannot be read back as a password.
 */

import { useEffect, useState } from 'react';

import { SparkleIcon } from './Icons';
import { connection } from '../lib/connection';
import { useConnection } from '../hooks/useConnection';
import { deriveCredentials, setCredentials, verifyCredentials } from '../lib/subsonic';

export function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const state = useConnection();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    connection.start();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    setError(null);
    try {
      const creds = deriveCredentials(username, password);
      const ok = await verifyCredentials(creds);
      if (!ok) {
        setError('That username or password was not accepted.');
        return;
      }
      setCredentials(creds);
      onSignedIn();
    } catch {
      setError('Could not reach a Frequenzy server. Check that Navidrome is running.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fz-login">
      <div className="fz-ambient">
        <div className="fz-ambient__blob" style={{ ['--art-primary' as string]: '#fa243c' }} />
        <div className="fz-ambient__blob" style={{ ['--art-secondary' as string]: '#7b2ff7' }} />
        <div className="fz-ambient__blob" style={{ ['--art-tertiary' as string]: '#ff6a7a' }} />
        <div className="fz-ambient__scrim" />
      </div>

      <form className="fz-login__panel fz-glass fz-glass--strong fz-glass--liquid" onSubmit={submit}>
        <div className="fz-glass-refraction" />

        <div className="fz-login__brand">
          <img src="/icons/icon.svg" alt="" />
          <div className="fz-login__title">Frequenzy</div>
          <div className="fz-login__sub">Your library, in full resolution — at home and away.</div>
        </div>

        <div className="fz-field" style={{ position: 'relative', zIndex: 3 }}>
          <label htmlFor="fz-user">Username</label>
          <input
            id="fz-user"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div className="fz-field" style={{ position: 'relative', zIndex: 3 }}>
          <label htmlFor="fz-pass">Password</label>
          <input
            id="fz-pass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && <div className="fz-login__error">{error}</div>}

        <button
          type="submit"
          className="fz-btn fz-btn--solid"
          style={{ height: 38, position: 'relative', zIndex: 3 }}
          disabled={busy || !username || !password}
        >
          {busy ? <span className="fz-spinner" style={{ width: 15, height: 15 }} /> : <SparkleIcon />}
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="fz-login__servers">
          {state.candidates.map((candidate) => {
            const probe = state.lastProbes.find((p) => p.candidate.id === candidate.id);
            const active = state.candidateId === candidate.id && state.status === 'online';
            return (
              <div className="fz-login__server" key={candidate.id}>
                <span
                  className="fz-conn__dot"
                  style={{ background: probe ? (probe.ok ? '#34c759' : '#ff453a') : 'var(--text-tertiary)' }}
                />
                <span style={{ flex: 1 }} className="fz-truncate">
                  {candidate.label} · {candidate.url ? candidate.url.replace(/^https?:\/\//, '') : 'same origin'}
                </span>
                <span>{active ? 'in use' : probe ? (probe.ok ? 'reachable' : 'no route') : 'checking…'}</span>
              </div>
            );
          })}
        </div>
      </form>
    </div>
  );
}
