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
  await new Promise((r) => setTimeout(r, 1500));

  // Click 3 dots on first card
  const diag = await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.querySelector('[title="More Options"]');
      if (!btn) return { error: 'No button' };
      btn.click();
      
      const menu = document.querySelector('.w-48');
      if (!menu) return { error: 'No menu' };

      const rect = menu.getBoundingClientRect();
      const elemAtCenter = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);

      return {
        menuDisplay: getComputedStyle(menu).display,
        menuVisibility: getComputedStyle(menu).visibility,
        menuOpacity: getComputedStyle(menu).opacity,
        menuZIndex: getComputedStyle(menu).zIndex,
        elemAtCenterTag: elemAtCenter ? elemAtCenter.tagName : null,
        elemAtCenterClass: elemAtCenter ? elemAtCenter.className : null,
        isMenuOrChild: menu.contains(elemAtCenter),
      };
    })()
  `);

  console.log('DIAGNOSTIC:', diag);
  win.close();
  closeDatabase();
  app.quit();
});
