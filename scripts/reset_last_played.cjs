async function resetLastPlayed() {
  const { initDatabase } = await import('../dist-electron/database/index.js');
  const db = initDatabase();

  const res = db.prepare('UPDATE games SET last_played_at = NULL').run();
  console.log(`Reset last_played_at to NULL for ${res.changes} games.`);
}

resetLastPlayed().catch(console.error);
