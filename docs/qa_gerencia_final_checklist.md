# QA Final - Gerencia (Slot 4)

Data de validacao: 23/02/2026
Ambiente: `http://SERVIDOR_IP:8070`

## Validacoes automatizadas

- `pnpm --filter @ajust/web typecheck` -> OK
- `pnpm --filter @ajust/web build` -> OK
- `pnpm test:e2e` (API) -> OK
- `pnpm test:web` (smoke web por perfil) -> OK

## Fluxos cobertos no smoke web

- Login publico em `/login`
- Bloqueio de rota protegida sem sessao (`/gerencia` -> 307)
- Login gerente + abertura `/gerencia`
- Login analista + abertura `/analista`
- Login cliente (CNPJ + 4 ultimos digitos) + abertura `/cliente`
- Validacao de assets `/_next/static/*` apos render de cada pagina
- Logout via `/api/auth/logout`

## Checklist manual (UI)

- [ ] Tema claro/escuro nas abas da gerencia (Visao, Ordens, Tecnicos, Provedores, SLA, Relatorios, Tenants, Configuracoes)
- [ ] Responsivo em largura de tablet/celular nas telas da gerencia
- [ ] Navegacao no sidebar sem inconsistencias visuais
- [ ] Modais de tenant/usuario abrindo e fechando sem overflow quebrado
- [ ] Exportacao em Relatorios (CSV e Excel CSV UTF-8)

## Observacao tecnica

Para evitar pagina branca por conflito de artefatos, o Next foi configurado com `distDir` separado:
- dev: `.next-dev`
- build/prod: `.next`

Arquivo: `apps/web/next.config.mjs`
