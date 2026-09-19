# PC Game Library & Launcher

## 1. Project Overview

Build a modern Windows desktop application that automatically discovers games installed across all available drives on the user's PC and provides a single unified game library from which the user can launch games.

The application should function as a personal PC game launcher/library manager.

The primary goal is:

> Scan the user's PC → detect installed games → identify their launcher/source → display them in one beautiful library → launch them directly.

The application must NOT download, crack, modify, bypass DRM, or pirate games.

It should only discover and launch games that are already legitimately installed on the user's computer.

---

# 2. Target Platform

Primary platform:

* Windows 10
* Windows 11

Architecture should allow future support for:

* Windows 12+
* Linux
* macOS

For the first version, optimize specifically for Windows.

---

# 3. Recommended Technology Stack

## Desktop Framework

Use:

* Electron
* Node.js

Electron will provide:

* Windows desktop application
* File-system access
* Process launching
* Drive detection
* Native dialogs
* System integration

## Frontend

Use:

* React
* Vite
* JavaScript or TypeScript
* Tailwind CSS

Prefer TypeScript if practical.

## Local Database

Use:

* SQLite

Recommended library:

* better-sqlite3

The database must be completely local.

No cloud database is required.

## Application State

Use:

* React Context or Zustand

Avoid unnecessarily complicated state management.

## Icons

Use:

* Lucide React

## Build

Use:

* electron-builder

The final application should be distributable as:

```text
GameHub-Setup.exe
```

---

# 4. Product Name

Use a temporary working name:

# GameHub

The architecture must make it easy to rename the application later.

Do not hard-code the name throughout the application.

Keep application metadata in one location.

Example:

```text
src/config/appConfig.ts
```

---

# 5. Core Requirements

The application must provide:

1. Automatic game detection
2. Detection across multiple drives
3. Steam game detection
4. Epic Games detection
5. GOG detection
6. Standalone game detection
7. Manual game addition
8. Game search
9. Game filtering
10. Game categories
11. Favorites
12. Recently played
13. Game launching
14. Launch history
15. Game metadata
16. Game artwork
17. Rescan functionality
18. Missing-game detection
19. Drive management
20. Settings
21. Dark modern UI

---

# 6. Important Design Principle

Do NOT simply scan every `.exe` file on every drive.

That will generate enormous numbers of false positives.

For example:

```text
C:\Windows\System32\
C:\Program Files\Common Files\
C:\Users\...\AppData\
```

contain thousands of executables that are not games.

The detection engine must use a layered strategy.

Priority:

```text
1. Known launcher detection
2. Known game manifest detection
3. Known installation directories
4. Heuristic standalone detection
5. Manual addition
```

---

# 7. Application Architecture

Use the following architecture:

```text
GameHub
│
├── Electron Main Process
│   │
│   ├── Window Management
│   ├── Drive Detection
│   ├── Game Scanner
│   ├── Steam Detector
│   ├── Epic Detector
│   ├── GOG Detector
│   ├── Standalone Detector
│   ├── Game Launcher
│   ├── Process Monitor
│   ├── File System APIs
│   └── IPC
│
├── React Renderer
│   │
│   ├── Dashboard
│   ├── Library
│   ├── Game Details
│   ├── Favorites
│   ├── Recently Played
│   ├── Settings
│   └── Components
│
└── SQLite
    │
    ├── Games
    ├── Launchers
    ├── Launch History
    ├── Favorites
    ├── Categories
    └── Settings
```

---

# 8. Folder Structure

Create the project with this structure:

```text
gamehub/
│
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   │
│   ├── ipc/
│   │   ├── gameHandlers.ts
│   │   ├── scannerHandlers.ts
│   │   ├── launcherHandlers.ts
│   │   ├── settingsHandlers.ts
│   │   └── driveHandlers.ts
│   │
│   ├── services/
│   │   ├── GameScanner.ts
│   │   ├── GameLauncher.ts
│   │   ├── DriveService.ts
│   │   ├── ProcessService.ts
│   │   ├── MetadataService.ts
│   │   └── ArtworkService.ts
│   │
│   ├── detectors/
│   │   ├── SteamDetector.ts
│   │   ├── EpicDetector.ts
│   │   ├── GogDetector.ts
│   │   ├── XboxDetector.ts
│   │   └── StandaloneDetector.ts
│   │
│   ├── database/
│   │   ├── database.ts
│   │   ├── migrations.ts
│   │   └── repositories/
│   │       ├── GameRepository.ts
│   │       ├── LaunchRepository.ts
│   │       ├── SettingsRepository.ts
│   │       └── CategoryRepository.ts
│   │
│   └── utils/
│       ├── fileUtils.ts
│       ├── registryUtils.ts
│       ├── pathUtils.ts
│       └── logger.ts
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── SearchBar.tsx
│   │   ├── GameCard.tsx
│   │   ├── GameGrid.tsx
│   │   ├── GameDetails.tsx
│   │   ├── LauncherBadge.tsx
│   │   ├── FavoriteButton.tsx
│   │   ├── PlayButton.tsx
│   │   ├── ScanProgress.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingState.tsx
│   │
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Library.tsx
│   │   ├── Favorites.tsx
│   │   ├── RecentlyPlayed.tsx
│   │   ├── GameDetailsPage.tsx
│   │   └── Settings.tsx
│   │
│   ├── hooks/
│   │   ├── useGames.ts
│   │   ├── useScanner.ts
│   │   ├── useSettings.ts
│   │   └── useLaunchGame.ts
│   │
│   ├── stores/
│   │   └── gameStore.ts
│   │
│   ├── types/
│   │   ├── Game.ts
│   │   ├── Launcher.ts
│   │   └── Settings.ts
│   │
│   ├── config/
│   │   └── appConfig.ts
│   │
│   └── styles/
│       └── globals.css
│
├── assets/
│   ├── icons/
│   └── default-game-cover.png
│
├── scripts/
│   └── postinstall.js
│
├── package.json
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── README.md
└── .gitignore
```

