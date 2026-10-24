# Pawn Control — Creator Studio

A local-first broadcast controller with brand profiles, named show setups, an explicit draft/live boundary, optional Chess.com widgets, information cards, manual counters and an RSS Feed Ticker. One published output is active at a time.

## Creator Studio workflow

- **Brand profiles** own the profile name, Chess.com identity (optional), channel handle and theme. **Shows** own layouts, content, presets and saved session state. New generic profiles require no Chess.com username and make no chess requests. New/duplicated shows and profiles start with fresh sessions and zero counters.
- Use the Creator Studio panel to create, duplicate, rename and select profiles/shows. Settings, layouts, content and imports save to the selected draft. Browsing or editing a different show does not change the broadcast.
- **Take Live** publishes the selected show after an explicit confirmation. Existing `/overlay?token=...` and `/credits?token=...` URLs follow the published snapshot, even when a logged-in controller opens them. Controller cookies and read-only tokens remain separate.
- Scores, timers, credits/tips playback, counter +/- and explicitly labeled live CTA/RSS playback controls act immediately on the **LIVE** show named at the top. Session controls display the live session. CTA pause in the settings editor is a draft setting; the separate Pause/Resume CTA live button is immediate.
- Information cards and labeled counters are configured in Creator Studio and positioned in Layout studio. Counter values persist per show; the chess session reset controls reset the chess score/timer, not manual counters.
- The first output format remains **landscape 2560 × 1440**, with the existing 1080p preview/downscale. A separate output-format selector and independently authored vertical layouts are deferred. There is no stretched vertical output.

## RSS Feed Ticker

Configure up to ten HTTP/HTTPS RSS or Atom feeds per show, with source labels, enabled flags and ordering. Choose automatic approval or an approval queue, optional publication time, comma-separated include keywords (any match), age limit, rotation/scrolling, interval, speed, font and opacity. Use Layout studio to position the separate RSS widget. Feed configuration is staged until Take Live.

The server refreshes the published show's feeds every five minutes; **Refresh feeds** requests a check. The live queue supports Approve, Reject, Pause, Resume, Skip, Pin and Unpin. Queue approvals and cached items persist per show across publishing switches and restarts. A new refresh updates the pending list without replacing the current headline or restarting its clock. Skip/Pin are intentional immediate changes. A story that expires or is rejected during display finishes its current display interval before disappearing. Pinned stories continue while eligible. Playback clocks are local to each overlay and restart when that source reloads.

Titles are deduplicated case-insensitively across feeds. Missing publication dates use first fetch time for age limits; dates more than five minutes in the future are excluded. Fetch failures keep eligible cached stories and show stale/error status only in the controller. Approval changes made during a refresh are preserved; results from an old published configuration are discarded.

RSS fetching is server-side, uses standard HTTP/HTTPS ports only, rejects credentials and non-public IP addresses (including mixed DNS responses), pins the validated address for the connection, and revalidates redirects. Limits: ten seconds including DNS/redirects, four requests in a redirect chain, 1 MiB per response, 1,000 parsed items and XML depth 32. DTDs/entities are rejected, no external resources are resolved, and display text uses textContent. Compressed responses and XML encodings other than UTF-8 are not supported. Feeds needing cookies, API keys or authentication are out of scope. Tests use mocked feeds; no external subscriptions are created.

## Migration, templates and backups

On first upgrade, the existing `state` document is copied into `studio:v2` inside the existing SQLite database. The original document is retained, including presets, undo and session data. The migrated show is initially both selected and published; new widgets start hidden. Subsequent writes atomically replace the studio document. `.env`, credentials and existing API caches are untouched. Keep a consistent backup of the data directory and `.env` before upgrading. Returning to the old code reads the preserved pre-upgrade state, not changes subsequently made in Creator Studio.

**Export profile template** includes all shows for the selected brand, with personal names, handles and free-form content replaced by placeholders. It excludes credentials, API cache, session/undo history, feed URLs and counter values. Import validates the format, drops unknown nested properties and feed URLs, and creates a new draft brand without modifying the live output. This conservative format deliberately requires the recipient to fill in content and feed URLs.

**Settings → Export backup** retains the selected show's exact settings, presets and session, excluding credentials/API cache. Import replaces that selected draft only; Take Live is still required. For a complete backup of every brand, show and feed queue, back up the SQLite data directory consistently as described below.

The existing widgets, authentication, OBS dock routes and dedicated credits source remain available. No cloud accounts, marketplace, platform API integrations or multitenant hosting are included.

## Quick start

Requires **Node.js 24 LTS** (includes built-in SQLite). No npm packages or build step.

