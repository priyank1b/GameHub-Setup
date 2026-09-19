# GameHub — AI Development Phases

## Purpose

This document defines the exact development sequence for GameHub.

The AI coding agent must follow these phases **in order**.

Do not skip phases.

Do not attempt to build the entire application in one step.

At the end of each phase:

1. Build the project.
2. Run the application.
3. Test the functionality introduced in that phase.
4. Fix all blocking errors.
5. Verify that previously working functionality still works.
6. Only then proceed to the next phase.

---

# PHASE 0 — Project Analysis & Planning

## Goal

Understand the environment before writing application code.

## Tasks

* Inspect the current project directory.
* Determine whether a project already exists.
* Check installed Node.js version.
* Check npm version.
* Check available development tools.
* Determine whether the project is empty or contains existing code.
* Do not delete existing user files without explicit permission.

## Output

Create:

```text
README.md
ARCHITECTURE.md
```

Document:

* Technology stack
* Project structure
* Main processes
* IPC architecture
* Database architecture
* Detection architecture
* Build architecture

## Completion Criteria

The architecture is documented and the project can proceed safely.

---

# PHASE 1 — Create Desktop Application

## Goal

Create a working Windows desktop application shell.

## Technology

Use:

* Electron
* React
* Vite
* TypeScript
* Tailwind CSS

## Tasks

Create:

```text
electron/
src/
assets/
```

Configure:

```text
Electron
React
Vite
Tailwind
TypeScript
```

Create:

```text
electron/main.ts
electron/preload.ts
src/main.tsx
src/App.tsx
```

## Requirements

Electron security:

```text
nodeIntegration: false
contextIsolation: true
```

Create a basic window.

## UI

Show:

```text
GameHub

Your games. One place.
```

## Completion Criteria

Running:

```bash
npm run dev
```

opens the GameHub desktop window successfully.

---

# PHASE 2 — Application UI Shell

## Goal

Build the complete visual structure before implementing game detection.

## Create

* Sidebar
* Top bar
* Search area
* Main content
* Page routing
* Settings page
* Library page
* Favorites page
* Recently Played page

## Sidebar

```text
HOME

LIBRARY
  All Games
  Steam
  Epic
  GOG
  Xbox
  Standalone

FAVORITES

RECENTLY PLAYED

DRIVES

SETTINGS
```

## Design

Use:

* Premium dark theme
* Modern typography
* Rounded cards
* Subtle animations
* Responsive game grid

Do not copy another application's exact UI.

## Completion Criteria

All navigation works, even if pages contain placeholder states.

---

# PHASE 3 — SQLite Database

## Goal

Create the local persistent database.

## Database

Use:

```text
SQLite
better-sqlite3
```

Location:

```text
%APPDATA%/GameHub/gamehub.db
```

## Implement

Tables:

```text
games
launch_history
categories
game_categories
settings
ignored_paths
```

## Implement repositories

```text
GameRepository
LaunchRepository
CategoryRepository
SettingsRepository
```

## Requirements

Create migrations.

Database must survive application restarts.

## Test

Create a test game.

Close application.

Reopen application.

Verify the game still exists.

## Completion Criteria

Database CRUD operations work correctly.

---

# PHASE 4 — Electron IPC Architecture

## Goal

Create a secure communication layer between React and Electron.

## Implement

```text
Renderer
    ↓
Preload
    ↓
IPC
    ↓
Main Process
    ↓
Services
```

Expose only safe APIs.

Example:

```ts
window.gameHub.games.getAll()
window.gameHub.games.add()
window.gameHub.games.update()
window.gameHub.games.remove()
window.gameHub.games.launch()
window.gameHub.games.scan()
```

## Do NOT expose

```text
fs
child_process
shell
process
```

directly to React.

## Completion Criteria

React can communicate with the database through secure IPC.

---

# PHASE 5 — Drive Detection

## Goal

Detect available Windows drives.

## Example

```text
C:
D:
E:
F:
G:
```

Return:

```text
drive letter
drive name
available space
total space
```

if available.

## UI

Settings:

```text
Available Drives

☑ C:
☑ D:
☑ E:
☑ F:
☑ G:
```

## Test

Verify external drives are handled.

Verify disconnected drives do not crash the application.

## Completion Criteria

GameHub correctly detects available drives.

---

# PHASE 6 — Manual Game Addition

## Goal

Create the first complete game workflow.

This phase is extremely important.

## Add Game

Provide:

```text
+ Add Game
```

Dialog:

```text
Game Name
Executable
Installation Folder
Launcher
Cover
Background
```

## Workflow

