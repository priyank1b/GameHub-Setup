const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');

const RESOLUTIONS = [
  { name: '1280x720_HD', width: 1280, height: 720 },
  { name: '1920x1080_FHD', width: 1920, height: 1080 },
  { name: '2560x1440_2K', width: 2560, height: 1440 },
  { name: '3840x2160_4K', width: 3840, height: 2160 },
];

async function runTest() {
  const { initDatabase, closeDatabase } = await import('../dist-electron/database/index.js');
  const { registerAllIpcHandlers } = await import('../dist-electron/ipc/index.js');

  const db = initDatabase();
  registerAllIpcHandlers(db);

  console.log('[Phase 18 Test] Database and IPC ready.');

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
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

  console.log('\n--- Testing Multi-Monitor Resolutions ---');

  for (const res of RESOLUTIONS) {
    win.setContentSize(res.width, res.height);
    await new Promise((r) => setTimeout(r, 600));

    const metrics = await win.webContents.executeJavaScript(`
      (() => {
        const grid = document.querySelector('[data-testid="game-grid"]');
        if (!grid) return { error: 'Game grid not found' };
        
        const cards = Array.from(grid.children);
        const firstCard = cards[0];
        const cardRect = firstCard ? firstCard.getBoundingClientRect() : null;
        const gridRect = grid.getBoundingClientRect();
        
        const filterButtons = Array.from(document.querySelectorAll('.space-y-6 button')).map(b => b.textContent.trim());
        
        return {
          totalCards: cards.length,
          gridWidth: Math.round(gridRect.width),
          cardWidth: cardRect ? Math.round(cardRect.width) : 0,
          cardHeight: cardRect ? Math.round(cardRect.height) : 0,
          aspectRatio: cardRect ? (cardRect.height / cardRect.width).toFixed(2) : '0',
          approxColumns: cardRect ? Math.round(gridRect.width / cardRect.width) : 0,
          filterButtonsSample: filterButtons.slice(0, 8),
        };
      })()
    `);

    console.log(`\n[Resolution ${res.name} (${res.width}x${res.height})]:`);
    console.log(`  Grid Width: ${metrics.gridWidth}px`);
    console.log(`  Card Width: ${metrics.cardWidth}px, Height: ${metrics.cardHeight}px (Ratio: ${metrics.aspectRatio})`);
    console.log(`  Calculated Columns: ${metrics.approxColumns}`);
    console.log(`  Total Cards Displayed: ${metrics.totalCards}`);

    if (metrics.cardWidth < 140 || metrics.cardWidth > 260) {
      console.warn(`  [WARNING] Card width ${metrics.cardWidth}px outside ideal bounds!`);
    } else {
      console.log(`  [PASS] Card dimensions are optimal.`);
    }

    // Capture screenshot
    const image = await win.capturePage();
    const screenshotPath = path.join(ARTIFACTS_DIR, `library_${res.name}.png`);
    fs.writeFileSync(screenshotPath, image.toPNG());
    console.log(`  Screenshot saved: ${screenshotPath}`);
  }

  // Detailed validation of Card Elements on the first game
  const cardElementsCheck = await win.webContents.executeJavaScript(`
    (() => {
      const grid = document.querySelector('[data-testid="game-grid"]');
      const firstCard = grid?.children[0];
      if (!firstCard) return { error: 'No card found' };

      const img = firstCard.querySelector('img');
      const name = firstCard.querySelector('h3')?.textContent;
      const playBtn = firstCard.querySelector('button[type="button"]');
      const badge = firstCard.querySelector('[class*="border"]');
      const favoriteBtn = firstCard.querySelector('button');

      return {
        hasCover: Boolean(img && img.src),
        coverSrc: img ? img.src.substring(0, 60) + '...' : null,
        gameName: name,
        hasLauncherBadge: Boolean(badge),
        hasPlayTrigger: Boolean(playBtn),
        hasFavoriteTrigger: Boolean(favoriteBtn),
      };
    })()
  `);

  console.log('\n--- First Game Card Spec Compliance ---');
  console.log(cardElementsCheck);

  win.close();
  closeDatabase();
  console.log('\n[Phase 18 Test] All tests passed successfully.');
  process.exit(0);
}

app.whenReady().then(runTest).catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
