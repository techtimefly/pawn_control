# Verification — Creator Studio branch

Verified on LV426 on October 24, 2026 with Node.js 24.19.0 from the bundled Codex runtime. The default PATH Node is 22.22.3 and was not used for validation.

## Automated checks

- Full `node --test`: **51 passed, 0 failed** (29 original tests plus 22 new tests).
- `node --check` on every tracked/new JavaScript module: passed.
- `git -c core.whitespace=cr-at-eol diff --check`: passed (repository contains mixed LF/CRLF files).
- HTTP integration checks exercise login, cross-origin rejection, controller-only mutations, token read-only access, new static module routes, SSE and restart persistence.
- New regressions cover preserved legacy state/presets/session/undo, idempotent database migration, isolated profiles/shows, shared brand identity, explicit publishing, live actions during draft browsing, optional chess without network requests, portable template sanitization and validation, and queue persistence across show switching/restart.
- RSS fixtures exercise RSS/Atom plain text, malformed/DTD/entity/size/depth rejection, IPv4/IPv6 and alternate IP spellings, private/mixed DNS answers, pinned transport destinations, redirect validation/limits, DNS/response timeouts, deduplication, keyword/age filtering, manual/automatic approval, rejection persistence, missing dates, stale cache retention, pause/skip/pin and uninterrupted headline timing.
- HTTP race tests exercise approval/rejection/pause while a fetch is pending, publishing another show during a fetch, and discarding stale results without overwriting the new output.

The initial sandboxed suite could not connect to its loopback test server (`EACCES`); rerunning with approved loopback access passed. No external RSS feed or Chess.com account is needed by the tests. Test databases use temporary directories and are cleaned up.

## Unrun checks and limitations

Browser QA was attempted through the available browser automation tool; it reported no apps or browsers (`apps: [], browsers: []`). A subsequent direct attempt to create an in-app browser tab also returned `Browser is not available: iab`. Consequently this branch has not had visual/browser interaction QA, narrow dock QA, or browser console verification. The HTTP and pure playback tests do not replace those checks. Before use, verify profile create/duplicate/switch, draft edits, cancelled/repeated Take Live, reload/reconnect, information/counter rendering, RSS scrolling/rotation and approval controls in a real browser.

Real OBS, scene activation, transparency/readability, LAN/proxy behavior, Docker and Linux service deployment were not run. No deployment or external publication was performed. Previous branch browser/OBS-related notes are historical and are not a verification of this branch.

Landscape 2560 × 1440 and vertical 1080 × 1920 now have independently saved layouts and a staged output-format selector. One format is live at a time; landscape retains the 1080p preview. No format requirement remains deferred. RSS playback clocks restart on source reload and are local to each source. Feed support is bounded UTF-8 RSS/Atom over standard HTTP/HTTPS; compressed/authenticated feeds are unsupported.

## Independent output-format follow-up

Six additional tests cover exact legacy landscape preservation and idempotent format migration, repeated switching without cross-layout changes, active/inactive canvas bounds, draft/published isolation, per-show isolation, preset/backup/template round trips, and SQLite restart persistence with a different editor/live format. The shared format dimensions drive layout editor bounds and pointer math, overlay canvas size, dedicated credits source size and credits/editor preview sizing. Visual rendering and OBS dimension changes still require manual verification; no UI/OBS pass is claimed.
