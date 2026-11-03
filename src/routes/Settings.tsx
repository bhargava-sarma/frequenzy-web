/** Preferences: playback, quality, lyrics, appearance, servers, storage, data and the account. */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { Segmented, Slider, Switch } from '../components/controls';
import { KeyboardIcon, LogoutIcon, PlusIcon, RefreshIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from '../components/Icons';
import { Page } from '../components/Page';
import { saveFile } from '../lib/clipboard';
import { connection, networkKind } from '../lib/connection';
import { getDownloads, isSupported as downloadsSupported, removeAllDownloads, storageEstimate, totalBytes } from '../lib/downloads';
import { DEFAULT_CANDIDATES, normalizeBase, type ServerCandidate } from '../lib/endpoint';
import { formatBytes } from '../lib/format';
import { clearHistory } from '../lib/history';
import { useScanStatus, useServerInfo } from '../lib/queries';
import { invalidateQueries } from '../lib/query';
import { clearStats, exportStats, playCount } from '../lib/stats';
import { getCredentials, startScan } from '../lib/subsonic';
import { useConnection } from '../hooks/useConnection';
import { useDownloadsVersion, useStatsVersion } from '../hooks/useData';
import { player } from '../state/player';
import { signOut } from '../state/session';
import {
  resetSettings, updateSettings, useSettings, type Accent, type Quality, type ReplayGainMode, type ThemeMode,
} from '../state/settings';
import { ui } from '../state/ui';

const QUALITY_LABEL: Record<Quality, string> = {
  original: 'original · bit-perfect',
  '320': '320 kbps',
  '256': '256 kbps',
  '192': '192 kbps',
  '128': '128 kbps',
  '96': '96 kbps',
};

const ACCENTS: Accent[] = ['orange', 'blue', 'green', 'yellow', 'red', 'pink', 'mono'];

function Row({ title, desc, children, wide }: { title: string; desc?: ReactNode; children?: ReactNode; wide?: boolean }) {
  return (
    <div className={`setting ${wide ? 'setting--wide' : ''}`}>
      <div className="setting__text">
        <div className="setting__title">{title}</div>
        {desc && <div className="setting__desc">{desc}</div>}
      </div>
      {children && <div className="setting__control">{children}</div>}
    </div>
  );
}

function Group({ index, id, title, children }: { index: number; id: string; title: string; children: ReactNode }) {
  return (
    <section className="settings-group" id={id}>
      <div className="section__head">
        <span className="section__index">{String(index).padStart(2, '0')}</span>
        <h2 className="section__title">{title}</h2>
        <span className="section__rule" />
      </div>
      <div className="settings-group__body">{children}</div>
    </section>
  );
}

function QualitySelect({ value, onChange, label }: { value: Quality; onChange: (q: Quality) => void; label: string }) {
  return (
    <select className="select" value={value} aria-label={label} onChange={(event) => onChange(event.target.value as Quality)}>
      {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
        <option key={q} value={q}>
          {QUALITY_LABEL[q]}
        </option>
      ))}
    </select>
  );
}

