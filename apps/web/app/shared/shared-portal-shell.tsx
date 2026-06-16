'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from 'react';
import { Menu, Bell, LogOut, Activity } from 'lucide-react';
import { cn } from './shared-ui';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// ------------------------------------------------------------------
// Internal Premium Sidebar Item
// ------------------------------------------------------------------
const SidebarItem = ({
  icon: Icon,
  label,
  active = false,
  onClick,
  dark = true,
  compact = false,
}: {
  icon: IconComponent;
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
        'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-150 text-sm font-medium mb-1 min-h-10',
        active
          ? cn(
              dark
                ? 'bg-white/[0.07] text-white border border-white/10'
                : 'bg-white text-slate-900 shadow-sm border border-slate-100',
            )
          : cn(
              dark
                ? 'text-[var(--sidebar-text)] hover:text-white hover:bg-[var(--sidebar-hover)]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
            ),
        compact && 'justify-center px-0',
      )}
      title={label}
    >
      {active && !compact && (
        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--sidebar-accent)]" />
      )}
      <Icon
        size={19}
        className={cn(
          active
            ? dark
              ? 'text-[var(--sidebar-accent)]'
              : 'text-blue-600'
            : dark
              ? 'text-[var(--sidebar-text)]'
              : 'text-slate-400',
        )}
      />
      {!compact && <span>{label}</span>}
      {!compact && active && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--sidebar-accent)]" />
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
  icon: IconComponent;
  onClick?: () => void;
  active?: boolean;
  role?: string;
};

type SidebarSectionItem = {
  key: string;
  kind: 'section';
  label: string;
  role?: string;
};

type SidebarItemType = SidebarMenuItem | SidebarSectionItem;

export type ErpSidebarItemBase = SidebarItemType;

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
  brandName?: string;
  brandIcon?: IconComponent;
  sidebarItems?: SidebarItemType[];
  activeView?: string;
  onViewChange?: (view: string) => void;
  onLogout?: () => void;
  loading?: boolean;
  dark?: boolean; // Controls theme
  themeToggle?: () => void;
};

