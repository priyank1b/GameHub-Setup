import React, { useState, useEffect } from 'react';
import {
  Users,
  RefreshCw,
  Unlink,
  Link,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  X,
  UserPlus,
  HelpCircle,
} from 'lucide-react';
import { LauncherAccount } from '../types/LauncherAccount';
import { FocusableItem } from './FocusableItem';

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountsUpdated?: () => void;
}

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({
  isOpen,
  onClose,
  onAccountsUpdated,
}) => {
  const [accounts, setAccounts] = useState<LauncherAccount[]>([]);
  const [detectedFriends, setDetectedFriends] = useState<
    Array<{ steamId: string; personaName: string; avatarUrl?: string }>
  >([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendSteamId, setFriendSteamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [groupingEnabled, setGroupingEnabled] = useState(true);
  const [syncUninstalledMap, setSyncUninstalledMap] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      if (window.gameHub?.accounts) {
        const list = await window.gameHub.accounts.getAll();
        setAccounts(list);
        if (window.gameHub.accounts.getDetectedFriends) {
          const friends = await window.gameHub.accounts.getDetectedFriends();
          setDetectedFriends(friends || []);
        }
        if (window.gameHub?.settings) {
          const map: Record<number, boolean> = {};
          for (const a of list) {
            const val = await window.gameHub.settings.get<boolean>(`account_${a.id}_sync_uninstalled`, true);
            map[a.id] = val !== false;
          }
          setSyncUninstalledMap(map);
        }
      }
      if (window.gameHub?.settings) {
        const grouping = await window.gameHub.settings.get('group_across_accounts', true);
        setGroupingEnabled(grouping);
      }
    } catch (err: any) {
      console.error('Failed to load accounts:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  const handleDiscover = async () => {
    try {
      setLoading(true);
      setMessage({ text: 'Scanning for local launcher accounts...', type: 'info' });
      const discovered = await window.gameHub?.accounts?.discover();
      await loadAccounts();
      setMessage({
        text: `Discovered and connected ${discovered?.length || 0} launcher account(s).`,
        type: 'success',
      });
      onAccountsUpdated?.();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: `Discovery failed: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (accountId: number) => {
    try {
      setSyncingId(accountId);
      const res = await window.gameHub?.accounts?.sync(accountId);
      if (res?.success) {
        setMessage({
          text: `Synchronized ${res.syncedCount} game(s) for account.`,
          type: 'success',
        });
      } else {
        setMessage({ text: `Sync warning: ${res?.error || 'Unknown error'}`, type: 'error' });
      }
      await loadAccounts();
      onAccountsUpdated?.();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: `Sync failed: ${err.message}`, type: 'error' });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncingAll(true);
      setMessage({ text: 'Synchronizing all accounts...', type: 'info' });
      await window.gameHub?.accounts?.syncAll();
      await loadAccounts();
      setMessage({ text: 'All accounts synchronized successfully.', type: 'success' });
      onAccountsUpdated?.();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: `Sync all failed: ${err.message}`, type: 'error' });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDisconnect = async (accountId: number) => {
    try {
      await window.gameHub?.accounts?.disconnect(accountId);
      await loadAccounts();
      setMessage({
        text: 'Account disconnected. Cached available library cleared (local installs kept).',
        type: 'info',
      });
      onAccountsUpdated?.();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: `Failed to disconnect: ${err.message}`, type: 'error' });
    }
  };

  const handleReconnect = async (accountId: number) => {
    try {
      await window.gameHub?.accounts?.reconnect(accountId);
      await loadAccounts();
      setMessage({ text: 'Account reconnected and synchronized.', type: 'success' });
      onAccountsUpdated?.();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: `Failed to reconnect: ${err.message}`, type: 'error' });
    }
  };

  const handleAddFriend = async (friendData: {
    displayName: string;
    externalAccountId: string;
    avatarUrl?: string;
  }) => {
    try {
      setLoading(true);
      setMessage({ text: `Adding ${friendData.displayName}...`, type: 'info' });
      await window.gameHub?.accounts?.addFriend({
        launcher: 'STEAM',
        displayName: friendData.displayName,
        externalAccountId: friendData.externalAccountId,
        avatarUrl: friendData.avatarUrl,
      });
      await loadAccounts();
      setMessage({
        text: `Connected ${friendData.displayName}'s shared library.`,
        type: 'success',
      });
      setShowAddFriend(false);
      setFriendName('');
      setFriendSteamId('');
      onAccountsUpdated?.();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: `Failed to add friend: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccountSyncUninstalled = async (accountId: number) => {
    const current = syncUninstalledMap[accountId] ?? true;
    const next = !current;
    setSyncUninstalledMap((prev) => ({ ...prev, [accountId]: next }));
    await window.gameHub?.settings?.set(`account_${accountId}_sync_uninstalled`, next);
    await handleSync(accountId);
  };

  const handleToggleGrouping = async () => {
    const next = !groupingEnabled;
    setGroupingEnabled(next);
    await window.gameHub?.settings?.set('group_across_accounts', next);
    onAccountsUpdated?.();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white font-['Outfit'] tracking-tight">
                Launcher Accounts & Multi-Account Sync
              </h3>
              <p className="text-xs text-zinc-400 font-mono">
                Connect multiple accounts per launcher • Secure OS storage • Unified library
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner Alert if any */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 border-b ${
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : message.type === 'error'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : message.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Top Actions & Settings */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-800/40 border border-zinc-800">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-teal-400" />
              <div>
                <span className="text-xs font-bold text-white block">
                  Group games across launchers & accounts
                </span>
                <span className="text-[11px] text-zinc-400">
                  {groupingEnabled
                    ? 'Unified canonical cards showing ownership badges'
                    : 'Split individual cards per launcher/account'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleGrouping}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                groupingEnabled
                  ? 'bg-teal-500 text-zinc-950 shadow-md shadow-teal-500/20'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {groupingEnabled ? 'Grouping ON' : 'Grouping OFF'}
            </button>
          </div>

          {/* Account Discovery & Sync All Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
              Connected Accounts ({accounts.length})
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAddFriend(!showAddFriend)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  showAddFriend
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Friend Library</span>
              </button>
              <button
                type="button"
                onClick={handleDiscover}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>Auto-Detect</span>
              </button>
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncingAll || loading || accounts.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold transition-all disabled:opacity-50 shadow-md shadow-teal-500/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                <span>Sync All</span>
              </button>
            </div>
          </div>

          {/* Add Friend / Shared Family Library Panel */}
          {showAddFriend && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider">
                    Add Friend or Family Shared Library
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFriend(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Detected Steam Friends quick-add */}
              {detectedFriends.filter((f) => !accounts.some((a) => a.externalAccountId === f.steamId))
                .length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-zinc-400 block font-mono">
                    Detected Steam Friends on this PC:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {detectedFriends
                      .filter((f) => !accounts.some((a) => a.externalAccountId === f.steamId))
                      .map((friend) => (
                        <button
                          key={friend.steamId}
                          type="button"
                          onClick={() =>
                            handleAddFriend({
                              displayName: friend.personaName,
                              externalAccountId: friend.steamId,
                              avatarUrl: friend.avatarUrl,
                            })
                          }
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-amber-500/20 border border-zinc-700/80 hover:border-amber-500/40 text-zinc-200 hover:text-amber-200 transition-all text-xs font-medium group"
                        >
                          {friend.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt=""
                              className="w-4 h-4 rounded-full ring-1 ring-zinc-700"
                            />
                          ) : (
                            <Users className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-300" />
                          )}
                          <span>{friend.personaName}</span>
                          <span className="text-[10px] text-amber-400/80 font-mono font-bold">+ Connect</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Manual Input Form */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1 border-t border-zinc-800/80">
                <input
                  type="text"
                  placeholder="Friend Name (e.g. JackedJoker)"
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder="SteamID64 (e.g. 76561199547397057)"
                  value={friendSteamId}
                  onChange={(e) => setFriendSteamId(e.target.value)}
                  className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={!friendSteamId.trim() || loading}
                  onClick={() =>
                    handleAddFriend({
                      displayName: friendName.trim() || `Steam Friend (${friendSteamId.slice(-4)})`,
                      externalAccountId: friendSteamId.trim(),
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-sm transition-all disabled:opacity-40"
                >
                  Connect
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>
                  Tip: Games installed on this PC from this friend will auto-link. To sync uninstalled games from remote friends, configure a Steam Web API key in Settings.
                </span>
              </div>
            </div>
          )}

          {/* Accounts List */}
          {accounts.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-zinc-800/20 border border-zinc-800 space-y-3">
              <ShieldCheck className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-300">No launcher accounts connected yet</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Click &quot;Auto-Detect&quot; to scan for existing local Steam and Epic logins on this PC.
              </p>
              <button
                type="button"
                onClick={handleDiscover}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all"
              >
                Auto-Detect Local Accounts
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((acc) => {
                const isConnected = acc.connectionStatus === 'CONNECTED';
                const isSyncing = syncingId === acc.id || acc.syncStatus === 'SYNCING';

                return (
                  <div
                    key={acc.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isConnected
                        ? 'bg-zinc-800/40 border-zinc-700/60'
                        : 'bg-zinc-900/60 border-zinc-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Account Identity */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                            acc.launcher === 'STEAM'
                              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              : acc.launcher === 'EPIC'
                              ? 'bg-zinc-700 text-zinc-200 border border-zinc-600'
                              : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          }`}
                        >
                          {acc.launcher.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{acc.displayName}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                              {acc.launcher}
                            </span>
                            {isConnected ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Connected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-semibold">
                                <Unlink className="w-3 h-3" /> Disconnected
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-0.5">
                            <span className="font-mono">ID: {acc.externalAccountId}</span>
                            {acc.lastSyncedAt && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-500" />
                                Synced {new Date(acc.lastSyncedAt).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          {isConnected && (
                            <label className="inline-flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={syncUninstalledMap[acc.id] ?? true}
                                onChange={() => handleToggleAccountSyncUninstalled(acc.id)}
                                className="w-3.5 h-3.5 accent-teal-500 rounded cursor-pointer"
                              />
                              <span className="text-[11px] text-zinc-400 hover:text-zinc-200">
                                Include uninstalled games (uncheck if this account only borrows games)
                              </span>
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSync(acc.id)}
                              disabled={isSyncing}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
                              title="Sync library entries for this account"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-400' : ''}`} />
                              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDisconnect(acc.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                              title="Disconnect account (removes cached available entries, preserves installed games)"
                            >
                              <Unlink className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReconnect(acc.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 transition-all"
                          >
                            <Link className="w-3.5 h-3.5" />
                            <span>Reconnect</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Tokens protected with OS-level secure encryption. Plaintext passwords never stored.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