export function Settings() {
  const settings = useSettings((s) => s);
  const location = useLocation();
  const wakeLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }, [location.hash]);

  let n = 0;

  return (
    <Page title="settings" eyebrow="fz-1 · preferences">
      <div className="settings">
        <Group index={++n} id="playback" title="playback">
          <Row title="autoplay" desc="When the queue runs out, keep going with music like the last track.">
            <Switch label="Autoplay" on={settings.autoplay} onChange={(on) => updateSettings({ autoplay: on })} />
          </Row>
          <Row wide title="crossfade" desc={settings.crossfadeSeconds ? `Tracks overlap by ${settings.crossfadeSeconds} s.` : 'Off — gapless, with no overlap.'}>
            <div className="setting__slider">
              <Slider
                value={settings.crossfadeSeconds}
                max={12}
                step={1}
                live
                label="Crossfade seconds"
                format={(v) => `${Math.round(v)} s`}
                onChange={(v) => updateSettings({ crossfadeSeconds: Math.round(v) })}
              />
              <span className="tnum setting__value">{settings.crossfadeSeconds || 'off'}</span>
            </div>
          </Row>
          <Row wide title="speed" desc="Playback speed, pitch preserved. Also on [ and ] and in the player.">
            <div className="setting__slider">
              <Slider
                value={settings.playbackRate}
                min={0.5}
                max={2}
                step={0.05}
                live
                label="Playback speed"
                format={(v) => `${v.toFixed(2)}×`}
                onChange={(v) => player.setRate(Math.round(v * 20) / 20)}
              />
              <span className="tnum setting__value">{settings.playbackRate.toFixed(2)}×</span>
            </div>
          </Row>
          <Row title="volume levelling" desc="ReplayGain from your tags evens out loudness. It can only turn tracks down, never up.">
            <Segmented<ReplayGainMode>
              label="ReplayGain"
              value={settings.replayGain}
              onChange={(value) => updateSettings({ replayGain: value })}
              options={[
                { value: 'off', label: 'off' },
                { value: 'track', label: 'track' },
                { value: 'album', label: 'album' },
              ]}
            />
          </Row>
          {settings.replayGain !== 'off' && (
            <Row wide title="pre-amp" desc="Added before levelling.">
              <div className="setting__slider">
                <Slider
                  value={settings.replayGainPreamp}
                  min={-12}
                  max={6}
                  step={0.5}
                  live
                  label="Pre-amp"
                  format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
                  onChange={(v) => updateSettings({ replayGainPreamp: Math.round(v * 2) / 2 })}
                />
                <span className="tnum setting__value">
                  {settings.replayGainPreamp > 0 ? '+' : ''}
                  {settings.replayGainPreamp.toFixed(1)}
                </span>
              </div>
            </Row>
          )}
          <Row title="scrobble" desc="Report listens back to Navidrome, and anything it forwards to.">
            <Switch label="Scrobble" on={settings.scrobble} onChange={(on) => updateSettings({ scrobble: on })} />
          </Row>
          <Row title="hand off between devices" desc="Keep the queue on the server, and offer to pick it up on another device.">
            <Switch label="Sync queue" on={settings.syncQueue} onChange={(on) => updateSettings({ syncQueue: on })} />
          </Row>
          {wakeLock && (
            <Row title="keep the screen on" desc="While the full-screen player is open.">
              <Switch label="Keep the screen on" on={settings.keepScreenOn} onChange={(on) => updateSettings({ keepScreenOn: on })} />
            </Row>
          )}
          {touch && (
            <Row title="haptics" desc="A short buzz on swipes and long presses.">
              <Switch label="Haptics" on={settings.haptics} onChange={(on) => updateSettings({ haptics: on })} />
            </Row>
          )}
        </Group>

        <Group index={++n} id="quality" title="quality">
          <NetworkLine />
          <Row title="at home" desc="On a LAN address. Original sends the file on disk, untouched.">
            <QualitySelect label="Quality at home" value={settings.qualityHome} onChange={(q) => updateSettings({ qualityHome: q })} />
          </Row>
          <Row title="away" desc="On Tailscale or the internet — lower it to save data on the go.">
            <QualitySelect label="Quality away" value={settings.qualityRemote} onChange={(q) => updateSettings({ qualityRemote: q })} />
          </Row>
          <Row title="transcode to" desc="Used whenever the quality is not original. Seeking can be slower while transcoding.">
            <Segmented
              label="Format"
              mono
              value={settings.transcodeFormat}
              onChange={(value) => updateSettings({ transcodeFormat: value })}
              options={[
                { value: 'mp3', label: 'mp3' },
                { value: 'opus', label: 'opus' },
                { value: 'aac', label: 'aac' },
              ]}
            />
          </Row>
        </Group>

        <Group index={++n} id="lyrics" title="lyrics">
          <Row title="romanization" desc="Transliterate non-Latin lyrics — the sound of the words, never a translation.">
            <Segmented
              label="Romanization"
              value={settings.romanization}
              onChange={(value) => updateSettings({ romanization: value })}
              options={[
                { value: 'auto', label: 'auto' },
                { value: 'always', label: 'always' },
                { value: 'never', label: 'off' },
              ]}
            />
          </Row>
          <Row title="show the original" desc="Keep the original line above its reading.">
            <Switch label="Show the original" on={settings.showOriginalWithRomanization} onChange={(on) => updateSettings({ showOriginalWithRomanization: on })} />
          </Row>
          <Row title="pinyin tone marks" desc="“wǒ ài nǐ” rather than “wo ai ni”.">
            <Switch label="Pinyin tones" on={settings.pinyinTones === 'symbol'} onChange={(on) => updateSettings({ pinyinTones: on ? 'symbol' : 'none' })} />
          </Row>
          <Row title="text size">
            <Segmented
              label="Lyrics size"
              mono
              value={settings.lyricsSize}
              onChange={(value) => updateSettings({ lyricsSize: value })}
              options={[
                { value: 's', label: 's' },
                { value: 'm', label: 'm' },
                { value: 'l', label: 'l' },
              ]}
            />
          </Row>
        </Group>

        <Group index={++n} id="appearance" title="appearance">
          <Row title="finish">
            <Segmented<ThemeMode>
              label="Theme"
              value={settings.theme}
              onChange={(value) => updateSettings({ theme: value })}
              options={[
                { value: 'system', label: 'auto' },
                { value: 'light', label: 'aluminium' },
                { value: 'dark', label: 'graphite' },
              ]}
            />
          </Row>
          <Row title="accent" desc="The colour of the play key, the LEDs and the screen.">
            <div className="swatches" role="radiogroup" aria-label="Accent">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  role="radio"
                  aria-checked={settings.accent === accent}
                  aria-label={accent}
                  title={accent}
                  className={`swatch swatch--${accent} ${settings.accent === accent ? 'is-on' : ''}`}
                  onClick={() => updateSettings({ accent })}
                />
              ))}
            </div>
          </Row>
          <Row title="density">
            <Segmented
              label="Density"
              value={settings.density}
              onChange={(value) => updateSettings({ density: value })}
              options={[
                { value: 'comfortable', label: 'roomy' },
                { value: 'compact', label: 'compact' },
              ]}
            />
          </Row>
          <Row title="card size">
            <Segmented
              label="Card size"
              mono
              value={settings.gridSize}
              onChange={(value) => updateSettings({ gridSize: value })}
              options={[
                { value: 's', label: 's' },
                { value: 'm', label: 'm' },
                { value: 'l', label: 'l' },
              ]}
            />
          </Row>
          <Row title="player shows" desc="What fills the full-screen player.">
            <Segmented
              label="Player display"
              value={settings.playerDisplay}
              onChange={(value) => updateSettings({ playerDisplay: value })}
              options={[
                { value: 'art', label: 'artwork' },
                { value: 'tape', label: 'tape' },
              ]}
            />
          </Row>
          <Row title="artwork tint" desc="Light the full-screen player with the colours of the cover.">
            <Switch label="Artwork tint" on={settings.artworkTint} onChange={(on) => updateSettings({ artworkTint: on })} />
          </Row>
          <Row title="reduce motion" desc="Stops the marquee, the reels and the transitions.">
            <Switch label="Reduce motion" on={settings.reduceMotion} onChange={(on) => updateSettings({ reduceMotion: on })} />
          </Row>
        </Group>

        <Group index={++n} id="servers" title="servers">
          <ServerEditor />
        </Group>

        <Group index={++n} id="library" title="library">
          <ScanControl />
        </Group>

        {downloadsSupported() && (
          <Group index={++n} id="storage" title="storage">
            <StorageRows />
          </Group>
        )}

        <Group index={++n} id="data" title="data">
          <DataRows />
        </Group>

        <Group index={++n} id="keys" title="keyboard">
          <Row title="shortcuts" desc="Almost everything has a key. Press ? anywhere to see them.">
            <button type="button" className="key key--sm" onClick={() => ui.openDialog({ type: 'shortcuts' })}>
              <KeyboardIcon /> show
            </button>
          </Row>
        </Group>

        <Group index={++n} id="about" title="about">
          <About />
        </Group>

        <Group index={++n} id="account" title="account">
          <Row title={getCredentials() ? `signed in as ${getCredentials()!.username}` : 'not signed in'} desc="Frequenzy keeps a salted token, never your password.">
            <button
              type="button"
              className="key key--sm"
              onClick={() =>
                ui.openDialog({
                  type: 'confirm',
                  title: 'sign out',
                  message: 'Sign out of this server? Downloads, history and settings stay on this device.',
                  confirmLabel: 'sign out',
                  danger: true,
                  onConfirm: signOut,
                })
              }
            >
              <LogoutIcon /> sign out
            </button>
          </Row>
          <Row title="reset preferences" desc="Back to how everything was out of the box.">
            <button
              type="button"
              className="key key--sm"
              onClick={() =>
                ui.openDialog({
                  type: 'confirm',
                  title: 'reset preferences',
                  message: 'Every setting on this page goes back to its default.',
                  confirmLabel: 'reset',
                  onConfirm: () => {
                    resetSettings();
                    ui.toast('preferences reset');
                  },
                })
              }
            >
              reset
            </button>
          </Row>
        </Group>
      </div>
    </Page>
  );
}

