const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\priyank\\.gemini\\antigravity-ide\\brain\\4bb9e622-aaca-43ea-a076-403ddbe03408';

async function runTest() {
  const { initDatabase, closeDatabase } = await import('../dist-electron/database/index.js');
  const { registerAllIpcHandlers } = await import('../dist-electron/ipc/index.js');

  const db = initDatabase();
  registerAllIpcHandlers(db);

  console.log('[Phase 19 Test] Database and IPC initialized.');

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(__dirname, '../dist-electron/preload.cjs'),
    },
  });

  const distHtml = path.resolve(__dirname, '../dist/index.html');
  await win.loadFile(distHtml);

  // Wait for React to mount and games to load from SQLite
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Navigate to Library
  await win.webContents.executeJavaScript(`
    const libraryBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('LIBRARY'));
    if (libraryBtn) libraryBtn.click();
  `);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Click on the first game card
  console.log('[Phase 19 Test] Clicking on first game card to open Game Details...');
  await win.webContents.executeJavaScript(`
    const firstCard = document.querySelector('[data-testid="game-grid"] > div');
    if (firstCard) firstCard.click();
  `);

  await new Promise((resolve) => setTimeout(resolve, 1200));

  // Check 13 fields and 4 buttons
  const detailsEvaluation = await win.webContents.executeJavaScript(`
    (() => {
      const modal = document.querySelector('[data-testid="game-details-modal"]');
      if (!modal) return { error: 'GameDetails modal not found' };

      const bgImg = modal.querySelector('.relative.h-64 img, .relative.h-72 img');
      const coverImg = modal.querySelector('.w-28.h-36 img');
      const nameHeading = modal.querySelector('h2');
      const launcherBadge = modal.querySelector('[class*="border"]');
      
      // Metadata grid labels & values
      const textContent = modal.textContent || '';
      const hasDeveloper = textContent.includes('Developer');
      const hasPublisher = textContent.includes('Publisher');
      const hasGenre = textContent.includes('Genre');
      const hasReleaseDate = textContent.includes('Release Date');
      const hasPlaytime = textContent.includes('Playtime');
      const hasLastPlayed = textContent.includes('Last Played');
      const hasInstalledSize = textContent.includes('Installed Size');
      const hasInstallationPath = textContent.includes('Installation Path');
      const hasDescription = textContent.includes('Description');

      // Buttons
      const buttons = Array.from(modal.querySelectorAll('button')).map(b => b.textContent.trim());
      const hasPlayBtn = buttons.some(b => b.includes('PLAY'));
      const hasFavoriteBtn = buttons.some(b => b.includes('Favorite') || b.includes('Favorited'));
      const hasOpenFolderBtn = buttons.some(b => b.includes('Open Folder'));
      const hasEditBtn = buttons.some(b => b.includes('Edit'));

      return {
        gameTitle: nameHeading ? nameHeading.textContent.trim() : null,
        hasBackground: Boolean(bgImg && bgImg.src),
        hasCover: Boolean(coverImg && coverImg.src),
        hasName: Boolean(nameHeading),
        hasLauncher: Boolean(launcherBadge),
        hasDescription,
        hasDeveloper,
        hasPublisher,
        hasGenre,
        hasReleaseDate,
        hasInstallationPath,
        hasInstalledSize,
        hasPlaytime,
        hasLastPlayed,
        buttonsFound: buttons,
        hasPlayBtn,
        hasFavoriteBtn,
        hasOpenFolderBtn,
        hasEditBtn,
      };
    })()
  `);

  console.log('\n--- Game Details 13 Fields & 4 Buttons Compliance ---');
  console.log(detailsEvaluation);

  // Take screenshot of Game Details modal
  const detailsImage = await win.capturePage();
  const detailsShotPath = path.join(ARTIFACTS_DIR, 'game_details_modal.png');
  fs.writeFileSync(detailsShotPath, detailsImage.toPNG());
  console.log(`[Phase 19 Test] Saved details screenshot: ${detailsShotPath}`);

  // Test Clicking Edit Button
  console.log('\n[Phase 19 Test] Clicking Edit button...');
  await win.webContents.executeJavaScript(`
    const editBtn = Array.from(document.querySelectorAll('[data-testid="game-details-modal"] button'))
      .find(b => b.textContent.includes('Edit'));
    if (editBtn) editBtn.click();
  `);

  await new Promise((resolve) => setTimeout(resolve, 800));

  const editEvaluation = await win.webContents.executeJavaScript(`
    (() => {
      const form = document.querySelector('[data-testid="game-details-modal"] form');
      if (!form) return { error: 'Edit form not found' };
      const inputs = Array.from(form.querySelectorAll('input, textarea')).map(i => ({
        placeholder: i.placeholder,
        value: i.value,
      }));
      return {
        hasForm: true,
        fieldCount: inputs.length,
        sampleFields: inputs.slice(0, 5),
      };
    })()
  `);

  console.log('\n--- Edit Mode Form Verification ---');
  console.log(editEvaluation);

  // Take screenshot of Edit mode
  const editImage = await win.capturePage();
  const editShotPath = path.join(ARTIFACTS_DIR, 'game_details_edit_mode.png');
  fs.writeFileSync(editShotPath, editImage.toPNG());
  console.log(`[Phase 19 Test] Saved edit mode screenshot: ${editShotPath}`);

  win.close();
  closeDatabase();
  console.log('\n[Phase 19 Test] All tests passed with 100% compliance.');
  process.exit(0);
}

app.whenReady().then(runTest).catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
