# GameHub 🎮 — Unified PC Game Library & Launcher

[![Release](https://img.shields.io/badge/release-v1.0.0-teal.svg)](https://github.com/priyank1b/GameHub-Setup/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-blue.svg)](https://github.com/priyank1b/GameHub-Setup)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Framework](https://img.shields.io/badge/Electron-33.x-47848F.svg)](https://www.electronjs.org/)
[![UI](https://img.shields.io/badge/React-18.x-61DAFB.svg)](https://react.dev/)

**GameHub** is a high-performance Windows desktop application designed to discover, organize, and launch games across all drives and launchers on your PC. It combines games from Steam, Epic Games, GOG Galaxy, Ubisoft Connect, Microsoft Store / Xbox, and standalone installations into a single unified library.

> **Privacy & Platform Respect**: GameHub strictly manages and launches legitimately installed games. It uses official platform protocols (`steam://rungameid/`, Epic URI schemes, GOG Galaxy hooks) to preserve achievements, cloud saves, overlays, and DRM without modifying game binaries.

---

## ✨ Features

- 🖥️ **Unified Multi-Launcher Library**: Discovers and centralizes games from:
  - **Steam** (ACF manifest parser across all Steam library folders)
  - **Epic Games Store** (`.item` manifests & catalog integration)
  - **GOG Galaxy** (Registry & database integration)
  - **Ubisoft Connect** (Configuration & registry parser)
  - **Xbox / Microsoft Store** (Safe AUMID protocol execution)
  - **Standalone / Custom Folders** (Heuristic binary detection)
- 💾 **Multi-Drive Scanning**: Automatically detects game folders across internal and external drives (`C:`, `D:`, `E:`, etc.) with customized scan location management.
- 🚀 **Smart Native Launching**:
  - Launches platform games through official protocol handlers preserving cloud saves and overlays.
  - Launches standalone executables with dedicated working directory isolation.
  - Gracefully detects missing or disconnected drives.
- 🎨 **Visual Richness & Artwork**:
  - Displays high-resolution cover artwork, heroes, logos, and game descriptions.
  - Official Steam Web Store API integration with disk caching (`%APPDATA%/GameHub/cache/artwork/`).
  - Full in-app metadata editor for custom and standalone games.
- ⚡ **Lightning-Fast Performance**:
  - Optimized SQLite storage with WAL (Write-Ahead Logging), 64MB memory page cache, and covered indexes.
  - Virtualized rendering with `content-visibility: auto` ensuring buttery smooth 60fps scrolling with 1,000+ games.
- 🔍 **Search, Filter & Sort**:
  - Instant search by title, developer, publisher, or genre.
  - Quick filter tabs for All, Steam, Epic, GOG, Standalone, Favorites, and Missing titles.
  - Sort by alphabetical (A-Z, Z-A), recently added, last played, playtime, or size.
- ⏱️ **Playtime Tracking & Favorites**:
  - Tracks individual game sessions and aggregates total playtime.
  - Instant one-click favorite toggling.
- 🛡️ **Integrity & Diagnostics**:
  - Automated PRAGMA database integrity checks, repair tools (`REINDEX`, `VACUUM`), and atomic snapshot backups.
  - Persistent rotating logs saved to `%APPDATA%/GameHub/logs/gamehub.log`.
  - JSON library export & import for cross-machine backup.
- 🔔 **System Tray & Hotkeys**:
  - Minimizes to the Windows System Tray for instant background access.
  - Keyboard shortcuts (`Ctrl+K` for search, `Ctrl+R` to rescan, `Escape` to close modals).

---

## 📥 Download & Installation

### Option 1: Windows Setup Installer (Recommended)
Download **`GameHub-Setup.exe`** from the [Releases](https://github.com/priyank1b/GameHub-Setup/releases) page.
- Runs standard Windows setup wizard.
- Creates Start Menu and Desktop shortcuts.
- Configures clean Windows uninstaller.

### Option 2: Portable Unpacked Release
Extract the `win-unpacked` folder and run `GameHub.exe` directly without installation.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Shell** | Electron 33, Node.js |
| **Frontend Framework** | React 18, TypeScript |
| **Styling & Icons** | Tailwind CSS, Lucide React |
| **Build Tools** | Vite 6, esbuild |
| **Database** | SQLite via `better-sqlite3` (WAL mode enabled) |
| **Packaging** | `electron-builder` (NSIS target) |

---

## 🏗️ Architecture

```text
                         GAMEHUB
                            │
            ┌───────────────┴───────────────┐
            │                               │
         React UI                      Electron Main
            │                               │
         Preload                     IPC Controllers
    (window.gameHub)                        │
            │                               │
            └───────────────┬───────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
       GameScanner     GameLauncher      Database
            │               │             SQLite
      ┌─────┼─────┐         │               │
    Steam  Epic  GOG    Windows OS     %APPDATA%/GameHub/
                        (Launchers)
```

---

## 💻 Building from Source

### Prerequisites
- **Windows 10 or 11 (64-bit)**
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/priyank1b/GameHub-Setup.git
   cd GameHub-Setup
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in Development Mode**:
   ```bash
   npm run dev
   ```

4. **Build Production Bundles**:
   ```bash
   npm run build
   ```

5. **Package Windows Installer**:
   ```bash
   npx electron-builder --win nsis
   ```
   The generated installer will be located at `release/GameHub-Setup.exe`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` | Focus search bar |
| `Ctrl + R` | Trigger quick library rescan |
| `Escape` | Close active modal or clear search |
| `Enter` | Launch selected game |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
