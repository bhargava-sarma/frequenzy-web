#!/usr/bin/env node
/**
 * Frequenzy host.
 *
 * Serves the built app and — if you point it at a Navidrome instance — proxies
 * the Subsonic API from the same origin. Same origin means no CORS to think
 * about and one hop instead of two, which is why the client prefers it over the
 * direct addresses whenever it answers.
 *
 *   node server/serve.mjs --port 4544 --upstream http://127.0.0.1:4533
 *
 * Environment variables work too: FREQUENZY_PORT, FREQUENZY_UPSTREAM, FREQUENZY_HOST.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const PORT = Number(arg('port', process.env.FREQUENZY_PORT ?? 4544));
const HOST = arg('host', process.env.FREQUENZY_HOST ?? '0.0.0.0');
const UPSTREAM = (arg('upstream', process.env.FREQUENZY_UPSTREAM ?? '') || '').replace(/\/+$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  // Kuromoji fetches these and gunzips them in JavaScript, so they must NOT be
  // sent with Content-Encoding: gzip or the browser would decompress them first.
  '.gz': 'application/octet-stream',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Length': Buffer.byteLength(body), ...headers });
  res.end(body);
}

/** Streams a request through to Navidrome, preserving range requests. */
function proxy(req, res) {
  const target = new URL(req.url, UPSTREAM);
  const upstream = new URL(UPSTREAM);
  const headers = { ...req.headers, host: upstream.host };
  delete headers['accept-encoding']; // let the client and Navidrome negotiate directly

  const client = upstream.protocol === 'https:' ? import('node:https') : import('node:http');
  void client.then(({ default: mod }) => {
    const forward = mod.request(
      {
        protocol: upstream.protocol,
        hostname: upstream.hostname,
        port: upstream.port || (upstream.protocol === 'https:' ? 443 : 80),
        method: req.method,
        path: target.pathname + target.search,
        headers,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    forward.on('error', (err) => {
      console.error('[frequenzy] upstream error:', err.message);
      if (!res.headersSent) send(res, 502, 'Upstream unavailable');
      else res.end();
    });
    req.pipe(forward);
  });
}

function serveFile(res, filePath, status = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  res.writeHead(status, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    // Hashed asset filenames are safe to cache forever; everything else is not.
    'Cache-Control': /\.[0-9a-f]{8,}\./i.test(path.basename(filePath))
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    send(res, 400, 'Bad request');
    return;
  }

  // Subsonic API and Navidrome's own endpoints, when an upstream is configured.
  if (UPSTREAM && (req.url.startsWith('/rest/') || req.url.startsWith('/share/'))) {
    proxy(req, res);
    return;
  }

  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  // Resolve inside dist and refuse anything that climbs out of it.
  const candidate = path.join(dist, requestPath);
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(path.resolve(dist))) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    serveFile(res, resolved);
    return;
  }

  // A missing file that clearly wants to *be* a file (it has an extension) is a
  // 404, not the app shell. Serving index.html here would turn a missing asset
  // into a confusing parse error somewhere downstream.
  if (path.extname(requestPath)) {
    send(res, 404, 'Not found');
    return;
  }

  // Single-page app: unknown routes fall through to index.html.
  const index = path.join(dist, 'index.html');
  if (fs.existsSync(index)) {
    serveFile(res, index);
    return;
  }

  send(res, 404, 'Frequenzy has not been built yet — run `npm run build` first.');
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Frequenzy is serving ${path.relative(root, dist)} on http://${HOST}:${PORT}`);
  if (UPSTREAM) console.log(`  Proxying /rest → ${UPSTREAM} (same-origin mode, no CORS needed)`);
  else console.log('  No --upstream set: the app will connect to Navidrome directly from the browser.');
  console.log('');
});