```sh
git clone git@github.com:techtimefly/pawn_control.git
cd pawn_control
npm run setup
# Save the generated login password; setup creates .env with unique credentials.
# Optionally set CHESS_USERNAME for a chess profile.
npm start
```

Open `http://CONTAINER-IP:3000/control` and sign in. Copy the read-only OBS URL from Settings into an OBS Browser Source, width **2560**, height **1440**. Keep the source at native size. The overlay has a transparent background. For uninterrupted updates, leave “Shutdown source when not visible” disabled.

Alternatively, copy `.env.example` to `.env` and set CONTROL_PASSWORD (16+ characters) and OVERLAY_TOKEN (24+ characters). Setup never overwrites an existing `.env`.

Set `CHESS_USERNAME` in the untracked `.env` for the first startup. It seeds a new database only. After that, the saved username in Settings takes precedence; changing the environment variable does not overwrite an existing player or session. A missing/placeholder username creates a generic profile and makes no Chess.com requests. Keep personal values out of `.env.example`.

For a local preview, keep HOST=127.0.0.1. For LXC access, set HOST=0.0.0.0 and allow TCP 3000 from your streaming PC. No Twitch credentials or Chess.com API key are needed. This app does not connect to Twitch chat.

## Requirements and configuration

| Requirement | Details |
| --- | --- |
| Runtime | Node.js 24+ with built-in SQLite; Node 24 LTS is recommended. npm is used for the provided scripts; `npm install` is not needed. |
| Repository access | Git and permission to clone this private repository; the documented SSH URL requires GitHub SSH authentication. |
| LXC service | Debian/Ubuntu with systemd, a `pawn` service user, and Node executable by that user outside `/root`. `curl` is used for the health checks below. |
| Optional Docker deployment | Docker Engine and the Docker Compose plugin; the image includes Node, so the host does not need a separate Node installation. |
| Networking | Outbound HTTPS to `api.chess.com`; streaming PC access to the configured container port (3000 by default). |
| Browser/OBS | A modern browser for controls and OBS Browser Source support; custom browser docks for the controller dock pages. |
| Canvas | OBS Browser Source width 2560, height 1440; OBS may downscale output to 1920 × 1080. |

Set deployment values in the untracked `.env` before first startup:

| Variable | Purpose / requirement |
| --- | --- |
| `CONTROL_PASSWORD` | Control/dock login; 16–1024 characters. No uppercase, digit, or symbol rule. Example values beginning with `replace-` are rejected. |
| `OVERLAY_TOKEN` | Read-only overlay access; at least 24 characters. Example values beginning with `replace-` are rejected. |
| `CHESS_USERNAME` | Optional Chess.com username; leave blank for a generic brand. Subsequent account changes use Settings. |
| `HOST` | `127.0.0.1` for local-only use; `0.0.0.0` for access from your streaming PC. |
| `PORT` | Listening port; defaults to `3000`. |
| `DATA_DIR` | `./data` for local use; **`/var/lib/pawn-control` for the supplied systemd service**. |
| `COOKIE_SECURE` | `false` for plain LAN HTTP; set `true` when accessing the app through HTTPS. |
| `CHESS_USER_AGENT` | Optional API identification header; the example uses `PawnControl/1.0`. |

`npm run setup` generates a random 24-character control password and a 64-character overlay token, saves them in `.env`, and prints the control password. It never overwrites an existing `.env` or silently rotates credentials on service startup. Optionally set the username and set deployment-specific HOST/DATA_DIR afterward. No Chess.com API key, Twitch login, or external database service is required.

## Included

- Reference-inspired charcoal stats card with cyan username, aligned rating rows, and orange streak badge.
- Separate scoreboard and CTA ticker; each widget can be shown, dragged, resized, layered, and locked.
- 1440p layout editor, edge/grid snapping, numeric positioning, and 1080p preview.
- Per-stat visibility and ordering; Minimal, Session, Full, and custom presets.
- Click W/L/D scores to increment, dedicated plus/minus controls, result recording, undo, editable ordered result history, reset, and session timer.
- Ticker with editable/reorderable messages, enabled flags, scrolling or rotation, speed, direction, timing, pause, dynamic values, and appearance controls.
- Chess.com ratings, personal bests, profile/avatar, goals, rating deltas, cached completed-game history, recent form, color win rates, average opponent rating, opening and ending summaries, accuracy coverage, and Puzzle Rush best when available.
- Instant updates to connected overlays through server-sent events (SSE), automatic reconnection, SQLite persistence, settings export/import, and local session history.
- Password-protected control API and separate read-only overlay token. The overlay URL does not embed control credentials, and its token cannot authorize control actions.

