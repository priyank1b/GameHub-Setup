async function testCovers() {
  const { initDatabase, GameRepository } = await import('../dist-electron/database/index.js');
  const db = initDatabase();
  const repo = new GameRepository(db);
  const games = repo.getAll();

  console.log(`Checking cover URLs for ${games.length} games...\n`);
  for (const g of games) {
    if (g.coverImage) {
      try {
        const res = await fetch(g.coverImage);
        console.log(`${g.name} (${g.launcherAppId}): HTTP ${res.status} ${res.status === 200 ? '✔' : '❌ ' + g.coverImage}`);
      } catch (err) {
        console.log(`${g.name}: ERROR ${err.message}`);
      }
    } else {
      console.log(`${g.name}: ❌ NO COVER IMAGE`);
    }
  }
}

testCovers().catch(console.error);
