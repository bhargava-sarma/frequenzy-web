/**
 * Owns "which server are we talking to right now", and keeps that answer correct
 * as the device roams between home Wi‑Fi and Tailscale.
 */

import {
  DEFAULT_CANDIDATES,
  hostOfUrl,
  isHomeHost,
  clearResolution,
  loadCachedResolution,
  loadCandidates,
  normalizeBase,
  probe,
  resolveEndpoint,
  saveCandidates,
  saveResolution,
  type ProbeResult,
  type Resolution,
  type ServerCandidate,
} from './endpoint';

export type ConnectionStatus = 'idle' | 'resolving' | 'online' | 'offline';

export interface ConnectionState {
  status: ConnectionStatus;
  /** True while any race is running, including quiet background re-checks. */
  checking: boolean;
  baseUrl: string | null;
  candidateId: string | null;
  label: string | null;
  latencyMs: number | null;
  lastProbes: ProbeResult[];
  lastResolvedAt: number | null;
  candidates: ServerCandidate[];
}

type Listener = (state: ConnectionState) => void;

/** How often we quietly confirm the current address still answers. */
const HEARTBEAT_MS = 45_000;
/** How often we re-race every address, so we can move back to the LAN when we get home. */
const REDISCOVER_MS = 4 * 60_000;

class ConnectionManager {
  private listeners = new Set<Listener>();
  private inflight: Promise<Resolution | null> | null = null;
  private raceId = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private rediscover: ReturnType<typeof setInterval> | null = null;
  private lastHiddenAt = 0;
  private started = false;

  state: ConnectionState = {
    status: 'idle',
    checking: false,
    baseUrl: null,
    candidateId: null,
    label: null,
    latencyMs: null,
    lastProbes: [],
    lastResolvedAt: null,
    candidates: DEFAULT_CANDIDATES,
  };

  constructor() {
    this.state.candidates = loadCandidates();
    const cached = loadCachedResolution();
    if (cached) {
      // Optimistically reuse the last good address so the first paint has data,
      // then confirm (or replace) it in the background.
      const match = this.state.candidates.find((c) => c.id === cached.id);
      this.state.baseUrl = cached.url;
      this.state.candidateId = cached.id;
      this.state.label = match?.label ?? cached.id;
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(patch: Partial<ConnectionState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of [...this.listeners]) fn(this.state);
  }

  getCandidates(): ServerCandidate[] {
    return this.state.candidates;
  }

  setCandidates(list: ServerCandidate[]): void {
    const normalized = list.map((c) => ({ ...c, url: normalizeBase(c.url) }));
    saveCandidates(normalized);
    this.emit({ candidates: normalized });
    void this.resolve(true);
  }

  /** Base URL for API calls. Null until the first successful resolution. */
  get baseUrl(): string | null {
    return this.state.baseUrl;
  }

  /**
   * Resolve now. Concurrent callers share one in-flight race; `force` starts a
   * new one, and only the newest race is allowed to publish its answer.
   *
   * A race run while we are already online is a background check: it does not
   * flip the status, so nothing that is waiting on `ensure()` stalls behind it.
   */
  resolve(force = false): Promise<Resolution | null> {
    if (this.inflight && !force) return this.inflight;
    const id = ++this.raceId;
    const background = this.state.status === 'online';
    this.emit(background ? { checking: true } : { status: 'resolving', checking: true });

    const probes: ProbeResult[] = [];
    const run = resolveEndpoint(this.state.candidates, { onProbe: (p) => probes.push(p) })
      .then((res) => {
        if (id !== this.raceId) return res;
        if (res) {
          saveResolution(res);
          this.emit({
            status: 'online',
            checking: false,
            baseUrl: normalizeBase(res.candidate.url),
            candidateId: res.candidate.id,
            label: res.candidate.label,
            latencyMs: res.latencyMs,
            lastProbes: res.probes,
            lastResolvedAt: res.at,
          });
        } else {
          this.emit({ status: 'offline', checking: false, latencyMs: null, lastProbes: probes });
        }
        return res;
      })
      .finally(() => {
        if (id === this.raceId) this.inflight = null;
      });
    this.inflight = run;
    return run;
  }

  /**
   * Make sure we have an address, resolving if we have never succeeded.
   * Note the explicit null checks: the same-origin candidate's base URL is the
   * empty string, so a truthiness test here would re-race the servers on every
   * single request.
   */
  async ensure(): Promise<string> {
    if (this.state.baseUrl !== null && this.state.status === 'online') return this.state.baseUrl;
    const res = await this.resolve();
    if (res) return normalizeBase(res.candidate.url);
    if (this.state.baseUrl !== null) return this.state.baseUrl; // stale but worth a try
    throw new Error('No Frequenzy server is reachable on this network.');
  }

  /** Called by the API client when a request dies at the transport layer. */
  async handleNetworkFailure(): Promise<string | null> {
    clearResolution();
    if (this.state.status === 'online') this.emit({ status: 'resolving' });
    const res = await this.resolve(true);
    return res ? normalizeBase(res.candidate.url) : null;
  }

  private async beat() {
    const base = this.state.baseUrl;
    if (base === null) {
      void this.resolve();
      return;
    }
    if (this.inflight) return;
    const current = this.state.candidates.find((c) => c.id === this.state.candidateId);
    const result = await probe(current ?? { id: 'current', label: 'Current', url: base, priority: 0, enabled: true }, 4000);
    if (!result.ok) void this.resolve(true);
    else if (this.state.status !== 'online') this.emit({ status: 'online', latencyMs: result.latencyMs });
    else this.emit({ latencyMs: result.latencyMs });
  }

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    void this.resolve();

    this.heartbeat = setInterval(() => void this.beat(), HEARTBEAT_MS);
    this.rediscover = setInterval(() => void this.resolve(true), REDISCOVER_MS);

    window.addEventListener('online', () => void this.resolve(true));
    window.addEventListener('offline', () => this.emit({ status: 'offline' }));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.lastHiddenAt = Date.now();
      } else if (Date.now() - this.lastHiddenAt > 15_000) {
        // Coming back from the background is the single most likely moment for
        // the network to have changed underneath us.
        void this.resolve(true);
      }
    });

    const conn = (navigator as unknown as { connection?: EventTarget }).connection;
    conn?.addEventListener?.('change', () => void this.resolve(true));
  }

  stop(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.rediscover) clearInterval(this.rediscover);
    this.heartbeat = null;
    this.rediscover = null;
    this.started = false;
  }
}

export const connection = new ConnectionManager();

/**
 * Home or away, judged by the address currently in use. Same-origin mode is
 * judged by the address the app itself was loaded from, since that is where
 * the API calls go.
 */
export function networkKind(state: ConnectionState = connection.state): 'home' | 'remote' {
  const base = state.baseUrl;
  const host = base ? hostOfUrl(base) : typeof location !== 'undefined' ? location.hostname : '';
  return isHomeHost(host) ? 'home' : 'remote';
}
