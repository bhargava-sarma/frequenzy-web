# Frequenzy

A network music player for [Navidrome](https://www.navidrome.org/), built like a piece of hardware:
aluminium or graphite casework, a black dot-matrix display, keys with travel, LEDs, a volume knob.
It streams your files untouched, follows you between home Wi‑Fi and Tailscale on its own, and is
fast — nothing re-renders four times a second while a song plays, lists are virtualised, and every
page you have seen comes back instantly from cache.

---

## The design

Modern, retro, industrial. One system, used everywhere:

- **Two finishes** — *aluminium* (light) and *graphite* (dark), or follow the system.
- **Seven accents** — orange, blue, green, yellow, red, pink or mono. Signal colours (blue, green,
  yellow, orange) mark kinds of action, the way coloured keys do on a sampler.
- **The display** — a black LCD with a dot-matrix clock and readouts, used for now-playing, the
  mini player, stats and storage.
- **Keys, knob, fader** — primary keys drop onto their edge when pressed, function keys carry LEDs,
  volume is a knob you drag or scroll, sliders have fader caps.
- **Type** — Space Grotesk for text, JetBrains Mono for labels and numbers, Doto for the
  dot-matrix readouts.
- **Motion** — short, purposeful, and off entirely with *reduce motion* (or the OS setting).

On desktop: a sidebar, a deck along the bottom (display, transport, function keys, knob) and an
inspector panel for the queue, lyrics or track info. On a phone: a tab bar, a mini player, a
full-screen player sheet, swipeable rows and long-press action sheets. Both are designed, neither is
the other shrunk down.

---

## Features

**Playback**
- Gapless playback on two alternating `<audio>` elements; optional equal-power **crossfade** (1–12 s).
- **Speed** 0.5–2× with pitch preserved, **A–B loop**, **sleep timer** (minutes or end of track,
  with a fade).
- **ReplayGain** (track or album) with pre-amp — only ever turns tracks down.
- **Autoplay**: when the queue runs out, keep going with similar music.
- Squared volume curve, so the bottom of the knob is usable.
- Recovers on its own: retries a failed stream, reconnects after a network change, unsticks a
  stalled stream, resumes where it was.
- **Media Session**: lock screen, media keys, headphone controls.
- **Hand-off**: optionally mirror the queue to the server and pick it up on another device.

**Quality**
- *Original* sends the file on disk, bit-for-bit (`format=raw`). A 24‑bit/96 kHz FLAC arrives as
  one, and is badged **lossless** / **hi‑res**.
- Separate quality **at home** and **away** (LAN vs Tailscale/internet), with transcode to MP3,
  Opus or AAC at 96–320 kbps when you want to save data.

**Queue**
- Play next, play last, drag to reorder (mouse or finger), swipe to remove, jump anywhere.
- Undo for destructive changes (clear, remove, replace), shuffle up next, save queue as playlist.
- Drag albums, playlists or tracks onto the queue, a sidebar playlist, or the pinned shelf.

**Library**
- Home (recently played, recently added, on repeat, rediscover), Browse, Albums, Artists, Songs,
  Genres, Playlists, Favourites, Recently added, History, Downloads.
- Sort and filter everywhere, grid or list, three card sizes, A–Z rail on artists.
- Album pages split by disc, with album notes; artist pages with top songs, releases grouped into
  albums, EPs, singles, compilations and live, similar artists and a sanitised bio.
- Playlists: create, rename, describe, reorder, remove, make public, duplicate, export as M3U.
- Multi-select (click, ⇧-click, ⌘/Ctrl-click) with a batch bar: play, queue, favourite, add to
  playlist, download.
- **Pins**: keep albums, artists and playlists one click away in the sidebar.

**Radio**
- Internet radio stations from Navidrome.
- Mixes: everything, favourites, by decade, by genre.
- Stations from any song, album or artist — similar music, endlessly.

**Lyrics**
- Synced lyrics from the server (embedded or `.lrc`), falling back to [LRCLIB](https://lrclib.net/).
- Search and pick a different lyric, nudge timing ±, three text sizes, tap a line to seek.
- **Romanization** — transliterated, never translated (see below).

**Stats**
- A local listening log (a listen counts after 30 s or half the track): listens, hours, artists,
  songs, day streak, a heat-map of every day, by hour, by weekday, top songs/artists/albums.
- 7 days, 30 days, a year or all time. Export or clear.

**Offline**
- Keep albums, playlists or tracks on the device (IndexedDB) and play them with no server at all.

**Fast to drive**
- **Command palette** (⌘/Ctrl K): every page, every action, your library, as you type.
- Keyboard shortcuts for everything (press `?`), including `g`-prefixed navigation.
- Context menus on everything, with submenus; action sheets on phones.
- Pull to refresh, scroll position restored on back, data cached and revalidated in the background.

---

## Gestures and shortcuts

On a phone:

| Gesture | What it does |
| --- | --- |
| Swipe a track **left** | Play next / add to queue (and remove, inside a playlist) |
| Swipe a track **right** | Favourite, or add to a playlist |
| Swipe far in either direction | Runs the first action without lifting your finger |
| **Long-press** a track | Opens the action sheet |
| Tap or flick up the **mini player** | Opens the full player |
| Swipe the **mini player** sideways | Previous / next track |
| Pull the **player** down | Dismisses it |
| **Pull down** on a page | Refreshes it |
| Drag a queue row's grip | Reorders the queue |
| Swipe a queue row left | Remove, or play next |

Keyboard (also listed in the app with `?`):

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `N` / `P` | Next / previous track |
| `←` `→` | Seek 5 s (`⇧` for 30 s) |
| `0`–`9` | Jump to 0–90% |
| `+` / `−` | Volume |
| `M` | Mute |
| `S` / `R` / `A` | Shuffle / repeat / autoplay |
| `B` | A–B loop: set A, set B, clear |
| `[` `]` `\` | Slower / faster / normal speed |
| `H` | Favourite the current track |
| `F` `L` `Q` `I` `T` | Full player, lyrics, queue, info, sleep timer |
| `G` then `H` `B` `R` `A` `I` `S` `P` `F` `Y` `D` `T` `,` | Go to home, browse, radio, albums, artists, songs, playlists, favourites, history, downloads, stats, settings |
| `⌘`/`Ctrl` `K` | Command palette |
| `/` | Search |
| `⌘`/`Ctrl` `A` | Select every track in a list |
| `Esc` | Close, or clear the selection |

---

## Quick start

```bash
npm install
npm run build
node server/serve.mjs --port 4544 --upstream http://127.0.0.1:4533
```

Then open `http://<your-server>:4544` from any device and sign in with your Navidrome credentials.

`--upstream` makes the host proxy the Subsonic API from its own origin: no CORS to configure and one
network hop instead of two. Frequenzy detects that setup on its own and prefers it.

For development:

```bash
npm run dev        # http://localhost:5173
npm run typecheck
```

---

## How the network switching works

Frequenzy ships with three candidate addresses, in priority order:

| Priority | Name         | Address                      |
| -------- | ------------ | ---------------------------- |
| `-100`   | This server  | *(same origin)*              |
| `0`      | Home Wi‑Fi   | `http://192.168.68.107:4533` |
| `10`     | Tailscale    | `http://100.91.236.120:4533` |

On startup — and whenever the network looks like it changed (coming back from the background, a
`navigator.connection` change, an `online` event, a failed request, or every few minutes) — all of
them are probed at once with `ping.view`. A candidate counts only if it returns a real Subsonic
envelope, so a static file server answering `404` cannot be mistaken for Navidrome. The most
preferred address that answers wins:

- **At home:** the LAN address answers in milliseconds and wins.
- **Away, on Tailscale:** the LAN address has no route; Tailscale wins.
- **At home and on Tailscale:** both answer; the LAN address wins on priority.

The winner is cached, so the next launch talks to the right server immediately while re-probing in
the background. A request that fails at the transport layer re-runs the race and retries once, so a
song that starts on the LAN and finishes on Tailscale never surfaces an error. Background re-checks
never block a request that is already on its way.

The network chip in the sidebar shows which address is live and how fast it answered; click it to
see every candidate and force a re-check. Addresses are editable in **Settings → servers**.

Browsers refuse to let an `https://` page talk to an `http://` address, so serve Frequenzy over HTTP
(as `serve.mjs` does), or put Navidrome behind the same TLS origin and use `--upstream`.

---

## Romanization

Transliteration — how the words *sound*, in the Latin alphabet — so you can sing along to a
language you do not read. Nothing is ever translated: 사랑해요 becomes *saranghaeyo*, not
"I love you", with the original line kept above the reading.

| Script | Approach |
| --- | --- |
| **Korean** | Revised Romanization, with liaison and consonant assimilation. 좋아요 → *joayo*, 신라 → *silla* |
| **Japanese** | Hepburn. Kana is table-driven; kanji uses the Kuromoji analyzer, loaded on demand |
| **Chinese** | Hanyu Pinyin via `pinyin-pro`, loaded on demand. Tone marks optional |
| **Cyrillic** | Russian, Ukrainian, Serbian, Bulgarian, Macedonian. Елена → *Yelena* |
| **Greek** | ISO 843 with digraphs (μπ → *b*, ου → *ou*) |
| **Indic** | Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam |
| **Thai** | RTGS-shaped, with a syllable state machine. สวัสดี → *sawatdi* |
| **Arabic / Hebrew** | Consonant skeleton plus whatever vowels are written |

The Kuromoji dictionary (~18 MB) is copied out of `node_modules` into `public/dict/` by
`scripts/sync-dict.mjs` (run on `install`, `dev` and `build`), fetched only when a lyric contains
kanji, and not committed.

---

## Project layout

```
src/
  lib/
    store.ts         tiny external store + selector hook (useSyncExternalStore)
    query.ts         stale-while-revalidate cache: dedupe, prefetch, invalidation
    queries.ts       every server query as a cached hook, plus loaders and prefetchers
    subsonic.ts      Subsonic/OpenSubsonic client, stream URLs, failover retry
    connection.ts    which server we are on, and keeping that answer correct
    endpoint.ts      the probe-and-race logic
    lyrics.ts        fetch, parse (incl. word-timed LRC), choose, offset, cache
    romanize/        one module per script, plus the orchestrator
    stats.ts         the listening log and its summaries (merges safely across tabs)
    downloads.ts     offline storage in IndexedDB and blob playback
    history.ts       recently played
  state/
    player.ts        the playback engine and queue, as an external store
    settings.ts      preferences, applied to the document as data attributes
    ui.ts            menus, dialogs, palette, toasts, panels
    library.ts       playlists and favourites
    actions.ts       every user-facing action, with toasts and undo
    menus.tsx        context menus for songs, albums, artists, playlists
    shortcuts.ts     the keyboard table — the handler and the help sheet both read it
    queueSync.ts     optional queue hand-off through the server
    pins.ts          the pinned shelf
  hooks/             layout, scroller + virtual rows, gestures, drop targets, data
  components/
    shell/           sidebar, deck, inspector, tab bar, mini player, network chip
    player/          display, transport, full player, tape deck, lyrics, queue
    overlays/        menu, dialogs, command palette, toasts
  routes/            pages
  styles/            tokens, base, controls, shell, content, overlays, player, pages
server/serve.mjs     static host with optional Subsonic proxy
```

### Playback engine

Two `<audio>` elements take turns. While one plays, the other pre-buffers the next track; at the
boundary the engine swaps to the one already loaded, so the gap is a swap rather than a fresh
connection. Crossfade uses the same pair with equal-power ramps. The elements stay out of the Web
Audio graph on purpose — an `AudioContext` would resample everything to its own rate.

The engine lives outside React. Components subscribe to exactly the slice they draw, and the
playback position has a store of its own, so only the scrubber and clock redraw as a song plays.

---

## Installing as an app

Frequenzy ships a web manifest and icons, so it installs to the dock or home screen from any
Chromium browser or iOS Safari ("Add to Home Screen") and runs without browser chrome.

Your password is never stored: Frequenzy derives Subsonic's salted token at sign-in and keeps only
the salt and token.

---

## Licence

MIT.
