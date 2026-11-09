# Correções de confiabilidade e entrega — 06/11/2026

O código foi corrigido e validado em ambiente descartável. Este trabalho não publica
imagens, não altera contas reais e não aplica migrations ao banco em uso.

## Alterações

- Dependências atualizadas, com Node 22 no Docker e no CI. CLI shadcn movido para
  desenvolvimento. A auditoria das dependências de produção retorna zero alertas.
- `deepmerge@4.3.1`, transitivo das ferramentas de desenvolvimento, recebeu patch
  contra alteração do protótipo do objeto retornado. O teste
  `scripts/dependency-security.test.cjs` verifica o pacote efetivamente usado pelo Jest.
  O registro público ainda aponta um alerta baixo, pois não há versão oficial corrigida.
  `pnpm run audit` mostra todos os alertas e reprova níveis moderado, alto e crítico;
  não há exclusão do aviso no registro nem redução da exigência anterior.
- Build da API separado dos testes; inicialização padronizada em `dist/main.js`.
- Deploy depende do workflow de CI reutilizável, envia os scripts/configurações do
  próprio commit e captura os IDs imutáveis das imagens anteriores. Backup usa o
  compose correto. Falha de atualização recria os contêineres com essas imagens.
- Redis disponível no CI; navegação e login dos três perfis incluídos no Playwright.
- Jobs recorrentes mantêm no máximo 1.000 sucessos por até 24 horas e 1.000 falhas
  por até sete dias. Horários cron explicitamente em UTC e intervalos inválidos rejeitados.
- Refresh serializado no PostgreSQL. Repetições do token imediatamente anterior
  compartilham a mesma rotação por 15 segundos entre réplicas. O resultado fica
  criptografado. Reutilização fora dessa janela revoga a sessão, com revogação confirmada
  antes de retornar erro. O papel atual continua sendo consultado no banco.
- Conta marcada com 2FA ativo, mas sem segredo configurado, deixa de obter acesso normal.
- Criação de O.S. e histórico de status geram eventos de outbox por triggers na mesma
  transação. O snapshot não inclui notas internas, descrição ou credenciais.
- Entrega dos efeitos em segundo plano, com posse distribuída por evento, checkpoints
  por efeito e retentativas com atraso limitado a uma hora. Auditoria usa ID estável.
  O processamento de eventos do motor também deixa de descartar falhas após cinco tentativas.
- Workflows retomam ações pendentes sem repetir ações já confirmadas, propagam falhas
  ao consumidor durável e enviam chave de idempotência nos webhooks.
- Notificações do fechamento confirmam o envio, tratam HTTP sem sucesso como falha
  e registram cada destino concluído. CSAT não é enviado antes do fechamento; falha SMTP
  pode retomar uma pesquisa já criada. A confirmação de envio fica registrada no banco.
- Atualizações por integração gravam status, anotação e histórico na mesma transação.
  Transições públicas exigem a versão; chamadas internas também usam comparação de versão.
- Acessos e senhas de demonstração mantidos na tela de login por orientação do usuário,
  pois o ambiente atual é de testes. Ausência de logotipo retorna 204, sem gerar um falso erro de requisição.
- Staging usa modo de produção, arquivo de ambiente próprio, Redis autenticado,
  volumes persistentes e portas apenas em loopback. Readiness da API verifica banco e Redis.

## Implantação

1. Publicar o commit revisado pelo fluxo de CI. A migration
   `20261106180000_durable_lifecycle_and_refresh` é aditiva e deve entrar antes da nova API.
   Ela não reenvia efeitos históricos anteriores à sua aplicação.
2. No staging, preparar `.env.staging` com valores reais e uma chave de cofre existente
   fora de uploads, conforme `.env.staging.example`. Aplicar previamente a nova configuração
   de Redis/volumes e conferir o proxy HTTPS. Preservar dados, volumes e a chave existentes.
3. A atualização de imagens exige serviços anteriores em execução para capturar o rollback.
   Isso é uma atualização de instalação existente, não um provisionamento inicial.
4. Rollback restaura somente imagens de aplicação, usando o snapshot desta tentativa
   em `.deploy/`. Não restaura o banco ou a infraestrutura; migrations futuras precisam
   manter compatibilidade com a versão anterior.
5. Os acessos de demonstração permanecem disponíveis para os testes; suas senhas não
   foram alteradas nem suas sessões revogadas por este trabalho.

## Contrato de entrega

Os efeitos são entregues pelo menos uma vez. Checkpoints e chaves de idempotência reduzem
duplicações, mas destinatários externos precisam respeitar essas chaves para evitar repetir
uma operação cuja resposta tenha sido perdida. SMTP pode confirmar a aceitação e ocorrer
uma interrupção antes do checkpoint; não há promessa de entrega exatamente uma vez.

## Verificação

- `pnpm validate`: lint, formato, tipos, auditoria, 11 testes de scripts e 740 testes unitários com cobertura.
- `bash scripts/test-db.sh`: migrations e 73 testes de integração em PostgreSQL descartável.
- Smoke HTTP da API, seis cenários de segurança e 200 requisições de carga sem erros.
- 23 testes Playwright, incluindo navegação dos menus, abertura de atendimento e os três perfis.
- Build de API, worker e web; imagem Docker executada em rede interna descartável com
  Node 22, migration automática e readiness de PostgreSQL/Redis confirmada.
- `pnpm release:check` com configuração de verificação, sem usar credenciais reais.
