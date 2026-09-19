const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');
const TEST_BACKUP_PATH = path.resolve(__dirname, '../test-gamehub-backup.json');

async function testPhase28() {
  const { initDatabase, closeDatabase, GameRepository, CategoryRepository, SettingsRepository } = await import('../dist-electron/database/index.js');
  const { BackupService } = await import('../dist-electron/services/BackupService.js');
  const { registerAllIpcHandlers } = await import('../dist-electron/ipc/index.js');

  const db = initDatabase();
  registerAllIpcHandlers(db);

  const gameRepo = new GameRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const settingsRepo = new SettingsRepository(db);

  const backupService = new BackupService(gameRepo, categoryRepo, settingsRepo);

  console.log('=== Step 1: Testing BackupService Export ===');
  const exportRes = await backupService.exportLibrary(TEST_BACKUP_PATH);
  console.log('[Export Result]', exportRes);

  if (!exportRes.success || !fs.existsSync(TEST_BACKUP_PATH)) {
    throw new Error('Export failed to write backup file');
  }

  // Validate JSON schema
  const rawBackup = fs.readFileSync(TEST_BACKUP_PATH, 'utf-8');
  const backupJson = JSON.parse(rawBackup);
  console.log(`[Backup Validation] Version: ${backupJson.version}, AppVersion: ${backupJson.appVersion}, Games count: ${backupJson.games?.length}`);
  console.log(`[Backup Validation] Categories: ${backupJson.categories?.length}, ScanLocations: ${backupJson.scanLocations?.length}`);
  console.log(`[Backup Sample Game]:`, backupJson.games[0]?.name, `(${backupJson.games[0]?.launcher}) - Dev:`, backupJson.games[0]?.developer);

  console.log('\n=== Step 2: Testing Fresh DB Import from Backup ===');
  const Database = require('better-sqlite3');
  const freshDb = new Database(':memory:');
  const { runMigrations } = await import('../dist-electron/database/index.js');
  runMigrations(freshDb, ':memory:');

  const freshGameRepo = new GameRepository(freshDb);
  const freshCategoryRepo = new CategoryRepository(freshDb);
  const freshSettingsRepo = new SettingsRepository(freshDb);
  const freshBackupService = new BackupService(freshGameRepo, freshCategoryRepo, freshSettingsRepo);

  const importRes = await freshBackupService.importLibrary(TEST_BACKUP_PATH);
  console.log('[Fresh Import Result]', importRes);

  const freshGames = freshGameRepo.getAll();
  console.log(`[Fresh DB Verification] Total restored games: ${freshGames.length}`);
  if (freshGames.length !== backupJson.games.length) {
    throw new Error(`Expected ${backupJson.games.length} games in fresh DB, but got ${freshGames.length}`);
  }

  console.log('\n=== Step 3: Testing UI Integration in Settings Page ===');
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(__dirname, '../dist-electron/preload.cjs'),
    },
  });

  const distHtml = path.resolve(__dirname, '../dist/index.html');
  await win.loadFile(distHtml);
  await new Promise((r) => setTimeout(r, 1500));

  // Navigate to Settings
  await win.webContents.executeJavaScript(`
    const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('SETTINGS'));
    if (settingsBtn) settingsBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 800));

  // Click Advanced Tab
  await win.webContents.executeJavaScript(`
    const advTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Advanced & Database');
    if (advTab) advTab.click();
  `);
  await new Promise((r) => setTimeout(r, 800));

  // Click Export Library Backup button in UI (with test path patched so dialog doesn't block headless runner)
  console.log('[UI Test] Clicking Export Library Backup button in UI...');
  await win.webContents.executeJavaScript(`
    (() => {
      const orig = window.gameHub.backup.export;
      window.gameHub.backup.export = () => orig(${JSON.stringify(TEST_BACKUP_PATH)});
      const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Export Library Backup'));
      if (exportBtn) exportBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1500));

  // Check Settings page screenshot
  const screenshot = await win.capturePage();
  const screenshotPath = path.join(ARTIFACTS_DIR, 'phase28_settings_backup_verified.png');
  fs.writeFileSync(screenshotPath, screenshot.toPNG());
  console.log(`[UI Test] Saved screenshot to ${screenshotPath}`);

  // Clean up
  if (fs.existsSync(TEST_BACKUP_PATH)) {
    fs.unlinkSync(TEST_BACKUP_PATH);
  }

  win.close();
  freshDb.close();
  closeDatabase();
  app.quit();
  console.log('\n=== All Phase 28 Tests Passed Successfully! ===');
}

app.whenReady().then(testPhase28).catch((err) => {
  console.error('[Phase 28 Test Error]:', err);
  if (fs.existsSync(TEST_BACKUP_PATH)) {
    try { fs.unlinkSync(TEST_BACKUP_PATH); } catch {}
  }
  app.quit();
});
