/** Preferences: appearance, lyrics, playback fidelity, servers and account. */

import { useState } from 'react';

import { Page } from '../components/Page';
import { CheckIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { formatBytes } from '../lib/format';
import { getDownloads, isSupported as downloadsSupported, removeAllDownloads, totalBytes } from '../lib/downloads';
import { connection } from '../lib/connection';
import { DEFAULT_CANDIDATES, normalizeBase, type ServerCandidate } from '../lib/endpoint';
import { getCredentials, setCredentials, startScan } from '../lib/subsonic';
import { useConnection } from '../hooks/useConnection';
import { useSettings, type LyricsRomanization, type ThemeMode } from '../state/settings';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className={`fz-switch ${on ? 'is-on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="fz-setting-row">
      <div className="fz-setting-row__text">
        <div className="fz-setting-row__title">{title}</div>
        {desc && <div className="fz-setting-row__desc">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export function Settings({ onSignedOut, onMenuClick }: { onSignedOut: () => void; onMenuClick?: () => void }) {
  const { settings, update } = useSettings();
  const state = useConnection();
  const [servers, setServers] = useState<ServerCandidate[]>(() => connection.getCandidates());
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const credentials = getCredentials();

  const commitServers = (next: ServerCandidate[]) => {
    setServers(next);
    connection.setCandidates(next);
  };

  const updateServer = (id: string, patch: Partial<ServerCandidate>) => {
    commitServers(servers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const runScan = async () => {
    setScanMessage('Starting scan…');
    try {
      await startScan(false);
      setScanMessage('Scan started. Navidrome will pick up new files in the background.');
    } catch {
      setScanMessage('Could not start a scan — your account may not be an admin.');
    }
  };

  return (
    <Page title="Settings" subtitle="Frequenzy 1.0" onMenuClick={onMenuClick}>
      <section className="fz-section" style={{ maxWidth: 680 }}>
        <div className="fz-section__head"><h2 className="fz-section__title">Playback</h2></div>

        <Row
          title="Lossless passthrough"
          desc="Streams are requested with format=raw, so Navidrome sends the original file untouched. Turn this off only if a device cannot decode FLAC."
        >
          <Toggle
            label="Lossless passthrough"
            on={!settings.allowTranscoding}
            onChange={(on) => update({ allowTranscoding: !on })}
          />
        </Row>

        <Row title="Scrobble plays" desc="Report listens back to Navidrome (and anything it forwards to).">
          <Toggle label="Scrobble plays" on={settings.scrobble} onChange={(on) => update({ scrobble: on })} />
        </Row>

        <Row
          title="Autoplay"
          desc="When the queue runs out, keep going with music like the last track."
        >
          <Toggle label="Autoplay" on={settings.autoplay} onChange={(on) => update({ autoplay: on })} />
        </Row>

        <Row
          title="Crossfade"
          desc={
            settings.crossfadeSeconds > 0
              ? `Tracks overlap by ${settings.crossfadeSeconds} seconds.`
              : 'Off — tracks change instantly, with no overlap.'
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 190 }}>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={settings.crossfadeSeconds}
              aria-label="Crossfade seconds"
              onChange={(event) => update({ crossfadeSeconds: Number(event.target.value) })}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 12, width: 26, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {settings.crossfadeSeconds || 'Off'}
            </span>
          </div>
        </Row>
      </section>

      {downloadsSupported() && (
        <section className="fz-section" style={{ maxWidth: 680 }}>
          <div className="fz-section__head"><h2 className="fz-section__title">Downloads</h2></div>
          <Row
            title="Stored on this device"
            desc={`${getDownloads().length} tracks · ${formatBytes(totalBytes())}. Downloaded tracks play from disk, so they work with no server in reach.`}
          >
            <button
              type="button"
              className="fz-btn"
              disabled={getDownloads().length === 0}
              onClick={() => void removeAllDownloads()}
            >
              Remove All
            </button>
          </Row>
        </section>
      )}

      <section className="fz-section" style={{ maxWidth: 680 }}>
        <div className="fz-section__head"><h2 className="fz-section__title">Lyrics</h2></div>

        <Row
          title="Romanization"
          desc="Transliterates non-Latin lyrics into the Latin alphabet — the sound of the words, never a translation."
        >
          <select
            value={settings.romanization}
            onChange={(event) => update({ romanization: event.target.value as LyricsRomanization })}
            style={{ height: 30, borderRadius: 6, background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--separator)', padding: '0 8px' }}
          >
            <option value="auto">Automatic</option>
            <option value="always">Always on</option>
            <option value="never">Off</option>
          </select>
        </Row>

        <Row title="Show original script" desc="Keeps the original line above its romanized reading.">
          <Toggle
            label="Show original script"
            on={settings.showOriginalWithRomanization}
            onChange={(on) => update({ showOriginalWithRomanization: on })}
          />
        </Row>

        <Row title="Pinyin tone marks" desc="“wǒ ài nǐ” rather than “wo ai ni” for Mandarin lyrics.">
          <Toggle
            label="Pinyin tone marks"
            on={settings.pinyinTones === 'symbol'}
            onChange={(on) => update({ pinyinTones: on ? 'symbol' : 'none' })}
          />
        </Row>
      </section>

      <section className="fz-section" style={{ maxWidth: 680 }}>
        <div className="fz-section__head"><h2 className="fz-section__title">Appearance</h2></div>

        <Row title="Theme">
          <div className="fz-segmented">
            {(['system', 'dark', 'light'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={settings.theme === mode ? 'is-active' : ''}
                onClick={() => update({ theme: mode })}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </Row>

        <Row title="Liquid glass" desc="Translucent, refracting panels. Costs a little GPU time.">
          <Toggle label="Liquid glass" on={settings.glass} onChange={(on) => update({ glass: on })} />
        </Row>

        <Row title="Ambient artwork colour" desc="Lets the album cover light the full-screen player.">
          <Toggle label="Ambient artwork colour" on={settings.ambientBackground} onChange={(on) => update({ ambientBackground: on })} />
        </Row>

        <Row title="Reduce motion" desc="Cuts the drifting gradients and easing animations.">
          <Toggle label="Reduce motion" on={settings.reduceMotion} onChange={(on) => update({ reduceMotion: on })} />
        </Row>
      </section>

      <section className="fz-section" style={{ maxWidth: 680 }}>
        <div className="fz-section__head"><h2 className="fz-section__title">Servers</h2></div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Every enabled address is probed at once whenever the network changes. The lowest priority number that answers
          wins, so your LAN address is preferred at home and Tailscale takes over when you leave.
        </p>

        {servers.map((server) => {
          const probe = state.lastProbes.find((p) => p.candidate.id === server.id);
          const active = state.candidateId === server.id && state.status === 'online';
          return (
            <div key={server.id} className="fz-setting-row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 240 }}>
                <input
                  value={server.label}
                  aria-label="Server name"
                  onChange={(event) => updateServer(server.id, { label: event.target.value })}
                  style={{ height: 28, borderRadius: 6, background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--separator)', padding: '0 8px', fontSize: 12, fontWeight: 600 }}
                />
                <input
                  value={server.url}
                  aria-label="Server URL"
                  placeholder="Leave blank for same origin"
                  spellCheck={false}
                  onChange={(event) => updateServer(server.id, { url: event.target.value })}
                  onBlur={(event) => updateServer(server.id, { url: normalizeBase(event.target.value) })}
                  style={{ height: 28, borderRadius: 6, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--separator)', padding: '0 8px', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Priority
                  <input
                    type="number"
                    value={server.priority}
                    aria-label="Priority"
                    onChange={(event) => updateServer(server.id, { priority: Number(event.target.value) })}
                    style={{ width: 54, height: 26, marginLeft: 6, borderRadius: 6, background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--separator)', padding: '0 6px', fontSize: 12 }}
                  />
                </label>
                <Toggle label="Enabled" on={server.enabled} onChange={(on) => updateServer(server.id, { enabled: on })} />
                <button
                  type="button"
                  className="fz-icon-btn"
                  aria-label="Remove server"
                  onClick={() => commitServers(servers.filter((s) => s.id !== server.id))}
                >
                  <TrashIcon />
                </button>
              </div>
              <div style={{ width: '100%', fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span
                  className="fz-conn__dot"
                  style={{ background: probe ? (probe.ok ? '#34c759' : '#ff453a') : 'var(--text-tertiary)' }}
                />
                {active && <CheckIcon style={{ width: 12, height: 12, color: '#34c759' }} />}
                {probe ? (probe.ok ? `Reachable in ${probe.latencyMs} ms` : 'No route from this network') : 'Not yet probed'}
                {active && ' · currently in use'}
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="fz-btn"
            onClick={() =>
              commitServers([
                ...servers,
                {
                  id: `server-${Date.now()}`,
                  label: 'New server',
                  url: 'http://',
                  priority: (servers.at(-1)?.priority ?? 0) + 10,
                  enabled: false,
                },
              ])
            }
          >
            <PlusIcon /> Add server
          </button>
          <button type="button" className="fz-btn" onClick={() => void connection.resolve(true)}>
            Re-check now
          </button>
          <button type="button" className="fz-btn" onClick={() => commitServers(DEFAULT_CANDIDATES)}>
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="fz-section" style={{ maxWidth: 680 }}>
        <div className="fz-section__head"><h2 className="fz-section__title">Library</h2></div>
        <Row title="Rescan the music folder" desc="Asks Navidrome to look for new and changed files.">
          <button type="button" className="fz-btn" onClick={() => void runScan()}>Scan now</button>
        </Row>
        {scanMessage && <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }}>{scanMessage}</div>}
      </section>

      <section className="fz-section" style={{ maxWidth: 680 }}>
        <div className="fz-section__head"><h2 className="fz-section__title">Account</h2></div>
        <Row
          title={credentials ? `Signed in as ${credentials.username}` : 'Not signed in'}
          desc="Frequenzy stores a salted token, never your password."
        >
          <button
            type="button"
            className="fz-btn"
            onClick={() => {
              setCredentials(null);
              onSignedOut();
            }}
          >
            Sign out
          </button>
        </Row>
      </section>
    </Page>
  );
}