```text
User selects EXE
       ↓
Validate executable
       ↓
Save to database
       ↓
Game appears in library
       ↓
User clicks PLAY
       ↓
Game launches
```

## Implement

Standalone launching.

Use safe process spawning through the Electron main process.

## Test

Add a legitimate locally installed game.

Launch it.

Close it.

Verify it appears after restarting GameHub.

## Completion Criteria

Manual game → database → library → launch works end-to-end.

---

# PHASE 7 — Standalone Game Scanner

## Goal

Automatically detect games that aren't managed by a supported launcher.

## IMPORTANT

Do NOT scan every `.exe` on every drive.

This can produce huge numbers of false positives.

## Initial scan locations

Allow user-selected folders such as:

```text
C:\Games
D:\Games
E:\Games
F:\Games
G:\Games
```

## Detection

Use heuristics such as:

```text
Game installation structure
Game executable
Unity files
Unreal Engine structure
Game asset directories
Known game naming patterns
Executable metadata
```

## Confidence

Assign confidence internally.

Example:

```text
90%+
→ Add automatically

50–89%
→ Possible Games

Below 50%
→ Ignore
```

Make the threshold configurable later.

## Completion Criteria

GameHub can discover reasonable standalone game installations without flooding the library with random executables.

---

# PHASE 8 — Game Scanner Engine

## Goal

Create a unified scanning architecture.

Create:

```ts
GameDetector
GameCandidate
GameScanner
```

Interface:

```ts
interface GameDetector {
    name: string;

    canRun(): Promise<boolean>;

    detect(
        locations: string[]
    ): Promise<GameCandidate[]>;
}
```

## Scanner pipeline

```text
Start
 ↓
Get drives
 ↓
Load scan locations
 ↓
Run detectors
 ↓
Generate candidates
 ↓
Normalize paths
 ↓
Deduplicate
 ↓
Compare database
 ↓
Insert new games
 ↓
Update existing games
 ↓
Mark missing games
 ↓
Finish
```

## Requirements

* Async
* Cancelable
* Progress reporting
* Permission-error handling
* No UI freezing

## Completion Criteria

A single scanner can execute multiple detection modules.

---

# PHASE 9 — Steam Detection

## Goal

Detect Steam games automatically.

## Tasks

Find Steam installation information using appropriate Windows configuration/registry/configuration files.

Detect Steam library folders.

Read:

```text
steamapps/appmanifest_*.acf
```

Extract:

```text
appid
name
installdir
```

Determine:

```text
installation path
```

## Important

Do not assume Steam is installed on:

```text
C:
```

Steam libraries can exist on:

```text
D:
E:
F:
G:
```

## Completion Criteria

GameHub detects Steam games from multiple Steam libraries.

---

# PHASE 10 — Steam Launching

## Goal

Launch Steam games through Steam.

Use:

```text
steam://rungameid/{APP_ID}
```

Do NOT directly launch the executable by default.

Steam should handle:

* Authentication
* DRM
* Steam Cloud
* Steam Overlay
* Achievements
* Anti-cheat
* Launch requirements

## Test

Select a Steam game.

Click:

```text
PLAY
```

Verify Steam launches the game.

## Completion Criteria

Steam games launch reliably.

---

# PHASE 11 — Epic Games Detection

## Goal

Detect Epic-installed games.

Use Epic installation manifests/configuration.

Extract:

```text
DisplayName
InstallLocation
LaunchExecutable
AppName
```

## Requirements

Handle games installed on different drives.

Avoid duplicate entries.

## Completion Criteria

Epic games appear correctly in the unified library.

---

# PHASE 12 — Epic Games Launching

## Goal

Launch Epic games using official Epic launcher mechanisms.

Do not bypass:

* Authentication
* DRM
* Epic launcher requirements

If Epic launcher is unavailable:

Show:

```text
Epic Games Launcher is not installed.

[ Locate Launcher ]
```

## Completion Criteria

Epic games launch correctly.

---

# PHASE 13 — GOG Detection

## Goal

Detect GOG/GOG Galaxy games.

Use appropriate:

* Registry information
* GOG Galaxy data
* Installation metadata

Extract:

```text
Game Name
Installation Path
Executable
Game ID
```

## Completion Criteria

GOG games appear correctly.

---

# PHASE 14 — GOG Launching

## Goal

Launch GOG games appropriately.

Prefer official GOG/Galaxy mechanisms where required.

If a standalone executable can safely be launched, support it.

## Completion Criteria

GOG games can be launched.

---

# PHASE 15 — Xbox / Microsoft Store

## Goal

Add support for Windows-managed games where technically permitted.

