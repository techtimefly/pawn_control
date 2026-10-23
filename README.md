# Pawn Control

A self-hosted chess broadcast desk for **twitch.tv/jamespawn**, pulling public Chess.com data for a configurable player. Designed for a Proxmox LXC on your LAN and a **2560 × 1440 OBS base canvas**, downscaled to 1920 × 1080.

## Quick start

Requires **Node.js 24 LTS** (includes built-in SQLite). No npm packages or build step.

```sh
npm run setup
# Save the generated login password; setup creates .env with unique credentials.
# Edit .env and set CHESS_USERNAME to your Chess.com username.
npm start
```

Open `http://CONTAINER-IP:3000/control` and sign in. Copy the read-only OBS URL from Settings into an OBS Browser Source, width **2560**, height **1440**. Keep the source at native size. The overlay has a transparent background. For uninterrupted updates, leave “Shutdown source when not visible” disabled.

Alternatively, copy `.env.example` to `.env` and set CONTROL_PASSWORD (16+ characters) and OVERLAY_TOKEN (24+ characters). Setup never overwrites an existing `.env`.

Set `CHESS_USERNAME` in the untracked `.env` for the first startup. It seeds a new database only. After that, the saved username in Settings takes precedence; changing the environment variable does not overwrite an existing player or session. A missing/placeholder username blocks first startup rather than fetching a sample account. Keep personal values out of `.env.example`.

For a local preview, keep HOST=127.0.0.1. For LXC access, set HOST=0.0.0.0 and allow TCP 3000 from your streaming PC. No Twitch credentials or Chess.com API key are needed. This app does not connect to Twitch chat.

## Included

- Reference-inspired charcoal stats card with cyan username, aligned rating rows, and orange streak badge.
- Separate scoreboard and CTA ticker; each widget can be shown, dragged, resized, layered, and locked.
- 1440p layout editor, edge/grid snapping, numeric positioning, and 1080p preview.
- Per-stat visibility and ordering; Minimal, Session, Full, and custom presets.
- Click W/L/D scores to increment, dedicated plus/minus controls, result recording, undo, editable ordered result history, reset, and session timer.
- Ticker with editable/reorderable messages, enabled flags, scrolling or rotation, speed, direction, timing, pause, dynamic values, and appearance controls.
- Chess.com ratings, personal bests, profile/avatar, goals, rating deltas, cached completed-game history, recent form, color win rates, average opponent rating, opening and ending summaries, accuracy coverage, and Puzzle Rush best when available.
- Instant updates to connected overlays through server-sent events (SSE), automatic reconnection, SQLite persistence, settings export/import, and local session history.
- Password-protected control API and separate read-only overlay token. Overlay clients never receive the control password or session cookie.

## Session rules

“Record win/loss/draw” and clicking a score append an ordered result. The minus button removes the latest matching result (or reduces a positive manual correction). Editing history recalculates streak. A draw breaks a win/loss streak. Direct total corrections do not fabricate chronological results; streak derives only from recorded results. Win rate is wins / (wins + losses + draws). Recent session results show the last ten ordered entries. Undo restores the previous session, including a reset. New sessions start at zero and snapshot available ratings. Session timer starts paused; start it when going live.

## API refresh and data meaning

- Profile: startup and daily, subject to upstream cache headers.
- Ratings: startup, then a five-minute scheduler, respecting upstream freshness and conditional requests.
- Current-month archive: fetched only when a historical stat is enabled. Also fetch the previous month for a recent sample across a month boundary.
- Requests are serial, timeout after 15 seconds, use ETag/Last-Modified validators, and back off on errors/429. “Refresh now” requests a check but cannot bypass upstream caching or retry backoff.
- Local scores, visibility, layout, and ticker changes propagate immediately.
- API failures retain the last good values. The control panel distinguishes last check, last successful response, rating game timestamp, and errors. No sample ratings are presented as live data.
- Optional manual rating overrides are clearly labeled in the panel and removed with “Use API”. Session rating deltas use one baseline per time control; if no rating exists at session start, the first available rating establishes the baseline.
- Historical metrics use up to the last 50 completed standard-chess games in the current and previous UTC months, filtered to the active time control. They are not lifetime statistics. Accuracy averages include only games with accuracy and show coverage. Opening labels are taken from available archive ECO data.

Chess.com data is cached and is **not guaranteed live**. Its documentation describes long refresh windows, so a post-game rating may remain unchanged even after Refresh now. Manual session tracking remains authoritative and is never silently overwritten by archive data.

