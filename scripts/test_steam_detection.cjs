const path = require('path');
const fs = require('fs');

async function testSteamDetector() {
  console.log('[Test] Loading SteamDetector...');
  const { SteamDetector } = await import('../dist-electron/services/detectors/index.js');
  const { DriveService } = await import('../dist-electron/services/DriveService.js');

  const driveService = new DriveService();
  const detector = new SteamDetector(driveService);

  console.log('[Test] Testing canRun...');
  const canRun = await detector.canRun();
  console.log('[Test] canRun:', canRun);

  console.log('[Test] Discovering library folders...');
  const libraryFolders = await detector.discoverSteamLibraryFolders();
  console.log('[Test] Discovered library folders:', libraryFolders);

  console.log('[Test] Running full detect()...');
  const candidates = await detector.detect([], (progress) => {
    console.log(`[Progress] ${progress.message}`);
  });

  console.log(`\n[Test] Detection finished! Discovered ${candidates.length} Steam games:\n`);
  candidates.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.launcher}] ${c.name} (App ID: ${c.launcherAppId})`);
    console.log(`   Path: ${c.installPath}`);
    console.log(`   Exe:  ${c.executablePath || 'None resolved'}`);
    console.log(`   Size: ${(c.installedSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    console.log(`   Cover: ${c.coverImage}`);
  });
}

testSteamDetector().catch((err) => {
  console.error('[Test Error]:', err);
  process.exit(1);
});
