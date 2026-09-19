import path from 'path';
import fs from 'fs';
import {
  initDatabase,
  closeDatabase,
  getDatabasePath,
  GameRepository,
  LaunchRepository,
  CategoryRepository,
  SettingsRepository,
} from '../dist-electron/database/index.js';

async function runDatabaseTests() {
  console.log('=== PHASE 3 — SQLite Database Verification ===');

  const dbPath = getDatabasePath();
  console.log(`Testing target database file: ${dbPath}`);

  // 1. Initialize DB and run migrations
  const db1 = initDatabase();
  const gameRepo1 = new GameRepository(db1);
  const launchRepo1 = new LaunchRepository(db1);
  const categoryRepo1 = new CategoryRepository(db1);
  const settingsRepo1 = new SettingsRepository(db1);

  console.log('\n--- 1. Testing Game Creation (INSERT) ---');
  const createdGame = gameRepo1.create({
    name: 'Test Game Persistence',
    launcher: 'STEAM',
    launcherAppId: '220',
    installPath: 'C:\\Games\\SteamLibrary\\steamapps\\common\\Half-Life 2',
    executablePath: 'C:\\Games\\SteamLibrary\\steamapps\\common\\Half-Life 2\\hl2.exe',
    genre: 'FPS',
    developer: 'Valve',
    publisher: 'Valve',
    isFavorite: true,
    isInstalled: true,
    isManual: false,
    totalPlayTime: 3600,
  });

  console.log('Created game with ID:', createdGame.id, 'Name:', createdGame.name);
  if (!createdGame.id) throw new Error('Game creation failed!');

  console.log('\n--- 2. Testing Game Update & Favorite Toggle ---');
  gameRepo1.update(createdGame.id, { description: 'Legendary Valve shooter.' });
  gameRepo1.recordPlayTime(createdGame.id, 1800);
  const updatedGame = gameRepo1.getById(createdGame.id);
  console.log('Updated total play time:', updatedGame?.totalPlayTime, 'Description:', updatedGame?.description);

  console.log('\n--- 3. Testing Launch History ---');
  const launchId = launchRepo1.recordLaunch(createdGame.id);
  launchRepo1.recordExit(launchId, 1800);
  const history = launchRepo1.getHistoryForGame(createdGame.id);
  console.log('Recorded launches for game:', history.length, 'Duration:', history[0]?.duration);

  console.log('\n--- 4. Testing Categories ---');
  const cat = categoryRepo1.create(`Test Category ${Date.now()}`);
  categoryRepo1.addGameToCategory(createdGame.id, cat.id);
  const gameCats = categoryRepo1.getCategoriesForGame(createdGame.id);
  console.log('Assigned categories:', gameCats.map(c => c.name));

  console.log('\n--- 5. Testing Settings ---');
  settingsRepo1.set('test_key', { verified: true, timestamp: Date.now() });
  const retrievedSettings = settingsRepo1.get('test_key');
  console.log('Retrieved setting test_key:', retrievedSettings);

  console.log('\n--- 6. Simulating Application Shutdown & DB Close ---');
  closeDatabase();
  console.log('Database connection closed cleanly.');

  console.log('\n--- 7. Simulating Application Restart & DB Reopen ---');
  const db2 = initDatabase();
  const gameRepo2 = new GameRepository(db2);
  const persistedGame = gameRepo2.getById(createdGame.id);

  if (!persistedGame) {
    throw new Error('FAILURE: Game did NOT survive restart!');
  }
  console.log('SUCCESS: Game survived restart!');
  console.log('Re-loaded game details:', {
    id: persistedGame.id,
    name: persistedGame.name,
    isFavorite: persistedGame.isFavorite,
    totalPlayTime: persistedGame.totalPlayTime,
    launcher: persistedGame.launcher,
  });

  console.log('\n--- 8. Testing Cleanup (DELETE) ---');
  const deleted = gameRepo2.delete(createdGame.id);
  console.log('Game deleted cleanly:', deleted);
  const verifyDeleted = gameRepo2.getById(createdGame.id);
  if (verifyDeleted !== null) {
    throw new Error('FAILURE: Game still exists after delete!');
  }
  console.log('Verified: Game is completely removed from database.');

  closeDatabase();
  console.log('\n=== ALL PHASE 3 DATABASE TESTS PASSED! ===');
}

runDatabaseTests().catch((err) => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
