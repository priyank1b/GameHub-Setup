# Available Games Library + Multi-Account UI

## States
INSTALLED, AVAILABLE, INSTALLING, UNKNOWN, SYNC_ERROR.

AVAILABLE means a connected account has the game in its synchronized launcher library but no local installation is detected.

## Filters
- All Games
- Installed
- Available to Install
- Favorites
- Recently Played
- All Accounts

All Accounts expands to entries such as:
- Steam — Personal
- Steam — Brother
- Epic — Personal

## Game card
Show title, artwork, installed status, launcher/account ownership, Install for available entries, Play for installed entries, and a launcher/account selector when multiple valid choices exist.

Example:
GTA V
- Steam / Personal — Installed — Play
- Steam / Brother — Available — Install
- Epic / Personal — Available — Install

## Install flow
1. Identify the selected launcher account.
2. Determine official launcher/account state where possible.
3. Hand off to the official launcher/install mechanism.
4. Never download game files itself unless a future provider explicitly supports an authorized mechanism.
5. Reconcile after installation so AVAILABLE becomes INSTALLED.
6. Do not create duplicate canonical cards.

## Disconnect
- Remove cached library entries for that account.
- Keep canonical games if other ownership or local installations remain.
- Keep local installations even if the originating account is disconnected.
- Reconnecting the same account restores its cached ownership without duplication.

## Sync
Sync is per account. Provide individual Sync Now and optionally Sync All. One failed account must not invalidate others. Cached results remain usable offline.
