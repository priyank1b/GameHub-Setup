# GameHub v1.0.3 — Storage & Automatic Rescan Test Plan

## Storage
- Standalone game: path and recursive size.
- Steam/Epic/GOG/Ubisoft: metadata size where available, filesystem fallback.
- Microsoft Store/Xbox: package matching, safe path discovery, protected WindowsApps handling.
- Large installations.
- Multiple drives.
- Inaccessible files.
- Missing/uninstalled games.
- Cached results.
- No fake `0 B`.

## Storage States
Verify:
- Known size
- Calculating
- Size unavailable
- Access denied

## Automatic Rescan
### Default
Fresh install: auto-rescan OFF; manual Rescan works.

### Enable
Enable auto-rescan and choose an interval. For development testing, use the shortest supported interval or a test-only interval.

### New Game
Start GameHub, enable auto-rescan, install/add a detectable new game, wait for the interval, and verify it appears without pressing Rescan.

### Restart
Close GameHub and reopen it. Verify the timer starts fresh and does not immediately compensate for time elapsed while the app was closed.

### Disable
Disable before the interval expires. Verify no scheduled scan occurs.

### Change Interval
Change the interval while running. Verify the old timer is cleared and a new timer starts from the change.

### Scan Collision
Start a long manual scan and allow the timer to fire. Verify no second scan starts.

### Manual Rescan
Verify manual Rescan works with auto-rescan both OFF and ON.

## Settings
Verify checkbox and interval survive restart.

## Controller
Navigate to Settings using a controller, toggle the checkbox, change interval, and return. Verify focus visuals and no regression.

## Performance
Test 100+ games, large installations, multiple drives, and verify the renderer stays responsive and no repeated full-drive scans occur.

## Production EXE
Test fresh install, upgrade from v1.0.1, storage detection, auto-rescan, manual scan, controller support, and game launching.

## Release Gate
Do not release v1.0.3 until there are no crashes, duplicates, renderer freezes, permission modifications, or false zero-size results.


## Available / Uninstalled Games
- First launcher sync fetches and caches available games.
- Restarting GameHub loads the cache without a full library fetch.
- `Sync Now` refreshes the cache.
- Uninstalled game shows `Install`.
- Install opens the official launcher/store flow.
- After installation and local Rescan/Auto Rescan, the same record becomes Installed.
- No duplicate game is created.
- A failed sync preserves the previous successful cache.


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
