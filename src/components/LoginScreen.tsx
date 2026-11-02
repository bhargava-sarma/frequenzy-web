/**
 * Sign-in, drawn as the front panel of the device.
 *
 * The password is never stored: Subsonic's salted MD5 token is derived once
 * and only that is kept. The screen shows every server address being raced,
 * live, and lets a new install add its own before signing in.
 */

import { useEffect, useState, type FormEvent } from 'react';

import { Spinner } from './controls';
import { CloseIcon, PlusIcon, ServerIcon } from './Icons';
import { Logo } from './shell/Sidebar';
import { connection } from '../lib/connection';
import { normalizeBase, type ServerCandidate } from '../lib/endpoint';
import { deriveCredentials, verifyCredentials } from '../lib/subsonic';
import { useConnection } from '../hooks/useConnection';
import { signIn } from '../state/session';

export function LoginScreen() {
  const state = useConnection();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState('');

  useEffect(() => {
    connection.start();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const creds = deriveCredentials(username.trim(), password);
      const ok = await verifyCredentials(creds);
      if (!ok) {
        setError('That username or password was not accepted.');
        return;
      }
      signIn(creds);
    } catch {
      setError('No server answered. Check that Navidrome is running, or add its address below.');
    } finally {
      setBusy(false);
    }
  };

  const addServer = () => {
    const url = normalizeBase(address);
    if (!/^https?:\/\/.+/i.test(url)) {
      setError('An address looks like http://192.168.1.20:4533');
      return;
    }
    const list = connection.getCandidates();
    const next: ServerCandidate = {
      id: `server-${Date.now()}`,
      label: new URL(url).hostname,
      url,
      priority: Math.min(...list.map((c) => c.priority).filter((p) => p > -100), 20) - 1,
      enabled: true,
    };
    connection.setCandidates([...list, next]);
    setAddress('');
    setError(null);
  };

  const removeServer = (id: string) => {
    connection.setCandidates(connection.getCandidates().filter((c) => c.id !== id));
  };

  return (
    <div className="login dot-grid">
      <form className="login__panel" onSubmit={submit}>
        <div className="login__brand">
          <Logo />
          <span className="login__word">frequenzy</span>
          <span className="tag">fz-1</span>
        </div>

        <div className="lcd login__lcd">
          <div className="login__lcd-title">network music player</div>
          <div className="login__servers">
            {state.candidates.map((candidate) => {
              const probe = state.lastProbes.find((p) => p.candidate.id === candidate.id);
              const live = state.candidateId === candidate.id && state.status === 'online';
              return (
                <div key={candidate.id} className="login__server">
                  <span className={`led ${probe ? (probe.ok ? 'is-on led--green' : 'is-on led--red') : ''}`} />
                  <span className="login__server-name truncate">
                    {candidate.label}
                    <span className="login__server-url"> {candidate.url ? candidate.url.replace(/^https?:\/\//, '') : 'same origin'}</span>
                  </span>
                  <span className="login__server-state">
                    {!candidate.enabled ? 'off' : live ? 'in use' : probe ? (probe.ok ? `${probe.latencyMs}ms` : 'no route') : '…'}
                  </span>
                  {editing && candidate.id !== 'same-origin' && (
                    <button type="button" className="login__server-remove" aria-label={`Remove ${candidate.label}`} onClick={() => removeServer(candidate.id)}>
                      <CloseIcon />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {editing && (
          <div className="login__add">
            <span className="input input--mono">
              <ServerIcon />
              <input
                value={address}
                placeholder="http://192.168.1.20:4533"
                aria-label="Server address"
                spellCheck={false}
                autoCapitalize="off"
                onChange={(event) => setAddress(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addServer();
                  }
                }}
              />
            </span>
            <button type="button" className="key key--icon" aria-label="Add server" onClick={addServer}>
              <PlusIcon />
            </button>
          </div>
        )}

        <label className="field">
          <span className="label">user</span>
          <span className="input">
            <input
              autoFocus
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </span>
        </label>
        <label className="field">
          <span className="label">password</span>
          <span className="input">
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </span>
        </label>

        {error && <div className="login__error">{error}</div>}

        <button type="submit" className="key key--primary key--lg login__go" disabled={busy || !username.trim() || !password}>
          {busy ? <Spinner /> : null}
          {busy ? 'signing in…' : 'sign in'}
        </button>

        <div className="login__foot">
          <button type="button" className="key key--sm key--ghost" onClick={() => setEditing((v) => !v)}>
            <ServerIcon /> {editing ? 'done' : 'servers'}
          </button>
          <span className="meta">password never stored · salted token</span>
        </div>
      </form>
    </div>
  );
}
