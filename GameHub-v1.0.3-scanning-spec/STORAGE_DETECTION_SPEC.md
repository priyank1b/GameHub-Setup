# GameHub v1.0.3 — Storage Detection Specification

## Objective
Provide reliable installation sizes without blocking the UI or changing Windows permissions.

## Model

```ts
type StorageSizeStatus =
  | "KNOWN"
  | "CALCULATING"
  | "UNKNOWN"
  | "ACCESS_DENIED";

type StorageSizeSource =
  | "metadata"
  | "filesystem"
  | "package"
  | "unknown";

interface StorageInfo {
  installPath?: string;
  sizeBytes?: number;
  status: StorageSizeStatus;
  source: StorageSizeSource;
  updatedAt?: string;
}
```

Adapt names to the existing project.

## Resolver
Use one `StorageResolver` abstraction with source-specific strategies.

Resolution order:
1. Trusted launcher/package metadata
2. Safe filesystem calculation
3. Safe fallback
4. UNKNOWN / ACCESS_DENIED

## Standalone
Do not assume the executable's immediate parent is the complete install root. Use known installation roots or configured scan locations. Recursively calculate size asynchronously.

Handle inaccessible files, large folders, missing paths, and reparse/symlink edge cases safely.

## Launcher Games
Prefer Steam/Epic/GOG/Ubisoft metadata. Use filesystem calculation only when needed.

## Microsoft Store/Xbox
Use supported Windows package information to identify packages and installation locations. Microsoft documents `Get-AppxPackage` for retrieving installed AppX/MSIX packages. Do not expose arbitrary PowerShell to the renderer. Do not take ownership of WindowsApps or change ACLs.

If safe enumeration is blocked, retain known metadata and report `Size unavailable` or `Access denied`.

## SQLite
Add or adapt:

```sql
install_path TEXT NULL,
install_size_bytes INTEGER NULL,
install_size_status TEXT NOT NULL DEFAULT 'UNKNOWN',
install_size_source TEXT NOT NULL DEFAULT 'unknown',
install_size_updated_at TEXT NULL
```

## Caching
Refresh on new detection, path change, explicit refresh, relevant metadata change, or staleness according to project policy. Do not calculate on every UI render.

## Concurrency
Maintain an in-flight calculation map so multiple requests for the same game share one calculation. Limit overall filesystem calculations to avoid excessive disk I/O.

## Errors
- Permission error -> ACCESS_DENIED
- Missing path -> UNKNOWN
- Temporary I/O error -> UNKNOWN + log
- Successful result -> KNOWN
- In progress -> CALCULATING

Never convert errors into `0`.

## UI
Display actual size, `Calculating…`, `Size unavailable`, or `Access denied`. Optional tooltip can show source and last-updated time.

## Security
Filesystem and package operations stay in Electron main/service code. Renderer receives sanitized results through the existing preload IPC.


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