---

# 9. Database Design

Use SQLite.

Database location:

```text
%APPDATA%/GameHub/gamehub.db
```

Do NOT store the database inside the installation directory.

---

## Games Table

```sql
CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    normalized_name TEXT,
    executable_path TEXT,
    install_path TEXT,
    launcher TEXT,
    launcher_app_id TEXT,
    cover_image TEXT,
    background_image TEXT,
    icon_path TEXT,
    description TEXT,
    developer TEXT,
    publisher TEXT,
    genre TEXT,
    release_date TEXT,
    installed_size INTEGER,
    is_favorite INTEGER DEFAULT 0,
    is_installed INTEGER DEFAULT 1,
    is_manual INTEGER DEFAULT 0,
    last_played_at TEXT,
    total_play_time INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

---

# 10. Launch History Table

```sql
CREATE TABLE launch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    launched_at TEXT NOT NULL,
    exited_at TEXT,
    duration INTEGER DEFAULT 0,
    FOREIGN KEY(game_id) REFERENCES games(id)
);
```

---

# 11. Categories Table

```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);
```

---

# 12. Game Categories Table

```sql
CREATE TABLE game_categories (
    game_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY(game_id, category_id),
    FOREIGN KEY(game_id) REFERENCES games(id),
    FOREIGN KEY(category_id) REFERENCES categories(id)
);
```

---

# 13. Settings Table

```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

---

# 14. Game Type

Create a TypeScript interface:

```ts
export interface Game {
    id: number;
    name: string;
    normalizedName?: string;
    executablePath?: string;
    installPath?: string;
    launcher: GameLauncher;
    launcherAppId?: string;
    coverImage?: string;
    backgroundImage?: string;
    iconPath?: string;
    description?: string;
    developer?: string;
    publisher?: string;
    genre?: string;
    releaseDate?: string;
    installedSize?: number;
    isFavorite: boolean;
    isInstalled: boolean;
    isManual: boolean;
    lastPlayedAt?: string;
    totalPlayTime: number;
}
```

Launcher enum:

```ts
export type GameLauncher =
    | "STEAM"
    | "EPIC"
    | "GOG"
    | "XBOX"
    | "EA"
    | "UBISOFT"
    | "BATTLE_NET"
    | "ROCKSTAR"
    | "STANDALONE"
    | "UNKNOWN";
```

---

# 15. First Launch Experience

When the application starts for the first time:

Show:

```text
Welcome to GameHub

Find all your PC games
in one place.

[ Scan My PC ]
```

Then ask:

```text
Which drives should GameHub scan?

☑ C:
☑ D:
☑ E:
☑ F:
☑ G:
☐ H:

[ Start Scan ]
```

Provide:

```text
Advanced scan options
```

with:

```text
☑ Detect Steam games
☑ Detect Epic Games
☑ Detect GOG games
☑ Detect standalone games
☑ Detect Microsoft/Xbox games
```

---

# 16. Drive Detection

Use Windows APIs / Node.js to identify available drives.

Example:

```text
C:
D:
E:
F:
G:
```

Only display currently available drives.

Do not assume that the user has a fixed number of drives.

If a drive disappears later:

```text
E:
Offline
```

Games from that drive should remain in the database but appear as unavailable.

---

# 17. Steam Detection

Steam detection should be one of the highest-priority detection methods.

Find Steam installation locations.

Typical locations include:

```text
C:\Program Files (x86)\Steam
C:\Program Files\Steam
```

But do NOT rely exclusively on these paths.

Use the Windows registry and Steam configuration where possible.

Steam may have libraries such as:

```text
C:\Program Files (x86)\Steam
D:\SteamLibrary
E:\Games\SteamLibrary
F:\Steam Games
```

Read Steam library locations.

Detect:

```text
steamapps/appmanifest_*.acf
```

Each manifest identifies an installed game.

Extract:

```text
appid
name
installdir
```

Build the game installation path:

```text
<steam-library>\steamapps\common\<installdir>
```

Do not simply search the entire disk if Steam already provides the library information.

---

# 18. Steam Launching

For Steam games:

```text
steam://rungameid/{APP_ID}
```

Use the app ID from the manifest.

Do NOT directly launch the game's executable by default.

This allows Steam to handle:

* DRM
* authentication
* Steam overlay
* Steam Cloud
* Steam achievements
* anti-cheat
* required launch parameters

---

# 19. Epic Games Detection

Detect Epic Games installations through installed manifests and known configuration locations.

Epic stores installation information in manifest files.

Search for Epic installation manifests rather than scanning the entire PC.

Extract:

```text
DisplayName
InstallLocation
LaunchExecutable
AppName
CatalogItemId
```

Store the relevant identifier in:

```text
launcher_app_id
```

---

# 20. Epic Launching

Use the official Epic launcher/protocol where possible.

If a game requires the Epic launcher, launch the game through Epic rather than bypassing it.

If the launcher is not available:

Show:

```text
Epic Games Launcher is not installed.

[ Locate Launcher ]
```

---

# 21. GOG Detection

Detect GOG-installed games using:

* Windows registry
* GOG Galaxy installation information
* Known GOG metadata
* Installation paths

Store:

```text
launcher = GOG
```

If GOG Galaxy is required for a particular title, launch through the official launcher.

---

# 22. Xbox / Microsoft Store Detection

Microsoft Store games are more complicated because many installations are protected by Windows.

The application should:

1. Detect accessible game registrations where possible.
2. Never attempt to bypass Windows permissions.
3. Never modify protected files.
4. Use official Windows application launch mechanisms.

If a game cannot be launched directly:

Display:

```text
This game is managed by Microsoft Store/Xbox.

[ Open in Xbox ]
```

---

# 23. Standalone Game Detection

Standalone games require heuristics.

Do NOT scan every `.exe` file blindly.

