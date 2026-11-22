import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

/**
 * Locates the Steam client and every Steam library folder on this PC.
 *
 * Why this exists: the old lookup spawned PowerShell with a 3s timeout, which
 * regularly timed out on slower / freshly booted PCs (or where PowerShell is
 * restricted), and then only fell back to C:\. Secondary libraries were only
 * picked up if they contained `libraryfolders.vdf`, which only exists in the
 * *main* Steam folder (secondary libraries have `libraryfolder.vdf`, singular).
 */

const REG_EXE = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');

/** Reads a single registry value using reg.exe (fast, no PowerShell needed). */
export async function readRegistryValue(key: string, valueName: string): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  for (const view of ['/reg:64', '/reg:32']) {
    try {
      const { stdout } = await execFileAsync(REG_EXE, ['query', key, '/v', valueName, view], {
        timeout: 8000,
        windowsHide: true,
      });
      // Output line: "    SteamPath    REG_SZ    c:/program files (x86)/steam"
      const line = stdout
        .split(/\r?\n/)
        .find((l) => l.trim().toLowerCase().startsWith(valueName.toLowerCase()));
      if (!line) continue;
      const m = line.match(/REG_(?:EXPAND_)?SZ\s+(.+)$/i);
      if (m && m[1].trim()) {
        const raw = m[1].trim();
        return raw.replace(/%([^%]+)%/g, (_, v) => process.env[v] || `%${v}%`);
      }
    } catch {
      // key/value missing in this view
    }
  }
  return null;
}

function normalizeDir(p: string): string {
  const resolved = path.resolve(p.replace(/\//g, '\\'));
  return resolved.charAt(0).toUpperCase() + resolved.slice(1);
}

function isSteamClientDir(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'steam.exe')) ||
    fs.existsSync(path.join(dir, 'steamapps', 'libraryfolders.vdf'))
  );
}

/** A folder is a Steam library if it has a steamapps dir with manifests or a library marker. */
export function isSteamLibraryDir(dir: string): boolean {
  const steamapps = path.join(dir, 'steamapps');
  try {
    if (!fs.statSync(steamapps).isDirectory()) return false;
  } catch {
    return false;
  }
  if (
    fs.existsSync(path.join(steamapps, 'libraryfolders.vdf')) ||
    fs.existsSync(path.join(steamapps, 'libraryfolder.vdf')) ||
    fs.existsSync(path.join(dir, 'libraryfolder.vdf'))
  ) {
    return true;
  }
  try {
    return fs.readdirSync(steamapps).some((f) => /^appmanifest_\d+\.acf$/i.test(f));
  } catch {
    return false;
  }
}

/**
 * Parses libraryfolders.vdf. Supports both the modern format
 *   "0" { "path" "D:\\SteamLibrary" ... }
 * and the legacy (pre-2021) format
 *   "1" "D:\\SteamLibrary"
 */
export function parseLibraryFoldersVdf(content: string): { paths: string[]; appIds: string[] } {
  const paths: string[] = [];
  const appIds: string[] = [];
  const unescape = (s: string) => s.replace(/\\\\/g, '\\');

  for (const m of content.matchAll(/"path"\s+"([^"]+)"/gi)) paths.push(unescape(m[1]));
  // Legacy: numeric key directly followed by a quoted path value
  for (const m of content.matchAll(/^\s*"\d+"\s+"([a-zA-Z]:[^"]*)"/gm)) paths.push(unescape(m[1]));

  for (const block of content.matchAll(/"apps"\s*\{([^}]*)\}/gi)) {
    for (const id of block[1].matchAll(/"(\d+)"\s+"(\d+)"/g)) appIds.push(id[1]);
  }
  return { paths, appIds };
}

export interface SteamLocation {
  /** The Steam client folder (has steam.exe / userdata / appcache), if found. */
  clientPath: string | null;
  /** All library roots (each contains a `steamapps` folder). */
  libraryPaths: string[];
  /** App IDs listed as installed in libraryfolders.vdf (may lag behind reality). */
  listedAppIds: Set<string>;
}

let cachedClientPath: string | null = null;

