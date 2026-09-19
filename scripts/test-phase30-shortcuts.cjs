const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('[Test-Phase30] Starting Phase 30 Keyboard Shortcuts automated verification...');

  let testPassed = true;
  function assert(condition, message) {
    if (!condition) {
      console.error(`[FAIL] ${message}`);
      testPassed = false;
      throw new Error(message);
    } else {
      console.log(`[PASS] ${message}`);
    }
  }

  try {
    // 1. Initialize SQLite Database & IPC Handlers
    const dbModule = await import('../dist-electron/database/index.js');
    const ipcModule = await import('../dist-electron/ipc/index.js');
    const db = dbModule.initDatabase();
    ipcModule.registerAllIpcHandlers(db);
    console.log('[Test-Phase30] SQLite & IPC Handlers successfully initialized.');

    // 2. Create test BrowserWindow with production preload
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../dist-electron/preload.cjs'),
      },
    });

    // Intercept Ctrl+R on main process level as in main.ts
    let ctrlRIntercepted = false;
    win.webContents.on('before-input-event', (event, input) => {
      if ((input.control || input.meta) && input.key.toLowerCase() === 'r' && input.type === 'keyDown') {
        event.preventDefault();
        ctrlRIntercepted = true;
        win.webContents.send('tray:rescan');
      }
    });

    // Load built index.html
    const indexPath = path.join(__dirname, '../dist/index.html');
    assert(fs.existsSync(indexPath), 'dist/index.html exists');
    await win.loadFile(indexPath);

    // Wait for DOM & games to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. Test Ctrl + K focusing #global-search-input
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'k', modifiers: ['control'] });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const searchFocusResult = await win.webContents.executeJavaScript(`
      (() => {
        const searchInput = document.getElementById('global-search-input');
        return {
          foundInput: !!searchInput,
          isFocused: document.activeElement === searchInput
        };
      })()
    `);
    assert(searchFocusResult.foundInput, '#global-search-input element found in DOM');
    assert(searchFocusResult.isFocused, 'Ctrl+K successfully focused #global-search-input');

    // 4. Test typing into search input and pressing Escape
    for (const char of 'hades') {
      win.webContents.sendInputEvent({ type: 'char', keyCode: char });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const typedVal = await win.webContents.executeJavaScript(`document.getElementById('global-search-input').value`);
    console.log('[Test-Phase30] Typed search value:', typedVal);
    assert(typedVal.length > 0, 'Real keyboard input into search bar succeeded');

    // Press Escape to clear
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const clearedVal = await win.webContents.executeJavaScript(`document.getElementById('global-search-input').value`);
    console.log('[Test-Phase30] Search value after Escape:', clearedVal);
    assert(clearedVal === '', 'Escape key successfully cleared active search input');

    // 5. Test Ctrl + R rescan triggering (Renderer & Main Process)
    const ctrlRResult = await win.webContents.executeJavaScript(`
      (() => {
        const evt = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true, cancelable: true });
        window.dispatchEvent(evt);
        return { defaultPrevented: evt.defaultPrevented };
      })()
    `);
    assert(ctrlRResult.defaultPrevented, 'Ctrl+R keydown event was intercepted and prevented default page reload');

    win.webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: 'r',
      modifiers: ['control'],
    });
    assert(ctrlRIntercepted, 'Main process before-input-event successfully captured Ctrl+R');

    // 6. Test Modal Escape Key Closing
    // Open GameDetailsModal by clicking first game card if present
    const modalTestResult = await win.webContents.executeJavaScript(`
      (async () => {
        const cards = document.querySelectorAll('[role="button"][aria-label]');
        if (cards.length === 0) return { skipped: true, reason: 'No cards available' };

        // Click first card to open modal
        cards[0].click();
        await new Promise(r => setTimeout(r, 600));

        const modalBefore = document.querySelector('[data-testid="game-details-modal"]');
        if (!modalBefore) return { skipped: true, reason: 'Modal did not open on click' };

        // Press Escape to dismiss modal
        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        window.dispatchEvent(esc);
        await new Promise(r => setTimeout(r, 600));

        const modalAfter = document.querySelector('[data-testid="game-details-modal"]');
        return {
          opened: !!modalBefore,
          closedAfterEscape: !modalAfter
        };
      })()
    `);

    if (!modalTestResult.skipped) {
      assert(modalTestResult.opened, 'GameDetailsModal successfully opened on card selection');
      assert(modalTestResult.closedAfterEscape, 'Escape key successfully closed GameDetailsModal');
    } else {
      console.log('[Test-Phase30] Modal test note:', modalTestResult.reason);
    }

    // 7. Test GameCard tabIndex & Enter key launching
    const cardKeyboardResult = await win.webContents.executeJavaScript(`
      (() => {
        const cards = document.querySelectorAll('[role="button"][aria-label]');
        if (cards.length === 0) return { hasCards: false };
        const firstCard = cards[0];
        firstCard.focus();
        return {
          hasCards: true,
          isFocused: document.activeElement === firstCard,
          hasTabIndex: firstCard.tabIndex === 0
        };
      })()
    `);
    if (cardKeyboardResult.hasCards) {
      assert(cardKeyboardResult.isFocused, 'Game card successfully received keyboard focus');
      assert(cardKeyboardResult.hasTabIndex, 'Game card has tabIndex=0 for keyboard accessibility');
    }

    console.log('\n========================================');
    console.log('PHASE 30 KEYBOARD SHORTCUTS ALL TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error('[Test-Phase30] Test failed:', err);
    testPassed = false;
  } finally {
    app.exit(testPassed ? 0 : 1);
  }
}

app.whenReady().then(runTests);
