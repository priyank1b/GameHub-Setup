# Canonical Game Grouping + Multi-Account Ownership

Represent one real game as one canonical GameHub item while preserving every launcher/account ownership record.

| Canonical Game | Launcher | Account | Ownership | Installed |
|---|---|---|---|---|
| GTA V | Steam | Personal | Yes | Yes |
| GTA V | Steam | Brother | Yes | No |
| GTA V | Epic | Personal | Yes | No |

## Matching
- Prefer stable launcher IDs.
- Use title/developer/publisher/platform metadata as supporting evidence.
- Never merge DLC, bundles, remasters, editions, demos, soundtracks, or similar titles by title alone.
- Preserve separate records when confidence is insufficient.

## Installation
An installation references its launcher game entry/account when known.

Examples:
- Steam Personal installed + Steam Brother owned = one canonical game.
- Steam Personal installed + Epic Personal owned = one canonical game.
- Installed on both Steam Personal and Epic Personal = one canonical game with two local installations.

## Views
Default: grouped canonical games.

Optional setting: `Group games across launchers/accounts`.

When OFF, expose separate launcher/account entries while retaining the same underlying canonical identity.
