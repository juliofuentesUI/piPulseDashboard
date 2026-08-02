# Handoff: remote viewing and testing

Written 2026-08-02. Two goals:

1. ~~**Tailscale** — reach the dev server from a phone beyond the LAN.~~ **Done** — see
   "Goal 1" below for what shipped.
2. **Remote PNG viewing** — Claude takes a screenshot and hands back something
   openable on a phone. **Still open.**

Delete this file once Goal 2 is done.

Repo convention: branch, commit, `git merge --ff-only` back to `main`, delete the
branch. No PRs — this is a solo repo.

---

## What already works

Playwright MCP is installed and functional. Do not redo any of this.

- Registered in **both** scopes: `.mcp.json` (project, committed) and `~/.claude.json`
  (user). Both pinned to `--browser chromium`.
- `chrome-for-testing` is downloaded to `~/.cache/ms-playwright/`. No install needed.
- `.playwright-mcp/` is gitignored and holds all output.
- README has a "Browser automation" section; CLAUDE.md has the usage rules.

**A new session will have the `mcp__playwright__*` tools.** The previous session did
not, because the server was added to `.mcp.json` mid-conversation and Claude Code only
connects MCP servers at startup. Everything below assumes a fresh session where the
tools are present — verify with `/mcp` before assuming otherwise.

### Taking a screenshot

```
npm run dev                       # API on :3000, Vite on :5173
mcp__playwright__browser_resize          {width: 720, height: 720}
mcp__playwright__browser_navigate        {url: "http://localhost:5173"}
mcp__playwright__browser_wait_for        {time: 4}
mcp__playwright__browser_take_screenshot {type: "png", scale: "css"}
```

**Do not pass `filename`.** With it, the file lands in the repo root as an untracked
stray; `--output-dir` does not override this. Without it, the file is auto-named into
`.playwright-mcp/`. Four seconds of wait is enough for the weather fetch to resolve.

For clicking, use `browser_snapshot`, not screenshots. It returns an accessibility tree
with stable refs — `button "Refresh weather" [ref=e16]`, `button "Open settings"
[ref=e22]` — and `browser_click` takes the ref. No pixel coordinates anywhere.

---

## Goal 1: Tailscale — done

**Tailscale runs on the Windows host, not in WSL.** Installing inside WSL was tried and
abandoned: systemd and `/dev/net/tun` are both present, so it looked viable, but mirrored
networking conflicts with Tailscale in WSL. Do not retry it.

The Windows-host arrangement is simpler anyway. Mirrored networking shares `localhost`
between Windows and WSL, so Windows reaches the WSL dev server with no port forwarding,
and Tailscale's address surfaces inside WSL as a `100.x` on its own interface.

Setup lives in README under "Remote access over Tailscale". The short version, from
PowerShell with `npm run dev` running in WSL:

```powershell
tailscale serve --bg 5173
tailscale serve status
```

`serve`, not `funnel` — `serve` is tailnet-only, while `funnel` publishes the dev server
to the internet and its hostname is discoverable in public Certificate Transparency logs.

The only repo change this needed was `server.allowedHosts: ['.ts.net']` in
`apps/web/vite.config.ts`. `tailscale serve` preserves the original `Host` header, so
requests arrive as the tailnet FQDN and Vite blocks them otherwise. Verified by spoofing
the header locally — `.ts.net` and bare IPs pass, everything else still gets
`Blocked request`.

The Windows machine is always on, so there is no "is the host awake" concern. The Pi is
deliberately off during development and is not part of this.

**HMR works over the tailnet**, verified by editing a component and watching a phone on
cellular hot-update without a reload. No `server.hmr` config is needed: Vite's injected
client derives protocol, host and port from the *page* URL rather than from the dev server
config, so an HTTPS page yields `wss://<fqdn>` on 443 by itself, and `tailscale serve`
forwards the upgrade.

**Do not "fix" this with `server.hmr.clientPort`.** Pinning it overrides that page-derived
logic for every client, so plain `localhost:5173` dev would be told to open `wss://localhost:443`
and local HMR would break. There is no problem to solve here.

---

## Goal 2: remote PNG viewing

**Untested — this is a plan, not a verified recipe.**

Local file paths cannot work here. A path like
`/home/juliofuentes408/projects/piPulseDashboard/.playwright-mcp/page-*.png` means
nothing to a phone, and markdown image syntax pointing at one did not render in the
VSCode extension chat. Only a URL reaches another device.

Suggested approach — publish as an Artifact:

1. Take the screenshot as above.
2. Base64 the PNG (~55 KB of text for a 41 KB image, well within limits).
3. Write a small self-contained HTML file embedding it as a `data:image/png;base64,…`
   URI. A strict CSP blocks external requests, so the image must be inlined.
4. Publish with the `Artifact` tool. Load the `artifact-design` skill first.

That yields a private claude.ai URL, openable on a phone signed into the same account.

Both goals are worth having, because they answer different questions.

`App.svelte` scales the fixed 720 × 720 design by
`Math.min(window.innerWidth, window.innerHeight) / 720`, so a phone shows the whole
dashboard centered and never clips it — roughly 0.54 on a 390 px-wide viewport. Layout
and touch behaviour are therefore honest on a phone.

Pixel fidelity is not. At a fractional scale the sprite grid resamples unevenly, so
sprite crispness and outline alignment can only be judged at exactly 720 × 720 — a
screenshot, or the HyperPixel itself. Keep the screenshot path for that, and for
asynchronous "here is what changed while you were away" handoffs.

---

## Environment facts

- Node 24 in WSL. Pi deploys need Node 22+ from NodeSource; apt's 18 is too old for Vite.
- npm workspaces: `apps/api` (Fastify, :3000), `apps/web` (Svelte 5 + Vite, :5173).
- `npm run typecheck` covers both workspaces.
- A background `npm run dev` may still be running from the previous session. Check
  before starting another.
- There is no banned-technology list. An earlier constraint against React, Tailwind,
  Docker and similar was explicitly lifted on 2026-08-02; the stack is settled as
  Svelte + Vite + Fastify. "Do not overbuild" in CLAUDE.md is about scope, not tools.
