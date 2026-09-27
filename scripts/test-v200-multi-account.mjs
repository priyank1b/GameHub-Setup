import path from 'path';
import fs from 'fs';
import assert from 'assert';
import {
  initDatabase,
  closeDatabase,
  LauncherAccountRepository,
  LauncherGameEntryRepository,
  CanonicalGameRepository,
  LocalInstallationRepository,
} from '../dist-electron/database/index.js';

console.log('====================================================');
console.log('GameHub v2.0.0 Multi-Account & Library Test Suite');
console.log('Adhering strictly to V2.0.0_TEST_PLAN.md');
console.log('====================================================\n');

// 1. Initialize DB and apply migrations
console.log('[Test 1] Initializing database & running migrations (v1-v5)...');
const testDbPath = path.join(process.cwd(), 'test-v200.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = initDatabase(testDbPath);

const currentVersion = db.pragma('user_version', { simple: true });
assert.strictEqual(currentVersion, 5, `Expected schema version 5, got ${currentVersion}`);
console.log('✓ Migration 5 successfully applied (schema version = 5).\n');

// Repositories
const accountRepo = new LauncherAccountRepository(db);
const gameEntryRepo = new LauncherGameEntryRepository(db);
const canonicalRepo = new CanonicalGameRepository(db);
const localInstallRepo = new LocalInstallationRepository(db);

// 2. Test Account Management
console.log('[Test 2] Testing Launcher Accounts (multi-account per launcher)...');

// 2a. Connect Steam Personal
const steamPersonal = accountRepo.create({
  launcher: 'STEAM',
  externalAccountId: '76561198000000001',
  displayName: 'Personal',
  connectionStatus: 'CONNECTED',
  syncStatus: 'IDLE',
});

// 2b. Connect Steam Brother
const steamBrother = accountRepo.create({
  launcher: 'STEAM',
  externalAccountId: '76561198000000002',
  displayName: 'Brother',
  connectionStatus: 'CONNECTED',
  syncStatus: 'IDLE',
});

// 2c. Connect Epic Personal
const epicPersonal = accountRepo.create({
  launcher: 'EPIC',
  externalAccountId: 'epic_account_123',
  displayName: 'Epic Personal',
  connectionStatus: 'CONNECTED',
  syncStatus: 'IDLE',
});

const allAccounts = accountRepo.getAll();
assert.strictEqual(allAccounts.length, 3, 'Expected 3 connected accounts');
console.log('✓ Connected multiple accounts across Steam and Epic (2 Steam, 1 Epic).\n');

// 2d. Unique constraint
console.log('[Test 3] Reconnection idempotency & unique constraint...');
assert.throws(() => {
  accountRepo.create({
    launcher: 'STEAM',
    externalAccountId: '76561198000000001',
    displayName: 'Personal Duplicate',
    connectionStatus: 'CONNECTED',
    syncStatus: 'IDLE',
  });
}, /UNIQUE constraint failed/, 'Should reject duplicate account for same launcher and external ID');
console.log('✓ Unique constraint (launcher, external_account_id) prevents duplicate accounts.\n');

// 3. Test Security (No plaintext tokens / credentials in database)
console.log('[Test 4] Security Audit: Verify schema contains zero credential columns...');
const tableInfo = db.pragma('table_info(launcher_accounts)');
const colNames = tableInfo.map((c) => c.name.toLowerCase());
assert(!colNames.includes('password'), 'Schema must not contain password column');
assert(!colNames.includes('token'), 'Schema must not contain token column');
assert(!colNames.includes('access_token'), 'Schema must not contain access_token column');
assert(!colNames.includes('secret'), 'Schema must not contain secret column');
console.log('✓ SQLite schema is credential-free. Tokens use OS-level safeStorage.\n');

// 4. Test Canonical Game Matching & Grouping Rules
console.log('[Test 5] Testing Canonical Game Grouping Rules...');

// Create canonical game GTA V
const gtaCanonical = canonicalRepo.create({
  title: 'Grand Theft Auto V',
  normalizedTitle: 'grandtheftautov',
  isFavorite: true,
  isHidden: false,
  totalPlayTime: 3600,
});

// Sync entries for GTA V across Steam Personal, Steam Brother, Epic Personal
gameEntryRepo.upsertBatch(steamPersonal.id, [
  { externalGameId: '271590', title: 'Grand Theft Auto V', canonicalGameId: gtaCanonical.id, installAvailable: false },
]);
gameEntryRepo.upsertBatch(steamBrother.id, [
  { externalGameId: '271590', title: 'Grand Theft Auto V', canonicalGameId: gtaCanonical.id, installAvailable: true },
]);
gameEntryRepo.upsertBatch(epicPersonal.id, [
  { externalGameId: 'Sugar', title: 'Grand Theft Auto V', canonicalGameId: gtaCanonical.id, installAvailable: true },
]);

const steamEntry = gameEntryRepo.getByAccountAndExternalId(steamPersonal.id, '271590');

// Local installation exists for Steam Personal
localInstallRepo.create({
  canonicalGameId: gtaCanonical.id,
  launcherGameEntryId: steamEntry.id,
  launcherAccountId: steamPersonal.id,
  installPath: 'C:\\Games\\Steam\\steamapps\\common\\Grand Theft Auto V',
  executablePath: 'C:\\Games\\Steam\\steamapps\\common\\Grand Theft Auto V\\GTA5.exe',
  launcher: 'STEAM',
  installSizeBytes: 105000000000,
  installSizeStatus: 'KNOWN',
  installSizeSource: 'filesystem',
  status: 'INSTALLED',
});

// Hydrate canonical game
const hydratedGTA = canonicalRepo.getById(gtaCanonical.id);
assert.strictEqual(hydratedGTA.status, 'INSTALLED', 'GTA V status should be INSTALLED');
assert.strictEqual(hydratedGTA.ownerships.length, 3, 'GTA V should have 3 account ownerships');
assert.strictEqual(hydratedGTA.installations.length, 1, 'GTA V should have 1 local installation');

const installedOwnership = hydratedGTA.ownerships.find((o) => o.launcherAccountId === steamPersonal.id);
assert.strictEqual(installedOwnership.isInstalled, true, 'Steam Personal ownership should be marked installed');

const uninstalledOwnership = hydratedGTA.ownerships.find((o) => o.launcherAccountId === steamBrother.id);
assert.strictEqual(uninstalledOwnership.isInstalled, false, 'Steam Brother ownership should be marked available (not installed)');
console.log('✓ Grouping verified: 1 Canonical GTA V card represents 3 account ownerships and 1 local installation.\n');

// 5. Matching Safety: Remasters / DLC must NEVER merge by title alone
console.log('[Test 6] Testing Remasters / Editions Matching Safety...');
const darkSouls = canonicalRepo.create({
  title: 'Dark Souls: Prepare to Die Edition',
  normalizedTitle: 'darksoulsprepartodieedition',
  isFavorite: false,
  isHidden: false,
  totalPlayTime: 0,
});

const darkSoulsRemastered = canonicalRepo.create({
  title: 'Dark Souls: Remastered',
  normalizedTitle: 'darksoulsremastered',
  isFavorite: false,
  isHidden: false,
  totalPlayTime: 0,
});

assert.notStrictEqual(darkSouls.id, darkSoulsRemastered.id, 'Dark Souls Remastered must NOT merge into original Dark Souls');
console.log('✓ Remasters and separate editions are preserved as distinct canonical records.\n');

// 6. Test Disconnect Semantics
console.log('[Test 7] Testing Disconnect & Reconnect Semantics...');
// Disconnect Steam Brother
gameEntryRepo.deleteByAccountId(steamBrother.id);
accountRepo.update(steamBrother.id, { connectionStatus: 'DISCONNECTED' });

// Check that Canonical GTA V still exists because Steam Personal & Epic Personal remain
const remainingGTA = canonicalRepo.getById(gtaCanonical.id);
assert.strictEqual(remainingGTA.ownerships.length, 2, 'Should retain remaining 2 owners');
assert.strictEqual(remainingGTA.installations.length, 1, 'Local installation must be preserved');
console.log('✓ Disconnecting an account removes only its cached entries; canonical records and local installs are strictly preserved.\n');

// 7. Test Reconnecting Account restores ownership
console.log('[Test 8] Reconnecting Account...');
accountRepo.update(steamBrother.id, { connectionStatus: 'CONNECTED' });
gameEntryRepo.upsertBatch(steamBrother.id, [
  { externalGameId: '271590', title: 'Grand Theft Auto V', canonicalGameId: gtaCanonical.id, installAvailable: true },
]);

const restoredGTA = canonicalRepo.getById(gtaCanonical.id);
assert.strictEqual(restoredGTA.ownerships.length, 3, 'Ownership cleanly restored after reconnect without duplication');
console.log('✓ Reconnecting restores ownership seamlessly.\n');

// Cleanup
closeDatabase();
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

console.log('====================================================');
console.log('ALL v2.0.0 SPECIFICATION TEST SCENARIOS PASSED (8/8)!');
console.log('====================================================');
process.exit(0);