Use:

* User-selected folders
* Common game folders
* File/folder naming
* Executable metadata
* Existing game database
* Known publishers
* Folder size
* Presence of game assets
* Presence of files such as:

```text
UnityPlayer.dll
UnrealEngine
Engine\
Content\
Data\
Binaries\
```

Possible directories:

```text
C:\Games
D:\Games
E:\Games
F:\Games
G:\Games
```

Also allow the user to configure custom scan directories.

---

# 24. Standalone Detection Confidence

Every automatically detected game should have a confidence score internally.

Example:

```text
Steam manifest:
100%

Epic manifest:
100%

GOG registry:
95%

Known game installation:
85%

Executable heuristic:
50%
```

Only add standalone games automatically when confidence exceeds a configurable threshold.

Low-confidence detections should go into:

```text
Possible Games
```

instead of the main library.

---

# 25. Duplicate Detection

A game can be detected by multiple detectors.

Example:

```text
Steam detector
Standalone detector
```

Both may find:

```text
Cyberpunk 2077
```

Do not create two entries.

Deduplicate using:

1. Launcher app ID
2. Normalized installation path
3. Executable path
4. Normalized game name

Priority:

```text
launcher ID > installation path > executable path > name
```

---

# 26. Scanner Architecture

Create:

```ts
interface GameDetector {
    name: string;

    canRun(): Promise<boolean>;

    detect(
        drives: string[]
    ): Promise<GameCandidate[]>;
}
```

Implement:

```text
SteamDetector
EpicDetector
GogDetector
XboxDetector
StandaloneDetector
```

The scanner should execute detectors independently.

---

# 27. Scan Progress UI

During scanning show:

```text
Scanning your PC...

Steam
██████████████░░░░

Epic Games
██████████░░░░░░░░

Standalone Games
████░░░░░░░░░░░░░░

Games found: 42
```

Display:

```text
Current drive:
D:

Current folder:
D:\Games
```

Allow:

```text
[ Cancel Scan ]
```

---

# 28. Scanner Requirements

The scanner must:

* Be asynchronous
* Not freeze the UI
* Respect cancellation
* Avoid scanning system directories unnecessarily
* Avoid scanning protected directories
* Handle permission errors
* Handle disconnected drives
* Handle corrupted files
* Log errors
* Continue when one folder fails

Never terminate the entire scan because one directory cannot be accessed.

---

# 29. Main Dashboard

The main screen should have a premium gaming aesthetic.

Layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ GameHub                         🔍 Search        ⚙           │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│ 🏠 Home      │  Welcome back                               │
│              │                                              │
│ 🎮 Library   │  Recently Played                            │
│              │                                              │
│ ⭐ Favorites │  ┌────────┐ ┌────────┐ ┌────────┐           │
│              │  │ Game 1 │ │ Game 2 │ │ Game 3 │           │
│ 🕐 Recent    │  └────────┘ └────────┘ └────────┘           │
│              │                                              │
│ 📁 Drives    │  All Games                                  │
│              │                                              │
│ ⚙ Settings  │  ┌────────┐ ┌────────┐ ┌────────┐           │
│              │  │ Game 1 │ │ Game 2 │ │ Game 3 │           │
│              │  └────────┘ └────────┘ └────────┘           │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

---

# 30. Sidebar

Sidebar items:

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

  C:
  D:
  E:
  F:
  G:

SETTINGS
```

Sidebar should be collapsible.

---

# 31. Game Cards

Each game card should display:

```text
┌──────────────────────────┐
│                          │
│       GAME ART           │
│                          │
│                    ☆     │
├──────────────────────────┤
│ Cyberpunk 2077           │
│ Steam                    │
│                          │
│             ▶ PLAY      │
└──────────────────────────┘
```

Hover effect:

* Slight scale
* Artwork zoom
* Show play button
* Show quick actions
* Smooth animation

Do not overuse animations.

---

# 32. Game Card Actions

On hover:

```text
▶ Play
⋮ More
```

More menu:

```text
Play
Game Details
Open Installation Folder
Create Desktop Shortcut
Add to Favorites
Edit Game
Remove from Library
Scan Again
```

---

# 33. Game Details Page

Clicking a game opens:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    BACKGROUND ART                            │
│                                                              │
│     Cyberpunk 2077                                           │
│                                                              │
│     Action RPG                                               │
│                                                              │
│     [ ▶ PLAY ]   [ ☆ FAVORITE ]                             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ About                                                        │
│                                                              │
│ Description...                                               │
│                                                              │
│ Developer: CD Projekt Red                                    │
│ Publisher: CD Projekt                                       │
│ Installed: E:\SteamLibrary\...                              │
│ Size: 72 GB                                                  │
│ Launcher: Steam                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# 34. Search

Search must be instant.

Search by:

* Game name
* Developer
* Publisher
* Genre
* Launcher
* Drive
* Category

Example:

```text
Search: witcher
```

Results:

```text
The Witcher 3
The Witcher 2
The Witcher Enhanced Edition
```

---

# 35. Filters

Provide:

```text
All
Steam
Epic
GOG
Xbox
Standalone
```

Additional filters:

```text
Favorites
Recently Played
Drive
Genre
Installed / Missing
```

---

# 36. Sorting

Support:

```text
Name A-Z
Name Z-A
Recently Played
Recently Added
Play Time
Size
Last Played
```

---

# 37. Favorites

Every game has a favorite toggle:

```text
☆
```

and:

```text
★
```

Favorites are stored in SQLite.

---

# 38. Recently Played

Track every launch.

Display:

```text
Recently Played

Cyberpunk 2077
Last played 2 hours ago

Red Dead Redemption 2
Last played yesterday

GTA V
Last played 3 days ago
```

---

# 39. Playtime Tracking

When launching a game:

```text
launch_time = current timestamp
```

Monitor the game process.

When the process exits:

```text
exit_time = current timestamp

