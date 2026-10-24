# Ampliação real: vinte O.S. por provedor e enriquecimento

21/10/2026. Ambiente principal: porta 8070. SGP somente leitura, sem alterar nenhum registro remoto. Este documento atualiza os quantitativos do piloto anterior, que tinha cinco O.S. por cliente.

## Dados efetivamente disponíveis

| Provedor | O.S. selecionadas | Anotações cadastrais SGP | Registros de acesso organizados |
| --- | ---: | ---: | ---: |
| Meganet | 20 | 51 | 55 |
| Homenet | 20 | 22 | 29 |
| Ecotelecom | 20 | 26 | 28 |
| Infotel | 20 | 164 | 176 |
| Ultranet | 20 | 69 | 72 |
| G5 Jaboatão | 20 | 59 | 65 |
| Total | 120 | 391 | 425 |

As 30 ordens anteriores foram reutilizadas; foram acrescentadas 90. Os IDs estão fixados em `sgp-sample-source.ts`, sem expansão silenciosa a cada reexecução. A escolha preserva os cinco casos já revisados e acrescenta tipos distintos disponíveis na janela recente por contrato. As novas classificações baseadas apenas no tipo de origem permanecem propostas, não representam homologação humana de noventa novos workflows.

Outros dados conferidos:

- 38 pessoas do endpoint de técnicos, todas importadas. A API devolve 40 registros, dos quais dois são contas operacionais (`Chamados_em_Espera` e `sistema_os`), não novos analistas. Uma nova execução do importador confirmou que as 38 pessoas já existiam. Não há concessão automática de login nem função de analista inventada: a API não distingue todos os cargos ou informa se a pessoa continua ativa.
- 118 registros de comentário/campo na O.S., dos quais quatro preservam observação/serviço prestado. O endpoint específico de anotações de O.S. devolveu zero notas nos 120 casos consultados; isso não foi preenchido artificialmente.
- 244 comentários das ocorrências, preservando texto, autoria de origem e datas. Foram vinculados autores aos cadastros locais somente por nome/login exato e unívoco.
- 119 agendamentos originais, vinculados à O.S. e ocorrência. O centésimo vigésimo caso não trouxe agendamento válido. Ausência de hora final não foi substituída por uma duração inventada. A descrição distingue agendamento confirmado de não confirmado. A agenda da gerência abre a visão de equipe.
- 52 tipos reais de demanda observados nas ordens selecionadas e cadastrados no catálogo. Estimativa de duração fica nula quando não informada. Prioridade padrão do catálogo não é apresentada como prioridade contratual verificada.
- 58 referências de anexos: 16 PNG, 11 JPEG, 10 PDF, 17 TXT, um OGG, um XLSX, um CFG e um BACKUP. **Os arquivos binários ainda não foram baixados**; ver o impedimento abaixo.

## Cofre: importação e limpeza

O endpoint de anotações cadastrais retornou 3.356 notas apesar do filtro de cliente. O importador aplica novamente a associação por ID e só persiste as 391 notas dos seis clientes autorizados. Nenhum acesso de outro cliente foi cadastrado.

Notas com divisões explícitas de sistemas/equipamentos foram separadas. Campos identificáveis preenchem endereço, usuário e senha; pares múltiplos ambíguos não são associados por adivinhação. São 202 registros com os três campos identificados; 223 precisam de revisão de pelo menos um campo, incluindo 53 com ambiguidade. Isso reflete a desorganização da origem, não senhas de demonstração criadas pelo ERP. O ambiente é `NAO_INFORMADO` quando o SGP não o informa.

O original completo da anotação, incluindo HTML e links, fica criptografado para recuperação; a revelação apresenta o texto legível e os links preservados, avisando quando a nota contém vários acessos. É disponibilizado somente por **Revelar anotação original do SGP**, com auditoria, perfil autorizado, isolamento por tenant e ocultação após trinta segundos ou saída da aba. A listagem não recebe segredos nem os campos criptográficos. A extração não substitui revisão humana: nomes e equipamentos podem necessitar padronização posterior.

