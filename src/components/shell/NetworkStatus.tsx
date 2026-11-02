/**
 * The network module: which server is in use, how fast it answered, and an
 * LED for the state. Clicking it lists every address and what each one said
 * the last time we asked.
 */

import { GlobeIcon, RefreshIcon, ServerIcon, SettingsIcon, WifiIcon } from '../Icons';
import { connection, networkKind } from '../../lib/connection';
import { navigate } from '../../lib/nav';
import { useConnection } from '../../hooks/useConnection';
import { ui, type MenuEntry } from '../../state/ui';

export function NetworkStatus({ compact }: { compact?: boolean }) {
  const state = useConnection();
  const kind = networkKind(state);
  const tone =
    state.status === 'online' ? 'led--green' : state.status === 'offline' ? 'led--red' : 'led--yellow';
  const label =
    state.status === 'online'
      ? (state.label ?? 'connected')
      : state.status === 'offline'
        ? 'no server'
        : 'searching…';

  const open = (element: Element) => {
    const entries: MenuEntry[] = [{ id: 'h', label: 'servers', heading: true }];
    for (const candidate of state.candidates) {
      const probe = state.lastProbes.find((p) => p.candidate.id === candidate.id);
      const active = state.candidateId === candidate.id && state.status === 'online';
      entries.push({
        id: candidate.id,
        label: `${candidate.label}${candidate.enabled ? '' : ' (off)'}`,
        icon: <ServerIcon />,
        checked: active,
        hint: probe ? (probe.ok ? `${probe.latencyMs} ms` : 'no route') : '—',
        disabled: true,
      });
    }
    entries.push(
      { id: 's', separator: true },
      { id: 'recheck', label: 're-check now', icon: <RefreshIcon />, onSelect: () => void connection.resolve(true).then(() => ui.toast('servers re-checked')) },
      { id: 'settings', label: 'server settings', icon: <SettingsIcon />, onSelect: () => navigate('/settings#servers') },
    );
    ui.openMenu(entries, element);
  };

  return (
    <button
      type="button"
      className={`netmod ${compact ? 'netmod--compact' : ''}`}
      title="Frequenzy picks the fastest reachable server automatically"
      onClick={(event) => open(event.currentTarget)}
    >
      <span className={`led is-on ${tone} ${state.status === 'resolving' || state.checking ? 'is-blinking' : ''}`} />
      {state.status === 'online' && (kind === 'home' ? <WifiIcon /> : <GlobeIcon />)}
      <span className="netmod__label truncate">{label}</span>
      {state.status === 'online' && state.latencyMs !== null && <span className="netmod__ms tnum">{state.latencyMs}ms</span>}
    </button>
  );
}