function NetworkLine() {
  const state = useConnection();
  const settings = useSettings((s) => s);
  const kind = networkKind(state);
  const quality = kind === 'home' ? settings.qualityHome : settings.qualityRemote;
  return (
    <div className="netline">
      <span className={`led is-on ${state.status === 'online' ? 'led--green' : 'led--red'}`} />
      <span className="netline__text">
        on <b>{state.label ?? 'no server'}</b> — {kind === 'home' ? 'home network' : 'away'} · streaming {QUALITY_LABEL[quality]}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- servers */

function ServerEditor() {
  const state = useConnection();
  const [draft, setDraft] = useState<ServerCandidate[]>(() => connection.getCandidates());
  const saved = state.candidates;
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  // Somebody else (the login screen, a reset) changed the list: follow it unless editing.
  useEffect(() => {
    if (!dirty) setDraft(saved);
    // `dirty` is deliberately read without being a dependency.
  }, [saved]);

  const patch = (id: string, change: Partial<ServerCandidate>) => setDraft((list) => list.map((c) => (c.id === id ? { ...c, ...change } : c)));
  const move = (index: number, delta: number) =>
    setDraft((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      // Priority follows position, lowest first.
      return next.map((c, i) => ({ ...c, priority: c.id === 'same-origin' ? -100 : i * 10 }));
    });

  const save = () => {
    const invalid = draft.find((c) => c.url && !/^https?:\/\/.+/i.test(normalizeBase(c.url)));
    if (invalid) {
      ui.error(`“${invalid.label}” needs an address starting with http:// or https://`);
      return;
    }
    connection.setCandidates(draft.map((c) => ({ ...c, url: normalizeBase(c.url) })));
    invalidateQueries(() => true);
    ui.toast('servers saved — re-checking');
  };

  return (
    <>
      <p className="settings-note">
        Every enabled address is tried at once whenever the network changes, and the first in this list that answers wins
        — so the LAN is used at home and Tailscale takes over when you leave.
      </p>
      <div className="servers">
        {draft.map((server, index) => {
          const probe = state.lastProbes.find((p) => p.candidate.id === server.id);
          const live = state.candidateId === server.id && state.status === 'online';
          return (
            <div key={server.id} className={`server ${live ? 'is-live' : ''}`}>
              <div className="server__order">
                <button type="button" className="ibtn ibtn--sm" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUpIcon />
                </button>
                <button type="button" className="ibtn ibtn--sm" aria-label="Move down" disabled={index === draft.length - 1} onClick={() => move(index, 1)}>
                  <ArrowDownIcon />
                </button>
              </div>
              <div className="server__fields">
                <span className="input">
                  <input value={server.label} aria-label="Name" onChange={(event) => patch(server.id, { label: event.target.value })} />
                </span>
                <span className="input input--mono">
                  <input
                    value={server.url}
                    aria-label="Address"
                    placeholder="blank = the server hosting this app"
                    spellCheck={false}
                    autoCapitalize="off"
                    onChange={(event) => patch(server.id, { url: event.target.value })}
                  />
                </span>
                <div className="server__status meta">
                  <span className={`led ${probe ? (probe.ok ? 'is-on led--green' : 'is-on led--red') : ''}`} />
                  {probe ? (probe.ok ? `answers in ${probe.latencyMs} ms` : `no route${probe.error ? ` · ${probe.error}` : ''}`) : 'not checked yet'}
                  {live && <span className="tag tag--accent">in use</span>}
                </div>
              </div>
              <div className="server__keys">
                <Switch label="Enabled" on={server.enabled} onChange={(on) => patch(server.id, { enabled: on })} />
                <button type="button" className="ibtn" aria-label="Remove" onClick={() => setDraft((list) => list.filter((c) => c.id !== server.id))}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="settings-keys">
        <button
          type="button"
          className="key key--sm"
          onClick={() =>
            setDraft((list) => [
              ...list,
              { id: `server-${Date.now()}`, label: 'new server', url: 'http://', priority: list.length * 10, enabled: true },
            ])
          }
        >
          <PlusIcon /> add
        </button>
        <button type="button" className="key key--sm" onClick={() => void connection.resolve(true).then(() => ui.toast('servers re-checked'))}>
          <RefreshIcon /> re-check
        </button>
        <button type="button" className="key key--sm key--ghost" onClick={() => setDraft(DEFAULT_CANDIDATES)}>
          defaults
        </button>
        <span className="toolbar__spacer" />
        {dirty && (
          <>
            <button type="button" className="key key--sm" onClick={() => setDraft(saved)}>
              discard
            </button>
            <button type="button" className="key key--sm key--primary" onClick={save}>
              save
            </button>
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- scan */

function ScanControl() {
  const status = useScanStatus();
  const scanning = status.data?.scanning ?? false;
  const reload = status.reload;

  // Poll while a scan runs.
  useEffect(() => {
    if (!scanning) return;
    const handle = setInterval(() => void reload(), 2000);
    return () => clearInterval(handle);
  }, [reload, scanning]);

  const run = (full: boolean) =>
    void startScan(full)
      .then(() => {
        ui.toast(full ? 'full scan started' : 'scan started');
        void status.reload();
      })
      .catch(() => ui.error("couldn't start a scan — it needs an admin account"));

  return (
    <>
      <Row
        title={scanning ? 'scanning…' : 'music folder'}
        desc={
          status.data
            ? `${(status.data.count ?? 0).toLocaleString()} files${status.data.folderCount ? ` in ${status.data.folderCount.toLocaleString()} folders` : ''}${
                status.data.lastScan ? ` · last scanned ${new Date(status.data.lastScan).toLocaleString()}` : ''
              }`
            : status.error
              ? 'scan status unavailable'
              : 'checking…'
        }
      >
        <span className={`led ${scanning ? 'is-on is-blinking' : ''}`} />
      </Row>
      <div className="settings-keys">
        <button type="button" className="key key--sm" disabled={scanning} onClick={() => run(false)}>
          <RefreshIcon /> quick scan
        </button>
        <button type="button" className="key key--sm" disabled={scanning} onClick={() => run(true)}>
          full scan
        </button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- storage */

function StorageRows() {
  const version = useDownloadsVersion();
  const count = useMemo(() => getDownloads().length, [version]);
  const bytes = useMemo(() => totalBytes(), [version]);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => {
    void storageEstimate().then(setEstimate);
  }, [version]);
  return (
    <Row
      title="downloads"
      desc={`${count} tracks · ${formatBytes(bytes) || '0 B'}${estimate?.quota ? ` · ${formatBytes(estimate.quota)} available to this site` : ''}`}
    >
      <button
        type="button"
        className="key key--sm"
        disabled={count === 0}
        onClick={() =>
          ui.openDialog({
            type: 'confirm',
            title: 'remove all downloads',
            message: `Delete ${count} tracks from this device?`,
            confirmLabel: 'remove all',
            danger: true,
            onConfirm: () => void removeAllDownloads().then(() => ui.toast('downloads removed')),
          })
        }
      >
        <TrashIcon /> remove all
      </button>
    </Row>
  );
}

/* ------------------------------------------------------------------- data */

function DataRows() {
  useStatsVersion();
  return (
    <>
      <Row title="listening stats" desc={`${playCount().toLocaleString()} listens logged on this device.`}>
        <div className="settings-keys settings-keys--inline">
          <button
            type="button"
            className="key key--sm"
            onClick={() => saveFile(`frequenzy-stats-${new Date().toISOString().slice(0, 10)}.json`, exportStats(), 'application/json')}
          >
            export
          </button>
          <button
            type="button"
            className="key key--sm"
            onClick={() =>
              ui.openDialog({
                type: 'confirm',
                title: 'clear stats',
                message: 'Forget every listen logged on this device? This cannot be undone.',
                confirmLabel: 'clear',
                danger: true,
                onConfirm: () => {
                  clearStats();
                  ui.toast('stats cleared');
                },
              })
            }
          >
            clear
          </button>
        </div>
      </Row>
      <Row title="history" desc="The recently played list on this device.">
        <button
          type="button"
          className="key key--sm"
          onClick={() => {
            clearHistory();
            ui.toast('history cleared');
          }}
        >
          clear
        </button>
      </Row>
    </>
  );
}

/* ------------------------------------------------------------------ about */

function About() {
  const server = useServerInfo();
  const state = useConnection();
  return (
    <dl className="spec spec--about">
      <div className="spec__row">
        <dt className="label">client</dt>
        <dd className="mono">frequenzy fz-1 · 2.0</dd>
      </div>
      <div className="spec__row">
        <dt className="label">server</dt>
        <dd className="mono">
          {server.data ? `${server.data.type ?? 'subsonic'} ${server.data.serverVersion ?? ''}`.trim() : server.loading ? '…' : 'unknown'}
        </dd>
      </div>
      <div className="spec__row">
        <dt className="label">api</dt>
        <dd className="mono">
          {server.data?.version ?? '—'}
          {server.data?.openSubsonic ? ' · opensubsonic' : ''}
        </dd>
      </div>
      <div className="spec__row">
        <dt className="label">address</dt>
        <dd className="mono">{state.baseUrl === '' ? location.origin : (state.baseUrl ?? '—')}</dd>
      </div>
    </dl>
  );
}
