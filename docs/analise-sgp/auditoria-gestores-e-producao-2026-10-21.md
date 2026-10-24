# Revisão para gestores e prontidão de produção

Data: 21/10/2026. Ambiente avaliado: Ajust ERP, porta 8070.

## Conclusão

O núcleo do ERP permite uma homologação guiada de consulta pelos gestores: provedores, equipe, ocorrências, O.S., comentários, agenda, catálogo e análises têm dados. **Não está tudo preenchido e não recomendo colocar em produção ainda.** Navegar sem erro não comprova que todos os fluxos de gravação, permissões, anexos e recuperação estejam prontos.

Não foram inventados apontamentos, políticas de SLA, escalas, ativos ou anexos originais para esconder campos vazios. Esta entrega não excluiu dados existentes, não ativou usuários em lote e não alterou as instalações das portas 8071/8078.

## Correções entregues

### Tipos de serviço

A página `/gerencia/servicos` antes privilegiava o cadastro do catálogo, enquanto a referência do Hub era uma análise das O.S. por tipo. Agora oferece:

- Aba **Análise das O.S.** com volume, tipos atendidos, atrasadas e vencimentos nas próximas duas horas.
- Filtros por origem SGP/ERP, provedor e período: histórico inteiro, 7/15/30/90 dias e intervalo personalizado.
- Ranking de até 20 tipos, tempo médio até resolução/encerramento e tabela completa, com responsáveis e prioridades ao expandir.
- Aba **Catálogo e modelos**, preservando cadastro e edição dos serviços existentes.

Os nomes originais importados são preservados; não se comprime toda configuração em um único enum. No recorte SGP há **128 O.S. e 53 nomes de tipos**. O catálogo tem **52 registros**; são universos diferentes, pois o histórico inclui um piloto anterior e variações de nomenclatura. A padronização desses nomes precisa ser deliberada, sem apagar a classificação original.

A média usa somente conclusões com datas válidas. Cancelamento não vira conclusão; duração de abertura a encerramento **não é tempo trabalhado**. O.S. explicitamente marcadas como demonstração não entram na nova análise. O filtro SGP permite separar o histórico importado das O.S. nativas, inclusive registros de testes ainda presentes.

Captura: [tipos de serviço, recorte SGP](tipos-servico-analise.png).

### Provedores

- `/gerencia/provedores` mantém a listagem em colunas e o cadastro detalhado.
- Nova aba **Análise das O.S.**: volume, ativas, concluídas, canceladas, atrasadas e próximas do prazo, por provedor, com origem SGP/ERP, período e busca. Grupos textuais de atendimentos internos/testes não são novos cadastros de provedores.
- O dashboard ganhou **O.S. por provedor**, acompanhando seu filtro de período.
- Removidos dois contadores fixos do menu que não representavam consultas reais.

Capturas: [análise dos provedores](provedores-analise.png), [dashboard](dashboard-provedores.png).

## Inventário dos dados

Contagens do tenant da Ajust, incluindo somente registros não excluídos quando o módulo possui exclusão lógica. Relações de importação e cadastros foram consultados em modo de leitura; não houve nova migração nesta entrega.