duration =
exit_time - launch_time
```

Update:

```text
total_play_time
```

If process tracking is unreliable, record the launch but do not claim an exact duration.

---

# 40. Game Launching Engine

Create:

```ts
GameLauncher
```

Method:

```ts
launch(game: Game): Promise<LaunchResult>
```

Launch behavior:

```text
STEAM
→ steam://rungameid/APP_ID

EPIC
→ Official Epic launcher/protocol

GOG
→ Official GOG mechanism

XBOX
→ Windows/Xbox launch mechanism

STANDALONE
→ executablePath
```

---

# 41. Standalone Launch

Before launching:

Check:

```text
Does executable exist?
```

If yes:

```text
spawn executable
```

If no:

Show:

```text
Game executable not found.

The game may have been moved or uninstalled.

[ Locate Game ]
[ Remove From Library ]
```

---

# 42. Launch Error Handling

If launching fails:

Show a user-friendly message.

Example:

```text
Unable to launch Cyberpunk 2077.

Possible reasons:
• The game was moved
• The launcher is not installed
• The game requires administrator permissions
• The installation is incomplete

[ Open Folder ]
[ Locate Game ]
```

Never expose raw Node.js stack traces to the normal user.

Log technical details separately.

---

# 43. Installation Folder

Provide:

```text
Open Installation Folder
```

Use Windows Explorer.

Example:

```text
explorer.exe "E:\Games\Cyberpunk 2077"
```

---

# 44. Manual Game Addition

Provide:

```text
+ Add Game
```

Dialog:

```text
Add Game

Game Name
[________________]

Executable
[ Browse ]

Installation Folder
[ Browse ]

Launcher
[ Standalone ▼ ]

Cover Image
[ Browse ]

Background Image
[ Browse ]

[ Cancel ] [ Add Game ]
```

Executable is mandatory for standalone games.

---

# 45. Editing Games

Allow users to edit:

```text
Name
Executable
Install path
Launcher
Cover
Background
Genre
Description
Developer
Publisher
```

---

# 46. Removing Games

Removing from GameHub must NOT uninstall the actual game.

Show confirmation:

```text
Remove from GameHub?

This will only remove the game from your library.

Your actual game files will NOT be deleted.

[ Cancel ] [ Remove ]
```

---

# 47. Missing Games

During a rescan, if an existing game's installation no longer exists:

Mark:

```text
is_installed = false
```

Show:

```text
Missing
```

Do not immediately delete it.

Allow:

```text
Locate Game
Remove From Library
```

---

# 48. Drive Management

Settings should show:

```text
Game Scan Locations

☑ C:\Games
☑ D:\Games
☑ E:\SteamLibrary
☑ G:\Games

[ + Add Folder ]
[ Remove ]
```

Allow users to choose specific directories.

This is preferable to repeatedly scanning entire drives.

---

# 49. Automatic Rescan

On application startup:

Perform a lightweight check.

Do NOT perform a full disk scan every startup.

Full scan should happen:

* First installation
* User presses Rescan
* User adds a scan location
* Scheduled scan if enabled

---

# 50. Rescan Button

Global button:

```text
⟳ Rescan
```

When clicked:

```text
Scanning...

Checking Steam...
Checking Epic...
Checking GOG...
Checking Xbox...
Checking standalone games...
```

---

# 51. Metadata

The architecture should support optional external metadata.

Possible metadata:

```text
Game name
Description
Cover
Background
Logo
Developer
Publisher
Genre
Release date
```

Do not make the entire application dependent on an external API.

The core launcher must work offline.

If metadata retrieval fails:

Use:

```text
Default Game Cover
```

and continue.

---

# 52. Artwork

Artwork sources must be configurable.

Store cached artwork locally:

```text
%APPDATA%/GameHub/cache/artwork/
```

Do not repeatedly download the same artwork.

Use game ID to identify cached assets.

---

# 53. Offline Mode

GameHub must work without internet.

Offline functionality:

* View library
* Search
* Filter
* Launch games
* Favorites
* Recent games
* Database
* Scan installed games
* Manual games

Internet-dependent functionality:

* New metadata
* New artwork
* Optional updates

---

# 54. Privacy

The application should be local-first.

Do not upload:

* Game installation paths
* File lists
* Personal files
* Windows usernames
* PC information

unless the user explicitly enables a feature requiring it.

---

# 55. Security

Never execute arbitrary files without user action.

For automatic detection:

Only create a launch target after validating the executable path.

Use safe IPC.

Do not expose Node.js APIs directly to React.

Use:

```text
contextIsolation: true
nodeIntegration: false
```

Use preload APIs.

---

# 56. Electron IPC

Expose only required APIs.

Example:

```ts
window.gameHub.games.getAll()

window.gameHub.games.scan()

window.gameHub.games.launch(gameId)

window.gameHub.games.favorite(gameId)

window.gameHub.games.remove(gameId)

window.gameHub.drives.getAll()

window.gameHub.settings.get()

