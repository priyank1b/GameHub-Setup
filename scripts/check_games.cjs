const path = require('path');

async function checkGames() {
  const { initDatabase, GameRepository } = await import('../dist-electron/database/index.js');
  const db = initDatabase();
  const repo = new GameRepository(db);

  const games = repo.getAll();
  console.log(`\n=== Total Games in Database: ${games.length} ===\n`);
  games.forEach((g, i) => {
    console.log(`${i + 1}. [${g.launcher}] ${g.name} (${g.drive})`);
    console.log(`   Install: ${g.installPath}`);
    console.log(`   Exe:     ${g.executablePath || 'None'}`);
    console.log(`   AppID:   ${g.launcherAppId || 'None'}`);
    console.log(`   Size:    ${(g.installedSize / (1024 * 1024 * 1024)).toFixed(2)} GB (${g.installedSize} bytes)`);
    console.log(`   Cover:   ${g.coverImage ? 'Available' : 'None'}`);
    console.log(`   Favorite:${g.isFavorite}`);
    if (g.launcherAppId === '622650') {
      console.log('   RAW OBJECT:', g);
    }
  });
}

checkGames().catch(console.error);