| Área | Encontrado | Interpretação para homologação |
| --- | --- | --- |
| Provedores | 6 | Meganet, Homenet, Ecotelecom, Infotel, Ultranet e G5 |
| Ocorrências | 132 | Não equivalem à quantidade de O.S. |
| O.S. | 168 | 128 SGP e 40 nativas do ERP |
| Amostra ampliada SGP | 120 | 20 por provedor; outras 8 são do piloto anterior |
| Nova análise, todas as origens | 166 O.S., 55 tipos | Exclui 2 demonstrações explícitas; ainda pode incluir testes nativos não classificados |
| Equipe/usuários | 43 | 5 ativos e 38 bloqueados; cadastro não significa acesso liberado |
| Tipos no catálogo | 52 | Não confundir catálogo com agrupamento de todas as O.S. |
| Agenda | 119 eventos | O mês exibido e os filtros reduzem o que aparece na tela |
| Comentários importados vinculados | 244 | Vínculos de importação de comentários, não contagem de todo o histórico interno |
| Cofre de credenciais | 425, de 6 provedores | Consulta sem revelar os segredos; quantidade não certifica validade dos acessos |
| Processos operacionais | 122 | Incluem histórico e demonstrações; abrir página não valida execução completa |
| Modelos de processo | 68 | Publicação e regras precisam de aceite operacional |
| Ajustpedia | 9 artigos | 1 técnico real e 8 artigos publicados com identificação E2E |
| Empresa/tenant | 1 | A operadora é a Ajust; os seis provedores são clientes dela, não seis tenants |
| Políticas de SLA | 0 | Impedimento para validar SLA contratual |
| Registro de trabalho | 0 apontamentos | Não há base para horas trabalhadas/produtividade por esforço |
| Plantão | 0 escalas | Precisa de escala real e responsáveis |
| Ativos e mudanças | 0 ativos e 0 mudanças não excluídos | Cofre com equipamentos descritos não equivale a inventário CMDB |
| Setores | 0 | Precisam de definição para distribuição automática |
| Configuração de notificações | 0 | Não presumir alertas operacionais ativos |

Nove O.S. SGP não têm responsável vinculado por ID de usuário, embora possam conservar o nome textual. É necessário reconciliar a identidade antes de cobrar distribuição e desempenho individual.

### Atenção ao SLA

No recorte SGP, **120 das 128 O.S. ficam fora do cálculo de atraso por falta de prazo/elegibilidade**. As oito restantes têm prazos legados registrados, mas isso não comprova uma política contratual aprovada. A tela informa essa limitação. Não transformar a ausência de política em “100% de SLA cumprido”, nem inventar prazo retroativo.

### Conteúdo de teste e anexos

Os oito artigos E2E são resíduos identificáveis de testes existentes. Também há 13 O.S. nativas com títulos característicos de teste e sem metadados de importação. Não foram apagadas por inferência: revisar os alvos e limpar/arquivar com autorização, preservando as demandas técnicas reais que eventualmente contenham a palavra “teste”.

Existem **58 referências importadas de anexos**, mas referência não significa arquivo original disponível. Foram encontrados dez arquivos locais, incluindo um substituto de demonstração já autorizado anteriormente. Esta revisão não comprovou a correspondência individual dos dez arquivos com as 58 referências. A migração de imagens, áudio e demais originais continua pendente; arquivo gerado nunca deve ser apresentado como evidência original do SGP.

## Cobertura da verificação

Foram abertas **41 rotas**, com sessão administrativa válida: páginas do menu gerencial, configurações e detalhes representativos de O.S., ocorrência, provedor e técnico. Nenhuma apresentou erro HTTP, falha de API observada ou exceção JavaScript durante essa navegação.

Evidência por rota: [auditoria de navegação](auditoria-paginas-gestores-2026-10-21.json). As contagens de linhas nesse arquivo são do recorte carregado, não necessariamente o total do banco. Uma página pode carregar corretamente e conter módulo vazio ou funcionalidade ainda não homologada.

Verificações adicionais desta entrega:

- Testes unitários: **436 aprovados** (405 API + 31 worker); **11 testes e 3 suítes ignorados** na API. Não contar os ignorados como aprovados.
- Typecheck da API e do frontend: aprovado.
- ESLint dos arquivos API/frontend envolvidos: aprovado.
- Regressão navegador/API das novas análises: filtros SGP, Meganet, intervalo inválido, catálogo preservado, provedores e dashboard aprovados, sem exceções JavaScript.
- Soma dos tipos conferida contra o total; metadados brutos da origem não são expostos no relatório.
- Tentativa de trocar tenant por query: o BFF remove o parâmetro e mantém os mesmos dados do tenant autenticado; a API direta rejeita com 403. Consulta anônima rejeitada com 401.

Reprodução da regressão: `ERP_AUDIT_AUTH_FILE=/caminho/privado/auth.json node scripts/check-service-type-analytics.cjs`. A sessão deve ser legítima, de curta duração e fora do repositório. O script não publica tokens nem revela credenciais.

