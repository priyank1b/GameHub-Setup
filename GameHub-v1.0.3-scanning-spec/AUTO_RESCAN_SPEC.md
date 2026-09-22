# GameHub v1.0.3 — Automatic Game Rescan Specification

## Objective
Allow users to automatically discover newly installed games while retaining manual Rescan.

## Settings

```text
Automatic Game Rescan

[ ] Automatically rescan for newly installed games

Rescan interval
[ 1 hour ▼ ]

Last automatic scan
...

Next automatic scan
...

[ Rescan Now ]
```

Default is OFF.

Suggested intervals:
- 15 minutes
- 30 minutes
- 1 hour
- 2 hours
- 6 hours
- 12 hours
- 24 hours

## Timer Behavior
The timer is tied to the GameHub application session.

Example:
- GameHub starts at 8:00 PM
- interval is 1 hour
- first automatic rescan is approximately 9:00 PM

If GameHub closes, the timer stops. No Windows background service is required. On the next launch, the timer starts from zero again.

Electron's `ready` lifecycle is the normal point for startup initialization, so integrate the timer with the existing startup lifecycle rather than starting it before Electron is ready. citeturn0search0

## Enable/Disable
When enabled:
- persist the setting
- start a fresh timer

When disabled:
- persist the setting
- immediately clear the timer

When the interval changes:
- persist the new interval
- clear the old timer
- start a new timer from that moment

## Scanner Integration
Automatic Rescan MUST call the exact same unified scanner service used by the existing manual Rescan button.

Do not create a second scanner implementation.

## Concurrent Scans
Use one shared scan state/lock.

If a timer fires during an active scan:
- do not start another scan
- do not queue another full scan
- log that the scheduled scan was skipped

Manual Rescan follows the same protection.

## Performance
Do not interpret automatic rescan as scanning every file on every drive every hour.

Prefer:
- launcher metadata
- known library folders
- configured scan locations
- cheap existence/change checks

Only perform expensive filesystem traversal when required.

## Persistence
Suggested existing-settings keys:

```text
auto_rescan_enabled = false
auto_rescan_interval_minutes = 60
```

Add equivalent names if the project's settings convention differs.

## UI
Show:
- current enabled state
- selected interval
- last automatic scan
- next automatic scan
- Rescan Now

A non-blocking toast/status is preferred after completion, e.g.:
`Game library updated — 1 new game found`

Do not show a modal dialog every time an automatic scan finishes.

## Controller
All new controls must work with v1.0.1 controller navigation: checkbox, interval selector, dropdown, confirm, back, and visible focus state.

## Acceptance Criteria
1. OFF by default.
2. Manual Rescan still works.
3. Enabling starts the timer.
4. First scan occurs only after the selected interval.
5. Timer starts from each application launch.
6. Closing GameHub stops automatic scanning.
7. Relaunch starts a fresh timer.
8. Changing interval resets the timer.
9. Disabling clears the timer.
10. Newly installed games appear after the interval without manual Rescan.
11. No duplicate games.
12. No concurrent scans.
13. Controller navigation works.
14. v1.0.1 behavior remains intact.
15. Packaged EXE behaves like development mode.


## Scope Boundary
This v1.0.3 release is focused on local scanning, storage detection, and automatic local rescanning.

The following are explicitly OUT OF SCOPE for v1.0.3 and deferred to v2.0.0:
- Uninstalled/available launcher library
- Launcher account authentication
- Launcher API/library synchronization
- Cross-launcher canonical game grouping
- Multi-launcher ownership UI
- Official launcher installation handoff

Do not introduce v2.0.0 account/API dependencies into v1.0.3.
