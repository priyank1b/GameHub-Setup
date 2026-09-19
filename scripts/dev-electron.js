import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';
import electron from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const DEV_SERVER_URL = 'http://localhost:5173';

function waitForServer(url, timeoutMs = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode === 200 || res.statusCode === 304) {
            resolve();
          } else {
            setTimeout(check, 250);
          }
        })
        .on('error', () => {
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error(`Timeout waiting for dev server at ${url}`));
          } else {
            setTimeout(check, 250);
          }
        });
    };
    check();
  });
}

async function compileElectron() {
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
}

async function start() {
  console.log('[dev-electron] Waiting for Vite dev server...');
  await waitForServer(DEV_SERVER_URL);
  console.log('[dev-electron] Vite dev server is ready. Compiling Electron...');
  await compileElectron();
  console.log('[dev-electron] Launching Electron window...');

  const extraArgs = process.argv.slice(2);
  const child = spawn(electron, ['.', ...extraArgs], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: DEV_SERVER_URL,
    },
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
}

start().catch((err) => {
  console.error('[dev-electron] Failed to start:', err);
  process.exit(1);
});
