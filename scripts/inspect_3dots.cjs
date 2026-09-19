const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const { initDatabase, closeDatabase } = await import('../dist-electron/database/index.js');
  const { registerAllIpcHandlers } = await import('../dist-electron/ipc/index.js');

  const db = initDatabase();
  registerAllIpcHandlers(db);

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      preload: path.resolve(__dirname, '../dist-electron/preload.cjs'),
    },
  });

  await win.loadFile(path.resolve(__dirname, '../dist/index.html'));
  await new Promise((r) => setTimeout(r, 2000));

  // Navigate to Library
  await win.webContents.executeJavaScript(`
    const libraryBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('LIBRARY'));
    if (libraryBtn) libraryBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 1000));

  // Click 3 dots on first card
  await win.webContents.executeJavaScript(`
    const btn = document.querySelector('[title="More Options"]');
    if (btn) btn.click();
  `);

  await new Promise((r) => setTimeout(r, 800));

  const result = await win.webContents.executeJavaScript(`
    (() => {
      const menu = document.querySelector('.w-48');
      if (!menu) return { error: 'Dropdown menu not found' };
      const items = Array.from(menu.querySelectorAll('button')).map(b => b.textContent.trim());
      const rect = menu.getBoundingClientRect();

      return {
        menuFound: true,
        items,
        menuRect: {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          height: Math.round(rect.height),
        },
      };
    })()
  `);

  console.log('3-Dot Menu Test Result:', result);

  const img = await win.capturePage();
  const outDir = path.join(__dirname, 'artifacts');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '3dots_fixed.png'), img.toPNG());
  console.log('Screenshot saved to 3dots_fixed.png');

  win.close();
  closeDatabase();
  app.quit();
});
