# GameHub v1.0.3 — Storage Detection & Automatic Rescan

## Goal
Improve game storage-size detection and optionally discover newly installed games automatically.

## Phases

### 1. Storage Architecture Audit
Inspect the current scanner, game model, database, IPC, and UI. Reuse the existing scan pipeline.

### 2. StorageResolver
Create a unified resolver for Steam, Epic, GOG, Ubisoft, Microsoft Store/Xbox, and standalone games.

Return:
- install path
- size bytes
- status: `KNOWN | CALCULATING | UNKNOWN | ACCESS_DENIED`
- source: `metadata | filesystem | package | unknown`
- last-updated timestamp

### 3. Standalone Storage
Resolve the real installation root and recursively calculate its size asynchronously. Do not scan every drive blindly.

### 4. Launcher Metadata
Prefer launcher metadata/manifests before expensive filesystem traversal.

### 5. Microsoft Store / Xbox
Use supported Windows package information. Never take ownership of WindowsApps or modify ACLs just to calculate size. If safe enumeration is impossible, show `Size unavailable` or `Access denied`, never fake `0 B`.

### 6. Async Calculation & Caching
Run calculations outside the renderer, cache results in SQLite, prevent duplicate calculations, and avoid recalculating unchanged games.

### 7. Database Migration
Add or adapt:
- `install_path`
- `install_size_bytes`
- `install_size_status`
- `install_size_source`
- `install_size_updated_at`

### 8. Automatic Rescan
Add Settings:
`[ ] Automatically rescan for newly installed games`

When enabled, show:
- 15 minutes
- 30 minutes
- 1 hour
- 2 hours
- 6 hours
- 12 hours
- 24 hours

Default: OFF.

The timer starts when GameHub starts. If set to 1 hour, the first automatic scan occurs approximately 1 hour after that launch. Closing GameHub stops the timer; the next launch starts a fresh timer.

Manual **Rescan** always remains available.

Changing the interval resets the timer. Disabling clears it. Never run two scans concurrently.

### 9. Rescan Performance
Automatic rescan must use the same unified scanner as manual Rescan. Prefer launcher metadata and configured library folders over full-drive traversal.

If a scheduled scan fires while another scan is running, skip that cycle rather than queueing another full scan.

### 10. Settings UI
Recommended:

Automatic Game Rescan

[ ] Automatically rescan for newly installed games

Rescan interval
[ 1 hour ▼ ]

Last automatic scan
...

Next automatic scan
...

[ Rescan Now ]

All controls must support mouse, keyboard, and the existing controller navigation.

### 11. Library UI
Show:
- `12.4 GB`
- `Calculating…`
- `Size unavailable`
- `Access denied`

Never show `0 B` for an unknown size.

### 12. Regression
Test all existing launchers, standalone games, multiple drives, protected WindowsApps, large games, duplicates, controller navigation, manual scan, automatic scan, settings persistence, Windows 10/11.

### 13. Production Validation
Test the packaged EXE, including upgrade from v1.0.1, automatic discovery of a newly installed game, storage calculation, controller support, and manual Rescan.

### 14. Release
Publish v1.0.3 only after the production installer passes all tests. Keep v1.0.0 and v1.0.1 untouched.


### Available / Uninstalled Games Library
Add an `Available to Install` state for games present in a user's supported launcher library but not installed locally. Fetch the launcher library once, cache it in SQLite, and provide an explicit `Sync Now` for later refreshes. Do not fetch the full launcher library on every Auto Rescan.

For an uninstalled game, show an `Install` action that hands off to the official launcher/store. After installation, local Rescan/Auto Rescan must convert the existing record to `INSTALLED` without creating a duplicate.


### Launcher Account & API Integration
Implement launcher account connections as separate providers. Normal users must not be asked to enter API keys or launcher passwords. Use official authorization where supported, keep secrets out of the distributed EXE, cache the user's available library, fetch supported metadata, and hand installation to the official launcher. If a launcher has no safe supported third-party library integration, keep installed-game detection working and clearly mark library sync unavailable.


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