## Using the control panel

1. Open `/control` and sign in with CONTROL_PASSWORD. In **Settings**, confirm the player/channel and copy the complete token-bearing OBS overlay URL.
2. In **Layout studio**, enable the widgets you want, drag/resize them, or enter exact coordinates. Use **Lock layout** to prevent accidental dragging. **Save preset** stores a reusable layout; it does not reset scores.
3. In **Stats & visibility**, choose visible rows and their order, the active time control, rating goals, and any manual rating overrides. The active time control controls the highlight and time-control-dependent metrics.
4. In **Session**, record each win/loss/draw. Use Undo for mistakes, Correct totals for count adjustments, and history edits when a result was recorded incorrectly. Start/pause/resume the clock or use Restart timer without clearing results. Reset session starts a new zero-score session.
5. In **CTA ticker**, add/edit/reorder messages, enable the ones to show, and choose scrolling or rotation. Pause ticker freezes movement; Show ticker controls visibility. In a compact CTA dock, expand **Ticker settings** for advanced options. Text/settings save when a control changes; finish a text edit by leaving its field.
6. For in-OBS control, use the combined `/dock` page described below. Add `/overlay?token=...` as the on-stream Browser Source; controller/dock pages are private controls and should not be used as broadcast sources.

Draft changes are saved in SQLite; Take Live publishes structural edits to overlay clients. Routine live controls propagate immediately. Refresh stats checks Chess.com; it never adds results to your manual session.

## Session rules

The session clock has separate Start/Resume, Pause, and Restart controls. Restart returns only the clock to `00:00:00` and starts it immediately; scores, streak, and game history stay intact. Reset session still clears the entire session. Timer actions synchronize between the main panel and OBS docks.

“Record win/loss/draw” and clicking a score append an ordered result. The minus button removes the latest matching result (or reduces a positive manual correction). Editing history recalculates streak. A draw breaks a win/loss streak. Direct total corrections do not fabricate chronological results; streak derives only from recorded results. Win rate is wins / (wins + losses + draws). Recent session results show the last ten ordered entries. Undo restores the previous session, including a reset. New sessions start at zero and snapshot available ratings. Session timer starts paused; start it when going live.

Session scores, streak, best session streak, session win rate, and session results are **manual stream-session statistics**, not imported from Chess.com. Empty values (`—`) or `0W` are expected before you record games. Saved sessions survive app restarts. A running clock measures elapsed wall time, including time while the app is stopped; pause it when ending a stream if you want to resume the same session later.

## API refresh and data meaning

- Profile: startup and daily, subject to upstream cache headers.
- Ratings: startup, then a five-minute scheduler, respecting upstream freshness and conditional requests.
- Current-month archive: fetched only when a historical stat is enabled. Also fetch the previous month for a recent sample across a month boundary.
- Requests are serial, timeout after 15 seconds, use ETag/Last-Modified validators, and back off on errors/429. “Refresh now” requests a check but cannot bypass upstream caching or retry backoff.
- Live scores and playback commands propagate immediately. Visibility, layout and ticker settings are staged until Take Live.
- API failures retain the last good values. The control panel distinguishes last check, last successful response, rating game timestamp, and errors. No sample ratings are presented as live data.
- Optional manual rating overrides are clearly labeled in the panel and removed with “Use API”. Session rating deltas use one baseline per time control; if no rating exists at session start, the first available rating establishes the baseline.
- Historical metrics use up to the last 50 completed standard-chess games in the current and previous UTC months, filtered to the active time control. They are not lifetime statistics. Accuracy averages include only games with accuracy and show coverage. Opening labels are taken from available archive ECO data.

Chess.com data is cached and is **not guaranteed live**. Its documentation describes long refresh windows, so a post-game rating may remain unchanged even after Refresh now. Manual session tracking remains authoritative and is never silently overwritten by archive data.