/** Finds the Steam client directory via registry, then well-known folders on every drive. */
export async function findSteamClientPath(driveRoots?: string[]): Promise<string | null> {
  if (cachedClientPath && isSteamClientDir(cachedClientPath)) return cachedClientPath;

  const fromRegistry = [
    await readRegistryValue('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
    await readRegistryValue('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    await readRegistryValue('HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'),
  ];
  for (const p of fromRegistry) {
    if (p && isSteamClientDir(normalizeDir(p))) {
      cachedClientPath = normalizeDir(p);
      return cachedClientPath;
    }
  }

  const roots = driveRoots && driveRoots.length > 0 ? driveRoots : listDriveRoots();
  const pf86 = process.env['ProgramFiles(x86)'];
  const pf = process.env.ProgramFiles;
  const guesses = [
    ...(pf86 ? [path.join(pf86, 'Steam')] : []),
    ...(pf ? [path.join(pf, 'Steam')] : []),
  ];
  for (const root of roots) {
    guesses.push(
      path.join(root, 'Program Files (x86)', 'Steam'),
      path.join(root, 'Program Files', 'Steam'),
      path.join(root, 'Steam'),
      path.join(root, 'Games', 'Steam'),
    );
  }
  for (const g of guesses) {
    if (isSteamClientDir(g)) {
      cachedClientPath = normalizeDir(g);
      return cachedClientPath;
    }
  }
  return null;
}

/** All mounted drive roots (C:\, D:\ ...). Cheap existsSync probe. */
export function listDriveRoots(): string[] {
  const roots: string[] = [];
  for (const c of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    const root = `${c}:\\`;
    try {
      if (fs.existsSync(root)) roots.push(root);
    } catch {}
  }
  return roots;
}

/**
 * Discovers every Steam library: the client folder and everything listed in its
 * libraryfolders.vdf. Only when that file is unavailable does it fall back to a
 * sweep of common folder names on every drive.
 */
export async function locateSteam(driveRoots?: string[]): Promise<SteamLocation> {
  const roots = driveRoots && driveRoots.length > 0 ? driveRoots : listDriveRoots();
  const libraries = new Map<string, string>(); // lowercased -> display path
  const listedAppIds = new Set<string>();

  const addLibrary = (p: string) => {
    const dir = normalizeDir(p);
    if (libraries.has(dir.toLowerCase())) return;
    if (!isSteamLibraryDir(dir)) return;
    libraries.set(dir.toLowerCase(), dir);
    for (const vdfName of ['libraryfolders.vdf']) {
      const vdf = path.join(dir, 'steamapps', vdfName);
      if (!fs.existsSync(vdf)) continue;
      try {
        const parsed = parseLibraryFoldersVdf(fs.readFileSync(vdf, 'utf-8'));
        parsed.appIds.forEach((id) => listedAppIds.add(id));
        parsed.paths.forEach((lp) => addLibrary(lp));
      } catch (err: any) {
        console.warn(`[SteamLocator] Failed reading "${vdf}":`, err.message);
      }
    }
  };

  const clientPath = await findSteamClientPath(roots);
  if (clientPath) addLibrary(clientPath);

  // When the client's libraryfolders.vdf exists it is authoritative: folders that are
  // not listed there are libraries the user removed from Steam (orphaned copies that
  // Steam itself treats as not installed). Only sweep drives when it is missing,
  // e.g. Steam not found via registry or a broken/absent VDF.
  const clientVdf = clientPath ? path.join(clientPath, 'steamapps', 'libraryfolders.vdf') : null;
  if (clientVdf && fs.existsSync(clientVdf)) {
    return { clientPath, libraryPaths: Array.from(libraries.values()), listedAppIds };
  }

  for (const root of roots) {
    for (const name of [
      'SteamLibrary',
      'Steam',
      path.join('Program Files (x86)', 'Steam'),
      path.join('Program Files', 'Steam'),
      path.join('Games', 'SteamLibrary'),
      path.join('Games', 'Steam'),
      'Steam Library',
      'SteamGames',
    ]) {
      addLibrary(path.join(root, name));
    }
    // A library can also be a drive root itself (e.g. D:\steamapps)
    addLibrary(root);
  }

  return { clientPath, libraryPaths: Array.from(libraries.values()), listedAppIds };
}
