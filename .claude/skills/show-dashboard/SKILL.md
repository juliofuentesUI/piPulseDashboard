---
name: show-dashboard
description: Show the user the running piPulse dashboard - either as a quick inline screenshot or as a published Artifact link they can open on a phone. Use whenever the user asks to see the current state of the app or a particular screen in it - "show me the dashboard", "what does it look like now", "send me a screenshot", "screenshot the settings menu", "how does it look", "send me a link to see it" - and especially when they are away from the machine or on mobile. Also use after finishing a visual change, when reporting the result would be clearer as a picture than a description.
---

# Show the dashboard

Two ways to do this. Inline is the default; publishing is for when it earns the extra steps.

| Ask | Do this |
| --- | --- |
| "how does it look", "did that work", checking a screen or state | **Quick look** - inline screenshot |
| Iterating on a change, several looks in a row | **Quick look** every time |
| "send me a link", something to bookmark or come back to | **Published link** |
| Judging sprite crispness, outlines, pixel alignment | **Published link**, and say to tap 1:1 |
| "what changed while I was away", an async handoff | **Published link** |

Inline renders fine on mobile - verified, not assumed. But it arrives around a quarter of
the screen width, roughly 0.2 scale, so it answers "is the layout intact" and cannot answer
"are the sprites crisp".

When it is genuinely ambiguous, take the quick look and offer the link in the same reply.
Do not publish twice for one request.

## Quick look

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
browser is already there from an earlier capture in the same session.

**Never pass `filename`** - without it the file is auto-named into the gitignored
`.playwright-mcp/`; with it the file lands in the repository root as an untracked stray,
and `--output-dir` does not override that.

720 x 720 is the HyperPixel's real resolution. Capture there even for a quick look, so the
proportions are honest.

**3. Say what changed** in the reply. The picture shows the state; the words should say
what to notice in it.

## A specific screen, not the dashboard

Drive the UI to the state first, then capture as above. Click by accessible name, never by
pixel coordinate - the layout is fixed but coordinates still rot when the design moves.

```
mcp__playwright__browser_click {target: "button[aria-label=\"Open settings\"]"}
```

`browser_snapshot` lists what is on screen with stable refs when the selector is not
obvious. Known controls: `Open settings` (the 3x2 dot grid) opens the theme picker,
which offers GBA Blue, Midnight, DMG Green, Brutalist Mono and Amber CRT.

Remember the browser keeps its state between calls. Close a dialog, or navigate afresh,
before capturing the plain dashboard again.

## Published link

Steps 1 and 2 above, then:

**3. Build the page.** A shell script cannot call an MCP tool, so the screenshot has to
come from step 2; this script handles everything after it.

```bash
node scripts/build-capture.mjs --png .playwright-mcp/<the-new-file>.png \
  --note "what changed"          # optional, shown as a metadata cell
```

It reads the commit, the capture time, and the live reading from the API, then writes
`.playwright-mcp/capture.html`. It throws rather than emitting a page that is not pure
ASCII - the publish-time wrapper is not guaranteed to declare a charset, and literal UTF-8
renders as mojibake.

**4. Publish, keeping the same URL.** The user bookmarks this link, so reuse it rather than
minting a new one:

```
Artifact {action: "list"}      -> find the entry titled "piPulse capture"
Artifact {file_path: ".playwright-mcp/capture.html",
          url: "<that URL>",
          favicon: "\U0001F324",
          description: "..."}
```

Omit `url` only if no such entry exists. A conversation that did not itself publish the
artifact will otherwise mint a new URL and strand the user's bookmark.

**5. Give the user the URL** in the reply. That is the deliverable - not the local path.

## The page

`scripts/build-capture.mjs` owns the markup. It is theme-aware (the dashboard's own
`gba-blue` and `midnight` palettes, so it follows the reader's device) and carries a
FIT / 1:1 toggle, because a fit-width view is browser-resampled and cannot be trusted for
sprite edges while the 1:1 view can.

Change the design by editing the script's `page()` function, never by hand-editing a
generated `capture.html`.
