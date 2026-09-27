import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Key,
  ShieldCheck,
  Users,
  Gamepad2,
  HardDrive,
  RefreshCw,
  FolderPlus,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { PageRoute } from '../types/Navigation';

interface HelpProps {
  onNavigate?: (page: PageRoute) => void;
  onOpenAccounts?: () => void;
}

interface GuideSection {
  id: string;
  title: string;
  category: string;
  icon: React.ElementType;
  badge?: string;
  summary: string;
  content: React.ReactNode;
}

export const Help: React.FC<HelpProps> = ({ onNavigate, onOpenAccounts }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>('steam-api-guide');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const sections: GuideSection[] = useMemo(
    () => [
      {
        id: 'steam-api-guide',
        title: 'Steam Web API Key & Family Sharing',
        category: 'Integrations & Accounts',
        icon: Key,
        badge: 'Important',
        summary:
          'When you need an API key, what to enter for "Domain Name" (localhost), and privacy guarantees.',
        content: (
          <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
            {/* When is it needed? */}
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <h4 className="font-bold text-zinc-100 flex items-center gap-2 text-base">
                <Info className="w-4 h-4 text-amber-400" />
                When Do You Actually Need a Steam Web API Key?
              </h4>
              <p className="text-zinc-400 text-xs">
                Most users <strong className="text-zinc-200">do not need</strong> an API key. GameHub is built to work offline and locally:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No Key Needed (Automatic)</span>
                  </div>
                  <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                    <li>Any installed game on your PC</li>
                    <li>Any Steam account that has logged into this PC</li>
                    <li>Installed Family Shared games from friends</li>
                    <li>Epic Games, Xbox, GOG, and standalone games</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase font-mono">
                    <Key className="w-3.5 h-3.5" />
                    <span>When You Need a Key</span>
                  </div>
                  <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                    <li>
                      Discovering <strong>uninstalled games</strong> from remote friends who shared their library online
                    </li>
                    <li>Friends who have never physically logged their Steam account into your PC</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step by step guide */}
            <div className="space-y-4">
              <h4 className="font-bold text-zinc-100 text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                Step-by-Step: How to Generate Your Free Steam API Key
              </h4>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-surface-850 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 font-mono">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <span>Open Valve&apos;s Official Key Page</span>
                  </div>
                  <p className="text-xs text-zinc-400 pl-7">
                    Click the link below to open Valve&apos;s developer portal directly in your default browser (Chrome, Edge, etc.). You will see the verified <code className="text-zinc-200 font-mono">https://steamcommunity.com</code> URL.
                  </p>
                  <div className="pl-7 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        window.gameHub?.openExternal?.('https://steamcommunity.com/dev/apikey')
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-sm"
                    >
                      <span>Open Valve API Key Page ↗</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-850 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 font-mono">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span>What to Enter for &quot;Domain Name&quot;?</span>
                  </div>
                  <div className="pl-7 space-y-2 text-xs text-zinc-400">
                    <p>
                      Valve requires you to fill out a field labeled <strong>&quot;Domain Name&quot;</strong> before generating the key. Most users get confused here because they do not own a website.
                    </p>
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono block">
                          Enter this in the Domain Name box:
                        </span>
                        <code className="text-sm font-bold text-amber-300 font-mono">
                          localhost
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('localhost', 'domain')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                      >
                        {copiedKey === 'domain' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      <em>Why?</em> Valve designed this form for web developers, but for personal library fetching, <code className="text-zinc-300 font-mono">localhost</code> (or <code className="text-zinc-300 font-mono">local</code>) is the universal safe standard and does not affect your key in any way.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-850 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 font-mono">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px]">
                      3
                    </span>
                    <span>Paste Key into GameHub Settings</span>
                  </div>
                  <p className="text-xs text-zinc-400 pl-7">
                    Valve will give you a 32-character hexadecimal key (e.g. <code className="text-zinc-300 font-mono">XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</code>). Copy it, return to GameHub <strong>Settings &gt; Library &gt; Steam Integration</strong>, and click <strong>Save Key</strong>.
                  </p>
                  <div className="pl-7 pt-1">
                    <button
                      type="button"
                      onClick={() => onNavigate?.('settings')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all border border-zinc-700"
                    >
                      <span>Go to Settings → Steam Integration</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy and Trust */}
            <div className="p-4 rounded-2xl bg-surface-900 border border-zinc-800 space-y-2.5">
              <h4 className="font-bold text-emerald-400 flex items-center gap-2 text-xs uppercase tracking-wider font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Security & Trust Guarantee</span>
              </h4>
              <ul className="text-xs text-zinc-400 space-y-1.5">
                <li>
                  • <strong className="text-zinc-200">Zero Passwords:</strong> GameHub never prompts for or stores your Steam password or 2FA Steam Guard codes.
                </li>
                <li>
                  • <strong className="text-zinc-200">Read-Only Permission:</strong> The Steam Web API key is strictly read-only for public library lists. It cannot make purchases, trade inventory items, or alter your account.
                </li>
                <li>
                  • <strong className="text-zinc-200">Browser Isolation:</strong> Key generation occurs in your external default browser (Chrome / Edge / Firefox) completely sandboxed away from GameHub.
                </li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'getting-started',
        title: 'Getting Started & Library Discovery',
        category: 'Overview & Basics',
        icon: Sparkles,
        summary:
          'How GameHub automatically finds games across Steam, Epic, Xbox, GOG, and custom drives.',
        content: (
          <div className="space-y-5 text-sm text-zinc-300 leading-relaxed">
            <p className="text-zinc-400 text-xs">
              GameHub is a unified desktop game launcher shell designed to aggregate all your PC games into one lightning-fast, beautiful library with zero configuration.
            </p>

            <div className="space-y-3">
              <h4 className="font-bold text-zinc-100 text-sm">Supported Launchers & Detection</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-surface-850 border border-zinc-800 space-y-1">
                  <div className="font-bold text-teal-400">Steam (Local & Shared)</div>
                  <p className="text-zinc-400 text-[11px]">
                    Reads <code className="text-zinc-300 font-mono">libraryfolders.vdf</code> and <code className="text-zinc-300 font-mono">appmanifest_*.acf</code> across all local Steam library drives.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-850 border border-zinc-800 space-y-1">
                  <div className="font-bold text-teal-400">Epic Games Store</div>
                  <p className="text-zinc-400 text-[11px]">
                    Reads manifests in <code className="text-zinc-300 font-mono">%ProgramData%\Epic\EpicGamesLauncher\Data\Manifests</code>.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-850 border border-zinc-800 space-y-1">
                  <div className="font-bold text-teal-400">Xbox / Microsoft Store</div>
                  <p className="text-zinc-400 text-[11px]">
                    Scans Windows PC Gaming packages and Xbox Game Pass installations on Windows drives.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-850 border border-zinc-800 space-y-1">
                  <div className="font-bold text-teal-400">GOG, Ubisoft, EA & Custom</div>
                  <p className="text-zinc-400 text-[11px]">
                    Detects games registered in the Windows registry, or added manually via the <code className="text-zinc-300 font-mono">+ Add Game</code> button.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-850 border border-zinc-800 space-y-2 text-xs">
              <h4 className="font-bold text-zinc-100 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                <span>The Rescan Button</span>
              </h4>
              <p className="text-zinc-400">
                Whenever you install or uninstall a game in Steam or Epic, click the <strong>Rescan</strong> button in the top bar (or press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">F5</kbd>) to instantly update your library without restarting the application.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'multi-account',
        title: 'Multi-Account & Family Sharing Management',
        category: 'Integrations & Accounts',
        icon: Users,
        summary:
          'How GameHub credits games to their true owners, filters libraries, and resolves shared titles.',
        content: (
          <div className="space-y-5 text-sm text-zinc-300 leading-relaxed">
            <p className="text-zinc-400 text-xs">
              If your PC is shared between family members or you borrow libraries from friends (such as Steam Family Sharing), GameHub automatically distinguishes who owns which game.
            </p>

            <div className="space-y-3">
              <h4 className="font-bold text-zinc-100 text-sm">Key Features</h4>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold">1.</span>
                  <div>
                    <strong className="text-zinc-200">Accurate Ownership Crediting:</strong> Games owned by family members (e.g. KhatarnakIshan or JackedJoker) are strictly assigned to their account, preventing borrower accounts from falsely claiming them.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold">2.</span>
                  <div>
                    <strong className="text-zinc-200">Account Switcher & Picker:</strong> If more than one account on your PC owns a game, clicking Play or Install prompts an account picker modal so you can launch under your desired profile.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold">3.</span>
                  <div>
                    <strong className="text-zinc-200">Filtering By Account:</strong> Use the collapsible <strong>Accounts &amp; Family</strong> section in the sidebar, or click the <strong>Filter ▾</strong> button in the Library toolbar to view games for a specific family member.
                  </div>
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenAccounts}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold transition-all shadow-sm"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Open Accounts &amp; Family Manager</span>
              </button>
            </div>
          </div>
        ),
      },
      {
        id: 'controller-shortcuts',
        title: 'Controller & Keyboard Navigation',
        category: 'Controls & Accessibility',
        icon: Gamepad2,
        summary:
          'Full gamepad controls, Xbox/PlayStation navigation, and productivity keyboard shortcuts.',
        content: (
          <div className="space-y-5 text-sm text-zinc-300 leading-relaxed">
            <p className="text-zinc-400 text-xs">
              GameHub has native 10-foot controller support optimized for handhelds (Steam Deck, ROG Ally, Legion Go) and TV living-room setups.
            </p>

            <div className="space-y-3">
              <h4 className="font-bold text-zinc-100 text-sm">Controller Bindings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">D-Pad / Left Stick</span>
                  <span className="font-mono font-bold text-teal-300">Navigate Cards &amp; Tabs</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">A / Cross (✕)</span>
                  <span className="font-mono font-bold text-teal-300">Launch / Select Game</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">B / Circle (◯)</span>
                  <span className="font-mono font-bold text-teal-300">Back / Close Modal</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">X / Square (□)</span>
                  <span className="font-mono font-bold text-teal-300">Toggle Favorite</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">Y / Triangle (△)</span>
                  <span className="font-mono font-bold text-teal-300">Open Game Details</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">LB / RB (Bumpers)</span>
                  <span className="font-mono font-bold text-teal-300">Cycle Main Pages</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-zinc-100 text-sm">Keyboard Shortcuts</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">Global Search</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono text-zinc-200">
                    Ctrl + K
                  </kbd>
                </div>
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">Rescan Library</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono text-zinc-200">
                    F5
                  </kbd>
                </div>
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">Close Open Modal</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono text-zinc-200">
                    Esc
                  </kbd>
                </div>
                <div className="p-3 rounded-xl bg-surface-850 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">Open Settings</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono text-zinc-200">
                    Ctrl + ,
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'drives-missing',
        title: 'Drive Tracking & Missing Game Recovery',
        category: 'Storage & Drives',
        icon: HardDrive,
        summary:
          'What happens when USB drives unplug, and how to reconnect or locate moved games.',
        content: (
          <div className="space-y-5 text-sm text-zinc-300 leading-relaxed">
            <p className="text-zinc-400 text-xs">
              If you store games on external SSDs, USB hard drives, or microSD cards, GameHub automatically tracks which drive each game lives on.
            </p>

            <div className="space-y-3">
              <h4 className="font-bold text-zinc-100 text-sm">Removable Drives &amp; Missing Tab</h4>
              <div className="p-4 rounded-xl bg-surface-850 border border-zinc-800 space-y-2 text-xs text-zinc-400">
                <p>
                  When you unplug an external drive, GameHub does <strong>not</strong> delete your playtime or metadata. Instead, the games are marked as <strong>&quot;Missing / Moved&quot;</strong> and grouped under an amber badge.
                </p>
                <p>
                  As soon as you reconnect the drive, click <strong>Rescan</strong> and all games instantly return to active status.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-zinc-100 text-sm">Relocating a Game Manually</h4>
              <p className="text-xs text-zinc-400">
                If you manually moved a standalone or DRM-free game to a new directory, right-click the card (or click the three dots menu <code className="text-zinc-300 font-mono">⋮</code>) and select <strong>&quot;Locate Executable&quot;</strong> to point GameHub to the new file path.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'faq',
        title: 'FAQ & Troubleshooting',
        category: 'Support & FAQs',
        icon: HelpCircle,
        summary:
          'Answers to common questions, database backups, and tips for adding custom games.',
        content: (
          <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-surface-850 border border-zinc-800 space-y-1.5">
                <h5 className="font-bold text-zinc-100 text-xs">
                  Why are some remote family games not showing up even with an API key?
                </h5>
                <p className="text-zinc-400 text-xs">
                  Valve&apos;s Web API respects Steam privacy settings. If your friend&apos;s Steam profile or &quot;Game Details&quot; privacy setting is set to <em>Private</em> or <em>Friends Only</em>, Valve will not return their game list to third-party API keys. Ask your friend to set &quot;Game Details&quot; to <strong>Public</strong> in their Steam Privacy Settings.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-850 border border-zinc-800 space-y-1.5">
                <h5 className="font-bold text-zinc-100 text-xs">
                  How do I add games from itch.io, emulators, or custom installers?
                </h5>
                <p className="text-zinc-400 text-xs">
                  Click the <strong>+ Add Game</strong> button in the top bar. You can browse and select any <code className="text-zinc-300 font-mono">.exe</code> file on your computer. GameHub will automatically generate clean artwork and metadata for it.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-850 border border-zinc-800 space-y-1.5">
                <h5 className="font-bold text-zinc-100 text-xs">
                  Where is my data stored, and how do I back it up?
                </h5>
                <p className="text-zinc-400 text-xs">
                  All your metadata, categories, and statistics are stored in a fast local SQLite database located at <code className="text-zinc-300 font-mono">%APPDATA%\GameHub\gamehub.db</code>. You can back it up anytime in <strong>Settings &gt; Storage &amp; Backup &gt; Export Library Backup</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-850 border border-zinc-800 space-y-1.5">
                <h5 className="font-bold text-zinc-100 text-xs">
                  What is the &quot;Storage &amp; Backup&quot; section in Settings, and why would I use it?
                </h5>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  During everyday gaming, you never need to touch this section. GameHub manages all indexing and caching automatically. You only need it if:
                </p>
                <ul className="text-zinc-400 text-xs space-y-1 list-disc list-inside pt-1">
                  <li><strong>Moving PCs or Reinstalling Windows:</strong> Export a library backup so you can restore your tags, categories, and playtime instantly on the new machine.</li>
                  <li><strong>Freeing up SSD disk space:</strong> Clear the artwork cache if high-resolution covers and banners are taking up too much storage.</li>
                  <li><strong>Recovering after a crash:</strong> If your PC loses power or shuts down abruptly, click &quot;Repair &amp; Optimize Database&quot; to restore indexes and speed up searches.</li>
                  <li><strong>Troubleshooting errors:</strong> View <code className="text-zinc-300 font-mono">gamehub.log</code> to inspect launch errors or integration logs.</li>
                </ul>
              </div>
            </div>
          </div>
        ),
      },
    ],
    [onNavigate, onOpenAccounts, copiedKey]
  );

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q)
    );
  }, [sections, searchQuery]);

  const activeSection = useMemo(() => {
    return (
      sections.find((s) => s.id === activeSectionId) ||
      filteredSections[0] ||
      sections[0]
    );
  }, [sections, activeSectionId, filteredSections]);

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-teal-500/10 via-surface-850 to-surface-850 border border-zinc-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-mono font-bold uppercase tracking-wider">
              <BookOpen className="w-3 h-3" />
              <span>User Manual &amp; Knowledge Base</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Help &amp; Documentation
            </h1>
            <p className="text-xs text-zinc-400 max-w-xl">
              Everything you need to know about setting up integrations, family sharing, controllers, and managing your library.
            </p>
          </div>

          {/* Quick Search in Help */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-teal-500/60 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Main Content Layout: Sidebar Topics + Active Content Pane */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Navigation Topic List */}
        <div className="md:col-span-4 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono px-1">
            DOCUMENTATION TOPICS ({filteredSections.length})
          </span>
          <div className="space-y-1.5">
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection.id === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full text-left p-3.5 rounded-2xl transition-all flex items-start gap-3 border ${
                    isActive
                      ? 'bg-teal-500/10 border-teal-500/30 text-teal-300 shadow-md shadow-teal-500/5'
                      : 'bg-surface-850/80 hover:bg-zinc-800/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl flex-shrink-0 ${
                      isActive
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-zinc-100 truncate block">
                        {sec.title}
                      </span>
                      {sec.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold flex-shrink-0">
                          {sec.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-normal">
                      {sec.category}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 self-center flex-shrink-0 transition-transform ${
                      isActive ? 'text-teal-400 translate-x-0.5' : 'text-zinc-600'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Article Details View */}
        <div className="md:col-span-8 p-6 rounded-3xl bg-surface-850 border border-zinc-800 shadow-lg space-y-6">
          <div className="border-b border-zinc-800/80 pb-4 space-y-1">
            <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-widest">
              {activeSection.category}
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <activeSection.icon className="w-5 h-5 text-teal-400" />
              <span>{activeSection.title}</span>
            </h2>
            <p className="text-xs text-zinc-400 font-normal pt-0.5">
              {activeSection.summary}
            </p>
          </div>

          <div className="pt-1">{activeSection.content}</div>
        </div>
      </div>
    </div>
  );
};
