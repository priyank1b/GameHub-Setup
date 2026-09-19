import { DriveService } from '../dist-electron/services/DriveService.js';
import { initDatabase, closeDatabase, SettingsRepository } from '../dist-electron/database/index.js';

async function testPhase5Drives() {
  console.log('=== PHASE 5 — Drive Detection Verification ===');

  const db = initDatabase(':memory:');
  const settingsRepo = new SettingsRepository(db);
  const driveService = new DriveService();

  console.log('\n--- 1. Detecting Available Windows Drives ---');
  const drives = await driveService.getAvailableDrives();
  console.log(`Found ${drives.length} active drive(s):`);

  for (const d of drives) {
    const totalGB = (d.totalBytes / 1024 ** 3).toFixed(1);
    const freeGB = (d.availableBytes / 1024 ** 3).toFixed(1);
    console.log(`  Drive [${d.letter}] "${d.name}" | Total: ${totalGB} GB | Free: ${freeGB} GB | Type: ${d.driveType}`);
    
    if (!d.letter || !d.name || d.totalBytes <= 0) {
      throw new Error(`Invalid drive metadata returned for ${d.letter}`);
    }
  }

  if (drives.length === 0) {
    throw new Error('No drives detected on Windows system!');
  }

  console.log('\n--- 2. Testing Disconnected / Nonexistent Drives Safety ---');
  // Test invalid letters Z:, X:
  const isZAvailable = driveService.isDriveAvailable('Z:');
  console.log('Is non-existent drive Z: available?', isZAvailable);
  if (isZAvailable) throw new Error('Nonexistent drive Z: reported as available!');

  // Calling getAvailableDrives with disconnected drive in included list should not crash
  const withDisconnected = await driveService.getAvailableDrives(['C:', 'Z:', 'X:']);
  console.log('Handled disconnected drive list without crashing. Returned drives:', withDisconnected.map(d => d.letter));

  console.log('\n--- 3. Testing Drive Inclusion Persistence in Settings ---');
  const initialIncluded = ['C:', 'D:'];
  settingsRepo.set('scan_drives', initialIncluded);
  const savedDrives = settingsRepo.get('scan_drives');
  console.log('Persisted included scan drives:', savedDrives);

  console.log('\n=== ALL PHASE 5 DRIVE DETECTION TESTS PASSED! ===');
  closeDatabase();
}

testPhase5Drives().catch((err) => {
  console.error('\nPhase 5 test failed:', err);
  process.exit(1);
});
