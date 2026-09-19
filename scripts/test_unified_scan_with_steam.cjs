const path = require('path');

async function testUnifiedScan() {
  console.log('[Test] Initializing DB & Services...');
  const { initDatabase, GameRepository, SettingsRepository } = await import('../dist-electron/database/index.js');
  const { DriveService } = await import('../dist-electron/services/DriveService.js');
  const { GameScanner } = await import('../dist-electron/services/scanner/index.js');
  const { SteamDetector } = await import('../dist-electron/services/detectors/index.js');
  const { StandaloneDetector } = await import('../dist-electron/services/StandaloneDetector.js');

  const db = initDatabase();
  const gameRepo = new GameRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const driveService = new DriveService();

  console.log(`[Test] Current games count in DB: ${gameRepo.getAll().length}`);

  const gameScanner = new GameScanner(gameRepo, settingsRepo, driveService);
  const steamDetector = new SteamDetector(driveService);
  const standaloneDetector = new StandaloneDetector();

  gameScanner.registerDetector(steamDetector);
  gameScanner.registerDetector(standaloneDetector);

  gameScanner.onProgress((p) => {
    console.log(`[Scan ${p.stage}] ${p.percent}% - ${p.message}`);
  });

  console.log('\n[Test] Executing gameScanner.scan()...');
  const result = await gameScanner.scan();
  console.log('\n[Test] Scan Result:', result);

  console.log(`\n[Test] New games count in DB: ${gameRepo.getAll().length}`);
  const allGames = gameRepo.getAll();
  console.log('\n[Test] All Games in DB:');
  allGames.forEach((g, idx) => {
    console.log(`${idx + 1}. [${g.launcher}] ${g.name} (${g.drive}) - ${g.installPath}`);
    console.log(`   Exe: ${g.executablePath}`);
    console.log(`   AppID: ${g.launcherAppId || 'N/A'}`);
    console.log(`   Cover: ${g.coverImage ? 'Yes' : 'No'}`);
  });
}

testUnifiedScan().catch((err) => {
  console.error('[Error]:', err);
  process.exit(1);
});
