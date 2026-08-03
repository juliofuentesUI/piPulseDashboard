---
name: show-dashboard
description: Screenshot the running piPulse dashboard and show it to the user inline. Use whenever the user asks to see the current state of the app or a particular screen in it - "show me the dashboard", "send me a screenshot", "what does it look like now", "screenshot the settings menu", "how does it look" - including when they are on mobile. Also use after finishing a visual change, when a picture reports the result better than a description. Only publish an Artifact instead if the user explicitly asks for one.
---

# Show the dashboard

**Take the screenshot and show it inline. That is the whole job.**

"Show me a screenshot", "send me a screenshot", "how does it look" - all of these mean take
the picture and put it in the reply. Inline images render everywhere the user reads this,
mobile included, and tapping one expands it to nearly full screen width. Do not build
anything. Do not publish anything. Do not offer to.

Only reach for an Artifact when the user asks for one in so many words - "make me an
artifact", "publish this", "send me a link", "I want a report". Their words are the trigger,
never your own judgement that a link might be nicer.

## Take the screenshot

**1. Make sure the dashboard is running.**

```bash
ss -tln | grep -E "5173|3000"
```

If nothing is listening, start `npm run dev` in the background and wait for Vite to report
ready. Both ports matter: 5173 serves the page, 3000 answers `/api/weather`.

**2. Capture at exactly 720 x 720.**

```
mcp__playwright__browser_navigate        {url: "http://localhost:5173"}
mcp__playwright__browser_resize          {width: 720, height: 720}
mcp__playwright__browser_wait_for        {time: 4}
mcp__playwright__browser_take_screenshot {type: "png", scale: "css"}
```

Four seconds is enough for the weather fetch to resolve. Skip navigate and resize if the
browser is already in the right place from an earlier capture this session.

**Never pass `filename`** - without it the file is auto-named into the gitignored
`.playwright-mcp/`; with it the file lands in the repository root as an untracked stray,
and `--output-dir` does not override that.

720 x 720 is the HyperPixel's real resolution. Capture there always, so proportions are
honest.

**3. Say what to notice.** The picture carries the state; the words should point at what
changed or what to look at.

## A specific screen, not the default view

Drive the UI to the state first, then capture. Click by accessible name, never by pixel
coordinate - the layout is fixed at 720 x 720 but coordinates still rot when the design
moves.

```
mcp__playwright__browser_click {target: "button[aria-label=\"Open settings\"]"}
```

`browser_snapshot` lists what is on screen with stable refs when the selector is not
obvious. Known controls: `Open settings` (the 3x2 dot grid) opens the theme picker, which
offers GBA Blue, Midnight, DMG Green, Brutalist Mono and Amber CRT.

The browser keeps its state between calls. Close a dialog, or navigate afresh, before
capturing the plain dashboard again - otherwise the next screenshot still has the dialog in
it.

## If, and only if, an Artifact was asked for

An Artifact is a published page, so it is worth the extra steps when the deliverable is
more than a picture: a written report of what changed, several captures compared, a
summary to read later. For a bare screenshot it is a wrapper around something that already
worked.

```bash
node scripts/build-capture.mjs --png .playwright-mcp/<the-new-file>.png \
  --note "what changed"          # optional, shown as a metadata cell
```

That writes `.playwright-mcp/capture.html` - the commit, capture time, and live reading
from the API, around the PNG as a data URI. It throws rather than emitting a page that is
not pure ASCII, because the publish-time wrapper is not guaranteed to declare a charset and
literal UTF-8 renders as mojibake. A strict CSP blocks external requests, so anything the
page shows has to be inlined.

Then publish, reusing the existing URL so a bookmark keeps working:

```
Artifact {action: "list"}      -> find the entry titled "piPulse capture"
Artifact {file_path: ".playwright-mcp/capture.html",
          url: "<that URL>",
          favicon: "\U0001F324",
          description: "..."}
```

Omit `url` only if no such entry exists. A conversation that did not itself publish the
artifact will otherwise mint a new URL and strand the bookmark. Give the user the URL in
the reply.

For a report rather than a capture, write your own HTML and publish that instead;
`build-capture.mjs` only knows how to frame a screenshot. Its `page()` function is where
the capture markup lives - never hand-edit a generated `capture.html`.