## Important

Microsoft Store/Xbox games can be protected by Windows.

Do NOT:

* Bypass permissions
* Modify protected files
* Circumvent Store protection

Use official Windows/Xbox launch mechanisms.

If direct launching is unavailable:

```text
This game is managed by Xbox/Microsoft Store.

[ Open Xbox ]
```

## Completion Criteria

Supported games can be detected and launched safely.

Unsupported cases fail gracefully.

---

# PHASE 16 — Duplicate Detection

## Goal

Prevent duplicate games.

Example:

```text
Steam Detector
+
Standalone Detector
=
Cyberpunk 2077
```

should produce ONE game.

## Priority

Use:

```text
Launcher ID
>
Installation Path
>
Executable Path
>
Normalized Name
```

## Completion Criteria

Repeated scans do not create duplicate games.

---

# PHASE 17 — Missing Game Detection

## Goal

Detect games that have been moved or uninstalled.

Example:

```text
Cyberpunk 2077
⚠ Missing
```

Do not delete automatically.

Allow:

```text
Locate Game
Remove From Library
```

If the game returns:

```text
is_installed = true
```

again.

## Completion Criteria

Moved/uninstalled games are correctly marked.

---

# PHASE 18 — Library UI

## Goal

Replace placeholder content with real database data.

Game cards should display:

```text
Cover
Game Name
Launcher
Play Button
Favorite
```

## Grid

Automatically adapt to window size.

Support at least:

```text
1280x720
1920x1080
2560x1440
3840x2160
```

## Completion Criteria

All detected games appear correctly.

---

# PHASE 19 — Game Details

## Goal

Create a full game details page.

Display:

```text
Background
Cover
Name
Description
Developer
Publisher
Genre
Release Date
Launcher
Installation Path
Installed Size
Playtime
Last Played
```

Buttons:

```text
PLAY
FAVORITE
OPEN FOLDER
EDIT
```

## Completion Criteria

Clicking a game opens a complete details page.

---

# PHASE 20 — Search & Filtering

## Goal

Make large libraries easy to navigate.

## Search

Support:

```text
Game Name
Developer
Publisher
Genre
```

## Filters

```text
All
Steam
Epic
GOG
Xbox
Standalone
Favorites
Missing
```

## Sorting

```text
A-Z
Z-A
Recently Added
Recently Played
Play Time
Size
```

## Completion Criteria

Search/filtering remains fast with hundreds of games.

---

# PHASE 21 — Favorites

## Goal

Implement favorites.

Click:

```text
☆
```

becomes:

```text
★
```

Save state in SQLite.

Create:

```text
Favorites
```

page.

## Completion Criteria

Favorites persist after restart.

---

# PHASE 22 — Recently Played

## Goal

Track games the user has launched.

Show:

```text
Recently Played
```

Sort by:

```text
last_played_at
```

## Completion Criteria

Launching a game updates Recently Played.

---

# PHASE 23 — Playtime Tracking

## Goal

Track approximate game playtime.

Workflow:

```text
Play
 ↓
Record launch time
 ↓
Monitor process
 ↓
Process exits
 ↓
Calculate duration
 ↓
Save launch history
 ↓
Update total playtime
```

## Important

Do not claim exact playtime when the process lifecycle cannot be determined reliably.

## Completion Criteria

Playtime is recorded reasonably accurately.

---

# PHASE 24 — Artwork & Metadata

## Goal

Make the library visually rich.

Optional metadata:

```text
Cover
Background
Logo
Description
Developer
Publisher
Genre
Release Date
```

## Requirements

* Metadata is optional.
* Game launching must work without metadata.
* Cache artwork locally.
* Do not download artwork repeatedly.

Cache:

```text
%APPDATA%/GameHub/cache/artwork/
```

## Completion Criteria

Games can automatically receive artwork/metadata when available.

---

# PHASE 25 — Settings

## Goal

Implement complete settings.

## General

```text
Start with Windows
Minimize to tray
Remember window size
```

## Library

```text
Scan Locations
Rescan
Automatic verification
```

## Appearance

```text
Dark
Light
System
Card Size
```

## Metadata

```text
Automatic metadata
Automatic artwork
```

## Advanced

```text
Clear Artwork Cache
Repair Database
Export Library
Import Library
Open Logs
```

## Completion Criteria

Settings persist across restarts.

---

# PHASE 26 — Drive & Folder Management

## Goal

Allow users to control exactly where GameHub searches.

Example:

```text
Game Scan Locations

☑ D:\Games
☑ E:\SteamLibrary
☑ F:\Epic Games
☑ G:\My Games

[ Add Folder ]
[ Remove ]
```

