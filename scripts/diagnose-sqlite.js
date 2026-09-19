import { spawnSync } from 'child_process';
import electron from 'electron';
import fs from 'fs';
import path from 'path';

console.log('=== GameHub SQLite Diagnostic ===');

// 1. Versions
const electronPkg = JSON.parse(fs.readFileSync('node_modules/electron/package.json', 'utf8'));
const sqlitePkg = JSON.parse(fs.readFileSync('node_modules/better-sqlite3/package.json', 'utf8'));

console.log('1. Electron version:', electronPkg.version);
console.log('2. System Node.js version:', process.version);
console.log('3. better-sqlite3 version:', sqlitePkg.version);
console.log('4. System Node ABI (modules):', process.versions.modules);

// Check Electron internal versions
const envNode = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
const abiCheck = spawnSync(electron, ['-e', 'console.log(JSON.stringify(process.versions))'], {
  env: envNode,
  encoding: 'utf8',
});

if (abiCheck.stdout) {
  const versions = JSON.parse(abiCheck.stdout.trim());
  console.log('5. Electron Node.js runtime version:', versions.node);
  console.log('6. Electron ABI (modules):', versions.modules);
  console.log('7. Electron Chromium version:', versions.chrome);
} else {
  console.error('Failed to get Electron versions:', abiCheck.stderr);
}

// Test loading better-sqlite3 inside Electron runtime
console.log('\n--- Testing better-sqlite3 load in Electron (as Node) ---');
const testRun = spawnSync(
  electron,
  [
    '-e',
    `
    try {
      const Database = require('better-sqlite3');
      const db = new Database(':memory:');
      console.log('SUCCESS: better-sqlite3 loaded and queried user_version:', db.pragma('user_version'));
      process.exit(0);
    } catch(err) {
      console.error('FAIL_LOAD:', err.message);
      if (err.stack) console.error(err.stack);
      process.exit(1);
    }
  `,
  ],
  {
    env: envNode,
    encoding: 'utf8',
  }
);

console.log('Stdout:', testRun.stdout);
console.log('Stderr:', testRun.stderr);
console.log('Exit Code:', testRun.status);
