async function checkPlaytimes() {
  const { initDatabase, GameRepository } = await import('../dist-electron/database/index.js');
  const db = initDatabase();
  const repo = new GameRepository(db);

  const games = repo.getAll();
  console.log(`\n=== Steam Game Playtimes in GameHub (${games.length} games) ===\n`);
  games.forEach((g, i) => {
    const hours = (g.totalPlayTime / 3600).toFixed(1);
    const mins = Math.floor(g.totalPlayTime / 60);
    console.log(`${i + 1}. [${g.launcher}] ${g.name} (${g.drive})`);
    console.log(`   Playtime: ${hours} hrs (${mins} mins / ${g.totalPlayTime}s)`);
    console.log(`   Last Played: ${g.lastPlayedAt || 'Never'}\n`);
  });
}

checkPlaytimes().catch(console.error);
