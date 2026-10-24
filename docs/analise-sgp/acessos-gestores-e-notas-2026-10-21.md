# Três perfis de avaliação e notas pessoais

Entrega de 21/10/2026. O sistema continua sendo o ERP interno da Ajust, **não um SaaS**. Nenhum tenant foi criado: há uma única empresa operadora, Ajust, e os provedores continuam em `Customer`.

## Acessos preparados

| Perfil | Login | Destino após autenticar |
| --- | --- | --- |
| Administração da Ajust | `gestores.admin@ajust.invalid` | `/gerencia` |
| Anderson Alves, equipe Ajust | `sgp.20@cadastro.ajust.invalid` | `/analista` |
| Cliente Meganet | `meganet.teste@ajust.invalid` | `/cliente` |

Senhas fortes diferentes foram geradas; não estão neste documento, no código ou nos screenshots. Foram entregues ao solicitante. Os endereços `.invalid` identificam acessos de avaliação, não caixas de e-mail funcionais. SMTP/recuperação de senha por e-mail continuam dependendo da configuração descrita na auditoria de produção.

O perfil administrativo de avaliação é `gerente`, suficiente para a gestão da operação da Ajust; não foi criada outra conta global de proprietário. Anderson mantém seu ID original SGP, atribuições reais (seis O.S. vinculadas) e papel `tecnico`, que abre o portal da equipe. Sua conta importada estava bloqueada: somente essa conta foi ativada e recebeu nova senha. Não foram alteradas senhas de outros colaboradores ou do administrador principal. Não existe promessa de expiração automática desses acessos: revogar as contas/sessões de avaliação e trocar as senhas após a rodada.

## Portal da Meganet sem outra empresa/tenant

Foi acrescentado `UserTenant.customerId`, vínculo de autorização entre o login cliente e o cadastro Meganet dentro da mesma Ajust. O nome técnico legado `UserTenant` não cria outro modelo comercial.

- A autorização resolve o vínculo no banco em cada requisição, não por nome do provedor, cookie ou parâmetro enviado pelo navegador.
- Consultas do portal exigem simultaneamente tenant Ajust, cliente Meganet, registros não excluídos e O.S. liberada para o cliente.
- A conta vinculada não pode usar as antigas consultas gerais de O.S., calendário, equipe, relatórios, credenciais ou token de eventos, mesmo chamando a API diretamente.
- Detalhes de outra O.S./outro cliente retornam 404. Comentários internos, metadados brutos, anexos e credenciais não são retornados.
- Notas pessoais e gerenciamento da própria conta/sessões permanecem disponíveis.

O portal mantém a proposta da referência antiga: quatro indicadores, abas Todas/Ativas/Fechadas, busca, protocolo e detalhes, usando os componentes e o tema premium atuais. A agenda contém apenas os agendamentos vinculados às O.S. públicas da Meganet, não o calendário global da Ajust. Indicadores mensais usam mês UTC e isso está indicado na tela.

As 20 O.S. da amostra Meganet estavam privadas após a migração. Para esta avaliação com o login do cliente, essas 20 foram liberadas, após conferência dos textos públicos e do recorte. Foi preservado um snapshot das flags/versões anteriores fora do repositório e registrado um evento de publicação na auditoria. Não foi alterada a visibilidade de comentários, anexos nem de atendimentos de outros provedores. Nenhuma O.S. foi duplicada, criada ou teve seu status/datas históricos alterados.

O primeiro acesso dessa conta usa senha explicitamente provisionada pelo administrador, registrada em metadados internos de provisionamento. Não houve fabricação de `lastLoginAt`: o campo foi preenchido pelo login real de teste. O fluxo de CNPJ/OTP das contas legadas não foi desabilitado globalmente; senha e 2FA continuam sendo verificados.

Limites: esta entrega prepara a consulta do histórico da Meganet para os gestores; não certifica abertura de novas solicitações, comentários do cliente ou download de anexos originais. Contas cliente legadas sem vínculo continuam no comportamento anterior e devem ser reconciliadas antes de qualquer entrega a clientes reais. A proteção nova cobre a conta Meganet vinculada; não representa certificação de segurança integral de todos os perfis antigos.

Captura: [portal Meganet no design atual](portal-cliente-meganet-premium.png).

## Minhas notas: experiência antiga, visual atual

A grade de cartões foi substituída por lista lateral e editor direto. Inclui busca por título/conteúdo, notas fixadas, datas, contador de caracteres, salvamento automático, botão Salvar e atalho Ctrl/Cmd+S no texto. Em telas menores, lista e editor ficam empilhados e acessíveis.

As gravações são serializadas por nota. Trocar rapidamente de nota não reutiliza o rascunho de outra; falha de gravação mantém o texto em edição e exibe erro/repetição em vez de confirmar que salvou. Ao sair da página há tentativa de concluir gravações agendadas; ao fechar/recarregar o navegador com rascunhos, há aviso nativo. Rascunhos não são um backup offline: em falha persistente, salvar novamente antes de sair.

Excluir exige confirmação. A API e os dados pessoais existentes foram mantidos; não houve migração ou exclusão das notas reais.

Captura: [editor premium durante teste temporário](minhas-notas-editor-premium.png). As duas notas usadas nessa captura foram criadas exclusivamente para teste e removidas ao terminar; não permanecem como conteúdo fictício no ERP.

## Verificações executadas

- Login pelo formulário real para os três perfis e redirecionamento correto, sem exceções JavaScript observadas.
- Conta Meganet: vinte O.S. corretas; abas de situação, detalhes, agenda, conta e notas abertas; tentativa de outro cliente rejeitada; endpoints gerais proibidos; tentativa de alterar nota de outro usuário proibida.
- Notas: duas edições rápidas em notas diferentes conferidas no banco; falha 503 simulada apenas no navegador; conteúdo mantido e gravação manual posterior conferida; fixação, filtro, cancelamento/confirmação de exclusão e largura móvel 390 px testados.
- **457 testes unitários aprovados** (426 API + 31 worker); 11 testes e três suítes seguem ignorados. Typecheck API/web aprovado. ESLint dos módulos novos e de autorização aprovado; os arquivos de shell/session-provider mantêm dois avisos pré-existentes de navegação interna com `window.location.assign`.
- Migração aditiva aplicada e cliente Prisma regenerado, sem remover tabelas, dados ou provedores.

Reprodução: `ERP_REVIEW_ACCESS_FILE=/caminho/privado/accounts.json node --env-file=.env scripts/check-review-access-notes.cjs`. Não versionar esse arquivo de senhas. Provisionamento e publicação recusam repetição quando seus snapshots/arquivos de controle já existem; não executar novamente para “testar” senhas.

Isso habilita a rodada de avaliação, **não muda o parecer de que produção ainda tem bloqueios** de HTTPS, segredos, dependências, SMTP, SLA e recuperação. Ver [auditoria anterior e critérios de produção](auditoria-gestores-e-producao-2026-10-21.md).
