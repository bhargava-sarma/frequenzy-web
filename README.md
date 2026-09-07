# Frequenzy

A music client for [Navidrome](https://www.navidrome.org/) that looks and behaves like Apple
Music, streams your files without transcoding them, and follows you between home Wi‑Fi and
Tailscale without ever asking which one you are on.

---

## What it does

**Bit-perfect playback.** Every stream is requested with `format=raw&maxBitRate=0`, which tells
Navidrome to hand back the file on disk untouched. A 24‑bit/96 kHz FLAC arrives as a 24‑bit/96 kHz
FLAC — no re-encode, no resample, no loss. Tracks are badged **Lossless** or **Hi‑Res Lossless** in
the interface so you can see it is working, and *Get Info* shows the exact sample rate, bit depth
and stream URL in use.

**Automatic server selection.** Frequenzy knows about more than one address for your server and
races them. Every enabled address is probed in parallel; the most preferred one that answers wins.
It re-races whenever the network moves — coming back from the background, a `navigator.connection`
change, an `online` event, a failed request, or every four minutes — so walking out of the house
mid-song simply continues on Tailscale.

**Two interfaces, not one shrunk down.** On desktop: sidebar navigation, the centred LCD transport,
hover-to-play artwork, click/shift/cmd multi-select with a batch toolbar. On a phone: a bottom tab
bar, a mini player you flick up to open, a full player you pull down to dismiss, rows you swipe
sideways to act on, and long-press action sheets. Both share liquid-glass panels with real
refraction — an SVG displacement map, not just a blur — and a full-screen player lit by colours
pulled out of the artwork.

**Synced lyrics with romanization.** Lyrics come from your server first (embedded tags or `.lrc`
sidecars, via the OpenSubsonic `getLyricsBySongId` endpoint) and fall back to
[LRCLIB](https://lrclib.net/). Non-Latin lyrics are **transliterated, never translated** — 사랑해요
becomes "saranghaeyo", not "I love you" — with the original line kept above the reading.

**Offline downloads.** Albums, playlists and single tracks can be kept on the device. The original
bytes go into IndexedDB and play back from there, so a downloaded album works with no server in
reach at all. IndexedDB rather than the Cache API on purpose: the Cache API is restricted to secure
contexts, and Frequenzy is served over plain HTTP so it can reach a plain-HTTP Navidrome.

---

## Gestures and shortcuts

On a phone:

| Gesture | What it does |
| --- | --- |
| Swipe a track **left** | Play Next / Play Last (and Remove, inside a playlist) |
| Swipe a track **right** | Favourite, or add to a playlist |
| Swipe far in either direction | Runs the first action without lifting your finger |
| **Long-press** a track | Opens the full action sheet, headed by what you pressed |
| Swipe the **mini player** up | Opens the full player |
| Swipe the **mini player** sideways | Previous / next track |
| Pull the **player** down | Dismisses it |
| Swipe the **artwork** sideways | Previous / next track |
| **Pull down** on a list | Refreshes it |
| Drag a queue row's grip | Reorders the queue |

On desktop, click selects a row, ⇧-click extends the selection and ⌘/Ctrl-click toggles one; a
floating toolbar then plays, queues, favourites or playlists everything selected at once.

---

## Quick start

```bash
npm install
npm run build
node server/serve.mjs --port 4544 --upstream http://127.0.0.1:4533
```

Then open `http://<your-server>:4544` from any device and sign in with your Navidrome credentials.

`--upstream` is worth setting: it makes the host proxy the Subsonic API from its own origin, which
means no CORS to configure and one network hop instead of two. Frequenzy detects that setup on its
own and prefers it (see **Same-origin mode** below).

For development:

```bash
npm run dev        # http://localhost:5173
```

---

## How the network switching works

Frequenzy ships with three candidate addresses, in priority order:

| Priority | Name         | Address                     |
| -------- | ------------ | --------------------------- |
| `-100`   | This server  | *(same origin)*             |
| `0`      | Home Wi‑Fi   | `http://192.168.68.107:4533` |
| `10`     | Tailscale    | `http://100.91.236.120:4533` |

On startup — and again whenever the network looks like it changed — all three are probed at once
with `ping.view`. A candidate counts as reachable only if it returns a real Subsonic envelope, so a
static file server answering `404` cannot be mistaken for Navidrome.

The first success starts a short grace window (900 ms) before settling, which lets a slightly slower
but more-preferred address still win the race. In practice:

- **At home:** the LAN address answers in single-digit milliseconds and wins.
- **Away, on Tailscale:** the LAN address has no route and fails; Tailscale wins.
- **At home *and* on Tailscale:** both answer, and the LAN address wins on priority — you get the
  fast path automatically.

The winner is cached in `localStorage`, so the next launch starts talking to the right server
immediately while re-probing in the background. If a request ever fails at the transport layer, the
race is re-run and the request retried once against the new winner — a song that starts on the LAN
and finishes on Tailscale never surfaces an error.

The sidebar's connection chip shows which address is live and how fast it answered; click it to see
every candidate's status and force a re-check. Addresses are editable in **Settings → Servers**.

### Same-origin mode

If you run `server/serve.mjs` with `--upstream`, it serves the app *and* proxies `/rest/*` to
Navidrome. The app then reaches the API at its own origin, which:

- removes CORS from the equation entirely,
- keeps everything on one connection,
- and works identically over LAN and Tailscale, because both addresses hit the same host.

This is the recommended way to run it. The direct-address mode still works and is what `npm run dev`
uses; it needs Navidrome to send permissive CORS headers on `/rest` (which it does by default). If
your reverse proxy strips them, use same-origin mode instead.

### HTTP, HTTPS and mixed content

Browsers refuse to let an `https://` page talk to an `http://` address. Since both of your server
addresses are plain HTTP, **serve Frequenzy over HTTP too** (as `serve.mjs` does). If you later put
the app behind TLS, put Navidrome behind the same TLS origin and use same-origin mode.

---

## Romanization

The goal is transliteration — how the words *sound*, spelled with the Latin alphabet — so you can
sing along to a language you do not read. Nothing is ever translated.

| Script | Approach |
| --- | --- |
| **Korean** | Revised Romanization, including liaison and consonant assimilation. 좋아요 → *joayo*, 신라 → *silla*, 같이 → *gachi* |
| **Japanese** | Hepburn. Kana is table-driven; kanji uses the Kuromoji morphological analyzer, loaded on demand |
| **Chinese** | Hanyu Pinyin via `pinyin-pro`, loaded on demand. Tone marks optional |
| **Cyrillic** | Russian, Ukrainian, Serbian, Bulgarian and Macedonian letters. Елена → *Yelena* |
| **Greek** | ISO 843 transcription with digraphs (μπ → *b*, ου → *ou*) |
| **Indic** | Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam. ज़िंदगी → *zindagi*, संगीत → *sangeet*, இசை → *isai* |
| **Thai** | RTGS-shaped, with a syllable state machine for onset/final position. สวัสดี → *sawatdi* |
| **Arabic / Hebrew** | Consonant skeleton plus whatever vowels are written. These scripts omit most short vowels, so a transliteration can only reproduce what is on the page |

A lyric sheet is analysed as a whole document, not line by line — that is how Han characters in a
Japanese song get read as Japanese rather than Mandarin.

The Kuromoji dictionary is ~18 MB and is copied out of `node_modules` into `public/dict/` by
`scripts/sync-dict.mjs` (run automatically on `install`, `dev` and `build`). It is fetched only when
a lyric actually contains kanji, and it is deliberately not committed to git.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `⌘` / `Ctrl` + `←` `→` | Previous / next track |
| `Shift` + `←` `→` | Seek 10 seconds |
| `⌘` / `Ctrl` + `↑` `↓` | Volume |
| `M` | Mute |
| `S` | Shuffle |
| `R` | Cycle repeat |
| `F` | Full-screen player |
| `⌘` / `Ctrl` + `F` | Search |
| `⌘` / `Ctrl` + `A` | Select every track in the list |
| `Esc` | Clear the selection, or close the player |

Media keys and the OS lock screen work through the Media Session API.

---

## Project layout

```
src/
  lib/
    connection.ts    which server we are on, and keeping that answer correct
    endpoint.ts      the probe-and-race logic
    subsonic.ts      Subsonic/OpenSubsonic client, raw-stream URLs, failover retry
    lyrics.ts        fetch, parse (including enhanced word-timed LRC), cache, sync
    romanize/        one module per script, plus the orchestrator
    color.ts         palette extraction from artwork
    md5.ts           Subsonic salted-token auth (WebCrypto has no MD5)
  state/
    player.tsx       dual-element playback engine, queue, Media Session, scrobbling
    library.tsx      playlists and favourites, shared app-wide
    settings.tsx     preferences
    downloads.ts     offline storage in IndexedDB, and blob-URL playback
    history.ts       local "Recently Played"
  hooks/
    useGestures.ts   swipe, long-press, sheet drag, pull-to-refresh, drag-reorder
    useLayout.ts     compact vs regular shell
  components/        interface, with mobile/ for the tab bar and mini player
  routes/            pages
  styles/            design tokens, liquid glass, layout, player, mobile shell
server/serve.mjs     static host with optional Subsonic proxy
```

### Playback engine

Two `<audio>` elements take turns. While one plays, the other pre-buffers the next track starting
20 seconds before the current one ends; at the track boundary the engine swaps to the element that
is already loaded, so the gap between tracks is a swap rather than a fresh connection. Crossfade
uses the same pair — the incoming track starts early and the two volumes ramp past each other.

The elements are deliberately kept out of the DOM and out of the Web Audio graph — routing through
`AudioContext` would resample everything to the context's rate, which is exactly the loss this app
exists to avoid.

**Autoplay** keeps things going when the queue empties: it asks the server for songs similar to the
last one played, falling back to a random pull from the same genre when there is no similarity data.

**The sleep timer** counts down or waits for the end of the current track, then fades out over three
seconds rather than cutting off.

---

## Configuration

Everything is in **Settings**:

- **Playback** — lossless passthrough (on by default), scrobbling, autoplay, crossfade
- **Lyrics** — romanization mode, whether to show the original script, pinyin tone marks
- **Appearance** — theme, liquid glass, ambient artwork colour, reduce motion
- **Servers** — add, edit, reorder and enable/disable addresses; see live probe results
- **Downloads** — how much is stored on this device, and a way to clear it
- **Library** — trigger a Navidrome rescan
- **Account** — sign out

Your password is never stored. Frequenzy derives Subsonic's salted MD5 token once at sign-in and
keeps only the salt and token.

---

## Installing as an app

Frequenzy ships a web manifest and icons, so it installs to the dock or home screen from any
Chromium browser or iOS Safari ("Add to Home Screen") and runs without browser chrome.

---

## Licence

MIT.
