const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');

async function testOvercooked2Details() {
  const { initDatabase, closeDatabase } = await import('../dist-electron/database/index.js');
  const { registerAllIpcHandlers } = await import('../dist-electron/ipc/index.js');

  const db = initDatabase();
  registerAllIpcHandlers(db);

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

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Navigate to Library
  await win.webContents.executeJavaScript(`
    const libraryBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('LIBRARY'));
    if (libraryBtn) libraryBtn.click();
  `);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Click specifically on Overcooked! 2
  console.log('[Test] Finding and clicking Overcooked! 2 card...');
  const clicked = await win.webContents.executeJavaScript(`
    (() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="game-grid"] > div'));
      const overcookedCard = cards.find(c => c.textContent && c.textContent.includes('Overcooked! 2'));
      if (overcookedCard) {
        overcookedCard.click();
        return true;
      }
      return false;
    })()
  `);

  if (!clicked) {
    console.error('[Test] Could not find Overcooked! 2 card in library!');
    app.quit();
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Extract all details shown in the modal
  const details = await win.webContents.executeJavaScript(`
    (() => {
      const modal = document.querySelector('[data-testid="game-details-modal"]');
      if (!modal) return null;

      const title = modal.querySelector('h2')?.textContent?.trim();
      const descHeading = Array.from(modal.querySelectorAll('h4')).find(h => h.textContent.includes('DESCRIPTION'));
      const description = descHeading ? descHeading.nextElementSibling?.textContent?.trim() : '';
      
      const gridItems = Array.from(modal.querySelectorAll('.grid > div'));
      const fields = {};
      gridItems.forEach(item => {
        const spans = Array.from(item.querySelectorAll('span'));
        if (spans.length >= 2) {
          fields[spans[0].textContent.trim()] = spans[1].textContent.trim();
        }
      });

      return { title, description, fields };
    })()
  `);

  console.log('\n[Test Result] Overcooked! 2 Modal Data:');
  console.log(JSON.stringify(details, null, 2));

  // Capture screenshot
  const image = await win.capturePage();
  const screenshotPath = path.join(ARTIFACTS_DIR, 'overcooked2_details_fixed.png');
  fs.writeFileSync(screenshotPath, image.toPNG());
  console.log(`[Test Result] Saved screenshot to ${screenshotPath}`);

  win.close();
  closeDatabase();
  app.quit();
}

app.whenReady().then(testOvercooked2Details).catch((err) => {
  console.error('[Test] Error:', err);
  app.quit();
});
