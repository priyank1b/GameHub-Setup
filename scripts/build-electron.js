import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

async function buildElectron() {
  console.log('[build-electron] Compiling main and preload scripts...');
  
  await build({
    entryPoints: [path.resolve(root, 'electron/main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/main.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/preload.cjs'),
    external: ['electron'],
    sourcemap: true,
    format: 'cjs',
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/database/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/database/index.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/ipc/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/ipc/index.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/DriveService.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/DriveService.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/GameLauncher.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/GameLauncher.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/StandaloneDetector.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/StandaloneDetector.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/scanner/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/scanner/index.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/detectors/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/detectors/index.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/SteamMetadataService.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/SteamMetadataService.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/BackupService.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/BackupService.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/TrayService.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/TrayService.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/Logger.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/Logger.js'),
    external: ['electron'],
    sourcemap: true,
    format: 'esm',
  });

  await build({
    entryPoints: [path.resolve(root, 'electron/services/DatabaseRecoveryService.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist-electron/services/DatabaseRecoveryService.js'),
    external: ['electron', 'better-sqlite3'],
    sourcemap: true,
    format: 'esm',
  });

  // Ensure assets directory in dist-electron has tray icon
  const distAssetsDir = path.resolve(root, 'dist-electron/assets');
  if (!fs.existsSync(distAssetsDir)) {
    fs.mkdirSync(distAssetsDir, { recursive: true });
  }
  const trayIconSrc = path.resolve(root, 'assets/tray-icon.png');
  if (fs.existsSync(trayIconSrc)) {
    fs.copyFileSync(trayIconSrc, path.resolve(distAssetsDir, 'tray-icon.png'));
  }

  console.log('[build-electron] Electron build complete.');
}

buildElectron().catch((err) => {
  console.error('[build-electron] Error:', err);
  process.exit(1);
});
