async function check() {
  const { initDatabase, GameRepository, LaunchRepository } = await import('../dist-electron/database/index.js');
  const db = initDatabase();
  const gameRepo = new GameRepository(db);
  const launchRepo = new LaunchRepository(db);

  console.log('Total game_launches in DB:', launchRepo.getRecentLaunches(50));
  const gamesWithLastPlayed = gameRepo.getAll().filter(g => g.lastPlayedAt);
  console.log('Games with lastPlayedAt count:', gamesWithLastPlayed.length);
  gamesWithLastPlayed.forEach(g => console.log(`- ${g.name}: lastPlayedAt=${g.lastPlayedAt}, playtime=${g.totalPlayTime}s`));
}
check().catch(console.error);
