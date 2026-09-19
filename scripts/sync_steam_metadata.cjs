const path = require('path');

async function syncSteamMeta() {
  const { initDatabase, GameRepository } = await import('../dist-electron/database/index.js');
  const { enrichExistingSteamGames } = await import('../dist-electron/services/SteamMetadataService.js');

  const db = initDatabase();
  const repo = new GameRepository(db);

  console.log('--- Starting Steam Metadata Sync ---');
  const count = await enrichExistingSteamGames(repo);
  console.log(`Enriched ${count} games.`);

  console.log('\n--- Verified Steam Games in Database ---');
  const steamGames = repo.getAll().filter((g) => g.launcher === 'STEAM');
  for (const g of steamGames) {
    console.log(`\nGame: ${g.name} (App ID: ${g.launcherAppId})`);
    console.log(`  Developer:   ${g.developer}`);
    console.log(`  Publisher:   ${g.publisher}`);
    console.log(`  Genre:       ${g.genre}`);
    console.log(`  ReleaseDate: ${g.releaseDate}`);
    console.log(`  Description: ${g.description?.slice(0, 90)}...`);
  }
}

syncSteamMeta().catch(console.error);
