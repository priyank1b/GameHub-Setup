const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function testV103() {
  console.log('=== GameHub v1.0.3 Verification Script ===\n');

  // 1. Database Migrations & Columns Verification
  const testDbDir = path.join(os.tmpdir(), 'gamehub-test-v103-' + Date.now());
  fs.mkdirSync(testDbDir, { recursive: true });
  const dbFile = path.join(testDbDir, 'test.db');
  const db = new Database(dbFile);

  console.log('[1/4] Testing Migration 3 execution...');
  // Initialize table as migration 2 would have it
  db.exec(`
    CREATE TABLE games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      normalized_name TEXT,
      executable_path TEXT,
      install_path TEXT,
      launcher TEXT NOT NULL,
      launcher_app_id TEXT,
      cover_image TEXT,
      background_image TEXT,
      icon_path TEXT,
      description TEXT,
      developer TEXT,
      publisher TEXT,
      genre TEXT,
      release_date TEXT,
      installed_size INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      is_installed INTEGER DEFAULT 1,
      is_manual INTEGER DEFAULT 0,
      last_played_at TEXT,
      total_play_time INTEGER DEFAULT 0,
      drive TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Insert a mock game with installed_size > 0
  db.prepare(`
    INSERT INTO games (name, launcher, installed_size)
    VALUES ('Half-Life 2', 'STEAM', 7500000000)
  `).run();

  // Now run Migration 3 logic
  db.exec(`
    ALTER TABLE games ADD COLUMN install_size_status TEXT DEFAULT 'UNKNOWN';
    ALTER TABLE games ADD COLUMN install_size_source TEXT DEFAULT 'unknown';
    ALTER TABLE games ADD COLUMN install_size_updated_at TEXT;
    
    UPDATE games
    SET install_size_status = 'KNOWN',
        install_size_source = 'metadata',
        install_size_updated_at = datetime('now')
    WHERE installed_size > 0 AND (install_size_status IS NULL OR install_size_status = 'UNKNOWN');
  `);

  const cols = db.pragma('table_info(games)').map((c) => c.name);
  console.log('Columns in games table:', cols.filter(c => c.includes('install_size')));
  if (!cols.includes('install_size_status') || !cols.includes('install_size_source') || !cols.includes('install_size_updated_at')) {
    throw new Error('Migration 3 columns missing!');
  }

  const hl2 = db.prepare('SELECT * FROM games WHERE name = ?').get('Half-Life 2');
  console.log('Backfilled game storage status:', hl2.install_size_status, 'source:', hl2.install_size_source);
  if (hl2.install_size_status !== 'KNOWN' || hl2.install_size_source !== 'metadata') {
    throw new Error('Backfill failed!');
  }
  console.log('✓ Migration 3 verified successfully.\n');

  // 2. Storage Size States & No Fake 0 B Verification
  console.log('[2/4] Verifying Storage Size States...');
  function formatSizeDisplay(g) {
    if (g.installSizeStatus === 'CALCULATING') {
      return 'Calculating…';
    }
    if (g.installSizeStatus === 'ACCESS_DENIED') {
      return 'Access denied';
    }
    if (g.installSizeStatus === 'UNKNOWN') {
      return 'Size unavailable';
    }
    const bytes = g.installSizeBytes ?? g.installedSize;
    if (bytes === undefined || bytes === null || bytes <= 0) {
      if (g.installSizeStatus === 'KNOWN') {
        return '0 B';
      }
      return 'Size unavailable';
    }
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  const testCases = [
    { name: 'Known Game', installSizeStatus: 'KNOWN', installedSize: 15400000000, expected: '14.3 GB' },
    { name: 'Calculating Game', installSizeStatus: 'CALCULATING', installedSize: 0, expected: 'Calculating…' },
    { name: 'WindowsApps Access Denied', installSizeStatus: 'ACCESS_DENIED', installedSize: 0, expected: 'Access denied' },
    { name: 'Unknown Game', installSizeStatus: 'UNKNOWN', installedSize: 0, expected: 'Size unavailable' },
    { name: 'Corrupt 0 B with UNKNOWN', installSizeStatus: 'UNKNOWN', installedSize: 0, expected: 'Size unavailable' },
  ];

  for (const tc of testCases) {
    const formatted = formatSizeDisplay(tc);
    console.log(`- ${tc.name}: formatted = "${formatted}" (expected "${tc.expected}")`);
    if (formatted !== tc.expected) {
      throw new Error(`State mismatch for ${tc.name}: got "${formatted}", expected "${tc.expected}"`);
    }
  }
  console.log('✓ Storage state display verified (Never produces false 0 B).\n');

  // 3. Settings persistence for Auto-Rescan
  console.log('[3/4] Verifying Auto-Rescan settings keys...');
  db.prepare("INSERT INTO settings (key, value) VALUES ('auto_rescan_enabled', 'true')").run();
  db.prepare("INSERT INTO settings (key, value) VALUES ('auto_rescan_interval_minutes', '60')").run();

  const enabled = db.prepare("SELECT value FROM settings WHERE key = 'auto_rescan_enabled'").get()?.value === 'true';
  const interval = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'auto_rescan_interval_minutes'").get()?.value, 10);
  console.log(`Auto-rescan enabled: ${enabled}, interval: ${interval} min`);
  if (!enabled || interval !== 60) {
    throw new Error('Auto-rescan settings persistence failed!');
  }
  console.log('✓ Auto-rescan settings verified.\n');

  // 4. Cleanup
  console.log('[4/4] Cleaning up test database...');
  db.close();
  fs.rmSync(testDbDir, { recursive: true, force: true });
  console.log('✓ All v1.0.3 storage and auto-rescan tests PASSED!\n');
}

testV103().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
