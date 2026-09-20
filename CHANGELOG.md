# Changelog

All notable changes to GameHub are documented in this file.

## [1.0.2] - 2026-09-20

### Fixed — Card Context Menu Clarity & Typography
- **Crisp Portal Rendering**:
  - Detached the game card 3-dots options menu from the card DOM tree using React Portals (`createPortal(..., document.body)`).
  - Eliminates sub-pixel bitmap scaling and blur caused by card hover and focus transforms (`scale-[1.02] -translate-y-1.5`).
- **Surface & Antialiasing Optimization**:
  - Replaced semi-transparent `backdrop-blur-xl` on the context menu with an opaque, solid dark surface (`#18181b` with `border border-zinc-700` and `shadow-2xl`) to eliminate edge halo blur.
  - Enabled system-wide font antialiasing (`-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`, and `text-rendering: optimizeLegibility`).
  - Upgraded menu typography to `13px font-medium text-zinc-100` for crisp, high-contrast readability.

---

## [1.0.1] - 2026-09-20

### Added — Full Game Controller & Gamepad Support

#### Controller Architecture & Lifecycle
- **Native Gamepad Detection**:
  - Full support for Xbox/XInput controllers, PlayStation DualShock/DualSense controllers, and standard generic USB/Bluetooth PC gamepads via the standard W3C Gamepad API.
  - Safe hot-plugging support: automatic detection upon connection, graceful release upon disconnection without application restart or UI freeze.
  - Multi-controller detection with automatic active controller switching upon user input.
  - Zero external drivers, background services, or native dependencies required.

#### Deterministic Spatial Navigation
- **Euclidean 2D Focus Engine**:
  - Directional navigation across game cards, action buttons, filters, and modals via D-Pad and left analog stick with dominant-axis isolation and 0.38 dead-zone filtering.
  - Smooth repeat timers (450ms initial delay, 220ms repeat interval) for precise single-step adjustments and comfortable hold scrolling.
  - Right-stick analog scrolling and LT/RT trigger paging inside long modal descriptions and context menus.
  - Single-press edge debouncing for action buttons to eliminate accidental double clicks.
  - Modal focus traps: opening dialogs (Game Details, Add Game, Confirmations) securely traps navigation inside the modal and restores focus back to the triggering element upon dismissal.
  - Seamless mouse/controller coexistence: moving the mouse instantly restores mouse mode, while any controller input automatically highlights the focused element.
  - GameCard focus styling visually aligned with mouse hover effects (subtle scale zoom, bright teal title glow, and centered play overlay).

#### UI Controls & Cheat Sheet
- **D-Pad / Left Stick**: Navigate UI elements, tabs, filters, and game grid.
- **Right Stick / Triggers (LT/RT)**: Smooth analog scrolling and fast page-up/page-down through modal text.
- **A / Cross / Start**: Play / Launch selected game, or confirm actions.
- **B / Circle**: Back, close modals, or cancel actions.
- **X / Square**: Instant favorite toggling.
- **Y / Triangle**: View game details/description modal, focus search bar, or open context menus.
- **LB / RB (Bumpers)**: Instant section switching (Home ↔ Library ↔ Favorites ↔ Recently Played ↔ Drives ↔ Settings).

#### Window Management & Tray Reliability (Fixes)
- **Windows Occlusion Freeze Fix**: Fixed an issue where restoring GameHub from the system tray after minimizing could freeze the UI due to Chromium's native window occlusion. Disabled `CalculateNativeWinOcclusion` and backgrounding of occluded windows.
- **Taskbar vs. Tray Behavior**: Minimizing the application (`[-]`) now properly keeps it on the Windows taskbar; clicking close (`[X]`) cleanly tucks it into the system tray.
- **Maximize & State Persistence**: Window maximize state and dimensions are now preserved when restoring from the system tray and persisted across application restarts via SQLite settings.

#### Controller Settings
- Added dedicated **Controller** tab in Settings displaying real-time connection status, detected controller hardware ID, W3C mapping standard, and a master controller navigation toggle.

#### Game Launch Boundary
- GameHub automatically suspends controller polling upon game launch or window blur, ensuring 100% of controller inputs pass directly and exclusively to the running game without interference.
- Automatically resumes controller UI navigation when GameHub regains window focus.

---

## [1.0.0] - 2026-09-19

### Initial Official Production Release

#### Core Features
- **Multi-Launcher Detection**:
  - Automatic multi-drive detection and library scanning.
  - Native detection for Steam, Epic Games Store, GOG Galaxy, Ubisoft Connect, and Standalone executables.
  - Multi-tiered candidate deduplication and intelligent path resolution.
- **Smart Launching**:
  - Official URI launcher integration for Steam (`steam://rungameid/`), Epic, and GOG.
  - Standalone process execution with working directory isolation.
  - Missing game detection and on-the-fly drive verification.
- **Library UI & Navigation**:
  - Modern, responsive React grid supporting 1280x720 up to 4K resolutions.
  - Multi-field search (title, developer, publisher, genre) and filter tabs.
  - Sorting by title (A-Z, Z-A), recently added, last played, playtime, and size.
  - Interactive Game Details modal with rich metadata, descriptions, and cover/hero artwork.
  - Full game editor (edit title, executable path, cover image, genre, developer, publisher).
- **Favorites & Statistics**:
  - Instant favorite toggling with persistent database storage.
  - Automatic playtime accumulation and last-played history tracking.
- **Data & Recovery**:
  - SQLite database with WAL mode, page caching, and covered query indexes.
  - Database backup snapshotting and recovery utility (`PRAGMA integrity_check`, `VACUUM`, `REINDEX`).
  - Full JSON library import and export functionality.
- **System Integration**:
  - Windows System Tray integration with quick launcher and restore options.
  - Global keyboard shortcuts (`Ctrl+K` for search, `Ctrl+R` for scan, `Escape` to close modals).
  - Rotated persistent logging in `%APPDATA%/GameHub/logs/gamehub.log`.
- **Packaging**:
  - Production Windows NSIS setup installer (`GameHub-Setup.exe`).
  - Standalone unpacked portable distribution.
