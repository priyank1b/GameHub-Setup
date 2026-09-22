# GameHub v1.0.3 — Microsoft Store / Xbox Storage Specification

## Objective
Improve Microsoft Store/Xbox detection without bypassing Windows protections.

## Package Discovery
Use supported Windows package information for the current user. Microsoft documents `Get-AppxPackage` for installed AppX/MSIX package discovery.

Prefer an existing native Windows API if the project already has one. Otherwise isolate PowerShell/Windows command integration in the Electron main process only.

## Matching
Build an indexed package map using stable identifiers where possible:
- package name
- family name
- full name
- publisher
- version
- install location

Do not rely only on display names.

## Protected Locations
Treat `C:\Program Files\WindowsApps` as Windows-managed.

Never:
- take ownership
- modify ACLs
- grant elevated access solely for size calculation
- modify/delete package files

## Size Strategy
1. Trusted package/launcher metadata
2. Safe filesystem calculation
3. Supported package-aware fallback
4. UNKNOWN / ACCESS_DENIED

Never report `0 GB` merely because access is unavailable.

## XboxGames
If GameHub can safely determine an accessible Xbox game root, calculate it recursively and cache it. If not accessible, retain metadata and report an honest unavailable/denied state.

## Optional Packages
Avoid double-counting shared framework/dependency packages. Be careful with main, resource, optional packages, and bundles.

## Testing
Test Microsoft Store and Xbox games, protected WindowsApps paths, accessible Xbox game folders, package updates, uninstall/reinstall, and inaccessible paths. Test the packaged EXE.


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
