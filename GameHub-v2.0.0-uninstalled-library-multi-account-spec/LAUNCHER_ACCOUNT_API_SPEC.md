# Launcher Account + Provider Specification

## Data model

### launcher_accounts
id, launcher, external_account_id, display_name, avatar_url, connection_status, last_connected_at, last_synced_at, sync_status, created_at, updated_at

Unique constraint: `(launcher, external_account_id)`

### launcher_game_entries
id, launcher_account_id, external_game_id, canonical_game_id, title, owned_status, install_available, metadata_json, last_seen_at, last_synced_at

Unique constraint: `(launcher_account_id, external_game_id)`

### local_installations
id, canonical_game_id, launcher_game_entry_id, launcher_account_id, install_path, install_size_bytes, install_size_status, status, last_verified_at

## Provider contract
Conceptually support:
- connectAccount()
- identifyConnectedAccount()
- disconnectAccount()
- syncLibrary(accountId)
- getGameInstallOptions(gameEntryId)
- handoffInstall(gameEntryId)
- handoffLaunch(gameEntryId/localInstallation)

Use official/publicly supported mechanisms where available. If a launcher cannot safely provide account-library sync, keep installed detection working and report sync unavailable.

## Active account
GameHub may store a preferred/active account per launcher for UI convenience.

Important: this is a GameHub preference, not a command to log the launcher into that account. Do not manipulate launcher credentials or force account switching.

## Secure storage
- Never store passwords/access tokens in SQLite.
- Use OS-protected secure storage from Electron's main process.
- Renderer receives only non-sensitive account state.
- Never log credentials, tokens, authorization codes, or secrets.
