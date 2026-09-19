const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const { initDatabase, closeDatabase } = await import('../dist-electron/database/index.js');
  const { registerAllIpcHandlers } = await import('../dist-electron/ipc/index.js');

  const db = initDatabase();
  registerAllIpcHandlers(db);

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.resolve(__dirname, '../dist-electron/preload.cjs'),
    },
  });

  await win.loadFile(path.resolve(__dirname, '../dist/index.html'));
  await new Promise((r) => setTimeout(r, 2000));

  // Navigate to Library by clicking the sidebar Library button
  await win.webContents.executeJavaScript(`
    const btn = Array.from(document.querySelectorAll('aside button')).find(b => b.innerText.includes('LIBRARY'));
    if (btn) btn.click();
  `);
  await new Promise((r) => setTimeout(r, 1000));

  // Find the first visible 3-dot button in the main library grid and click it
  await win.webContents.executeJavaScript(`
    const mainGrid = document.querySelector('main [data-testid="game-grid"]');
    const first3Dot = mainGrid ? mainGrid.querySelector('[title="More Options"]') : null;
    if (first3Dot) {
      first3Dot.scrollIntoView();
      first3Dot.click();
    }
  `);
  await new Promise((r) => setTimeout(r, 800));

  const img = await win.capturePage();
  fs.writeFileSync('C:/Users/priyank/.gemini/antigravity-ide/brain/4bb9e622-aaca-43ea-a076-403ddbe03408/3dots_visible_test.png', img.toPNG());
  console.log('Saved 3dots_visible_test.png');

  win.close();
  closeDatabase();
  app.quit();
});