As oito credenciais e2e identificadas por provedor `IXC Soft`, endereço de exemplo e usuário `admin_e2e` foram arquivadas em `migration_archive.credentials_e2e_20261021` e removidas do cofre ativo. O filtro foi exato; nenhum registro de acesso real foi apagado. A recuperação é possível a partir da tabela de arquivo ou do backup anterior.

Foi conferido o mascaramento dos nomes/observações: sete trechos coincidentes com senhas extraídas foram protegidos nesses campos, sem alterar o segredo original protegido. A verificação posterior não encontrou essas coincidências nos nomes e observações examinados. Isso não é uma certificação de ausência de segredo arbitrário em todo texto livre do sistema.

### Chave e recuperação

Os 425 registros foram recriptografados com AES-256-GCM e uma chave aleatória própria do cofre, independente dos segredos padrão do ambiente de desenvolvimento. Valores antigos continuam legíveis pela compatibilidade do criptografador.

**Não apagar a chave**: neste ambiente ela está em `uploads/.keys/vault.key` no host, montada em `/tmp/ajust_uploads/.keys/vault.key` na API. Diretório `0700`, arquivo `0600`, fora do Git e de rotas públicas. O caminho pode ser configurado por `VAULT_KEY_FILE`. A chave precisa de backup protegido separado, além do banco e dos uploads; sem ela os valores `vault:v1:` não podem ser recuperados. A decriptação nunca gera silenciosamente outra chave se a original estiver ausente.

O acesso público atual continua por HTTP e o ambiente ainda tem configuração de desenvolvimento. Antes do uso definitivo de credenciais reais, é necessário homologar HTTPS, restrição de acesso e os demais segredos/autenticação de produção. A criptografia em repouso não protege o tráfego HTTP.

## Mídias: impedimento confirmado

O endpoint `/api/os/imagem/id/{id}/list/` retorna nomes e metadados. O endpoint documentado de detalhe aceita o nome-base do arquivo, mas também só devolve metadados. O acesso aos arquivos em `/media/ocorrencia/...` responde HTTP 302 para `/accounts/login`, inclusive com app/token. Formato e permissão foram testados sem tentar contornar a autenticação web.

As 58 referências foram preservadas e aparecem na aba Anexos das O.S. como **conteúdo pendente de autorização na origem**. Não existem linhas com arquivo de tamanho zero simulando download, nem imagens fictícias. Para concluir, é necessária uma exportação autorizada dessas mídias ou um meio de leitura do SGP que permita baixá-las. O usuário foi consultado sobre isso.

Os uploads do ERP passaram a ter montagem persistente no Compose. Nove registros antigos já apontavam para arquivos temporários ausentes no container antes desta alteração; a mudança não inventa nem recupera esses arquivos perdidos de testes anteriores.

## SLA, esforço e empresas: ausência não é dado

Os detalhes consultados não expuseram apontamentos de trabalho dos analistas nem políticas contratuais de SLA. O sistema preserva abertura, fechamento e agendamento; calcula **tempo decorrido**, identificado explicitamente como diferente de esforço. Não foram criados `TimeEntry` a partir de duração do chamado, nem regras de SLA baseadas na média de atendimentos antigos. O SLA histórico permanece desconhecido e fora dos indicadores contratuais. As telas explicam a pendência; metas dos workflows continuam propostas.

O tenant é o ambiente da **Ajust**, não um duplicado de cada provedor atendido. Os seis provedores continuam em `Customer`, com as ordens associadas por relação, dentro do ambiente da consultoria. Criar seis tenants por aparência alteraria isolamento e permissões indevidamente. A tela de cada provedor agora lista as vinte ordens e seus links de acompanhamento.

