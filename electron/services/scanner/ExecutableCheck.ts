import fs from 'fs';
import path from 'path';

export type ExecutableCheckResult = 'FOUND' | 'NONE' | 'MISSING' | 'ACCESS_DENIED';

// Executables that do not make a folder a game on their own
const NON_GAME_EXE = /^(unins.*|uninstall.*|setup.*|install.*|vc_?redist.*|dxsetup.*|dotnet.*|crashreport.*|unitycrashhandler.*|ue4prereqsetup.*|ueprereqsetup.*|easyanticheat_setup.*|be?service.*_setup.*)\.exe$/i;

const SKIP_DIRS = new Set(['_commonredist', 'commonredist', 'redist', 'redistributables', 'directx', 'vcredist', '__installer', '_installer', 'support']);

/**
 * Checks whether a folder actually contains a runnable game executable
 * (not just an uninstaller / redistributable). Leftover folders after an
 * uninstall (saves, shader caches, mods) are reported as 'NONE'.
 */
export function checkFolderHasExecutable(installPath: string, maxDepth = 4): ExecutableCheckResult {
  if (!installPath) return 'MISSING';
  try {
    if (!fs.statSync(installPath).isDirectory()) return 'MISSING';
  } catch (err: any) {
    if (err?.code === 'EPERM' || err?.code === 'EACCES') return 'ACCESS_DENIED';
    return 'MISSING';
  }

  let denied = false;
  let visited = 0;
  const walk = (dir: string, depth: number): boolean => {
    if (depth > maxDepth || visited > 4000) return false;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err: any) {
      if (err?.code === 'EPERM' || err?.code === 'EACCES') denied = true;
      return false;
    }
    visited++;
    const subdirs: string[] = [];
    for (const e of entries) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.exe') && !NON_GAME_EXE.test(e.name)) return true;
      if (e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name.toLowerCase())) {
        subdirs.push(path.join(dir, e.name));
      }
    }
    for (const sub of subdirs) {
      if (walk(sub, depth + 1)) return true;
    }
    return false;
  };

  if (walk(installPath, 0)) return 'FOUND';
  return denied && visited === 0 ? 'ACCESS_DENIED' : 'NONE';
}

/** Launchers whose installs live in protected folders we may not be able to read. */
export function isProtectedLauncher(launcher?: string): boolean {
  return launcher === 'XBOX';
}
