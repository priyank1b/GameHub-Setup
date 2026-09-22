# GameHub v2.0.0 — Uninstalled Library + Multi-Account

## Scope
Introduce a unified library across launchers, including games owned but not installed and multiple connected accounts per launcher.

## Core rule
A launcher is not an account. One launcher can have multiple connected accounts, and every launcher-library entry belongs to exactly one launcher account.

## Phase Plan
1. Architecture audit and migration safety
2. Canonical game identity
3. Multi-account launcher model
4. Secure account connection/storage
5. Launcher provider abstraction
6. Per-account library synchronization
7. Cached available-games library
8. Installed/available reconciliation
9. Cross-launcher and cross-account grouping
10. Account-aware install handoff
11. Account-aware Play routing
12. Account filtering
13. Account management UI
14. Disconnect/reconnect semantics
15. Metadata/artwork deduplication
16. Controller navigation
17. Performance/caching
18. Security review
19. Failure/recovery handling
20. Full regression testing
21. Production packaging/release

## Multi-account requirements
- Multiple accounts may be connected for the same launcher.
- Each account has a stable launcher-specific external identity.
- Every synced game entry references its owning launcher account.
- Credentials/tokens are never stored as plaintext in SQLite.
- Use OS-protected secure storage from Electron's main process.
- Never silently switch the user's launcher account.
- Disconnecting an account removes its cached library data but does not delete local installations.
- Reconnecting the same account must not create duplicates.
- Sync status/timestamps are tracked independently.

## Example
Steam: Personal (342 games), Brother (128 games)
Epic: Personal (74 games)

A canonical GTA V record may contain:
- Steam / Personal / owned
- Steam / Brother / owned
- Epic / Personal / owned

## Out of scope
DRM/auth/anti-cheat bypass, private-page scraping, launcher passwords, automatic account switching, unauthorized API access, or circumventing official launcher mechanisms.
