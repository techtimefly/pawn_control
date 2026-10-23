# Verification

Verified locally on Windows with Node.js 24.19.0, October 23, 2026.

## Automated checks

`node --test`: **12 tests passed**. Covers ordered session results, streaks, draws, corrections, nonnegative totals, reset/undo, validation, layout backup round trips, historical aggregates, missing ticker values, API cache validators, 429 backoff, serial fetching, year-boundary archives, authentication, cross-origin rejection, read-only token restrictions, SSE delivery, and SQLite persistence across restart.

## Browser checks

- Signed in to the private control panel.
- Pulled real Chess.com stats for the configured player at initial verification time. Neither that personal username nor the returned ratings are hardcoded into the application.
- Recorded wins, a loss, and a draw; confirmed session totals, win rate, result history, and streak updates.
- Moved the stats widget from X=2070/Y=70 to X=1860/Y=260 by dragging and confirmed saved coordinates.
- Resized the card from 430×390 to 520×480 by its corner handle.
- Enabled the scoreboard, locked the layout, and switched between native and downscaled output previews.
- Applied Minimal and Session visibility presets and verified updated fields.
- Switched the CTA ticker from rotation to scrolling and confirmed substituted messages.
- Opened the read-only overlay in a separate browser view and confirmed new scores propagated immediately.
- Confirmed overlay canvas dimensions 2560×1440, transparent body background, and zero interactive controls.
- No errors/warnings in the final control-panel and overlay browser consoles.

## Deployment checks still needed

The project has not been installed on the user's Proxmox host. Verify the Linux systemd service, LAN firewall/DNS, persistent directory permissions, and actual OBS Browser Source rendering on the streaming PC after deployment. Docker configuration is supplied but was not executed here. API archive edge cases are tested with fixtures; historical aggregates depend on whatever public archive data Chess.com provides.

Preview screenshots contain disposable local test-session results. The shipped project starts with a new zero-score session and contains no preview database or credentials.