Limites: a navegação usou sessão administrativa, não certificou o perfil gerente restrito nem o isolamento completo entre todos os papéis. Acessar `/analista` ou `/cliente` como super_admin redireciona para a gestão; não é teste desses usuários. Não foram executados novos testes de escrita no banco compartilhado, build de produção sobre o frontend ativo, ensaio de restauração ou teste de carga.

## Bloqueios antes de produção

### Críticos: segurança e implantação

1. **Ambiente ainda de desenvolvimento.** Os serviços ativos usam `next dev`, `tsx watch` e montagem do código. Preparar build/release isolado, executar os checks de staging e promover com rollback testado.
2. **Validação de release reprovada.** `node --env-file=.env scripts/release-readiness.mjs` apontou senha/conexão de banco com padrão/placeholder, segredos JWT curtos, segredo de reset e tokens de integrações/worker ausentes, URLs base e SMTP ausentes no arquivo avaliado. O startup da API também avisa sobre segredos inseguros e SMTP indisponível. Variáveis efetivas de containers podem diferir do arquivo: revisar ambas.
3. **Cofre exige rotação planejada.** Trocar senhas/tokens expostos e remover defaults. Não substituir cegamente a chave de criptografia: os 425 acessos existentes precisam de migração/recriptografia e recuperação testadas.
4. **HTTPS, rede e serviços internos.** O acesso avaliado é HTTP. API, banco, Redis, pgAdmin e worker têm publicação em todas as interfaces do host. Não foi testado o alcance externo/firewall; restringir os serviços internos e expor somente o necessário atrás de TLS.
5. **Dependências vulneráveis.** `pnpm audit --prod --json` reportou 1 ocorrência crítica, 27 altas, 22 moderadas e 5 baixas. A crítica envolve `proxy-addr`. Esses números são achados do gerenciador, não exploração comprovada; precisam de triagem, atualização e regressão antes do release. [Resultado e advisories](auditoria-dependencias-producao-2026-10-21.json).

### Altos: operação e confiabilidade

6. **Acesso real dos usuários.** O login com as credenciais de demonstração configuradas falhou; não houve redefinição de senha. Os testes de navegação usaram sessão existente. Validar convite, login, logout, refresh, recuperação e 2FA com contas reais de gerente/analista/cliente. Revisar os 38 usuários bloqueados individualmente; não ativar todos automaticamente.
7. **Tempo real externo mal configurado.** O BFF emite `socketUrl: http://localhost:8092`. Para um gestor remoto, isso aponta para o computador dele, não para o servidor. Configurar gateway público seguro e testar reconexão/autorização remotamente. A página abrir não certifica entrega de eventos.
8. **SLA e estrutura operacional.** Aprovar políticas, horário útil, feriados, pausas, escalonamento, setores, escala e responsáveis. Conferir os oito prazos legados antes de tratá-los como compromisso real.
9. **Workflows duráveis.** Homologar DNS/OLT com usuários reais: decisões, paralelismo, encaminhamento sem duplicação, reabertura, cancelamento, repetição de evento, limites de encadeamento e retomada após reiniciar worker/API. A auditoria de navegação não substitui esses testes.
10. **Dados e evidências.** Isolar/limpar resíduos de teste com revisão prévia, reconciliar responsáveis, validar credenciais por amostragem e obter anexos originais com autorização. Não recalcular histórico de forma a simular horas trabalhadas.
11. **Backup, observabilidade e recuperação.** Validar restauração de banco e arquivos, proteção das chaves do cofre, retenção, alertas externos e procedimento de rollback. A existência de scripts não comprova um restore bem-sucedido.

## Como liberar para os gestores agora

Recomendo homologação controlada, preferencialmente em ambiente separado e com acesso restrito. Começar por provedores, equipe, leitura de ocorrências/O.S., comentários, agenda e análise de serviços; selecionar **Origem → Importadas do SGP** para avaliar a amostra real.

Informar previamente que horas apontadas, políticas SLA, plantões, ativos, mudanças e anexos originais não estão completos. Antes de distribuir acesso amplo, resolver os itens críticos e validar login de uma conta de gerente sem privilégios de super_admin. O critério final de produção deve ser o aceite dos fluxos e da recuperação, não “todas as telas têm algum número”.
