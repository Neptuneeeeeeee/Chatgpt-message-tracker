# ChatGPT Message Tracker

**English** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md)

A local Chrome extension that counts the messages **you** send on the ChatGPT website — grouped by mode (`Instant`, `Medium`, `High`, `Extra High`, `Pro`) — so you always know how much you've actually used.

> **Independent local counter. Not affiliated with or endorsed by OpenAI.**
> It does not query official quotas, predict remaining allowance, or provide OpenAI's official usage data.

![ChatGPT Message Tracker UI preview](docs/ui-preview.svg)

---

## Installation

No build step is needed — load the extension directly from this repository:

1. Clone or download this repository, and unzip it if needed.
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the project root folder (the one containing `manifest.json`).
5. Open or refresh [https://chatgpt.com/](https://chatgpt.com/) — a floating counter appears in the bottom-right corner of the page.

## How to Use

1. **Just send messages.** When you send a message on ChatGPT, the extension reads the mode selected next to the composer and records `+1` for that mode once your message actually appears in the conversation.
2. **Watch the floating counter** on the page, or click the extension icon to open the popup for per-mode counts, `+1`, and **Undo**.
3. **Fix mistakes anytime.** Missed or extra counts can be corrected with `+1`, **Undo**, or by deleting recent entries in the popup.
4. **If auto-detection is off**, open the popup and disable **Auto-detect mode** to count under a manually selected mode instead.
5. **Dig deeper on the settings page**: rename modes, add custom modes, view time-range and daily statistics, export your data as JSON, or clear records.

Things that are correctly **not** counted: confirming an IME candidate with Enter, pressing Enter while a reply is still streaming, clearing a draft, or stopping a response.

## Features

- Counts sent messages by mode: `Instant`, `Medium`, `High`, `Extra High`, `Pro`, plus your own custom modes.
- Floating counter widget directly on the ChatGPT page.
- Automatic mode detection at the moment of sending, based on the ChatGPT page's own language and labels — no guessing from your browser language.
- Two independent language settings, each offering 21 language/region choices: **Interface language** and **ChatGPT mode-label language**. Both default to **English**, not the browser language; change them in **Settings → Languages**. Language changes save automatically and preserve custom names and history.
- Time-range statistics (last 3 hours / 24 hours / 7 days / 30 days) and per-day statistics for each mode.
- Manual corrections: `+1`, undo, and deleting recent records.
- Export settings and usage records as JSON.
- Everything stays on your machine, in Chrome's local extension storage.

## Privacy

This extension never uploads data and never stores conversation content. To confirm a send and avoid double counting, it temporarily compares your composer draft with newly rendered messages in page memory; these transient states disappear when the page closes. Each saved record contains only:

- Mode ID
- Timestamp
- Record source (send button, Enter key, or manual entry)

See the full [privacy policy](PRIVACY.md) for details.

## Limitations

- Only works in the Chrome profile where the extension is installed.
- Only counts messages sent on the ChatGPT website — not the mobile app, other browsers, or other devices.
- Automatic detection depends on the ChatGPT page UI; if ChatGPT redesigns its interface, the selectors may need an update.
- It is a personal local counter, not an official OpenAI usage meter.

## Updating

After pulling new code or making changes, go to `chrome://extensions/` and click the reload button on the **ChatGPT Message Tracker** card.

## Development

```sh
npm ci            # install dependencies
npm run check     # static checks
npm test          # unit tests
npm run test:chrome   # load the real extension in an isolated Chrome profile against local test pages
```

Mode-label recognition ships with evidence for 21 language/region variants; sources, original message keys, and SHA-256 hashes are recorded in `docs/site-language-evidence.json`. Re-verify them with:

```sh
node --expose-gc tools/verify-evidence.mjs /path/to/exported-official-assets
```

## Packaging for the Chrome Web Store

```sh
npm ci
npm run check
npm test
python3 tools/build_release.py
```

The script writes the uploadable extension zip and a `publish-kit.zip` (publisher materials, **not** for upload) under `dist/`. The `store/` folder contains the listing copy, permission/privacy justifications, and real UI screenshots. See `store/PUBLISHING.md` for the full checklist.