window.gameHub.settings.update()
```

Do NOT expose:

```text
fs
child_process
shell
process
```

directly to the renderer.

---

# 57. Preload API

Example:

```ts
contextBridge.exposeInMainWorld("gameHub", {
    games: {
        getAll: () => ipcRenderer.invoke("games:getAll"),
        getById: (id: number) =>
            ipcRenderer.invoke("games:getById", id),

        launch: (id: number) =>
            ipcRenderer.invoke("games:launch", id),

        scan: () =>
            ipcRenderer.invoke("games:scan"),

        add: (game: GameInput) =>
            ipcRenderer.invoke("games:add", game),

        update: (id: number, game: GameInput) =>
            ipcRenderer.invoke("games:update", id, game),

        remove: (id: number) =>
            ipcRenderer.invoke("games:remove", id),

        toggleFavorite: (id: number) =>
            ipcRenderer.invoke("games:toggleFavorite", id)
    },

    drives: {
        getAll: () =>
            ipcRenderer.invoke("drives:getAll")
    }
});
```

---

# 58. UI Theme

Create a premium gaming interface.

Default:

```text
Dark mode
```

Characteristics:

* Dark background
* Large game artwork
* Subtle gradients
* Glass-like panels
* Rounded cards
* Smooth transitions
* Clear typography
* Strong Play button
* Minimal clutter

Avoid copying Steam's exact UI.

Create an original design.

---

# 59. Color System

Use configurable theme variables.

Example:

```css
--background
--surface
--surface-hover
--border
--text-primary
--text-secondary
--accent
--accent-hover
--danger
--success
```

Do not hard-code colors in hundreds of components.

---

# 60. Responsive Layout

The application is desktop-first.

Support:

```text
1280x720
1366x768
1920x1080
2560x1440
3840x2160
```

The library grid should dynamically change.

Example:

```text
1280px → 4 cards
1920px → 6 cards
2560px → 7–8 cards
```

Do not make cards excessively small.

---

# 61. Animations

Use subtle animations:

* Card hover
* Page transitions
* Sidebar transitions
* Scan progress
* Play button hover
* Modal appearance

Avoid:

* Excessive bouncing
* Constant moving backgrounds
* Heavy particle effects
* Animations that hurt performance

---

# 62. Performance Requirements

The application should remain responsive with:

```text
100 games
500 games
1000 games
```

Avoid rendering every game unnecessarily.

Use virtualization if the library becomes very large.

Images should be lazy loaded.

---

# 63. Database Performance

Create indexes:

```sql
CREATE INDEX idx_games_name
ON games(normalized_name);

CREATE INDEX idx_games_launcher
ON games(launcher);

CREATE INDEX idx_games_favorite
ON games(is_favorite);

CREATE INDEX idx_games_last_played
ON games(last_played_at);
```

---

# 64. Logging

Create a local log file:

```text
%APPDATA%/GameHub/logs/gamehub.log
```

Log:

* Application startup
* Scanner errors
* Game detection
* Launch attempts
* Launch failures
* Database errors

Do not log sensitive information unnecessarily.

---

# 65. Error Handling

Every major operation should have:

```text
try/catch
```

Failures should not crash the application.

Examples:

```text
Drive inaccessible
Permission denied
Game executable missing
Database unavailable
Malformed manifest
Launcher unavailable
Artwork unavailable
```

Handle them gracefully.

---

# 66. Settings Page

Settings should contain:

## General

```text
☑ Start GameHub with Windows
☐ Minimize to system tray
☑ Remember window size
```

## Library

```text
[ Rescan Library ]

Scan Locations
...
```

## Launching

```text
☑ Confirm before launching
☐ Run games as administrator
```

Do not enable administrator launching by default.

## Appearance

```text
Theme
○ Dark
○ Light
○ System

Card Size
Small / Medium / Large
```

## Metadata

```text
☑ Automatically fetch metadata
☑ Automatically fetch artwork
```

## Advanced

```text
Clear Artwork Cache
Repair Database
Export Library
Import Library
Open Logs Folder
```

---

# 67. Import / Export

Allow library export to JSON.

Example:

```json
{
    "version": 1,
    "games": []
}
```

This allows users to back up their GameHub configuration.

Import should validate the JSON before modifying the database.

---

# 68. System Tray

Optional feature.

Tray menu:

```text
GameHub

Open GameHub
Rescan Games
Recently Played
Exit
```

Do not keep unnecessary background processes running.

---

# 69. Desktop Shortcut

Allow:

```text
Create Desktop Shortcut
```

For standalone games, create a shortcut that launches the game.

For Steam games, create a shortcut that opens:

```text
steam://rungameid/APP_ID
```

---

# 70. Startup Behavior

If enabled:

```text
Windows starts
↓
GameHub starts
↓
GameHub minimizes to tray
```

Do not automatically scan every drive during startup.

Perform lightweight verification only.

---

# 71. Game Detection Priority

Use this order:

```text
Steam
↓
Epic
↓
GOG
↓
Xbox / Microsoft Store
↓
Other supported launchers
↓
Standalone configured directories
↓
Optional heuristic scan
```

---

# 72. Future Launcher Support

Architecture must make it easy to add:

```text
EA App
Ubisoft Connect
Battle.net
Rockstar Games Launcher
itch.io
Amazon Games
Humble
```

Create a generic interface:

```ts
interface LauncherDetector {
    launcher: GameLauncher;

    detect(): Promise<GameCandidate[]>;

    launch(game: GameCandidate): Promise<void>;
}
```

Adding a new launcher should require creating one detector rather than rewriting the application.

---

# 73. Game Candidate

Use an intermediate object:

```ts
interface GameCandidate {
    name: string;
    installPath?: string;
    executablePath?: string;

    launcher: GameLauncher;

    launcherAppId?: string;

    confidence: number;

    metadata?: {
        developer?: string;
        publisher?: string;
        genre?: string;
    };
}
```

The scanner produces candidates.

The database service converts candidates into actual games.

---

# 74. Scan Pipeline

Implement:

```text
START SCAN
    ↓
Get available drives
    ↓
Load configured scan locations
    ↓
Run launcher detectors
    ↓
Run standalone detector
    ↓
Generate candidates
    ↓
Normalize paths
    ↓
Deduplicate
    ↓
Compare with database
    ↓
Mark missing games
    ↓
Insert new games
    ↓
Update existing games
    ↓
Fetch optional metadata
    ↓
Refresh UI
    ↓
SCAN COMPLETE
```

---

# 75. Game Name Normalization

Normalize names for duplicate detection.

Example:

```text
"Cyberpunk 2077"
"cyberpunk 2077"
"Cyberpunk2077"
```

should be treated carefully during comparison.

Do not blindly merge games based only on name.

Prefer installation path and launcher ID.

---

# 76. Safe File Scanning

Never scan these by default:

```text
C:\Windows
C:\Windows\System32
C:\Program Files\WindowsApps
C:\$Recycle.Bin
System Volume Information
```

unless the detector specifically requires access and Windows allows it.

Never attempt to bypass permissions.

---

# 77. Cancellation

Scanner must support cancellation.

Example:

```ts
const controller = new AbortController();

