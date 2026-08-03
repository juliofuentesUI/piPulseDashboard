---
name: show-dashboard
description: Capture the running piPulse dashboard at 720x720 and publish it as an Artifact link the user can open on a phone. Use whenever the user asks to see the current state of the dashboard or app - "show me the dashboard", "what does it look like now", "send me a screenshot", "screenshot the app", "how does it look", "send me a link to see it" - and especially when they are away from the machine or on mobile. Also use after finishing a visual change, when reporting the result would be clearer as a picture than a description.
---

# Show the dashboard

Produces a private claude.ai URL the user can tap on a phone. Confirmed to render there;
do not assume an inline screenshot is visible to them instead.

## Why a link and not just a screenshot

A local path like `.playwright-mcp/page-*.png` means nothing on a phone, and markdown
image syntax pointing at one does not render in chat. Only a URL reaches another device.
A published page also outlives the dev server, which makes it the right shape for
"here is what changed while you were away".

## Sequence

**1. Make sure the dashboard is running.**

```bash
ss -tln | grep -E "5173|3000"
```

If nothing is listening, start it with `npm run dev` in the background and wait for Vite
to report ready. Both ports matter: 5173 serves the page, 3000 answers `/api/weather`.

**2. Capture at exactly 720 x 720** with the Playwright MCP server:

```
mcp__playwright__browser_navigate        {url: "http://localhost:5173"}
mcp__playwright__browser_resize          {width: 720, height: 720}
mcp__playwright__browser_wait_for        {time: 4}
mcp__playwright__browser_take_screenshot {type: "png", scale: "css"}
```

Four seconds is enough for the weather fetch to resolve. **Never pass `filename`** - without
it the file is auto-named into the gitignored `.playwright-mcp/`; with it the file lands in
the repository root as an untracked stray, and `--output-dir` does not override that.

720 x 720 is not optional. It is the HyperPixel's real resolution, and sprite crispness can
only be judged there.

**3. Build the page.** A shell script cannot call an MCP tool, so the screenshot has to come
from step 2; this script handles everything after it.

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
