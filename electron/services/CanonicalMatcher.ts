import { CanonicalGameRepository } from '../database/repositories/CanonicalGameRepository';
import { CanonicalGame } from '../../src/types/LauncherAccount';
import { GameLauncher } from '../../src/types/Launcher';

export class CanonicalMatcher {
  private static readonly EDITION_FLAGS = [
    'remaster',
    'remastered',
    'definitive edition',
    'game of the year',
    'goty',
    'deluxe edition',
    'deluxe',
    'special edition',
    'enhanced edition',
    'director\'s cut',
    'directors cut',
    'gold edition',
    'anniversary edition',
    'complete edition',
    'vr',
    'demo',
    'soundtrack',
    'artbook',
    'prologue',
    'classic',
  ];

  /**
   * Normalizes a title into a comparable string.
   */
  public static normalizeTitle(title: string): string {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/['’":™®©\-–—_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extracts any edition / variant flags from the title.
   * Two titles with different edition flags must NEVER be merged!
   */
  public static extractEditionFlags(title: string): Set<string> {
    const norm = title.toLowerCase();
    const found = new Set<string>();

    for (const flag of CanonicalMatcher.EDITION_FLAGS) {
      const regex = new RegExp(`\\b${flag}\\b`, 'i');
      if (regex.test(norm)) {
        found.add(flag);
      }
    }

    return found;
  }

  /**
   * Checks if two titles can safely be considered the same canonical game.
   */
  public static canMergeTitles(titleA: string, titleB: string): boolean {
    const normA = CanonicalMatcher.normalizeTitle(titleA);
    const normB = CanonicalMatcher.normalizeTitle(titleB);

    if (normA === normB) {
      return true;
    }

    // Check edition flags
    const flagsA = CanonicalMatcher.extractEditionFlags(titleA);
    const flagsB = CanonicalMatcher.extractEditionFlags(titleB);

    // If flags differ, do NOT merge (e.g. Dark Souls vs Dark Souls Remastered, Demo, etc.)
    if (flagsA.size !== flagsB.size) {
      return false;
    }

    for (const flag of flagsA) {
      if (!flagsB.has(flag)) {
        return false;
      }
    }

    // Stripped comparison only if both had identical flags
    const strippedA = normA.replace(/[^a-z0-9]/g, '');
    const strippedB = normB.replace(/[^a-z0-9]/g, '');

    return strippedA.length > 3 && strippedA === strippedB;
  }

  /**
   * Finds an existing canonical game or creates a new one.
   */
  public static findOrCreateCanonical(
    canonicalRepo: CanonicalGameRepository,
    item: {
      title: string;
      launcher: GameLauncher;
      externalGameId?: string;
      coverImage?: string;
      backgroundImage?: string;
      iconPath?: string;
      description?: string;
      developer?: string;
      publisher?: string;
      genre?: string;
      releaseDate?: string;
    }
  ): CanonicalGame {
    const allGames = canonicalRepo.getAll(true);

    // 1. Check if a placeholder record existed for this exact external ID (e.g. "Steam App 1089980")
    if (item.externalGameId && !item.title.startsWith('Steam App ')) {
      const placeholderTitle = `Steam App ${item.externalGameId}`;
      const placeholderMatch = allGames.find((g) => g.title === placeholderTitle);
      if (placeholderMatch) {
        canonicalRepo.update(placeholderMatch.id, {
          title: item.title,
          normalizedTitle: CanonicalMatcher.normalizeTitle(item.title).replace(/[^a-z0-9]/g, ''),
          coverImage: item.coverImage || placeholderMatch.coverImage,
          backgroundImage: item.backgroundImage || placeholderMatch.backgroundImage,
          description: item.description || placeholderMatch.description,
          developer: item.developer || placeholderMatch.developer,
          publisher: item.publisher || placeholderMatch.publisher,
          genre: item.genre || placeholderMatch.genre,
          releaseDate: item.releaseDate || placeholderMatch.releaseDate,
        });
        return canonicalRepo.getById(placeholderMatch.id)!;
      }
    }

    // 2. Normal canonical title matching
    for (const existing of allGames) {
      if (CanonicalMatcher.canMergeTitles(existing.title, item.title)) {
        // If existing has no cover or description, enrich it
        const updates: Record<string, any> = {};
        if (!existing.coverImage && item.coverImage) {
          updates.coverImage = item.coverImage;
        }
        if (!existing.backgroundImage && item.backgroundImage) {
          updates.backgroundImage = item.backgroundImage;
        }
        if (!existing.description && item.description) {
          updates.description = item.description;
        }
        if (Object.keys(updates).length > 0) {
          canonicalRepo.update(existing.id, updates);
          return canonicalRepo.getById(existing.id)!;
        }
        return existing;
      }
    }

    // No existing match found -> create new canonical game record
    return canonicalRepo.create({
      title: item.title,
      normalizedTitle: CanonicalMatcher.normalizeTitle(item.title).replace(/[^a-z0-9]/g, ''),
      coverImage: item.coverImage,
      backgroundImage: item.backgroundImage,
      iconPath: item.iconPath,
      description: item.description,
      developer: item.developer,
      publisher: item.publisher,
      genre: item.genre,
      releaseDate: item.releaseDate,
      isFavorite: false,
      isHidden: false,
      totalPlayTime: 0,
    });
  }
}
