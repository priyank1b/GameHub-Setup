import {
  initDatabase,
  closeDatabase,
  getDatabasePath,
  GameRepository,
  LaunchRepository,
} from '../dist-electron/database/index.js';
import { GameLauncher } from '../dist-electron/services/GameLauncher.js';
import fs from 'fs';
import path from 'path';

async function testPhase6ManualGame() {
  console.log('=== PHASE 6 — Manual Game Addition & Launch Verification ===');

  const dbPath = getDatabasePath();
  const db1 = initDatabase();
  const gameRepo1 = new GameRepository(db1);
  const launchRepo1 = new LaunchRepository(db1);
  const launcher1 = new GameLauncher(gameRepo1, launchRepo1);

  // 1. Locate a legitimate Windows executable
  const testExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'notepad.exe');
  if (!fs.existsSync(testExe)) {
    throw new Error(`Test executable does not exist at: ${testExe}`);
  }
  console.log(`Using legitimate Windows executable for standalone launch test: ${testExe}`);

  // 2. Manual Game Addition -> Save to database
  console.log('\n--- 1. Testing Manual Game Addition & DB Insertion ---');
  const manualGame = gameRepo1.create({
    name: 'Manual Test Standalone Tool',
    launcher: 'STANDALONE',
    executablePath: testExe,
    installPath: path.dirname(testExe),
    isFavorite: true,
    isInstalled: true,
    isManual: true,
    totalPlayTime: 0,
    genre: 'Utility / Standalone',
  });

  console.log(`Created manual game ID: ${manualGame.id}, Name: ${manualGame.name}`);
  if (!manualGame.id) throw new Error('Failed to create manual game in database!');

  // 3. Verify it appears in library
  console.log('\n--- 2. Verifying Game in Library ---');
  const fetched = gameRepo1.getById(manualGame.id);
  if (!fetched || fetched.name !== manualGame.name) {
    throw new Error('Game was not found in library after creation!');
  }
  console.log('Game successfully retrieved from library:', {
    id: fetched.id,
    name: fetched.name,
    launcher: fetched.launcher,
    isManual: fetched.isManual,
  });

  // 4. Test Game Launch via GameLauncher
  console.log('\n--- 3. Testing Standalone Game Process Launch ---');
  const launchResult = await launcher1.launch(manualGame.id);
  console.log('Launch result:', launchResult);

  if (!launchResult.success || !launchResult.pid) {
    throw new Error(`Launch failed: ${launchResult.error}`);
  }
  console.log(`Process spawned successfully with PID: ${launchResult.pid}`);

  // Verify launch history was recorded
  const history = launchRepo1.getHistoryForGame(manualGame.id);
  console.log(`Launch history entries for game: ${history.length}, launchId: ${history[0]?.id}`);
  if (history.length === 0) {
    throw new Error('Launch history was not recorded in SQLite database!');
  }

  // Terminate test process cleanly
  try {
    process.kill(launchResult.pid);
    console.log(`Terminated test process (PID: ${launchResult.pid}) cleanly.`);
  } catch (err) {
    // Process may have exited quickly
  }

  // 5. Test Persistence across restarts
  console.log('\n--- 4. Testing Persistence Across Application Restart ---');
  closeDatabase();
  console.log('Simulated application shutdown.');

  const db2 = initDatabase();
  const gameRepo2 = new GameRepository(db2);
  const reloadedGame = gameRepo2.getById(manualGame.id);

  if (!reloadedGame) {
    throw new Error('CRITICAL: Manual game did not survive application restart!');
  }
  console.log('SUCCESS: Manual game survived application restart intact!', {
    id: reloadedGame.id,
    name: reloadedGame.name,
    executablePath: reloadedGame.executablePath,
    totalPlayTime: reloadedGame.totalPlayTime,
  });

  // Clean up test game
  gameRepo2.delete(manualGame.id);
  console.log('Cleaned up test game record.');
  closeDatabase();

  console.log('\n=== ALL PHASE 6 MANUAL GAME ADDITION TESTS PASSED! ===');
}

testPhase6ManualGame().catch((err) => {
  console.error('\nPhase 6 test failed with error:', err);
  process.exit(1);
});
