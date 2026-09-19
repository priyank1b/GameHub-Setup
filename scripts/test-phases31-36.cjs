const path = require('path');
const fs = require('fs');

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING PHASES 31 - 36 SYSTEMATIC VERIFICATION');
  console.log('====================================================\n');

  let passed = true;
  function assert(condition, message) {
    if (!condition) {
      console.error(`[FAIL] ${message}`);
      passed = false;
      throw new Error(message);
    } else {
      console.log(`[PASS] ${message}`);
    }
  }

  try {
    // -----------------------------------------------------------------
    // PHASE 31: Performance Optimization Test
    // -----------------------------------------------------------------
    console.log('\n--- Testing Phase 31: Performance Optimization ---');
    const dbModule = await import('../dist-electron/database/index.js');
    const db = dbModule.initDatabase();

    // Verify Pragmas
    const journalMode = db.pragma('journal_mode', { simple: true });
    assert(journalMode.toLowerCase() === 'wal', `journal_mode is WAL (got ${journalMode})`);

    const schemaVer = db.pragma('user_version', { simple: true });
    assert(schemaVer >= 2, `Database schema version is at least 2 (got ${schemaVer})`);

    // Verify Migration 2 indices
    const indices = db.prepare(`SELECT name FROM sqlite_master WHERE type='index'`).all().map(i => i.name);
    assert(indices.includes('idx_games_name_nocase'), 'idx_games_name_nocase exists');
    assert(indices.includes('idx_games_installed'), 'idx_games_installed exists');
    assert(indices.includes('idx_games_last_played'), 'idx_games_last_played exists');
    assert(indices.includes('idx_games_playtime'), 'idx_games_playtime exists');

    // Performance Stress Test: 1,000 Games in a single transaction
    const gameRepo = new dbModule.GameRepository(db);
    const startInsert = Date.now();
    gameRepo.transaction(() => {
      const insertStmt = db.prepare(`
        INSERT INTO games (
          name, normalized_name, launcher, executable_path,
          install_path, is_favorite, is_installed, is_manual,
          total_play_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 1, 0, 0, datetime('now'), datetime('now'))
      `);

      for (let i = 1; i <= 1000; i++) {
        insertStmt.run(
          `Synthetic Game ${i.toString().padStart(4, '0')}`,
          `syntheticgame${i}`,
          'STANDALONE',
          `C:\\Games\\Synthetic${i}\\game.exe`,
          `C:\\Games\\Synthetic${i}`
        );
      }
    });
    const insertDuration = Date.now() - startInsert;
    console.log(`[Phase 31] Inserted 1,000 synthetic games in ${insertDuration}ms`);
    assert(insertDuration < 1000, `1,000 game batch insert completed in under 1 second (${insertDuration}ms)`);

    // Query 1,000 games benchmark
    const startQuery = Date.now();
    const allGames = gameRepo.getAll();
    const queryDuration = Date.now() - startQuery;
    console.log(`[Phase 31] Queried ${allGames.length} games in ${queryDuration}ms`);
    assert(queryDuration < 50, `Querying 1,000+ games completed in under 50ms (${queryDuration}ms)`);

    // Cleanup synthetic test games
    db.prepare(`DELETE FROM games WHERE name LIKE 'Synthetic Game%'`).run();

    // -----------------------------------------------------------------
    // PHASE 32: Security Review Test
    // -----------------------------------------------------------------
    console.log('\n--- Testing Phase 32: Security Review ---');
    const launcherModule = await import('../dist-electron/services/GameLauncher.js');
    const launchRepo = new dbModule.LaunchRepository(db);
    const launcher = new launcherModule.GameLauncher(gameRepo, launchRepo);

    // Test rejection of non-exe execution
    const nonExeGame = {
      id: 999991,
      name: 'Malicious Script',
      launcher: 'STANDALONE',
      executablePath: 'C:\\Games\\hack.bat',
      isInstalled: true,
      totalPlayTime: 0,
      isFavorite: false,
    };
    const badExtResult = launcher.launchStandalone(nonExeGame);
    assert(!badExtResult.success, 'GameLauncher rejects non-exe files (.bat)');
    assert(badExtResult.error.includes('Security violation'), 'Returns security violation message');

    // Test rejection of null byte injection
    const nullByteGame = {
      id: 999992,
      name: 'Null Injection',
      launcher: 'STANDALONE',
      executablePath: 'C:\\Games\\test.exe\0.bat',
      isInstalled: true,
      totalPlayTime: 0,
      isFavorite: false,
    };
    const nullResult = launcher.launchStandalone(nullByteGame);
    assert(!nullResult.success, 'GameLauncher rejects null-byte path injections');

    // Test rejection of unauthorized URI schemes
    const badUriRes = await launcher.launchUri('powershell://Invoke-Expression', nonExeGame);
    assert(!badUriRes.success, 'GameLauncher rejects unauthorized URI protocols (powershell:)');
    assert(badUriRes.error.includes('Unauthorized') || badUriRes.error.includes('unverified'), 'Returns unauthorized protocol error message');

    // -----------------------------------------------------------------
    // PHASE 33: Error Handling Test
    // -----------------------------------------------------------------
    console.log('\n--- Testing Phase 33: Error Handling ---');
    // Non-existent game launch handles gracefully without crash
    const ghostLaunch = await launcher.launch(888888);
    assert(!ghostLaunch.success, 'Launching non-existent game returns graceful error');
    assert(ghostLaunch.error.includes('not found'), 'Returns descriptive error message');

    // -----------------------------------------------------------------
    // PHASE 34: Logging Test
    // -----------------------------------------------------------------
    console.log('\n--- Testing Phase 34: Logging ---');
    const loggerModule = await import('../dist-electron/services/Logger.js');
    const { Logger } = loggerModule;
    Logger.init();

    const logPath = Logger.getLogPath();
    assert(fs.existsSync(logPath), `Log file exists at ${logPath}`);

    Logger.info('Test', 'Phase 34 automated log test entry');
    const logContent = fs.readFileSync(logPath, 'utf8');
    assert(logContent.includes('Phase 34 automated log test entry'), 'Log file contains written event');
    assert(logContent.includes('[INFO] [Test]'), 'Log file contains formatted log category and level');

    // -----------------------------------------------------------------
    // PHASE 35: Database Recovery Test
    // -----------------------------------------------------------------
    console.log('\n--- Testing Phase 35: Database Recovery ---');
    const recoveryModule = await import('../dist-electron/services/DatabaseRecoveryService.js');
    const { DatabaseRecoveryService } = recoveryModule;

    // Test integrity check
    const integrity = DatabaseRecoveryService.checkIntegrity(db);
    assert(integrity.ok, 'PRAGMA integrity_check reports healthy database');

    // Test safety backup
    const backupRes = DatabaseRecoveryService.backupDatabase();
    assert(backupRes.success, 'Database safety backup created successfully');
    assert(fs.existsSync(backupRes.backupPath), `Backup file exists at ${backupRes.backupPath}`);

    // Test repair & reindex
    const repairRes = DatabaseRecoveryService.repairDatabase();
    assert(repairRes.success, 'Database repair executed successfully');
    assert(repairRes.actionTaken === 'vacuum_reindex', 'Healthy database was vacuumed and reindexed');

    // -----------------------------------------------------------------
    // PHASE 36: Windows Installer Configuration Test
    // -----------------------------------------------------------------
    console.log('\n--- Testing Phase 36: Windows Installer ---');
    const builderYmlPath = path.resolve(__dirname, '../electron-builder.yml');
    assert(fs.existsSync(builderYmlPath), 'electron-builder.yml exists');
    const builderYml = fs.readFileSync(builderYmlPath, 'utf8');
    assert(builderYml.includes('artifactName: "GameHub-Setup.exe"'), 'artifactName is GameHub-Setup.exe');
    assert(builderYml.includes('target: nsis'), 'target includes NSIS installer');
    assert(builderYml.includes('createDesktopShortcut: true'), 'Desktop shortcut is configured');
    assert(builderYml.includes('createStartMenuShortcut: true'), 'Start menu shortcut is configured');

    console.log('\n====================================================');
    console.log('ALL PHASES 31 - 36 VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n[VERIFICATION ERROR]:', err);
    passed = false;
  } finally {
    process.exit(passed ? 0 : 1);
  }
}

runVerification();