scanner.scan({
    signal: controller.signal
});
```

When user presses:

```text
Cancel Scan
```

stop new work gracefully.

Already-completed results should remain available.

---

# 78. Notifications

Use toast notifications.

Examples:

```text
✓ Cyberpunk 2077 added

✓ Library scan completed
42 games found

⚠ 2 games could not be verified

✕ Failed to launch GTA V
```

---

# 79. Empty State

If no games are found:

```text
🎮

No games found

GameHub couldn't find any installed games.

[ Scan My PC ]

or

[ Add Game Manually ]
```

---

# 80. Missing Game State

If a game is missing:

```text
Cyberpunk 2077

⚠ Installation not found

Expected location:
E:\Games\Cyberpunk 2077

[ Locate Game ]
[ Remove ]
```

---

# 81. Game Detail Metadata Failure

If no metadata exists:

```text
Cyberpunk 2077

Standalone Game

[ ▶ PLAY ]

Installation
E:\Games\Cyberpunk 2077
```

Never block launching because metadata is unavailable.

---

# 82. First MVP

Build the application in these stages.

## Phase 1 — Application Shell

Implement:

* Electron
* React
* Vite
* Tailwind
* SQLite
* Window
* Sidebar
* Routing
* Dark theme

At the end:

```text
GameHub opens as a Windows desktop application.
```

---

# 83. Phase 2 — Database

Implement:

* SQLite
* Tables
* Repositories
* CRUD operations

Test:

```text
Add game
Read game
Update game
Delete game
Favorite game
```

---

# 84. Phase 3 — Drive Detection

Implement:

```text
Get Windows drives
```

Show them in Settings.

Example:

```text
C:  475 GB
D:  1 TB
E:  2 TB
G:  1 TB
```

---

# 85. Phase 4 — Manual Games

Implement:

```text
Add Game
```

Allow the user to browse for an executable.

Then:

```text
Save game
Show card
Launch game
```

This should be the first working end-to-end feature.

---

# 86. Phase 5 — Standalone Scanner

Implement configurable scan directories.

Start with:

```text
C:\Games
D:\Games
E:\Games
F:\Games
G:\Games
```

but only scan directories that exist.

Detect likely game installations.

---

# 87. Phase 6 — Steam

Implement Steam library detection.

Test with multiple Steam libraries on different drives.

Test:

```text
C:
D:
E:
G:
```

Make sure duplicate games aren't created.

Implement Steam launching.

---

# 88. Phase 7 — Epic

Implement:

* Manifest detection
* Game metadata
* Installation path
* Epic launching

---

# 89. Phase 8 — GOG

Implement:

* Registry detection
* Galaxy detection
* Game launching

---

# 90. Phase 9 — Xbox

Implement safe detection and official Windows launch methods.

Do not bypass Windows Store restrictions.

---

# 91. Phase 10 — Artwork & Metadata

Add optional metadata provider.

Implement:

```text
Game name
Cover
Background
Description
Developer
Publisher
Genre
```

Cache downloaded images.

---

# 92. Phase 11 — Playtime

Implement:

```text
Launch
↓
Monitor process
↓
Process exits
↓
Calculate duration
↓
Save history
```

---

# 93. Phase 12 — Settings

Implement:

* Scan folders
* Theme
* Startup
* Tray
* Metadata
* Launch options
* Cache
* Export/import

---

# 94. Phase 13 — Packaging

Create Windows installer:

```text
GameHub-Setup.exe
```

Requirements:

* Desktop shortcut option
* Start menu shortcut
* Uninstaller
* Application icon
* Version number

---

# 95. Testing

Test the following.

## Drive Tests

```text
C only
C + D
C + D + E
External drive
Disconnected drive
Network drive
```

## Game Tests

```text
Steam
Epic
GOG
Standalone
Missing game
Moved game
Duplicate game
Game with spaces in path
Game with special characters
```

## Launch Tests

```text
Steam game
Epic game
Standalone game
Missing executable
Launcher unavailable
```

---

# 96. Performance Testing

Test with:

```text
10 games
100 games
500 games
1000 games
```

Verify:

* Startup time
* Search speed
* Scanning speed
* Memory usage
* UI responsiveness

---

# 97. Security Testing

Verify:

```text
nodeIntegration = false
contextIsolation = true
```

Ensure renderer cannot directly execute arbitrary commands.

All launch requests must go through validated IPC.

Validate executable paths before launching.

---

# 98. Important Windows Considerations

Windows paths may contain:

```text
C:\Program Files\
C:\Games\
D:\My Games\
```

Always handle:

* Spaces
* Unicode
* Special characters
* Long paths
* Missing directories
* Permission errors

Do not concatenate paths manually.

Use:

```ts
path.join()
```

---

# 99. Long Path Support

Some games have very long installation paths.

Where possible, support Windows long paths.

Never truncate a path.

---

# 100. Process Detection

When tracking playtime, don't simply assume:

```text
process name == executable name
```

Some games launch additional processes.

Store the original launch process and determine the correct process lifecycle.

For Steam games, direct process tracking may require additional handling.

Playtime should be considered an approximation unless the process lifecycle can be reliably determined.

---

# 101. Multiple Executables

Some games have:

```text
Game.exe
GameLauncher.exe
Game-Win64-Shipping.exe
```

The user should be able to select which executable to launch.

For automatic detection, prefer:

```text
official launcher
↓
known primary executable
↓
largest likely game executable
```

Never automatically choose an arbitrary `.exe`.

---

# 102. Administrator Games

Some games may require elevated permissions.

Do not run everything as administrator.

If a game fails because of permissions, provide:

```text
Launch as Administrator
```

as an optional action.

---

# 103. Game Updates

GameHub should not update games.

It is a launcher/library manager.

For updates:

```text
Steam → Steam
Epic → Epic
GOG → GOG
```

Let the official platform manage updates.

---

# 104. Uninstallation

Do not implement direct game deletion initially.

The Remove action should only remove the game from GameHub.

Future versions may provide:

```text
Open Steam
Open Epic
Open GOG
```

for uninstalling through the official launcher.

---

# 105. User Experience Principle

The user should be able to perform this workflow:

```text
Install GameHub
        ↓
