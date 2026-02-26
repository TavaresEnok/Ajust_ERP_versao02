# Decisao Oficial de Escopo v2 - ERP Ajust

Status: Aprovado para execucao do MVP  
Data base: 2026-02-17

## 1) Escopo funcional MVP

Tipos de OS:
- Rompimento
- Lentidao
- Configuracao ONU
- Troca de Senha
- Cancelamento
- Auditoria
- Instalacao
- BGP

Matriz de SLA:
- Critica: 4h
- Alta: 8h
- Normal: 24h
- Baixa: 72h
- Override: Rompimento e BGP usam metade do SLA base, minimo de 2h

Workflow e regras:
- Caminho principal: `Ag. Terceiros -> Resolvida -> Fechada`
- Cancelamento: permitido a partir de `Aberta` e `Em Analise`
- Reabertura: `Fechada -> Em Analise`
- Fechamento OS permitido para: `analista`, `gerente`, `super_admin`
- `tecnico` pode apenas marcar `Resolvida`
- Aprovacao obrigatoria para fechar OS `Critica/Alta` com atraso SLA

## 2) IAM, seguranca e compliance

Papeis iniciais:
- `super_admin`
- `gerente`
- `analista`
- `tecnico`
- `cliente`
- `leitura`

Autenticacao e sessao:
- Access token: 15 minutos
- Refresh token: 7 dias, rotativo
- Logout remoto por sessao/dispositivo: minimo para admin/gerente, alvo para todos no MVP
- 2FA: obrigatorio para `super_admin`, opcional para demais no MVP

Protecao de dados:
- Criptografia em repouso obrigatoria para tokens, credenciais e segredos
- Auditoria obrigatoria para:
  - login/logout/falha de login
  - criacao/edicao/fechamento/reabertura de OS
  - alteracoes de SLA
  - mudancas de papel/permissao
  - acesso a credenciais
  - exportacoes
  - acoes de sincronizacao

## 3) Multi-tenant e governanca

Modelo:
- Isolamento obrigatorio por `tenant_id`
- Usuario multi-tenant via `user_tenant` com papel por tenant

Relatorios globais:
- `super_admin`: sempre permitido
- `gerente`: somente com permissao global explicita

Campos obrigatorios de tenant:
- `tenant_id` (auto)
- razao social
- nome fantasia
- CNPJ/CPF
- slug/dominio
- timezone
- contato tecnico
- e-mail
- telefone
- status

## 4) Integracao SGP e sincronizacao

Primeiro SGP:
- IXC Soft

Metodo de integracao:
- API REST + webhook
- Importacao de arquivo somente fallback

Fonte de verdade por dominio:
- SGP: ciclo principal da OS
- ERP: owner, notas, tags, anexos internos

Resolucao de conflito:
1. Dominio de autoridade
2. `updated_at`
3. Prioridade de fonte em empate (SGP para ciclo OS, ERP para internos)

Frequencia:
- Tempo real via webhook
- Polling de reconciliacao a cada 5 minutos

Eventos WebSocket:
- criacao de OS
- alteracao de OS
- mudanca de status
- atribuicao de tecnico
- nova ocorrencia/comentario
- alerta SLA
- erro de sync

## 5) Limites operacionais e anexos

Capacidade alvo MVP:
- ate 1.000 OS/dia
- ate 100 usuarios simultaneos

Anexos MVP:
- ate 10 MB por arquivo
- ate 10 arquivos por OS
- tipos permitidos: `pdf`, `png`, `jpg`, `jpeg`, `txt`, `csv`, `zip`

## 6) Plataforma e implantacao

Arquitetura obrigatoria:
- Node.js
- Next.js + TypeScript
- NestJS (Express adapter)
- NestJS Gateway (WebSocket)
- PostgreSQL
- Redis
- RabbitMQ ou NATS (Kafka apenas se escala massiva exigir)
- Prisma
- JWT + Refresh
- Zod ou class-validator

Portas Docker (Slot 4):
- `8070` web
- `8071` api/ws
- `8072` postgres
- `8073` redis
- `8074` rabbitmq amqp
- `8075` rabbitmq management
- `8076` worker
- `8077-8079` servicos auxiliares
- `8080-8089` reserva

Deploy e rollout:
- Primeiro deploy: cloud gerenciado, com conectividade segura aos SGPs dos clientes
- Go-live: rollout por tenant (piloto + expansao), sem big bang

## 7) Itens congelados para MVP

Congelado nesta v2:
- Escopo funcional de OS, SLA, workflow e aprovacao
- Modelo de seguranca principal
- Estrategia de integracao IXC
- Regras de autoridade e reconciliacao
- Estrategia de deploy e rollout

Nao congelado (podera evoluir em v3):
- expansao de modulos secundarios
- ajuste de KPIs avancados
- tuning de escala apos carga real
