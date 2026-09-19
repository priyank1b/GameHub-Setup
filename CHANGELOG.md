# Changelog

All notable changes to GameHub are documented in this file.

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