Open GameHub
        ↓
Scan PC
        ↓
Wait
        ↓
All games appear
        ↓
Click a game
        ↓
Click PLAY
        ↓
Game launches
```

No complicated configuration should be required.

---

# 106. Advanced Future Features

Do not implement these in the MVP, but keep architecture extensible for:

* Controller navigation
* Big Picture mode
* Steam Deck-like interface
* Gamepad support
* FPS overlay
* CPU/GPU monitoring
* Screenshots
* Game notes
* Game tags
* Custom collections
* Playtime charts
* Game completion tracking
* Achievement tracking
* Cloud backup
* Multiple user profiles
* Game-specific launch arguments
* Mod manager integration
* Emulator support
* ROM library
* Portable games
* Network game library
* Remote launch
* Mobile companion application

---

# 107. Emulator Support — Future

Future versions could support:

```text
Dolphin
PCSX2
RPCS3
Ryujinx
RetroArch
```

But this should be a separate module.

Architecture:

```text
Game
│
├── PC Game
├── Emulator Game
└── Other
```

Do not implement emulator support in the first version.

---

# 108. UI Navigation

Use client-side routing.

Routes:

```text
/
    Home

/library
    All Games

/library/steam
    Steam

/library/epic
    Epic

/library/gog
    GOG

/library/standalone
    Standalone

/favorites
    Favorites

/recent
    Recently Played

/game/:id
    Game Details

/settings
    Settings
```

---

# 109. Global Search

Search should work from every page.

Keyboard shortcut:

```text
Ctrl + K
```

opens search.

Escape closes it.

---

# 110. Keyboard Shortcuts

Implement:

```text
Ctrl + K
Search

Ctrl + R
Rescan

Ctrl + Shift + F
Favorites

Escape
Close modal

Enter
Launch selected game
```

Do not override common Windows shortcuts unnecessarily.

---

# 111. Accessibility

Support:

* Keyboard navigation
* Focus states
* Screen-reader labels
* Sufficient contrast
* Tooltips for icon-only buttons

---

# 112. Internationalization

Initially:

```text
English
```

But structure the application so translations can be added later.

Do not hard-code every user-facing string inside components.

---

# 113. Configuration

Create:

```ts
appConfig.ts
```

Example:

```ts
export const appConfig = {
    name: "GameHub",
    version: "1.0.0",
    databaseName: "gamehub.db",
    defaultScanPaths: [],
    metadataEnabled: true,
    artworkEnabled: true
};
```

---

# 114. Environment Variables

Do not put secrets directly in source code.

If an external metadata API is used:

```text
.env
```

Example:

```text
METADATA_API_KEY=
```

The application should still work if the key is missing.

Never commit `.env`.

---

# 115. Gitignore

Include:

```text
node_modules/
dist/
release/
.env
.env.*
*.log
*.db
*.db-shm
*.db-wal
```

---

# 116. README

README must explain:

```text
Project overview
Features
Technology
Development setup
Running locally
Building
Packaging
Architecture
Adding a detector
Database
Troubleshooting
```

---

# 117. Development Commands

Use:

```bash
npm install
```

Development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Package Windows application:

```bash
npm run package
```

---

# 118. Code Quality

Follow:

* SOLID principles
* Clear naming
* Small services
* Typed interfaces
* No duplicated logic
* No giant React components
* No hard-coded Windows paths
* No hard-coded launcher logic inside UI

Keep detection logic completely separate from UI.

---

# 119. Important Separation

The UI must never contain code like:

```ts
child_process.spawn(...)
```

or:

```ts
fs.readdir(...)
```

The correct flow is:

```text
React
 ↓
Preload API
 ↓
IPC
 ↓
Electron Main
 ↓
Service
 ↓
Operating System
```

---

# 120. Logging Architecture

Create:

```text
Logger
```

with:

```ts
logger.info()
logger.warn()
logger.error()
logger.debug()
```

Use log levels.

Avoid console logging large amounts of information in production.

---

# 121. Database Migration System

Do not assume the database schema will never change.

Create migrations:

```text
001_initial.sql
002_add_playtime.sql
003_add_categories.sql
```

Store the current schema version.

On startup:

```text
Check database version
↓
Run missing migrations
↓
Start application
```

---

# 122. Backup

Before database migration:

Create:

```text
gamehub.db.backup
```

This prevents accidental data loss.

---

# 123. Crash Recovery

If database corruption occurs:

Show:

```text
GameHub detected a database problem.

[ Repair Database ]
[ Restore Backup ]
```

Do not silently delete the database.

---

# 124. Scanner Database Rules

When scanning:

### New game

Insert.

### Existing game

Update:

```text
install path
executable
last verification
metadata
```

### Missing game

Set:

```text
is_installed = false
```

### Reappeared game

Set:

```text
is_installed = true
```

Do not duplicate it.

---

# 125. Scan Result

At the end show:

```text
Scan Complete

42 games found

New games:
5

Already in library:
35

Missing:
2

Possible games:
3

[ View Library ]
```

---

# 126. Possible Games

Low-confidence detections should be shown separately.

Example:

```text
Possible Games

Found:
D:\Games\SomeFolder

Executable:
Game.exe

Confidence:
62%

