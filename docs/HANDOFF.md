# Handoff: remote viewing and testing

Written 2026-08-02. Two goals, neither started:

1. **Tailscale** — reach the dev server from a phone beyond the LAN.
2. **Remote PNG viewing** — Claude takes a screenshot and hands back something
   openable on a phone.

Delete this file once both are done.

---

## Step 0: uncommitted work

`CLAUDE.md` and `README.md` are modified and not committed. Both are documentation
corrections about `browser_take_screenshot` writing outside `.playwright-mcp/`. Review
and commit before starting.

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

## Goal 1: Tailscale

Install **inside WSL**, not on the Windows host. The dev server lives in WSL and the
environment is already suited to it:

- systemd is enabled (`/etc/wsl.conf`), so `tailscaled` runs as a service and survives
  restarts.
- `/dev/net/tun` exists, so no `--tun=userspace-networking` workaround is needed.
- Mirrored networking is on — `eth4` carries the LAN address `192.168.0.164/24`
  directly rather than a NAT'd `172.x`, so no `netsh portproxy` is required.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

`tailscale up` prints a login URL. **The user does that in a browser — do not attempt
to authenticate on their behalf.** Then install Tailscale on the phone and sign into
the same account.

Verify by loading `http://<machine-name>:5173` from the phone on cellular, with wifi
off, to prove it is not just working over the LAN. `tailscale serve` can front it with
HTTPS if mixed-content warnings become a problem.

The Windows machine is always on, so there is no "is the host awake" concern. The Pi is
deliberately off during development and is not part of this.

Vite already binds `0.0.0.0`, so no config change is needed. If the phone gets a host
check error, Vite's `server.allowedHosts` in `apps/web/vite.config.ts` may need the
tailnet hostname.

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

Worth deciding once it works: whether this is even needed. If Tailscale lets the user
load the live dashboard on their phone, a static screenshot is only useful as an
asynchronous record — "here is what I changed while you were away." Do not build
elaborate tooling around it until that question is settled.

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