Official references: [Published-Data API](https://www.chess.com/news/view/published-data-api), [caching guidance](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it).

## Ticker tokens

New installations default to continuous scrolling. Existing installations retain their saved mode: select **CTA ticker → Display mode → Continuous scroll** for moving text and make sure **Pause ticker** is unchecked. Message rotation shows one CTA at a time, changing every configured interval (25 seconds by default).

`{username}`, `{channel}`, `{wins}`, `{losses}`, `{draws}`, `{streak}`, `{blitz_rating}`, `{rapid_rating}`, `{bullet_rating}`, `{blitz_goal}`, `{rapid_goal}`, `{bullet_goal}`. A message with an unavailable rating is skipped. Unknown tokens remain visible so they can be corrected. No enabled/usable messages means the ticker hides. All messages are plain text, never HTML.

## Proxmox LXC deployment

Suggested starting allocation: unprivileged Debian/Ubuntu container, 1 vCPU, 512 MB–1 GB RAM, 4 GB disk, DHCP reservation or static LAN address. Install Node.js 24 LTS using your usual trusted package source and verify `node --version` is v24 or newer. Docker/nesting is not required.

The repository and installation directory use the same name: `pawn_control`. The service expects the checkout at `/opt/pawn_control`. Install Git and configure access to the private repository on the container first.

Before installing the unit, verify the system-wide runtime:

```sh
command -v node
node --version
/usr/bin/node --version
```

The service requires Node.js 24+ at `/usr/bin/node`. If Node exists elsewhere (for example `/usr/local/bin/node`), set `ExecStart` to that absolute path before copying the unit. A root-only nvm installation under `/root` is not accessible to the `pawn` service with `ProtectHome=true`; install Node system-wide instead. If no Node executable is found, install Node.js 24 LTS from a trusted distribution source or the [official Node downloads](https://nodejs.org/en/download) before continuing.

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

The unit remains named `pawn-control.service`, and persistent data stays at `/var/lib/pawn-control`. `StateDirectory=pawn-control` creates that directory at service startup with ownership for `pawn`, before filesystem sandboxing is applied. Only the checkout path uses the underscore. `WorkingDirectory` and `EnvironmentFile` use `/opt/pawn_control`; `ExecStart` invokes `/usr/bin/node` with `/opt/pawn_control/server.mjs`. The service defaults DATA_DIR to `/var/lib/pawn-control`; keep that value in `.env` too, since EnvironmentFile values take precedence. A different DATA_DIR also requires updating the unit's writable-directory settings and permissions.

If Node is installed at a different system-wide path, prefer a persistent override so future service-file updates do not undo it. Run `systemctl edit pawn-control` and enter, for example:

```ini
[Service]
ExecStart=
ExecStart=/usr/local/bin/pawn-node /opt/pawn_control/server.mjs
```

Use the actual executable path on your machine. Do not point it at `/root/.nvm/...` or symlink into `/root`. An independently installed/copied executable such as `/usr/local/bin/pawn-node` must be executable by `pawn`; check with `runuser -u pawn -- /usr/local/bin/pawn-node --version`. If using a copied binary, update that copy when upgrading Node. Drop-ins under `/etc/systemd/system/pawn-control.service.d/` survive replacement of the main unit file.

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

After starting or updating, allow Node to finish initializing and verify readiness rather than relying only on systemd's immediate "active" status:

```sh
curl --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:3000/health
ss -tlnp | grep ':3000'
```

Expected health response: `{"ok":true}`. Replace port 3000 above if you configured another port. Then open `http://CONTAINER-IP:3000/control` from the streaming PC. For ordinary code updates, pull and restart; reload the control panel/dock and refresh the OBS Browser Source to load changed frontend modules. Copy/reload the service unit when its configuration changes, as shown above. Preserve `.env` and DATA_DIR; do not rerun first-time setup to upgrade.

Optional container image: `docker compose up -d --build` after configuring `.env` with real credentials and an optional CHESS_USERNAME. Keep PORT=3000 for the supplied `3000:3000` mapping, or adjust the mapping to match. Compose sets HOST=0.0.0.0 and DATA_DIR=/app/data; a named volume holds SQLite data. The image uses Node 24. This deployment does not use the systemd unit.

### Startup troubleshooting

- `226/NAMESPACE` mentioning a missing `/var/lib/pawn-control`: update the installed unit to the version with `StateDirectory=pawn-control`, then reload systemd. For older units, create it with `install -d -o pawn -g pawn -m 0750 /var/lib/pawn-control`.
- `203/EXEC` and `Unable to locate executable '/usr/bin/node'`: Node is missing at the configured path. Check `command -v node`, install Node 24+ system-wide if necessary, or update `ExecStart` to the real system-wide executable. This error happens before application code runs.
- After correcting the unit/runtime, use `systemctl daemon-reload`, `systemctl reset-failed pawn-control`, `systemctl restart pawn-control`, then `journalctl -u pawn-control -n 50 --no-pager`.
- An error trying to create `/opt/pawn_control/data` under the hardened service: set `.env` DATA_DIR to `/var/lib/pawn-control`, not `./data`, and restart.
- Password/token startup rejection: check the length requirements above and replace example credentials. Do not paste `.env` into logs or support messages.
- A black OBS source: verify the full token-bearing overlay URL, source dimensions 2560×1440, and visibility settings. If that exact URL works in a browser on the streaming PC but OBS stays black, restart OBS and check its browser-source logs if necessary.
- CTA additions on plain HTTP are supported; if an older UI still reports `crypto.randomUUID is not a function`, update the checkout and hard-refresh the control panel/dock.

`StateDirectory` behavior is documented in [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#RuntimeDirectory=).

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

## OBS browser docks

Recommended: add **`http://CONTAINER-IP:3000/dock`** once for a combined dock with **Score / CTA / Credits / Tips** tabs and a single login. Switching tabs stays on the same page and authenticated connection. The selected tab is remembered in that browser across refreshes when local storage is available. The header shows connection status and a Sign out button. The session still expires normally after 12 hours. Separate dock URLs remain available below.

Add these URLs in **OBS → Docks → Custom Browser Docks** (replace CONTAINER-IP):

| Dock | URL | Controls |
| --- | --- | --- |
| Combined | `http://CONTAINER-IP:3000/dock` | Score, CTA, Credits and Tips tabs, one login, remembered tab, shared connection status and sign-out |
| Score | `http://CONTAINER-IP:3000/dock/score` | W/L/D, plus/minus, undo, corrections, reset, result history, and start/pause/restart clock |
| CTA | `http://CONTAINER-IP:3000/dock/cta` | Add/edit/reorder/enable messages, pause/show ticker, scrolling/rotation and appearance settings |

Sign in with your control password inside OBS. These are private controller pages, not on-stream Browser Sources; do not use the read-only overlay token. Both docks share saved state with the main control panel and overlay, and retain their dock mode when refreshed. Start with a width around 360–420 px and resize as needed. Dock links are also available in the main Settings page. Continue using `/overlay?token=...` for the on-stream overlay.


## End credits and chess tips

Both widgets start hidden on the main overlay. Enable them in their editors or Layout Studio; drag, resize, lock, layer, and save them with a layout. Existing settings and saved layouts upgrade without resetting scores. Imported older backups also receive the new defaults.

### End credits Browser Source

1. Open **End credits** in the control panel, or **Credits** in the combined OBS dock. Edit, reorder, and enable sections and entries. The initial editable template uses the supplied hardware/software example; review it before broadcasting.
2. Copy the dedicated **credits Browser Source URL** from that page. It is `/credits?token=YOUR_OVERLAY_TOKEN`; keep it private just like the overlay URL.
3. Add it as a Browser Source to your ending scene, at **2560 x 1440**. The source restarts automatically on OBS source activation and stops/resets on deactivation. Keep **Refresh browser when scene becomes active** enabled as a reload fallback.
4. Credits automatically scroll on page load. The default is a 60-second run followed by a held final message. Choose a total duration or scroll speed, optional looping, font sizes, spacing, colors, and background opacity in Credits settings.

The dedicated source listens to the [OBS per-source activation event](https://github.com/obsproject/obs-browser#register-for-event-callbacks), independently in each browser source. Repeated active notifications do not interrupt playback. Ordinary browser previews still autoplay on load; switching browser tabs does not restart them. Use a dedicated source for the ending scene: if the same OBS source remains active in both scenes, OBS has no deactivation/reactivation to report. This behavior does not restart the main overlay or the editor preview.

Advanced Scene Switcher can activate your ending scene normally; no control-panel click is needed to start credits. If a macro should leave that scene afterward, configure its delay to match your chosen total duration. Pawn Control does not switch OBS scenes or emit a completion event.

**Play live**, **Pause live**, **Restart live**, and **Hide live** affect currently connected credits sources, including the main overlay credits widget when enabled. Play resumes a paused run or replays a completed run. Restart begins from the top. A newly loaded dedicated source autoplays, independently of an earlier hide or pause command, unless OBS has reported it inactive. While inactive, live dock commands cannot start that source; the next activation always restarts it. The dedicated source works even when the main overlay credits widget is hidden.

The editor has separate **local preview** controls: opening the editor and playing its preview do not start credits on live sources. Settings edits are staged until Take Live.

### Chess tips

Open **Chess tips** in the full panel or **Tips** in the combined dock. Add editable text with an optional title and category, enable or reorder entries, select sequential or shuffled playback, and set the rotation interval (5-300 seconds). Enable **Show tips widget**, then position it in Layout Studio. Next, Previous, Pause, and Resume controls update connected viewers. Shuffle avoids repeating the same tip immediately when multiple tips are enabled.

The supplied tips are general chess advice; this widget displays your own text and does not analyze live positions. Empty or disabled tips are skipped. Tip controls and credits controls share the same existing dock login.
