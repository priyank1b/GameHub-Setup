async function printUrls() {
  const { initDatabase, GameRepository } = await import('../dist-electron/database/index.js');
  const db = initDatabase();
  const repo = new GameRepository(db);
  const games = repo.getAll().filter(g => ['3949040', '4704690'].includes(g.launcherAppId));
  games.forEach(g => {
    console.log(g.name, '(' + g.launcherAppId + ')');
    console.log('Cover:', g.coverImage);
    console.log('Hero: ', g.backgroundImage);
  });
}
printUrls().catch(console.error);
