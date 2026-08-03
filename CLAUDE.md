# piPulseDashboard

A weather dashboard for a 720 × 720 HyperPixel Square Touch on a Raspberry Pi 5.
`README.md` covers the architecture, API contract, layout bands, and theming — read it
before changing anything structural.

## Scope

This is a first demo, deliberately small: current weather for San Jose on one fixed-size
screen, done well. Do not overbuild it.

Prefer plain CSS and hand-rolled helpers over new dependencies. The pixel sprites and the
runtime payload validation are hand-written on purpose, not for lack of a library.

"Do not overbuild" is about **scope, not tools**. There is no banned-technology list — an
earlier constraint against React, Tailwind and Docker was lifted, and the stack is settled
as Svelte + Vite + Fastify. Adding a dev-tooling script is fine; adding a second screen to
the demo is not.

## Verifying UI changes

The layout is authored at a fixed 720 × 720 and never reflows, so reading the CSS does
not tell you whether it renders correctly. Start the app with `npm run dev` and drive the
Playwright MCP server against `http://localhost:5173` with the viewport set to 720 × 720.
First-run setup is under "Browser automation" in `README.md`.

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

Install Node 22+ from NodeSource. The version in apt is 18, which is too old for Vite and
fails during install.