Official references: [Published-Data API](https://www.chess.com/news/view/published-data-api), [caching guidance](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it).

## Ticker tokens

`{username}`, `{channel}`, `{wins}`, `{losses}`, `{draws}`, `{streak}`, `{blitz_rating}`, `{rapid_rating}`, `{bullet_rating}`, `{blitz_goal}`, `{rapid_goal}`, `{bullet_goal}`. A message with an unavailable rating is skipped. Unknown tokens remain visible so they can be corrected. No enabled/usable messages means the ticker hides. All messages are plain text, never HTML.

## Proxmox LXC deployment

Suggested starting allocation: unprivileged Debian/Ubuntu container, 1 vCPU, 512 MB–1 GB RAM, 4 GB disk, DHCP reservation or static LAN address. Install Node.js 24 LTS using your usual trusted package source and verify `node --version` is v24 or newer. Docker/nesting is not required.

The repository and installation directory use the same name: `pawn_control`. The service expects the checkout at `/opt/pawn_control`. Install Git and configure access to the private repository on the container first.

As root inside the container, for a new installation:

```sh
useradd --system --home /opt/pawn_control --shell /usr/sbin/nologin pawn
mkdir -p /opt /var/lib/pawn-control
git clone git@github.com:techtimefly/pawn_control.git /opt/pawn_control
cp /opt/pawn_control/.env.example /opt/pawn_control/.env
# Edit /opt/pawn_control/.env with a 16+ character password, 24+ character token,
# and HOST=0.0.0.0. Generate random credentials with your password manager.
# Set CHESS_USERNAME to your Chess.com username before first startup.
# Set DATA_DIR=/var/lib/pawn-control.
chown -R pawn:pawn /var/lib/pawn-control
chown root:pawn /opt/pawn_control/.env
chmod 640 /opt/pawn_control/.env
cp /opt/pawn_control/deploy/pawn-control.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pawn-control
systemctl status pawn-control
```

The unit remains named `pawn-control.service`, and persistent data stays at `/var/lib/pawn-control`. Only the checkout path uses the underscore. `WorkingDirectory`, `EnvironmentFile`, and `ExecStart` all point to `/opt/pawn_control`. The service defaults DATA_DIR to `/var/lib/pawn-control`; keep that value in `.env` too, since EnvironmentFile values take precedence.

For an existing installation already at `/opt/pawn_control`, update the installed service after pulling:

```sh
git -C /opt/pawn_control pull --ff-only
cp /opt/pawn_control/deploy/pawn-control.service /etc/systemd/system/pawn-control.service
systemctl daemon-reload
systemctl restart pawn-control
systemctl status pawn-control
```

If your checkout is elsewhere, adjust all three service paths before installing it. If migrating from `/opt/pawn-control`, preserve its `.env` and continue using the existing `/var/lib/pawn-control` data directory. Do not rerun first-install commands over an existing configuration.

The service uses `/usr/bin/node`; adjust ExecStart if your Node installation differs. Logs: `journalctl -u pawn-control -f`. Health: `curl http://127.0.0.1:3000/health`. Keep LAN access restricted to trusted devices. For remote use, prefer your VPN. HTTP passwords are visible to observers on the network; use a TLS reverse proxy if the LAN is not trusted. Set COOKIE_SECURE=true when serving through HTTPS. A proxy must forward SSE without buffering and permit long-lived connections.

Optional container image: `docker compose up -d --build` after configuring `.env` with HOST=0.0.0.0. The volume holds SQLite data; the image uses Node 24.

## Backups and maintenance

### Secrets and Git

Commit `.env.example` with placeholders, never the real `.env`. The two application secrets are CONTROL_PASSWORD and OVERLAY_TOKEN. Generate them on the LXC with `npm run setup`, or supply them through the service environment. Chess.com public data needs no API key, and the Twitch channel link needs no Twitch token. Keep SSH deployment keys outside the project and never put them in browser code. If GitHub Actions deployment is added, store deployment credentials in GitHub Actions secrets, not repository files.

The ignore rules exclude `.env` variants (except `.env.example`), runtime data, databases, logs, and common private-key files. The Docker build context excludes these too. Ignore rules do not remove already tracked secrets; if a real credential is ever committed, rotate it and remove it from history as appropriate. Application files live at the repository root; development preview data and credentials must remain outside the repository.

Include DATA_DIR and `.env` in protected Proxmox backups. SQLite uses WAL; stop the service for a manual file copy, or use a consistent container snapshot. The Settings export is a portable settings/session backup, excluding credentials and API cache. Import validates and replaces settings/session, leaving credentials unchanged. Saved layouts include appearance and widget configuration, not scores. Keep tokens out of screenshots and source control. Rotate the overlay token in `.env` and restart if leaked.

## Development and verification

```sh
npm test
npm start
```

Tests exercise session/streak rules, undo/reset, validation, ticker substitutions, cache behavior, authentication, read-only overlay access, persistence, and realtime delivery. Browser QA should also check a real OBS source for transparency, readability at 1080p, reconnection, and network access from the streaming PC. This project can be prepared locally without access to your Proxmox host; deployment and real OBS verification remain host-side steps.

## Files

`server.mjs` HTTP/auth/realtime server · `setup.mjs` first-run configuration · `lib/` state, storage, API adapter · `public/` control panel and overlay renderer · `test/` tests · `deploy/` LXC service · `.env.example` configuration.
