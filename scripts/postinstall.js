import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

try {
  console.log('[postinstall] Ensuring better-sqlite3 is targeting Electron ABI...');
  execSync('npx prebuild-install -r electron -t 33.4.11', {
    cwd: path.resolve(root, 'node_modules/better-sqlite3'),
    stdio: 'inherit',
    shell: true,
  });
  console.log('[postinstall] better-sqlite3 native bindings configured successfully.');
} catch (err) {
  console.error('[postinstall] Warning: Failed to prebuild-install better-sqlite3:', err.message);
}
