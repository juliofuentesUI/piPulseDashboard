# piPulseDashboard

A dashboard for a 720 × 720 HyperPixel Square Touch on a Raspberry Pi 5: the San Jose
weather, and what the United States is searching Google for. `README.md` covers the
architecture, API contract, layout bands, and theming — read it before changing anything
structural.

## Scope

The panel is a horizontal carousel of two pages, swiped between:

- **Weather** — the weather for San Jose, on whichever of two fixed-size layouts settings
  has chosen: current conditions or a 7-day forecast.
- **Search Pulse** — what the United States is searching Google for right now.

Both stay deliberately small and are meant to be done well rather than made bigger. Do not
overbuild them.

Prefer plain CSS and hand-rolled helpers over new dependencies. The pixel sprites and the
runtime payload validation are hand-written on purpose, not for lack of a library.

"Do not overbuild" is about **scope, not tools**. There is no banned-technology list for
the stack — an earlier constraint against React, Tailwind and Docker was lifted, and the
stack is settled as Svelte + Vite + Fastify. Adding a dev-tooling script is fine. The
Search Pulse list below is a different thing: it bans sources and methods, not build
tooling, and it does not loosen.

### Search Pulse guardrails

The plan — phases, screen layout, acceptance criteria — is
[docs/search-pulse-plan.md](docs/search-pulse-plan.md). Read it before starting a phase
and update it as phases land.

Search Pulse is built in phases, and **each phase is merged and usable before the next
one starts.** Finishing the current phase is the whole job; do not roll ahead into the
next to "complete the feature".

**The carousel stays two pages: Weather and Search Pulse.** Everything Search Pulse gains
is a view *inside* that one section — the trend list, the details panel, the rank graph,
the daily view — reached by a tap or a vertical switch, never by another card beside the
weather. A horizontal swipe means "change section" and must keep meaning only that.

Everything the screen shows must trace back to the official Google Trending Now feed, or
to an explicit local rule over snapshots we stored ourselves. A field the feed does not
supply is **left out** — never inferred, never approximated, never filled in with a
plausible-looking value. Status labels like `NEW` or `RISING` come from documented rules
in code that a person can read and check, not from a model. Approximate volume stays
labelled approximate; volume buckets are not search counts.

Never add any of these to Search Pulse:

- OpenAI, Gemini, or any other hosted model; local language models
- News summarisation, sentiment analysis, AI categorisation, AI-written conclusions
- Reddit, forums, or any unofficial source; scraping of search-result pages
- Business-idea generation, opportunity scoring, subjective recommendations

Google Trends reports demand movement and nothing else. It does not supply keyword
difficulty, ranking difficulty, cost per click, advertising competition, or conversion
probability, so no value on this screen may be labelled as one of those unless a dedicated
SEO provider is added and is genuinely the thing supplying it.

The question the screen exists to answer is "what searches are suddenly capturing
people's attention right now?", and later "how long did they last?". Anything that does
not serve one of those is out of scope.

## Verifying UI changes

The layout is authored at a fixed 720 × 720 and never reflows, so reading the CSS does
not tell you whether it renders correctly. Start the app with `npm run dev` and drive the
Playwright MCP server against `http://localhost:5173` with the viewport set to 720 × 720.
First-run setup is under "Browser automation" in `README.md`.

There are three layouts — the two weather ones and Search Pulse — and a change to shared
styling, sprites or theming can regress any of them. Check all three, driving the app with
`browser_snapshot` and clicks by accessible name, never by pixel coordinate:

- **Between pages**, click **Show WEATHER** or **Show SEARCH PULSE**, the page indicator at
  the bottom of the panel. Those buttons scroll the same carousel a swipe does, so what
  you capture is what a finger gets.
- **Between weather layouts**, click **Open settings**, then **WEATHER NOW** or
  **7-DAY FORECAST**. Picking one closes the panel and returns to the weather page.

The app always opens on the weather page, showing whichever layout was last chosen.

**720 × 720 is not negotiable, because any other size lies about the artwork.**
[App.svelte](apps/web/src/App.svelte) scales the design by
`Math.min(window.innerWidth, window.innerHeight) / 720`, which is exactly 1 on the
HyperPixel but about 0.54 on a phone. At a fractional scale the sprite grid resamples
unevenly, so layout and touch targets stay honest while sprite crispness and outline
alignment do not. Judge those only at 720 × 720 — a capture, or the panel itself.

Do not pass `filename` to `browser_take_screenshot`. Without it the file is auto-named
into `.playwright-mcp/`, which is gitignored; with it the file lands in the repository
root instead and shows up as an untracked stray.

Run `npm run typecheck` before calling a change done — it covers both workspaces.

## Showing the user the dashboard

When the user asks to see the dashboard — "show me", "send me a screenshot", "what does it
look like now" — use the **`show-dashboard`** skill, or let them invoke it directly as
`/show-dashboard`. It screenshots at 720 × 720 and shows the image inline. That is all it
should do.

**Do not publish an Artifact unless the user asks for one in so many words.** Inline images
render fine on mobile and expand to full width when tapped, so a link buys nothing for a
bare screenshot. Artifacts are for deliverables bigger than a picture — a written report,
several captures compared — and the user says when they want one.

## Remote access

Tailscale lives on the **Windows host**, never inside WSL — installing it in WSL was tried
and abandoned, because mirrored networking conflicts with it. Mirrored networking also
means Windows already reaches the WSL dev server on `localhost`, so `tailscale serve` on
the host is all that is needed. Leave Tailscale installation and `serve`/`funnel` config
to the user on Windows; there is nothing to run for it inside WSL.

Do not change the dev server's `host` or `port`, or add WSL port forwarding, to make
remote access work. Those are not the problem. The one thing the repo needs is
`server.allowedHosts` in `apps/web/vite.config.ts`, which is already set.

## Raspberry Pi deploys

Install **Node 24+** from NodeSource. The version in apt is 18, which is too old for Vite
and fails during install.

The floor moved from 22 to 24 when Search Pulse started storing history: it uses
`node:sqlite`, which Node 22 has only behind `--experimental-sqlite` and 24 has outright.
Built-in SQLite is what keeps this dependency-free and, more to the point, keeps a native
module off a Raspberry Pi.