## Important

User-selected folders should be preferred over full-drive scanning.

## Completion Criteria

Users can add/remove scan locations.

---

# PHASE 27 — Scan Progress & Notifications

## Goal

Make scanning understandable.

Display:

```text
Scanning PC...

Steam
██████████████░░

Epic
████████░░░░░░░

Standalone
████░░░░░░░░░░

Games found: 42
```

Provide:

```text
Cancel Scan
```

Completion:

```text
Scan Complete

42 games found

5 new
35 existing
2 missing
3 possible
```

## Completion Criteria

Scanning progress is visible and cancellation works.

---

# PHASE 28 — Import / Export

## Goal

Allow users to back up their GameHub library.

Export:

```text
gamehub-library.json
```

Include:

* Games
* Favorites
* Categories
* Scan locations
* Settings where appropriate

Do NOT export sensitive information unnecessarily.

## Completion Criteria

Exported library can be imported into another GameHub installation.

---

# PHASE 29 — System Tray

## Goal

Optional Windows tray functionality.

Tray menu:

```text
GameHub

Open
Rescan
Recently Played
Exit
```

Do not keep unnecessary background services running.

## Completion Criteria

GameHub can minimize to tray and restore correctly.

---

# PHASE 30 — Keyboard Shortcuts

Implement:

```text
Ctrl + K
Search

Ctrl + R
Rescan

Escape
Close modal

Enter
Launch selected game
```

Do not interfere with common Windows shortcuts.

---

# PHASE 31 — Performance Optimization

## Goal

Ensure GameHub remains responsive with large libraries.

Test:

```text
100 games
500 games
1000 games
```

Optimize:

* Database queries
* Image loading
* React rendering
* Search
* Scanner
* IPC calls

Use virtualization if required.

Lazy-load artwork.

## Completion Criteria

UI remains responsive with large libraries.

---

# PHASE 32 — Security Review

Verify:

```text
nodeIntegration = false
contextIsolation = true
```

Check all IPC handlers.

Validate:

* File paths
* Executables
* Game IDs
* Database input

Do not allow arbitrary renderer commands to execute.

## Completion Criteria

No unnecessary privileged functionality is exposed to the renderer.

---

# PHASE 33 — Error Handling

Test:

```text
Drive disconnected
Permission denied
Game deleted
Game moved
Launcher missing
Malformed manifest
Database error
Metadata unavailable
Artwork unavailable
Executable missing
```

The application must not crash.

Provide user-friendly messages.

Technical details should go to logs.

---

# PHASE 34 — Logging

Create:

```text
%APPDATA%/GameHub/logs/gamehub.log
```

Log:

```text
Application startup
Database events
Scanner events
Detector errors
Launch attempts
Launch failures
```

Do not log unnecessary personal information.

---

# PHASE 35 — Database Recovery

Implement:

```text
Repair Database
```

Before migrations or destructive operations, create a backup.

Example:

```text
gamehub.db.backup
```

Never silently delete a corrupted database.

---

# PHASE 36 — Windows Installer

## Goal

Create a production Windows installer.

Use:

```text
electron-builder
```

Output:

```text
GameHub-Setup.exe
```

Installer should support:

* Install location
* Desktop shortcut
* Start menu shortcut
* Uninstall
* Application icon

## Completion Criteria

A fresh Windows machine can install and run GameHub.

---

# PHASE 37 — Fresh Machine Test

Perform a clean installation test.

Test:

```text
Install
 ↓
Launch
 ↓
Scan
 ↓
Detect games
 ↓
Open game
 ↓
Launch game
 ↓
Restart GameHub
 ↓
Library persists
```

Verify no development environment is required.

---

# PHASE 38 — Full Regression Test

Retest every major feature:

```text
✓ Application startup
✓ Database
✓ Drive detection
✓ Manual games
✓ Standalone detection
✓ Steam detection
✓ Steam launching
✓ Epic detection
✓ Epic launching
✓ GOG detection
✓ GOG launching
✓ Xbox handling
✓ Duplicate detection
✓ Missing games
✓ Search
✓ Filters
✓ Favorites
✓ Recently played
✓ Playtime
✓ Artwork
✓ Metadata
✓ Settings
✓ Import/export
✓ Tray
✓ Installer
```

Fix regressions before release.

---

# PHASE 39 — Production Polish

Improve:

* Loading states
* Empty states
* Error messages
* Tooltips
* Animations
* Keyboard navigation
* Accessibility
* Responsive layout
* Typography
* Icons
* Game card design

Remove:

