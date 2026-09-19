import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, closeDatabase } from '../dist-electron/database/index.js';
import { registerAllIpcHandlers } from '../dist-electron/ipc/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

async function testIPC() {
  console.log('=== PHASE 4 — Electron IPC Architecture Verification ===');

  const db = initDatabase(':memory:');
  registerAllIpcHandlers(db);

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(root, 'dist-electron/preload.js'),
    },
  });

  win.loadFile(path.resolve(root, 'dist/index.html'));

  win.webContents.on('did-finish-load', async () => {
    try {
      console.log('\n--- 1. Testing games.getAll() via IPC ---');
      const games1 = await win.webContents.executeJavaScript('window.gameHub.games.getAll()');
      console.log('Initial games count:', games1.length);

      console.log('\n--- 2. Testing games.add() via IPC ---');
      const newGame = await win.webContents.executeJavaScript(`
        window.gameHub.games.add({
          name: 'IPC Integration Test Game',
          launcher: 'STEAM',
          launcherAppId: '400',
          installPath: 'C:\\\\Games\\\\Portal',
          isFavorite: false,
          isInstalled: true,
          isManual: false,
          totalPlayTime: 0
        })
      `);
      console.log('Created game via IPC:', newGame.id, newGame.name);

      console.log('\n--- 3. Testing games.toggleFavorite() via IPC ---');
      const toggled = await win.webContents.executeJavaScript(`window.gameHub.games.toggleFavorite(${newGame.id})`);
      console.log('Toggle favorite result:', toggled);
      const updated = await win.webContents.executeJavaScript(`window.gameHub.games.getById(${newGame.id})`);
      console.log('Verified updated isFavorite:', updated.isFavorite);

      console.log('\n--- 4. Testing games.launch() via IPC ---');
      const launchResult = await win.webContents.executeJavaScript(`window.gameHub.games.launch(${newGame.id})`);
      console.log('Launch IPC result:', launchResult);

      console.log('\n--- 5. Testing settings.set() and settings.get() via IPC ---');
      await win.webContents.executeJavaScript(`window.gameHub.settings.set('theme', 'dark')`);
      const theme = await win.webContents.executeJavaScript(`window.gameHub.settings.get('theme')`);
      console.log('Retrieved setting via IPC:', theme);

      console.log('\n--- 6. Testing drives.getAvailable() via IPC ---');
      const drives = await win.webContents.executeJavaScript('window.gameHub.drives.getAvailable()');
      console.log('Detected drives via IPC:', drives.map((d) => d.letter));

      console.log('\n--- 7. Verifying privileged Node APIs are NOT exposed ---');
      const securityCheck = await win.webContents.executeJavaScript(`
        ({
          hasFs: typeof window.fs !== 'undefined',
          hasChildProcess: typeof window.child_process !== 'undefined',
          hasShell: typeof window.shell !== 'undefined',
          hasProcess: typeof window.process !== 'undefined',
          hasRequire: typeof window.require !== 'undefined',
        })
      `);
      console.log('Security check (all should be false):', securityCheck);

      if (
        securityCheck.hasFs ||
        securityCheck.hasChildProcess ||
        securityCheck.hasShell ||
        securityCheck.hasProcess ||
        securityCheck.hasRequire
      ) {
        throw new Error('SECURITY VIOLATION: Privileged Node APIs leaked to renderer!');
      }

      console.log('\n=== ALL PHASE 4 IPC TESTS PASSED! ===');
      win.close();
      closeDatabase();
      app.quit();
      process.exit(0);
    } catch (err) {
      console.error('\nIPC Test Failed:', err);
      win.close();
      closeDatabase();
      app.quit();
      process.exit(1);
    }
  });
}

app.whenReady().then(testIPC);
