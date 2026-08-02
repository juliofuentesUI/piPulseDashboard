# piPulseDashboard

A weather dashboard for a 720 × 720 HyperPixel Square Touch on a Raspberry Pi 5.
`README.md` covers the architecture, API contract, layout bands, and theming — read it
before changing anything structural.

## Scope

This is a first demo, deliberately small: current weather for San Jose on one fixed-size
screen, done well. Do not overbuild it.

Prefer plain CSS and hand-rolled helpers over new dependencies. The pixel sprites and the
runtime payload validation are hand-written on purpose, not for lack of a library.

## Verifying UI changes

The layout is authored at a fixed 720 × 720 and never reflows, so reading the CSS does
not tell you whether it renders correctly. Start the app with `npm run dev` and drive the
Playwright MCP server against `http://localhost:5173` with the viewport set to 720 × 720.
First-run setup is under "Browser automation" in `README.md`.

Do not pass `filename` to `browser_take_screenshot`. Without it the file is auto-named
into `.playwright-mcp/`, which is gitignored; with it the file lands in the repository
root instead and shows up as an untracked stray.

Run `npm run typecheck` before calling a change done — it covers both workspaces.

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