* Debug buttons
* Console spam
* Placeholder text
* Fake data
* Unused components
* Dead code

---

# PHASE 40 — Version 1.0 Release

Set:

```text
Version:
1.0.0
```

Prepare:

```text
README.md
CHANGELOG.md
LICENSE
```

Final installer:

```text
GameHub-Setup.exe
```

Verify:

```text
npm run build
npm run package
```

works without errors.

---

# Development Rules For The AI

## Rule 1 — One Phase At A Time

Never implement multiple major phases simultaneously.

Finish:

```text
Phase N
```

before starting:

```text
Phase N+1
```

---

## Rule 2 — Never Break Existing Features

Before changing an existing service:

1. Inspect it.
2. Understand it.
3. Modify only what is necessary.
4. Run the application.
5. Test the affected feature.

---

## Rule 3 — No Fake Functionality

Do not create buttons that only display:

```text
Coming soon
```

unless the feature is intentionally marked as future functionality.

Do not pretend that a feature works when it does not.

---

## Rule 4 — No Hard-Coded Game Paths

Never assume:

```text
C:\Program Files\Steam
```

is the only Steam location.

Games can be installed on:

```text
C:
D:
E:
F:
G:
```

or custom folders.

---

## Rule 5 — No Full-Disk EXE Scanning By Default

Never do:

```text
C:\ → find every .exe
D:\ → find every .exe
E:\ → find every .exe
```

Use launcher manifests and configured folders first.

---

## Rule 6 — No Piracy Features

GameHub must never:

* Crack games
* Bypass DRM
* Bypass authentication
* Download pirated games
* Disable anti-cheat
* Modify licensing
* Circumvent Microsoft Store protection

GameHub is strictly a legitimate game library and launcher.

---

## Rule 7 — Offline First

The core application must work without internet.

Internet should only be required for optional:

```text
Artwork
Metadata
Application updates
```

---

## Rule 8 — Graceful Failure

If something cannot be detected:

Do not crash.

Instead:

```text
Unknown
Possible Game
Missing
Unsupported
```

as appropriate.

---

## Rule 9 — Keep Architecture Extensible

Adding a new launcher should require something like:

```text
NewDetector.ts
```

rather than rewriting the whole application.

---

## Rule 10 — Test On Real Windows

Windows-specific features must be tested on Windows.

Do not assume that Linux/macOS behavior is equivalent.

---

# Priority Order

When forced to choose between features, prioritize:

```text
1. Reliable launching
2. Reliable game detection
3. Data safety
4. Scanner stability
5. Performance
6. UI
7. Metadata
8. Cosmetic features
```

---

# Final Architecture

The final architecture should resemble:

```text
                         GAMEHUB
                            │
                ┌───────────┴───────────┐
                │                       │
             React UI              Electron Main
                │                       │
                │                  ┌────┴────┐
                │                  │         │
             Preload              Services  IPC
                │                  │
                └──────────────────┤
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                GameScanner    GameLauncher    Database
                    │              │              │
          ┌─────────┼─────────┐    │          SQLite
          │         │         │    │
        Steam     Epic       GOG   │
          │         │         │    │
          └─────────┴─────────┴────┘
                         │
                    Windows OS
                         │
             ┌───────────┼───────────┐
             │           │           │
             C:          D:          E:
             │           │           │
          Games        Games      SteamLibrary
```

---

# Definition Of Done

GameHub version 1.0 is complete only when:

```text
✓ It installs on Windows
✓ It starts without development tools
✓ It detects available drives
✓ It scans configured folders
✓ It detects Steam games
✓ It detects Epic games
✓ It detects GOG games
✓ It handles standalone games
✓ It avoids duplicate games
✓ It detects missing games
✓ It stores the library locally
✓ It displays games in a modern UI
✓ It supports search/filtering
✓ It supports favorites
✓ It supports recently played
✓ It can launch games
✓ It handles launcher-based games correctly
✓ It works without internet for core functionality
✓ It does not bypass DRM or platform security
✓ It survives application restarts
✓ It handles errors gracefully
✓ It passes the final regression test
✓ It produces a Windows installer
```

---

# Final AI Instruction

You are the primary software engineer for this project.

Follow this development plan strictly.

Start with **PHASE 0**.

Do not jump directly to Steam/Epic detection.

Do not generate the entire application in a single response.

At the end of each phase, report:

```text
PHASE:
Status:

Implemented:
- ...

Files created/changed:
- ...

Tests performed:
- ...

Issues:
- ...

Next phase:
- ...
```

Only proceed to the next phase after the current phase is functional.

The objective is to produce a **real, reliable Windows application**, not a visual prototype.