[ Add ]
[ Ignore ]
```

Ignored paths should be saved so future scans do not repeatedly show them.

---

# 127. Ignore List

Create:

```sql
CREATE TABLE ignored_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL
);
```

---

# 128. Game Verification

Every game should have a verification state:

```text
VERIFIED
MISSING
UNKNOWN
```

Do not constantly verify every game.

Verify when:

* Application starts
* User opens game details
* User launches
* User performs scan

---

# 129. Application Startup

Startup sequence:

```text
Electron starts
 ↓
Initialize logging
 ↓
Initialize database
 ↓
Run migrations
 ↓
Initialize IPC
 ↓
Create window
 ↓
Load React
 ↓
Load library
 ↓
Perform lightweight game verification
 ↓
Ready
```

---

# 130. Shutdown

On shutdown:

```text
Save application settings
Close database
Stop active scanners
Stop process monitors
Close logs
```

Avoid leaving child processes behind.

---

# 131. Window Features

Support:

* Minimize
* Maximize
* Restore
* Close
* Remember size
* Remember position

Default:

```text
1280 x 800
```

Minimum:

```text
1000 x 650
```

---

# 132. Custom Title Bar

A custom title bar may be used for a premium UI.

If implemented:

* Keep native Windows behavior reliable.
* Provide minimize/maximize/close.
* Ensure accessibility.
* Do not sacrifice stability for visual design.

---

# 133. Splash Screen

Optional.

Use:

```text
GameHub

Loading your library...
```

Keep it short.

Do not artificially delay startup.

---

# 134. Application Icon

Create a simple original gaming-themed icon.

Do not copy Steam, Epic, Xbox, or other trademarks.

Use:

```text
assets/icons/
```

---

# 135. Branding

Temporary:

```text
GameHub
Your games. One place.
```

Make branding easy to change later.

---

# 136. Final MVP Definition

Version 1.0 must support:

```text
✓ Windows desktop application
✓ React UI
✓ SQLite
✓ Multiple drives
✓ Steam detection
✓ Epic detection
✓ GOG detection
✓ Standalone detection
✓ Manual games
✓ Search
✓ Filters
✓ Favorites
✓ Recently played
✓ Game launching
✓ Missing-game detection
✓ Rescan
✓ Game details
✓ Settings
✓ Dark UI
✓ Windows installer
```

---

# 137. Development Order

Follow this exact implementation order.

```text
1. Create project
2. Configure Electron
3. Configure React/Vite
4. Configure Tailwind
5. Create application shell
6. Create SQLite database
7. Implement repositories
8. Implement IPC
9. Implement manual game addition
10. Implement standalone launch
11. Implement drive detection
12. Implement standalone scanner
13. Implement Steam detector
14. Implement Steam launching
15. Implement Epic detector
16. Implement Epic launching
17. Implement GOG detector
18. Implement GOG launching
19. Implement game deduplication
20. Implement missing game detection
21. Implement favorites
22. Implement recent games
23. Implement playtime
24. Implement metadata
25. Implement artwork
26. Implement settings
27. Implement import/export
28. Implement tray
29. Implement keyboard shortcuts
30. Optimize performance
31. Test
32. Package Windows installer
```

---

# 138. Development Rule

After completing every major phase:

1. Run the application.
2. Test the feature.
3. Fix errors.
4. Do not continue while the previous phase is fundamentally broken.

Never generate the entire project blindly and assume it works.

---

# 139. Testing Strategy

Each service should be testable independently.

Example:

```text
SteamDetector
EpicDetector
GogDetector
StandaloneDetector
GameRepository
GameLauncher
DriveService
```

Use mocks where operating-system access is required.

---

# 140. Important Constraint

Never use piracy-related functionality.

The application must NOT:

* Download pirated games
* Crack games
* Bypass DRM
* Bypass launcher authentication
* Circumvent Windows Store protection
* Disable anti-cheat
* Modify game licensing
* Provide unauthorized game copies

It is only a library and launcher for games already installed by the user.

---

# 141. Future Cloud Features

Do not add cloud accounts in version 1.

If added later:

* User authentication
* Cloud library backup
* Sync settings
* Sync playtime
* Cross-device library

must be optional.

The local library must remain functional without an account.

---

# 142. Final User Experience

The final application should feel like:

```text
Steam Library
+
Playnite-style game aggregation
+
Modern gaming dashboard
+
Local-first launcher
```

but with an original UI and implementation.

The user should not need to remember:

```text
Which drive?
Which folder?
Which launcher?
Which executable?
```

They should simply open GameHub and see:

```text
ALL MY GAMES
```

in one place.

---

# 143. Final Acceptance Test

The application is considered successful when a fresh Windows installation containing games such as:

```text
Steam:
    Game A
    Game B

Epic:
    Game C

GOG:
    Game D

Standalone:
    Game E
```

can be scanned and displayed as:

```text
ALL GAMES

Game A     Steam
Game B     Steam
Game C     Epic
Game D     GOG
Game E     Standalone
```

and clicking:

```text
▶ PLAY
```

launches each game through the appropriate legitimate mechanism.

---

# 144. Final Instruction to the AI Coding Agent

Build this application incrementally.

Do not replace working code unnecessarily.

Before implementing a feature:

1. Inspect the existing project.
2. Understand the current architecture.
3. Reuse existing components and services.
4. Implement the smallest clean change.
5. Run/build/test.
6. Fix errors.
7. Continue to the next phase.

Do not create fake functionality.

Do not use placeholder buttons that appear functional but do nothing.

If a feature cannot be implemented reliably on Windows, implement graceful fallback behavior and clearly communicate it in the UI.

Prioritize:

```text
Reliability
>
Correct game detection
>
Correct launching
>
Data safety
>
Performance
>
UI polish
```

The most important requirement is:

> **A user should be able to scan all their configured drives and launch their legitimately installed PC games from one application without having to manually remember where each game is installed.**

Build the project as a production-quality Windows desktop application, not as a demo.
