# QA Final - Area do Analista

## Escopo
- Fluxo principal: `provedor -> ocorrencia -> ordem de servico`.
- Base de conhecimento/credenciais compartilhada por `tenant_id`.
- Permissoes por papel e isolamento multi-tenant.

## Pre-condicoes
- Backend/API ativo.
- Frontend ativo.
- Banco com migracoes aplicadas.
- Usuarios de teste: `super_admin`, `gerente`, `analista`, `tecnico`, `cliente`.

## Cenarios obrigatorios

### 1) Navegacao principal
- Abrir `Analista > Provedores` e validar listagem.
- Entrar em um provedor e abrir ocorrencias.
- Abrir ocorrencia e listar O.S vinculadas.
- Abrir detalhes ao clicar na linha (sem depender de botao extra).

### 2) Ocorrencias
- Criar ocorrencia com campos obrigatorios.
- Validar `Aberta por` preenchido automaticamente com usuario logado.
- Editar ocorrencia existente e validar persistencia apos F5.
- Validar protocolo como nao editavel.

### 3) O.S internas
- Criar primeira O.S a partir da ocorrencia.
- Criar segunda O.S na mesma ocorrencia.
- Validar regra: uma O.S pertence a uma ocorrencia.
- Editar O.S e validar campos de identificacao e persistencia apos F5.

### 4) Comentarios/anotacoes
- Inserir anotacao na ocorrencia.
- Inserir anotacao na O.S.
- Confirmar historico cronologico visivel e atualizado sem quebrar layout.

### 5) Anexos
- Upload de arquivos permitidos (`pdf,png,jpg,jpeg,txt,csv,zip`) ate 10MB.
- Validar bloqueio de tipo/limite invalido.
- Validar abertura/listagem de anexos na primeira O.S e demais O.S.

### 6) Credenciais (tenant-shared)
- Confirmar que credenciais sao compartilhadas entre analistas do mesmo tenant.
- Confirmar que tenant A nao enxerga tenant B.
- Validar filtros server-side por provedor/tipo/ambiente.
- Validar ordenacao server-side e paginacao.
- Validar reveal de segredo + auditoria.

### 7) SLA e status
- Validar transicoes permitidas:
  - `Ag. Terceiros -> Resolvida -> Fechada`
  - `Cancelada` a partir de `Aberta/Em Analise`
  - `Reaberta` de `Fechada -> Em Analise`
- Validar permissoes de fechamento por papel.
- Validar aprovacao obrigatoria para Critica/Alta com atraso.

### 8) WebSocket tempo real
- Criacao/alteracao de O.S em outra sessao refletindo em tempo real.
- Mudanca de status em tempo real.
- Nova anotacao/comentario em tempo real.
- Alertas de SLA e erro de sync em tempo real.

### 9) Seguranca e sessao
- Login/logout e logout remoto por sessao.
- Token access 15 min e refresh 7 dias rotativo.
- 2FA obrigatorio para `super_admin`.
- Auditoria de eventos criticos:
  - login/logout/falha
  - create/edit/close/reopen O.S
  - alteracao de SLA
  - mudanca de papel/permissao
  - acesso a credenciais
  - exportacoes e sync

## Criterio de aceite
- Todos os cenarios obrigatorios aprovados.
- Sem regressao visual critica no tema claro/escuro.
- Sem erro 500 nos fluxos principais.
- Typecheck do monorepo em verde.