type ThemeTone = 'white' | 'dark-blue';

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
    { key: 'white', label: 'Claro', fill: 'bg-white', ring: 'ring-blue-500/80' },
    { key: 'dark-blue', label: 'Escuro', fill: 'bg-[#1e1e2e]', ring: 'ring-blue-400/80' },
  ];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border p-1',
        dark ? 'border-white/10 bg-white/5' : 'border-[var(--border-default)] bg-white shadow-sm',
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
              active ? cn('ring-2 scale-100', sw.ring) : 'opacity-70 hover:opacity-100',
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
  brandName = 'Ajust ERP',
  brandIcon: BrandIcon = Activity,
  sidebarItems = [],
  activeView,
  onViewChange,
  onLogout,
  loading = false,
  dark = true,
  themeToggle,
}: SharedPortalShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [lastLightTone, setLastLightTone] = useState<'white'>('white');
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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('erp-dark', dark);
    document.documentElement.setAttribute('data-erp-tone', dark ? 'dark-blue' : themeTone);
  }, [dark, themeTone]);

  const onSelectThemeTone = (tone: ThemeTone) => {
    if (tone === 'dark-blue') {
      setThemeTone('dark-blue');
      if (!dark) themeToggle?.();
      return;
    }
    setThemeTone('white');
    setLastLightTone('white');
    if (dark) themeToggle?.();
  };

  // Default Header Implementation
  const DefaultHeader = (
    <header
      className={
        headerClassName ||
        cn(
          'h-16 border-b px-4 md:px-6 flex items-center justify-between transition-colors duration-300 z-20',
          dark
            ? 'bg-[#1e1e2e] border-white/10 shadow-sm'
            : 'bg-white/90 backdrop-blur-md border-[var(--border-default)] shadow-sm',
        )
      }
    >
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMobileOpen(true)}
          className={cn(
            'md:hidden p-2 rounded-lg transition-colors',
            dark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-600',
          )}
        >
          <Menu size={20} />
        </button>
        <button
          onClick={() => setSidebarCompact(!sidebarCompact)}
          className={cn(
            'hidden md:flex p-2 rounded-lg transition-colors',
            dark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-600',
          )}
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumbs / Title */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className={cn(dark ? 'text-slate-500' : 'text-slate-400')}>Portal</span>
          <span className={cn(dark ? 'text-slate-600' : 'text-slate-300')}>/</span>
          <span className={cn('font-medium', dark ? 'text-slate-300' : 'text-slate-700')}>
            {tenantName}
          </span>
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
                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
            )}
            title="Sair"
          >
            <LogOut size={14} />
            <span className="hidden md:inline">Sair</span>
          </button>
        )}

        <button
          className={cn(
            'relative p-2 rounded-full transition-colors',
            dark
              ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
          )}
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-transparent" />
        </button>

        <div className={cn('h-8 w-px mx-1', dark ? 'bg-white/10' : 'bg-slate-200')} />

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <div
              className={cn(
                'text-sm font-medium leading-none',
                dark ? 'text-slate-200' : 'text-slate-800',
              )}
            >
              {userName}
            </div>
            <div
              className={cn(
                'text-[10px] uppercase font-bold mt-0.5',
                dark ? 'text-slate-500' : 'text-slate-500',
              )}
            >
              {userRole.replace('_', ' ')}
            </div>
          </div>
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-offset-2',
              dark
                ? 'bg-blue-600 text-white ring-offset-[#0f172a] ring-blue-500/30'
                : 'bg-blue-100 text-blue-700 ring-offset-white ring-blue-100',
            )}
          >
            {userName.substring(0, 2).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );

  // Default Sidebar Implementation
  const DefaultSidebarContent = (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <div className="w-8 h-8 rounded-[10px] bg-[var(--accent-600)] flex items-center justify-center text-white shadow-sm">
          <BrandIcon size={18} />
        </div>
        {(!sidebarCompact || mobileOpen) && (
          <span className="ml-3 font-semibold text-lg tracking-[-0.02em] text-white">
            {brandName}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
        {(!sidebarCompact || mobileOpen) && (
          <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--sidebar-section)]">
            Menu Principal
          </div>
        )}
        <div className="space-y-1">
          {sidebarItems.map((item) => {
            if (item.kind === 'section') {
              if (sidebarCompact && !mobileOpen) return null;
              return (
                <div
                  key={item.key}
                  className={cn(
                    'px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em]',
                    'text-[var(--sidebar-section)]',
                  )}
                >
                  {item.label}
                </div>
              );
            }

            const isActive = Boolean(item.active ?? (activeView && item.key === activeView));
            const handleItemClick =
              item.onClick ?? (onViewChange ? () => onViewChange(item.key) : undefined);

            return (
              <SidebarItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                onClick={handleItemClick || (() => undefined)}
                active={isActive}
                dark={true}
                compact={sidebarCompact && !mobileOpen}
              />
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="p-3 rounded-[14px] flex items-center gap-3 bg-white/[0.04] border border-white/10">
          <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0 bg-white/10 ring-1 ring-white/10">
            {avatarImg ? (
              <img src={avatarImg} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold uppercase bg-slate-700 text-white">
                {avatarText || userName.substring(0, 3)}
              </div>
            )}
          </div>

          {(!sidebarCompact || mobileOpen) && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-semibold truncate text-white">{userName}</p>
              <p className="text-[11px] text-[var(--sidebar-text)]">{userRole.replace('_', ' ')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const DefaultSidebar = (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={
          sidebarClassName ||
          cn(
            'hidden md:flex flex-col border-r transition-all duration-300 z-30',
            'bg-[var(--sidebar-bg)] border-white/10 shadow-lg',
            sidebarCompact ? 'w-20' : 'w-64',
          )
        }
      >
        {DefaultSidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className={cn(
              'absolute left-0 top-0 h-full w-72 shadow-2xl transition-transform duration-300',
              'bg-[var(--sidebar-bg)] border-r border-white/10',
            )}
          >
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
          'erp-product-shell h-screen overflow-hidden font-sans transition-colors duration-300 relative',
          dark
            ? 'erp-tone-dark bg-[#111827] text-slate-300'
            : 'erp-tone-white bg-[var(--bg-app)] text-[var(--text-primary)]',
        )
      }
    >
      <div className="flex h-full relative z-10">
        {ActualSidebar}

        <div className={contentWrapperClassName || 'flex-1 flex flex-col overflow-hidden relative'}>
          {ActualHeader}

          <main
            className={
              mainClassName ||
              cn(
                'flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10',
                dark ? 'bg-transparent' : 'bg-[var(--bg-app)]',
              )
            }
          >
            <div className={contentClassName || 'max-w-[1600px] mx-auto'}>{children}</div>
          </main>
        </div>
      </div>

      {overlays}
    </div>
  );
}
