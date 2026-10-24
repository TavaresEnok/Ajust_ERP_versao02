'use client';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { PasswordGenerator } from './password-generator';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  HelpCircle,
  ChevronsUpDown,
  Command,
  ArrowUpRight,
  CheckCheck,
  Headphones,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { getPortalNavigation, getPage, portalItems } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Brand, Avatar } from './primitives';
import { useAppTheme } from '@/components/theme-provider';
import { useErp } from '@/lib/erp/gateway';
import { TenantLogo, useTenantIdentity } from './tenant-identity';
export function AppShell({ children }: { children: ReactNode }) {
  const { dark, ready, toggle } = useAppTheme();
  const path = usePathname();
  const originalPage = getPage(path);
  const { scope, transport } = useErp();
  const portalNavigation = getPortalNavigation(path, scope?.role);
  const scopedCustomer = scope?.role === 'cliente' && !!scope.customerId;
  const navigation = scopedCustomer
    ? portalNavigation
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const section = item.path.split('/')[2];
            return !section || ['ordens', 'agenda', 'notas', 'seguranca'].includes(section);
          }),
        }))
        .filter((group) => group.items.length)
    : portalNavigation;
  const identity = useTenantIdentity();
  const name = identity.name || (scope ? 'Usuário autenticado' : 'Prévia sem sessão');
  const tenantName = identity.tenantName || (scope ? 'Empresa autenticada' : 'Ajust Tecnologia');
  const base =
    path.startsWith('/cliente') || path.startsWith('/portal')
      ? '/cliente'
      : path.startsWith('/analista')
        ? '/analista'
        : '/gerencia';
  const visibleItems = navigation.flatMap((group) => group.items);
  const page =
    visibleItems.find((item) => item.path === path) ||
    visibleItems.find((item) => item.path !== base && path.startsWith(item.path + '/')) ||
    originalPage;
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notifications, setNotifications] = useState(false);
  const [read, setRead] = useState(false);
  const [profile, setProfile] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const results = [
    ...navigation.flatMap((group) => group.items),
    ...(scope?.role === 'analista' ? [] : portalItems),
  ].filter((n) =>
    (n.title + ' ' + n.description)
      .toLocaleLowerCase('pt-BR')
      .includes(query.toLocaleLowerCase('pt-BR')),
  );
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-card focus:p-3"
      >
        Pular para o conteúdo
      </a>
      {mobile && (
        <button
          className="mobile-overlay"
          onClick={() => setMobile(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside className={cn('sidebar', mobile && 'is-open')}>
        <div className="px-6 pt-6 pb-5">
          <Link href={base} aria-label="Ajust ERP início">
            <Brand />
          </Link>
        </div>
        <div className="mx-4 mb-1">
          <button
            className="flex w-full items-center gap-2.5 rounded-lg border border-border p-2.5 text-left"
            onClick={() => setProfile((v) => !v)}
          >
            <TenantLogo name={tenantName} />
            <span className="flex-1">
              <span className="block text-[11px] font-semibold">{tenantName}</span>
              <span className="block text-[10px] text-muted-foreground">Workspace principal</span>
            </span>
            <ChevronsUpDown className="size-3 text-muted-foreground" />
          </button>
        </div>
        <nav
          className="flex-1 overflow-y-auto px-3 pb-5 [scrollbar-width:thin]"
          aria-label="Navegação principal"
        >
          {navigation.map((group) => {
            const links = group.items.map((item) => (
              <Fragment key={item.path}>
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobile(false)}
                  aria-current={page.path === item.path ? 'page' : undefined}
                  className={cn('nav-item', page.path === item.path && 'active')}
                >
                  <item.icon />
                  <span>{item.title}</span>
                  {item.count && <span className="nav-count">{item.count}</span>}
                </Link>
                {item.path.endsWith('/credenciais') && <PasswordGenerator />}
              </Fragment>
            ));
            return group.collapsible ? (
              <details
                key={group.label}
                className="group/nav"
                open={
                  group.items.some(
                    (item) => path === item.path || path.startsWith(item.path + '/'),
                  ) || undefined
                }
              >
                <summary className="nav-label flex cursor-pointer list-none items-center justify-between rounded-md focus-visible:outline-2 focus-visible:outline-primary">
                  {group.label}
                  <ChevronDown className="size-3 transition-transform group-open/nav:rotate-180" />
                </summary>
                {links}
              </details>
            ) : (
              <div key={group.label}>
                <p className="nav-label">{group.label}</p>
                {links}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border px-3 pt-2 pb-3">
          <button className="nav-item w-full" onClick={() => setHelp(true)}>
            <HelpCircle />
            <span>Central de ajuda</span>
            <ArrowUpRight className="ml-auto" />
          </button>
          <div className="mt-1 flex items-center gap-2.5 rounded-lg bg-muted/70 px-3 py-2.5">
            <span
              className={cn(
                'size-1.5 rounded-full',
                scope && transport ? 'bg-success' : 'bg-warning',
              )}
            />
            <span className="text-[10px] text-muted-foreground">
              {scope && transport ? 'ERP conectado à sessão' : 'ERP original não conectado'}
            </span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobile(true)} className="md:hidden" aria-label="Abrir menu">
              <Menu className="size-5" />
            </button>
            <span className="hidden text-xs text-muted-foreground sm:block">Workspace</span>
            <ChevronRight className="hidden size-3 text-muted-foreground sm:block" />
            <span className="truncate text-[11px] font-medium">{page.title}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="header-search flex w-[225px] items-center gap-2 rounded-md border border-border bg-muted/35 px-2.5 py-2 text-[11px] text-muted-foreground"
            >
              <Search className="size-3.5" />
              Buscar no Ajust...
              <span className="ml-auto flex items-center gap-0.5 rounded border border-border bg-card px-1 text-[9px]">
                <Command className="size-2.5" />K
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!ready}
              onClick={toggle}
              aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
            <button
              className="relative p-1.5 text-muted-foreground"
              aria-label="Abrir notificações"
              onClick={() => setNotifications(true)}
            >
              <Bell className="size-[18px]" strokeWidth={1.6} />
              {!read && (
                <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full border border-card bg-warning" />
              )}
            </button>
            <span className="h-6 border-l border-border" />
            <button
              className="flex items-center gap-2.5 text-left"
              onClick={() => setProfile((v) => !v)}
              aria-expanded={profile}
              aria-label="Menu do perfil"
            >
              <Avatar name={name} className="size-8 bg-secondary text-primary" />
              <span className="hidden sm:block">
                <span className="block text-[11px] font-medium">{name}</span>
                <span className="block text-[9px] text-muted-foreground">
                  {scope?.role || 'Frontend em desenvolvimento'}
                </span>
              </span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </div>
        </header>
        {profile && (
          <div className="absolute top-[65px] right-5 z-40 flex w-60 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-lg">
            <p className="px-3 py-2 text-[10px] text-muted-foreground">
              Visualizar espaços de trabalho
            </p>
            {portalItems.slice(0, 2).map((p) => (
              <Link
                className="nav-item"
                key={p.path}
                href={p.path}
                onClick={() => setProfile(false)}
              >
                <p.icon />
                {p.title}
              </Link>
            ))}
            <Link
              href={`${base}/configuracoes`}
              className="nav-item"
              onClick={() => setProfile(false)}
            >
              Preferências do perfil
              <ChevronRight className="ml-auto" />
            </Link>
            <button
              type="button"
              className="nav-item w-full"
              onClick={async () => {
                setProfile(false);
                await fetch('/api/session/logout', {
                  method: 'POST',
                  credentials: 'same-origin',
                }).catch(() => undefined);
                window.location.assign('/login');
              }}
            >
              <LogOut />
              Sair
            </button>
          </div>
        )}
        <main id="main-content" className="page-body">
          {children}
          <footer className="footer">
            <span>© 2026 Ajust Tecnologia. Feito para conectar sua operação.</span>
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-success" />
              {scope && transport ? 'Sessão do ERP' : 'Frontend · backend não conectado'}
              <span className="mx-1">·</span>v2.0
            </span>
          </footer>
        </main>
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>O que você procura?</DialogTitle>
            <DialogDescription>Navegue rapidamente pelas áreas do Ajust ERP.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label="Buscar páginas"
            placeholder="Buscar páginas, módulos e ferramentas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-80 overflow-auto">
            {results.length ? (
              results.map((n) => (
                <Link
                  key={n.path}
                  href={n.path}
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery('');
                  }}
                  className="nav-item"
                >
                  <n.icon />
                  <span>{n.title}</span>
                  <ChevronRight className="ml-auto" />
                </Link>
              ))
            ) : (
              <p className="p-5 text-center text-muted-foreground">Nenhuma página encontrada.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={notifications} onOpenChange={setNotifications}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seu centro de notificações</DialogTitle>
            <DialogDescription>
              Exemplos visuais do redesign, não mensagens recebidas do ERP. O contrato original não
              possui uma caixa de notificações por usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {scope ? (
              <p className="text-xs leading-6 text-muted-foreground">
                A caixa de entrada aguarda contrato do backend. Configure destinos e gatilhos na
                área Notificações.
              </p>
            ) : read ? (
              <p className="p-8 text-center text-muted-foreground">
                Você está em dia. Nenhuma notificação não lida.
              </p>
            ) : (
              [
                'A OS-2026-0840 precisa da sua atenção. O prazo de SLA está próximo.',
                'Camila Santos concluiu a OS-2026-0837.',
                'Você tem 5 compromissos agendados para hoje.',
              ].map((n, i) => (
                <Link
                  key={n}
                  href={i === 2 ? '/gerencia/agenda' : '/gerencia/ordens/OS-2026-0840'}
                  onClick={() => setNotifications(false)}
                  className="flex gap-3 rounded-lg bg-muted p-4"
                >
                  <Bell className="size-4 shrink-0 text-primary" />
                  <span className="text-xs leading-relaxed">{n}</span>
                </Link>
              ))
            )}
            <Button variant="outline" disabled={!!scope} onClick={() => setRead(true)}>
              <CheckCheck data-icon="inline-start" />
              Marcar todas como lidas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Como podemos ajudar?</DialogTitle>
            <DialogDescription>Encontre guias e informações para usar o Ajust.</DialogDescription>
          </DialogHeader>
          <Link href="/analista/ajustpedia" onClick={() => setHelp(false)} className="nav-item">
            <Headphones />
            Explorar a Ajustpedia
            <ChevronRight className="ml-auto" />
          </Link>
          <p className="rounded-lg bg-secondary p-4 text-xs leading-relaxed text-primary">
            O redesign é a interface operacional do Ajust ERP. Os formulários utilizam os contratos
            originais e aguardam o transporte e a sessão do backend. Uma rota ou menu não substitui
            autorização no servidor.
          </p>
        </DialogContent>
      </Dialog>
      <Toaster position="bottom-right" richColors theme={dark ? 'dark' : 'light'} />
    </>
  );
}
