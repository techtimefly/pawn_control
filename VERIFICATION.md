# Verification

Verified locally on Windows with Node.js 24.19.0, October 23, 2026.

## Automated checks

`node --test`: **32 tests passed**. Covers ordered session results, streaks, draws, corrections, nonnegative totals, reset/undo, validation, layout backup round trips, historical aggregates, missing ticker values, API cache validators, 429 backoff, serial fetching, year-boundary archives, authentication, cross-origin rejection, read-only token restrictions, SSE delivery, SQLite persistence across restart, ticker timing/pause/scroll calculations, HTTP-compatible CTA IDs, explicit timer commands, and dock routes.

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

Combined dock follow-up: `/dock` was browser-verified with one sign-in, Score/CTA switching in the same page, and selected-tab restoration after refresh. It shares one authenticated event connection, exposes connection status and sign-out, and retains the separate dock URLs. The combined route is included in the existing HTTP/auth integration checks.

Dock/timer follow-up: verified Score and CTA pages in browser views at 380 px width, password login, starting/pausing/restarting the clock, preserved scores/history after restart, and adding an additional CTA. Both dock consoles were free of errors/warnings. OBS embedding itself remains a deployment-side check.

Ticker follow-up: replaced the interval/Web Animations implementation with an elapsed-time renderer and repeated scrolling content. A browser fixture verified rotation at a two-second interval and moving scroll text while receiving state updates every 250 milliseconds. Pause held the same text and transform across observations; resume and hide/show restored visible motion without console errors. Actual OBS verification is still required on the streaming PC.

The project has not been installed on the user's Proxmox host. Verify the Linux systemd service, LAN firewall/DNS, persistent directory permissions, and actual OBS Browser Source rendering on the streaming PC after deployment. Docker configuration is supplied but was not executed here. API archive edge cases are tested with fixtures; historical aggregates depend on whatever public archive data Chess.com provides.

Preview screenshots contain disposable local test-session results. The shipped project starts with a new zero-score session and contains no preview database or credentials.


## Credits and tips branch

The 26-test suite additionally covers legacy database/settings/preset migration, old backup import, credits duration and speed calculations, play-once/loop behavior, isolated playback timelines, tip navigation/shuffle/pause, new input validation, static module routes, and read-only token restrictions for playback commands.

Browser checks verified the four-tab dock with one login; dedicated credits autoplay; live pause and restart; independent local preview playback while the live source stayed paused; held final message; and tip Next/Pause/Resume controls. A five-second disposable configuration was used for timing checks. Real OBS scene activation and Advanced Scene Switcher integration still require verification on the streaming PC.


OBS activation fix: three additional regression tests simulate per-source activation events and exercise the real credits timeline. They verify inactive reset, restart on reactivation, duplicate-event handling, activation before settings arrive, suppression of off-air dock commands, active pause/resume, source independence, and browser-only autoplay. The full 29-test suite passes; the new module is also served by the HTTP integration test. Event name/payload were checked against the official obsproject/obs-browser documentation and implementation. Actual OBS scene switching remains a streaming-PC verification step.


## Optional authentication

October 24, 2026: all 32 tests pass. New authentication tests cover strict AUTH_REQUIRED parsing and default behavior, conditional credential validation, token-free reads and SSE, password-free control actions, retained cross-origin/JSON/input checks, and returning to protected mode with expired pre-restart cookies and preserved results. Existing protected-mode tests still verify read-only tokens cannot write.

Browser checks verified a password-free combined dock with an authentication-disabled indicator and hidden Sign out, score recording, token-free overlay and credits rendering, clean source URLs in Settings, and a protected dock that still requires login and shows Sign out after authentication. The open control panel had no console warnings or errors. Disposable previews used loopback addresses and contain no production data. LXC/Compose deployment and real OBS embedding remain host-side verification steps.
