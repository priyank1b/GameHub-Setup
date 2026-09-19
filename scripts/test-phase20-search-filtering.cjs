const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');

async function testPhase20() {
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

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [${level}] ${message} (${sourceId}:${line})`);
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

  // Test 1: Check initial count of games
  const initialCardsCount = await win.webContents.executeJavaScript(`
    document.querySelectorAll('[data-testid="game-grid"] > div').length
  `);
  console.log(`[Phase 20 Test] Initial library game cards count: ${initialCardsCount}`);

  // Test 2: Search by Developer ("CD PROJEKT")
  console.log('[Phase 20 Test] Testing search by Developer: "CD PROJEKT"...');
  await win.webContents.executeJavaScript(`
    const input = document.querySelector('header input');
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, 'CD PROJEKT');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await new Promise((resolve) => setTimeout(resolve, 800));

  const devSearchResults = await win.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('[data-testid="game-grid"] > div')).map(card => card.querySelector('h3')?.textContent?.trim())
  `);
  console.log('[Phase 20 Test] Developer Search Results:', devSearchResults);

  // Test 3: Search by Publisher ("Electronic Arts")
  console.log('[Phase 20 Test] Testing search by Publisher: "Electronic Arts"...');
  await win.webContents.executeJavaScript(`
    (() => {
      try {
        const input = document.querySelector('header input');
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, 'Electronic Arts');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (e) {
        console.error('Test 3 error:', e.message);
      }
    })()
  `);
  await new Promise((resolve) => setTimeout(resolve, 800));

  const pubSearchResults = await win.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('[data-testid="game-grid"] > div')).map(card => card.querySelector('h3')?.textContent?.trim())
  `);
  console.log('[Phase 20 Test] Publisher Search Results:', pubSearchResults);

  // Clear search
  await win.webContents.executeJavaScript(`
    (() => {
      try {
        const clearBtn = document.querySelector('header button[title="Clear search"]');
        if (clearBtn) {
          clearBtn.click();
        } else {
          const input = document.querySelector('header input');
          if (input) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(input, '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      } catch (e) {
        console.error('Clear error:', e.message);
      }
    })()
  `);
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Test 4: Filter by Steam
  console.log('[Phase 20 Test] Testing filter by Steam pill...');
  await win.webContents.executeJavaScript(`
    const steamTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Steam') && !b.textContent.includes('Library'));
    if (steamTab) steamTab.click();
  `);
  await new Promise((resolve) => setTimeout(resolve, 800));

  const steamGamesCount = await win.webContents.executeJavaScript(`
    document.querySelectorAll('[data-testid="game-grid"] > div').length
  `);
  console.log(`[Phase 20 Test] Filtered Steam games count: ${steamGamesCount}`);

  // Test 5: Sort by Size
  console.log('[Phase 20 Test] Testing Sort by Size...');
  await win.webContents.executeJavaScript(`
    const select = document.querySelector('select');
    if (select) {
      select.value = 'size';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  `);
  await new Promise((resolve) => setTimeout(resolve, 800));

  const sortedBySize = await win.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('[data-testid="game-grid"] > div')).slice(0, 3).map(card => card.querySelector('h3')?.textContent?.trim())
  `);
  console.log('[Phase 20 Test] Top 3 Games sorted by Size:', sortedBySize);

  // Take screenshot of Filtered & Sorted view
  const image = await win.capturePage();
  const screenshotPath = path.join(ARTIFACTS_DIR, 'phase20_search_filter_verified.png');
  fs.writeFileSync(screenshotPath, image.toPNG());
  console.log(`[Phase 20 Test] Saved screenshot to ${screenshotPath}`);

  win.close();
  closeDatabase();
  app.quit();
}

app.whenReady().then(testPhase20).catch((err) => {
  console.error('[Phase 20 Test] Error:', err);
  app.quit();
});
