/**
 * Automatic server selection.
 *
 * Frequenzy is reachable at more than one address: the LAN address when you are
 * on home Wi-Fi and the Tailscale address when you are away. Nobody should ever
 * have to flip a switch, so we probe every configured address in parallel and
 * keep the best one that answers, re-probing whenever the network moves under us.
 */

export interface ServerCandidate {
  id: string;
  label: string;
  url: string;
  /** Lower wins when several addresses answer. */
  priority: number;
  enabled: boolean;
}

/**
 * An empty `url` means "same origin" — the case where Frequenzy is served by
 * something that also proxies Navidrome (see `npm run serve`). It wins outright
 * when it answers, because same-origin means no CORS and no second hop.
 */
export const SAME_ORIGIN = '';

export const DEFAULT_CANDIDATES: ServerCandidate[] = [
  { id: 'same-origin', label: 'This server', url: SAME_ORIGIN, priority: -100, enabled: true },
  { id: 'lan', label: 'Home Wi‑Fi', url: 'http://192.168.68.107:4533', priority: 0, enabled: true },
  { id: 'tailscale', label: 'Tailscale', url: 'http://100.91.236.120:4533', priority: 10, enabled: true },
];

export interface ProbeResult {
  candidate: ServerCandidate;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface Resolution {
  candidate: ServerCandidate;
  latencyMs: number;
  at: number;
  probes: ProbeResult[];
}

const STORAGE_KEY = 'frequenzy.endpoint.v1';
const CANDIDATES_KEY = 'frequenzy.servers.v1';

/** Trim a trailing slash so we can concatenate paths safely. */
export function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function loadCandidates(): ServerCandidate[] {
  try {
    const raw = localStorage.getItem(CANDIDATES_KEY);
    if (!raw) return DEFAULT_CANDIDATES;
    const parsed = JSON.parse(raw) as ServerCandidate[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CANDIDATES;
    return parsed.map((c) => ({ ...c, url: normalizeBase(c.url) }));
  } catch {
    return DEFAULT_CANDIDATES;
  }
}

export function saveCandidates(list: ServerCandidate[]): void {
  try {
    localStorage.setItem(CANDIDATES_KEY, JSON.stringify(list));
  } catch {
    /* storage may be unavailable in private mode; selection still works in-memory */
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * The address we loaded the app from is, by definition, reachable right now. If
 * one of the candidates lives on that same host we already know which network we
 * are on, so it gets to jump the queue.
 */
function effectivePriority(c: ServerCandidate): number {
  if (typeof location !== 'undefined' && hostOf(c.url) && hostOf(c.url) === location.hostname) {
    return c.priority - 1000;
  }
  return c.priority;
}

export async function probe(candidate: ServerCandidate, timeoutMs = 3500): Promise<ProbeResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${normalizeBase(candidate.url)}/rest/ping.view?c=frequenzy&v=1.16.1&f=json&u=probe&p=probe`;
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal, cache: 'no-store', mode: 'cors' });
    clearTimeout(timer);
    if (!res.ok) {
      return { candidate, ok: false, latencyMs: Math.round(performance.now() - started), error: `HTTP ${res.status}` };
    }
    // An unauthenticated ping still returns a Subsonic envelope (with an auth
    // error inside), and that envelope is what proves we reached Navidrome
    // rather than, say, a static file server returning its index page.
    const body = (await res.json()) as { 'subsonic-response'?: unknown };
    const ok = body['subsonic-response'] !== undefined;
    return {
      candidate,
      ok,
      latencyMs: Math.round(performance.now() - started),
      error: ok ? undefined : 'not a Subsonic server',
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      candidate,
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ResolveOptions {
  /** How long to keep waiting for a better (higher priority) address after the first success. */
  graceMs?: number;
  timeoutMs?: number;
  onProbe?: (result: ProbeResult) => void;
}

/**
 * Probe every enabled address at once and settle on the best one that answers.
 * The first success starts a short grace window so a slightly slower — but more
 * preferred — address (the LAN, usually) can still win the race.
 */
export async function resolveEndpoint(
  candidates: ServerCandidate[] = loadCandidates(),
  opts: ResolveOptions = {},
): Promise<Resolution | null> {
  const { graceMs = 900, timeoutMs = 3500, onProbe } = opts;
  const active = candidates.filter((c) => c.enabled && (c.url === SAME_ORIGIN || /^https?:\/\/.+/i.test(c.url)));
  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) => effectivePriority(a) - effectivePriority(b));
  const bestPossible = effectivePriority(sorted[0]);
  const results: ProbeResult[] = [];

  return new Promise<Resolution | null>((resolve) => {
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    let pending = sorted.length;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (graceTimer) clearTimeout(graceTimer);
      const winners = results
        .filter((r) => r.ok)
        .sort((a, b) => {
          const p = effectivePriority(a.candidate) - effectivePriority(b.candidate);
          return p !== 0 ? p : a.latencyMs - b.latencyMs;
        });
      if (winners.length === 0) {
        resolve(null);
        return;
      }
      const w = winners[0];
      resolve({ candidate: w.candidate, latencyMs: w.latencyMs, at: Date.now(), probes: results });
    };

    for (const candidate of sorted) {
      probe(candidate, timeoutMs).then((result) => {
        results.push(result);
        pending -= 1;
        onProbe?.(result);
        if (settled) return;
        if (result.ok) {
          // The most-preferred address answered — no reason to keep waiting.
          if (effectivePriority(result.candidate) === bestPossible) finish();
          else if (!graceTimer) graceTimer = setTimeout(finish, graceMs);
        }
        if (pending === 0) finish();
      });
    }
  });
}

export function loadCachedResolution(): { url: string; id: string; at: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.url !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveResolution(res: Resolution): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ url: normalizeBase(res.candidate.url), id: res.candidate.id, at: res.at }),
    );
  } catch {
    /* ignore */
  }
}

export function clearResolution(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
