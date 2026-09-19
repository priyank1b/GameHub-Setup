const fs = require('fs');
const path = require('path');

function getSteamPlaytimes(steamPath) {
  const userdataDir = path.join(steamPath, 'userdata');
  if (!fs.existsSync(userdataDir)) return {};

  const accountDirs = fs.readdirSync(userdataDir);
  const playtimes = {};

  for (const acc of accountDirs) {
    const configFile = path.join(userdataDir, acc, 'config', 'localconfig.vdf');
    if (!fs.existsSync(configFile)) continue;

    try {
      const content = fs.readFileSync(configFile, 'utf-8');
      
      // Parse blocks under "Software" -> "Valve" -> "Steam" -> "Apps"
      // App blocks look like:
      // "48000"
      // {
      //    "LastPlayed" "1789759872"
      //    "Playtime" "386"
      // }
      const appBlockRegex = /"(\d{3,10})"\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      let match;
      while ((match = appBlockRegex.exec(content)) !== null) {
        const appid = match[1];
        const blockContent = match[2];

        const ptMatch = blockContent.match(/"Playtime"\s*"(\d+)"/i);
        const lpMatch = blockContent.match(/"LastPlayed"\s*"(\d+)"/i);

        const minutes = ptMatch ? parseInt(ptMatch[1], 10) : 0;
        const lastPlayed = lpMatch ? parseInt(lpMatch[1], 10) : 0;

        if (minutes > 0 || lastPlayed > 0) {
          if (!playtimes[appid] || playtimes[appid].playtimeMinutes < minutes) {
            playtimes[appid] = {
              playtimeMinutes: minutes,
              playtimeSeconds: minutes * 60,
              lastPlayedUnix: lastPlayed,
              lastPlayedAt: lastPlayed > 0 ? new Date(lastPlayed * 1000).toISOString() : null,
            };
          }
        }
      }
    } catch (err) {
      console.warn(`Could not read ${configFile}:`, err.message);
    }
  }

  return playtimes;
}

const res = getSteamPlaytimes('C:\\Program Files (x86)\\Steam');
console.log(`Found playtime records for ${Object.keys(res).length} Steam games:\n`);
['48000', '1091500', '622650', '1222700', '1426210', '1238840', '1623730', '3949040', '4704690'].forEach(id => {
  if (res[id]) {
    console.log(`App ID ${id}: ${res[id].playtimeMinutes} mins (${(res[id].playtimeMinutes / 60).toFixed(1)} hrs), last played: ${res[id].lastPlayedAt}`);
  } else {
    console.log(`App ID ${id}: No playtime recorded`);
  }
});