O nome de exibição do workspace passou de `Ajust Demo` para `Ajust`. CNPJ, razão social e contatos reconhecidos como valores fixos do seed foram retirados, sem substituição por outros dados inventados. O slug técnico foi preservado por compatibilidade. A identidade jurídica e os contatos da própria Ajust precisam ser informados com documentação real; os CNPJs dos clientes não devem ser usados como CNPJ da consultoria. Contagens de usuários e setores são obtidas das relações reais do banco.

## Correções funcionais e visuais

- Catálogo: `activeOnly=false` estava filtrando somente inativos. Corrigido para incluir todos. A consulta vazia também não cria mais serviços padrão de ISP automaticamente; a criação explícita continua disponível.
- Login: sucesso passa a limpar o contador de tentativas, sem remover bloqueio ativo e sem enfraquecer a proteção de senhas incorretas.
- Sessões: cookies do ambiente principal agora usam prefixo `ajust_live_`. A versão histórica da porta 8071 continua com seus cookies próprios; visitar uma versão não sobrescreve a sessão da outra. É necessário entrar novamente uma vez na versão principal após a troca de nomes.
- Indisponibilidade transitória do backend não é mais tratada como credencial inválida pelo resolvedor da sessão: responde indisponibilidade preservando cookies, sem liberar acesso a dados não autorizados.
- Cofre: filtros de busca/provedor/tipo aplicados no servidor com paginação; a relação de provedores não depende somente dos primeiros duzentos registros.
- Ajustpedia: lista vertical, metadados do autor real, descrição e comando separados, terminal com cópia, edição e filtros, preservando os artigos existentes. Os artigos e2e anteriores não foram apagados como se fossem parte da limpeza específica do cofre. Favoritos são de sessão, não um novo cadastro migrado.
- Indicador de desenvolvimento do Next.js desativado; telemetria do Next desativada no serviço web. Não foram encontradas integrações Vercel/v0 na aplicação. O framework Next foi mantido; não há motivo técnico para remover o framework para retirar aquele SVG.

## Verificação e reprodução

Backup prévio: `/var/lib/postgresql/data/ajust_before_enrichment_20261021.dump` no container PostgreSQL. Migration `20261021160000_sgp_enrichment_provenance`; novas chaves de origem e tabela `ExternalImportLink` tornam históricos, agenda e catálogo reexecutáveis sem duplicação.

Scripts principais:

- `scripts/import-sgp-registry.ts --apply`: pessoas e clientes, somente dados cadastrais reais.
- `scripts/import-sgp-sample.ts --apply`, com `SGP_SAMPLE_SIZE=20`: amostra fixada de 120 ordens.
- `scripts/enrich-sgp-real-data.ts --apply`: acessos, comentários, campos, agenda, catálogo e referências de mídia. Rodar na API com `SGP_TOKEN` no ambiente, sem imprimir tokens ou notas.
- `scripts/backfill-sgp-links.ts`: vínculos unívocos com pessoas, sem criar identidades pelo nome.
- `scripts/protect-sgp-vault.ts`: conversão compatível para a chave própria do cofre; reexecução ignora valores já convertidos.
- `scripts/preserve-sgp-original-notes.ts`: preservação cifrada do HTML integral e dos links da anotação, respeitando o ID do cliente.
- `scripts/audit-sgp-secrets.ts`: integridade da decriptação e conferência restrita de nomes/observações, sem imprimir segredos.
- `scripts/check-sgp-enrichment-ui.cjs`: navegador real, vinte casos por provedor, 425 acessos, 52 serviços, 119 agendamentos, revelação auditada sem imprimir conteúdos, seis logins consecutivos, isolamento entre portas e navegação sem erros.

Verificação final: typechecks da API, frontend e worker aprovados; suíte geral com 398 testes aprovados e onze testes condicionais desabilitados nessa execução; dez testes transacionais de banco V1/V2 executados separadamente e aprovados. A conferência do navegador passou com zero erros de página, incluindo as vinte ordens no detalhe do provedor. A checagem dos 425 registros confirmou a recuperação das notas protegidas com a chave própria, sem segredos impressos nos relatórios.
