import fs from 'fs';
import path from 'path';
import os from 'os';

export interface SteamStoreMetadata {
  appId: string;
  name?: string;
  description?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
  releaseDate?: string;
  headerImage?: string;
  fetchedAt: number;
}

export class SteamMetadataService {
  private cacheFilePath: string;
  private cache: Map<string, SteamStoreMetadata> = new Map();
  private isLoaded = false;

  constructor(customCachePath?: string) {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const dir = path.join(appData, 'GameHub');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
    this.cacheFilePath = customCachePath || path.join(dir, 'steam_store_cache.json');
    this.loadCache();
  }

  private loadCache(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (typeof data === 'object' && data !== null) {
          for (const [k, v] of Object.entries(data)) {
            this.cache.set(k, v as SteamStoreMetadata);
          }
        }
      }
      this.isLoaded = true;
    } catch (err: any) {
      console.warn('[SteamMetadataService] Failed loading cache:', err.message);
      this.isLoaded = true;
    }
  }

  public saveCache(): void {
    try {
      const obj: Record<string, SteamStoreMetadata> = {};
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[SteamMetadataService] Failed writing cache:', err.message);
    }
  }

  public getCached(appId: string): SteamStoreMetadata | undefined {
    this.loadCache();
    return this.cache.get(appId);
  }

  public cleanDescription(raw?: string): string {
    if (!raw) return '';
    return raw
      .replace(/<[^>]*>/g, '') // Strip HTML tags
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\r\n/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  public async fetchMetadata(appId: string, force = false): Promise<SteamStoreMetadata | null> {
    if (!appId) return null;
    this.loadCache();

    if (!force && this.cache.has(appId)) {
      return this.cache.get(appId)!;
    }

    try {
      const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (!res.ok) {
        return null;
      }
      const json = (await res.json()) as any;
      const appData = json[appId];
      if (!appData || !appData.success || !appData.data) {
        return null;
      }

      const d = appData.data;
      const meta: SteamStoreMetadata = {
        appId,
        name: d.name,
        description: this.cleanDescription(d.short_description || d.detailed_description),
        developer:
          Array.isArray(d.developers) && d.developers.length > 0
            ? d.developers.join(', ')
            : undefined,
        publisher:
          Array.isArray(d.publishers) && d.publishers.length > 0
            ? d.publishers.join(', ')
            : undefined,
        genre:
          Array.isArray(d.genres) && d.genres.length > 0
            ? d.genres
                .map((g: any) => g.description)
                .filter(Boolean)
                .join(', ')
            : undefined,
        releaseDate: d.release_date?.date || undefined,
        headerImage: d.header_image || undefined,
        fetchedAt: Date.now(),
      };

      this.cache.set(appId, meta);
      this.saveCache();
      return meta;
    } catch (err: any) {
      console.warn(`[SteamMetadataService] Could not fetch metadata for app ${appId}:`, err.message);
      return null;
    }
  }

  public async batchFetchMetadata(
    appIds: string[],
    concurrency = 4,
    onProgress?: (done: number, total: number) => void
  ): Promise<Map<string, SteamStoreMetadata>> {
    const results = new Map<string, SteamStoreMetadata>();
    const uncachedIds: string[] = [];

    this.loadCache();
    for (const id of appIds) {
      if (this.cache.has(id)) {
        results.set(id, this.cache.get(id)!);
      } else {
        uncachedIds.push(id);
      }
    }

    let completed = results.size;
    onProgress?.(completed, appIds.length);

    if (uncachedIds.length === 0) {
      return results;
    }

    for (let i = 0; i < uncachedIds.length; i += concurrency) {
      const chunk = uncachedIds.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (id) => {
          const meta = await this.fetchMetadata(id);
          if (meta) {
            results.set(id, meta);
          }
          completed++;
          onProgress?.(completed, appIds.length);
        })
      );
    }

    this.saveCache();
    return results;
  }
}

/**
 * Checks all Steam games currently in the SQLite database and enriches any that
 * lack rich metadata (developer, publisher, genre, releaseDate, or have placeholder descriptions)
 */
export async function enrichExistingSteamGames(gameRepo: any): Promise<number> {
  try {
    const allGames = gameRepo.getAll();
    const steamGames = allGames.filter(
      (g: any) =>
        g.launcher === 'STEAM' &&
        g.launcherAppId &&
        (!g.developer ||
          !g.description ||
          g.description.startsWith('Official Steam installation') ||
          g.description.startsWith('Discovered standalone') ||
          !g.genre ||
          g.genre === 'Unity' ||
          g.genre === 'Unreal Engine' ||
          g.genre === 'Game' ||
          !g.releaseDate)
    );

    if (steamGames.length === 0) return 0;
    console.log(`[SteamEnricher] Found ${steamGames.length} Steam game(s) needing store metadata enrichment.`);

    const metadataService = new SteamMetadataService();
    const appIds = steamGames.map((g: any) => g.launcherAppId);
    const metaMap = await metadataService.batchFetchMetadata(appIds, 4);

    let updatedCount = 0;
    for (const game of steamGames) {
      const meta = metaMap.get(game.launcherAppId);
      if (!meta) continue;

      const updates: Record<string, any> = {};

      const isPlaceholderDesc =
        !game.description ||
        game.description.startsWith('Official Steam installation') ||
        game.description.startsWith('Discovered standalone');
      if (meta.description && isPlaceholderDesc) {
        updates.description = meta.description;
      }

      if (meta.developer && (!game.developer || game.developer === 'Unknown')) {
        updates.developer = meta.developer;
      }

      if (meta.publisher && (!game.publisher || game.publisher === 'Unknown')) {
        updates.publisher = meta.publisher;
      }

      const isEngineOrGenericGenre =
        !game.genre ||
        game.genre === 'Unity' ||
        game.genre === 'Unreal Engine' ||
        game.genre === 'Standard Executable' ||
        game.genre === 'Game';
      if (meta.genre && isEngineOrGenericGenre) {
        updates.genre = meta.genre;
      }

      if (meta.releaseDate && (!game.releaseDate || game.releaseDate === 'Unknown')) {
        updates.releaseDate = meta.releaseDate;
      }

      if (Object.keys(updates).length > 0) {
        gameRepo.update(game.id, updates);
        updatedCount++;
        console.log(`[SteamEnricher] Successfully enriched "${game.name}" with official store metadata.`);
      }
    }

    return updatedCount;
  } catch (err: any) {
    console.warn('[SteamEnricher] Error during background enrichment:', err.message);
    return 0;
  }
}

