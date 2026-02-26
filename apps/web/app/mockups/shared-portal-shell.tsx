'use client';

import React, { useEffect, useState } from 'react';
import { Menu, X, Bell, User, LogOut, ChevronLeft, Activity, RefreshCw } from 'lucide-react';
import { cn } from './shared-ui';

// ------------------------------------------------------------------
// Internal Premium Sidebar Item
// ------------------------------------------------------------------
const SidebarItem = ({
  icon: Icon,
  label,
  active = false,
  onClick,
  dark = true,
  compact = false
}: {
  icon: any;
  label: string;
  active?: boolean;
  onClick: () => void;
  dark?: boolean;
  compact?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium mb-1',
        active
          ? cn(dark ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5' : 'bg-white text-slate-900 shadow-md border border-slate-100')
          : cn(dark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'),
        compact && 'justify-center px-0'
      )}
      title={label}
    >
      <Icon size={20} className={cn(active ? (dark ? 'text-blue-400' : 'text-blue-600') : (dark ? 'text-slate-500' : 'text-slate-400'))} />
      {!compact && <span>{label}</span>}
      {!compact && active && (
        <div className={cn('ml-auto w-1.5 h-1.5 rounded-full', dark ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]' : 'bg-blue-600')} />
      )}
    </button>
  );
};

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
type SidebarMenuItem = {
  key: string;
  kind?: 'item';
  label: string;
  icon: any;
  onClick: () => void;
  active: boolean;
  role?: string;
};

type SidebarSectionItem = {
  key: string;
  kind: 'section';
  label: string;
  role?: string;
};

type SidebarItemType = SidebarMenuItem | SidebarSectionItem;

type SharedPortalShellProps = {
  // Legacy slots (optional overrides)
  sidebar?: React.ReactNode;
  header?: React.ReactNode;

  // Content
  children: React.ReactNode;
  overlays?: React.ReactNode;
  mobileOverlay?: React.ReactNode;

  // Styles
  rootClassName?: string;
  mainClassName?: string;
  contentClassName?: string;
  contentWrapperClassName?: string;
  sidebarClassName?: string;
  headerClassName?: string;

  // Premium / Auto-layout props
  tenantName?: string;
  userName?: string;
  userRole?: string;
  avatarImg?: string;
  avatarText?: string;
  sidebarItems?: SidebarItemType[];
  onLogout?: () => void;
  loading?: boolean;
  dark?: boolean; // Controls theme
  themeToggle?: () => void;
};

type ThemeTone = 'white' | 'light-blue' | 'dark-blue' | 'cyber-purple';

function ThemeToneSwatches({
  selected,
  onSelect,
  dark,
}: {
  selected: ThemeTone;
  onSelect: (tone: ThemeTone) => void;
  dark: boolean;
}) {
  const swatches: Array<{ key: ThemeTone; label: string; fill: string; ring: string }> = [
    { key: 'white', label: 'Branco', fill: 'bg-white', ring: 'ring-slate-300/80' },
    { key: 'light-blue', label: 'Azul claro', fill: 'bg-[#2754d6]', ring: 'ring-blue-600/80' },
    { key: 'dark-blue', label: 'Azul escuro', fill: 'bg-[#1e3a8a]', ring: 'ring-blue-500/70' },
    { key: 'cyber-purple', label: 'Roxo Cyber', fill: 'bg-[#7c3aed]', ring: 'ring-fuchsia-400/90' },
  ];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border p-1',
        dark ? 'border-blue-400/20 bg-blue-500/10' : 'border-blue-200 bg-blue-50'
      )}
    >
      {swatches.map((sw) => {
        const active = selected === sw.key;
        return (
          <button
            key={sw.key}
            type="button"
            onClick={() => onSelect(sw.key)}
            title={sw.label}
            className={cn(
              'h-5 w-5 rounded-[6px] border transition-all',
              sw.fill,
              dark ? 'border-white/15' : 'border-slate-300/70',
              active
                ? cn('ring-2 scale-100', sw.ring)
                : 'opacity-70 hover:opacity-100'
            )}
            aria-label={sw.label}
            aria-pressed={active}
          />
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------
// Main Shell Component
// ------------------------------------------------------------------
export function SharedPortalShell({
  sidebar,
  header,
  children,
  overlays,
  mobileOverlay,
  rootClassName,
  mainClassName,
  contentClassName,
  contentWrapperClassName,
  sidebarClassName,
  headerClassName,

  tenantName = 'Ajust ERP',
  userName = 'Usuario',
  userRole = 'manager',
  avatarImg,
  avatarText,
  sidebarItems = [],
  onLogout,
  loading = false,
  dark = true,
  themeToggle,
}: SharedPortalShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [lastLightTone, setLastLightTone] = useState<'white' | 'light-blue' | 'cyber-purple'>(() => {
    if (typeof window === 'undefined') return 'light-blue';
    const saved = window.localStorage.getItem('erp-light-tone');
    if (saved === 'white') return 'white';
    if (saved === 'cyber-purple') return 'cyber-purple';
    return 'light-blue';
  });
  const [themeTone, setThemeTone] = useState<ThemeTone>(dark ? 'dark-blue' : lastLightTone);

  useEffect(() => {
    if (dark) {
      setThemeTone('dark-blue');
      return;
    }
    setThemeTone(lastLightTone);
  }, [dark, lastLightTone]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('erp-light-tone', lastLightTone);
  }, [lastLightTone]);

  const onSelectThemeTone = (tone: ThemeTone) => {
    if (tone === 'dark-blue') {
      setThemeTone('dark-blue');
      if (!dark) themeToggle?.();
      return;
    }
    setThemeTone(tone);
    setLastLightTone(tone);
    if (dark) themeToggle?.();
  };

  // Default Header Implementation
  const DefaultHeader = (
    <header className={headerClassName || cn(
      'h-16 border-b px-4 md:px-6 flex items-center justify-between transition-colors duration-300 z-20',
      dark ? 'bg-[#0f172a]/60 backdrop-blur-xl border-slate-700/50 shadow-sm' : 'bg-white/80 backdrop-blur-md border-slate-200 shadow-sm'
    )}>
      <div className="flex items-center gap-4">
        <button onClick={() => setMobileOpen(true)} className={cn("md:hidden p-2 rounded-lg transition-colors", dark ? "hover:bg-white/5 text-slate-400" : "hover:bg-slate-100 text-slate-600")}>
          <Menu size={20} />
        </button>
        <button onClick={() => setSidebarCompact(!sidebarCompact)} className={cn("hidden md:flex p-2 rounded-lg transition-colors", dark ? "hover:bg-white/5 text-slate-400" : "hover:bg-slate-100 text-slate-600")}>
          <Menu size={20} />
        </button>

        {/* Breadcrumbs / Title */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className={cn(dark ? 'text-slate-500' : 'text-slate-400')}>Portal</span>
          <span className={cn(dark ? 'text-slate-600' : 'text-slate-300')}>/</span>
          <span className={cn('font-medium', dark ? 'text-slate-300' : 'text-slate-700')}>{tenantName}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        {themeToggle && (
          <div className="inline-flex items-center gap-2">
            <ThemeToneSwatches selected={themeTone} onSelect={onSelectThemeTone} dark={dark} />
          </div>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
              dark
                ? 'border-rose-500/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
            )}
            title="Sair"
          >
            <LogOut size={14} />
            <span className="hidden md:inline">Sair</span>
          </button>
        )}

        <button className={cn("relative p-2 rounded-full transition-colors", dark ? "text-slate-400 hover:text-slate-200 hover:bg-white/5" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100")}>
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-transparent" />
        </button>

        <div className={cn("h-8 w-px mx-1", dark ? "bg-white/10" : "bg-slate-200")} />

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <div className={cn("text-sm font-medium leading-none", dark ? "text-slate-200" : "text-slate-800")}>{userName}</div>
            <div className={cn("text-[10px] uppercase font-bold mt-0.5", dark ? "text-slate-500" : "text-slate-500")}>{userRole.replace('_', ' ')}</div>
          </div>
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-offset-2",
            dark ? "bg-blue-600 text-white ring-offset-[#0f172a] ring-blue-500/30" : "bg-blue-100 text-blue-700 ring-offset-white ring-blue-100")}>
            {userName.substring(0, 2).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );

  // Default Sidebar Implementation
  const DefaultSidebarContent = (
    <div className="flex flex-col h-full">
      <div className={cn("h-16 flex items-center px-6 border-b", dark ? "border-slate-700/50" : "border-slate-200")}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Activity size={18} />
        </div>
        {(!sidebarCompact || mobileOpen) && <span className={cn("ml-3 font-bold text-lg tracking-tight", dark ? "text-white" : "text-slate-900")}>Ajust ERP</span>}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
        {(!sidebarCompact || mobileOpen) && <div className={cn("px-3 mb-2 text-[10px] font-bold uppercase tracking-wider", dark ? "text-slate-500" : "text-slate-400")}>Menu Principal</div>}
        <div className="space-y-1">
          {sidebarItems.map((item) => {
            if (item.kind === 'section') {
              if (sidebarCompact && !mobileOpen) return null;
              return (
                <div
                  key={item.key}
                  className={cn(
                    'px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em]',
                    dark ? 'text-blue-400/60' : 'text-slate-400'
                  )}
                >
                  {item.label}
                </div>
              );
            }

            return (
              <SidebarItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                onClick={item.onClick}
                active={item.active}
                dark={dark}
                compact={sidebarCompact && !mobileOpen}
              />
            );
          })}
        </div>
      </div>

      <div className={cn("p-4", dark ? "" : "border-t border-slate-200")}>
        <div className={cn("p-3 rounded-xl flex items-center gap-3", dark ? "bg-[#161b22] border border-white/5" : "bg-white border border-slate-200 shadow-sm")}>
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0", dark ? "bg-white/10" : "bg-slate-100")}>
            {avatarImg ? (
              <img src={avatarImg} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className={cn("w-full h-full flex items-center justify-center text-[10px] font-bold uppercase", dark ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700")}>
                {avatarText || userName.substring(0, 3)}
              </div>
            )}
          </div>

          {(!sidebarCompact || mobileOpen) && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className={cn("text-xs font-bold truncate", dark ? "text-white" : "text-slate-900")}>{userName}</p>
              <p className={cn("text-[10px]", dark ? "text-slate-500" : "text-slate-400")}>{userRole.replace('_', ' ')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const DefaultSidebar = (
    <>
      {/* Desktop Sidebar */}
      <aside className={sidebarClassName || cn(
        "hidden md:flex flex-col border-r transition-all duration-300 z-30",
        dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 shadow-lg" : "bg-white border-slate-200",
        sidebarCompact ? "w-20" : "w-64"
      )}>
        {DefaultSidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className={cn(
            "absolute left-0 top-0 h-full w-72 shadow-2xl transition-transform duration-300",
            dark ? "bg-[#0f172a] border-r border-slate-700/50" : "bg-white border-r border-slate-200"
          )}>
            {DefaultSidebarContent}
          </aside>
        </div>
      )}
    </>
  );

  const ActualSidebar = sidebar || DefaultSidebar;
  const ActualHeader = header || DefaultHeader;

  return (
    <div
      data-erp-tone={dark ? 'dark-blue' : themeTone}
      className={
        rootClassName ||
        cn(
          'h-screen overflow-hidden font-sans transition-colors duration-300 relative',
          dark
            ? 'erp-tone-dark bg-[#0b1220] text-slate-300'
            : themeTone === 'white'
              ? 'erp-tone-white bg-slate-50 text-slate-900'
              : themeTone === 'cyber-purple'
                ? 'erp-tone-cyber-purple bg-[#221736] text-slate-100'
                : 'erp-tone-light-blue bg-[#adc2f2] text-slate-900'
        )
      }
    >
      {/* Ambient Background Glows */}
      {dark && !rootClassName?.includes('bg-') && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/16 blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/12 blur-[120px] mix-blend-screen" />
          <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 blur-[100px] mix-blend-screen" />
        </div>
      )}

      <div className="flex h-full relative z-10">
        {ActualSidebar}

        <div className={contentWrapperClassName || "flex-1 flex flex-col overflow-hidden relative"}>
          {ActualHeader}

          <main className={mainClassName || cn("flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10", dark ? "bg-transparent" : "bg-slate-50/50")}>
            <div className={contentClassName || "max-w-[1600px] mx-auto"}>
              {children}
            </div>
          </main>
        </div>
      </div>

      {overlays}
    </div>
  );
}
