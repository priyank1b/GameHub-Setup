import path from 'path';
import { Database } from 'better-sqlite3';
import {
  CanonicalGameRepository,
  LocalInstallationRepository,
} from '../../database/index';
import { LauncherGameEntryRepository } from '../../database/index';
import { CanonicalMatcher } from '../CanonicalMatcher';
import { GameCandidate } from './types';

/**
 * Bridges scanner results into the canonical library tables
 * (canonical_games + local_installations), which are what the Library UI reads
 * once any canonical game exists. Without this, games discovered by a Rescan
 * only land in the legacy `games` table and never show as installed.
 */
export class CanonicalInstallSync {
  private canonicalRepo: CanonicalGameRepository;
  private installRepo: LocalInstallationRepository;
  private entryRepo: LauncherGameEntryRepository;

  constructor(private db: Database) {
    this.entryRepo = new LauncherGameEntryRepository(db);
    this.canonicalRepo = new CanonicalGameRepository(db);
    this.installRepo = new LocalInstallationRepository(db);
  }

  private norm(p?: string): string {
    return p ? path.resolve(p).toLowerCase() : '';
  }

  /** Finds the single launcher account/entry owning this app, if unambiguous. */
  private findEntryLink(
    launcher: string,
    appId?: string
  ): { entryId?: number; accountId?: number } {
    if (!appId || launcher === 'STANDALONE' || launcher === 'UNKNOWN') return {};
    const rows = this.db
      .prepare(
        `SELECT lge.id AS entry_id, lge.launcher_account_id AS account_id
         FROM launcher_game_entries lge
         JOIN launcher_accounts la ON la.id = lge.launcher_account_id
         WHERE la.launcher = ? AND lge.external_game_id = ?`
      )
      .all(launcher, appId) as Array<{ entry_id: number; account_id: number }>;
    // Family sharing / multiple accounts: stay launcher-level to avoid mis-crediting
    if (rows.length !== 1) return {};
    return { entryId: rows[0].entry_id, accountId: rows[0].account_id };
  }

  /**
   * Steam records which account installed a game (LastOwner in the appmanifest).
   * If that account is connected and has no entry for the game yet, create one so
   * the card shows its account badge without needing a Sync All first.
   */
  private ensureSteamOwnership(cand: GameCandidate, canonicalId: number): void {
    if (cand.launcher !== 'STEAM' || !cand.launcherAppId) return;
    const lastOwner = cand.metadata?.lastOwner as string | undefined;
    if (!lastOwner) return;
    const account = this.db
      .prepare(
        `SELECT id FROM launcher_accounts
         WHERE launcher = 'STEAM' AND external_account_id = ? AND connection_status = 'CONNECTED'`
      )
      .get(lastOwner) as { id: number } | undefined;
    if (!account) return;
    if (this.entryRepo.getByAccountAndExternalId(account.id, cand.launcherAppId)) return;
    this.entryRepo.upsertBatch(account.id, [
      {
        externalGameId: cand.launcherAppId,
        title: cand.name,
        canonicalGameId: canonicalId,
        ownedStatus: 'OWNED',
        installAvailable: false,
      },
    ]);
  }

  /** Returns number of installations created or updated. */
  public sync(candidates: GameCandidate[]): number {
    let changed = 0;
    const now = new Date().toISOString();

    for (const cand of candidates) {
      try {
        const canonical = CanonicalMatcher.findOrCreateCanonical(this.canonicalRepo, {
          title: cand.name,
          launcher: cand.launcher,
          externalGameId: cand.launcherAppId,
          coverImage: cand.coverImage,
          backgroundImage: cand.backgroundImage,
          iconPath: cand.iconPath,
          description: cand.description,
          developer: cand.developer,
          publisher: cand.publisher,
          genre: cand.genre,
          releaseDate: cand.releaseDate,
        });

        const candInstall = this.norm(cand.installPath);
        const existing = this.installRepo
          .getByCanonicalId(canonical.id)
          .find((i) => i.launcher === cand.launcher && this.norm(i.installPath) === candInstall)
          || this.installRepo
            .getByCanonicalId(canonical.id)
            .find((i) => i.launcher === cand.launcher && !i.installPath);

        const size = cand.installedSize || cand.installSizeBytes || 0;
        this.ensureSteamOwnership(cand, canonical.id);
        const link = this.findEntryLink(cand.launcher, cand.launcherAppId);

        if (existing) {
          const needsUpdate =
            existing.status !== 'INSTALLED' ||
            existing.installPath !== cand.installPath ||
            (cand.executablePath && existing.executablePath !== cand.executablePath) ||
            (size > 0 && existing.installSizeBytes !== size);
          if (needsUpdate) {
            this.installRepo.update(existing.id, {
              installPath: cand.installPath,
              executablePath: cand.executablePath ?? existing.executablePath,
              installSizeBytes: size || existing.installSizeBytes,
              installSizeStatus: size ? 'KNOWN' : existing.installSizeStatus,
              installSizeSource: size ? 'metadata' : existing.installSizeSource,
              status: 'INSTALLED',
              lastVerifiedAt: now,
            });
            changed++;
          }
        } else {
          this.installRepo.create({
            canonicalGameId: canonical.id,
            launcherGameEntryId: link.entryId,
            launcherAccountId: link.accountId,
            installPath: cand.installPath,
            executablePath: cand.executablePath,
            launcher: cand.launcher,
            installSizeBytes: size,
            installSizeStatus: size ? 'KNOWN' : 'UNKNOWN',
            installSizeSource: size ? 'metadata' : 'unknown',
            status: 'INSTALLED',
            lastVerifiedAt: now,
          });
          changed++;
        }
      } catch (err: any) {
        console.warn(`[CanonicalInstallSync] Failed syncing "${cand.name}":`, err.message);
      }
    }

    console.log(`[CanonicalInstallSync] Synced ${candidates.length} candidates, ${changed} installation(s) created/updated.`);
    return changed;
  }
}
