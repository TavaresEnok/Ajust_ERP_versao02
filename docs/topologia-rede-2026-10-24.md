# Topologia de rede por provedor

## Navegação

No portal do analista, **Escala de plantão** pertence a **Meu trabalho**.

**Topologia de rede** substitui a antiga tela de equipamentos em `/analista/ativos` e `/gerencia/ativos`. A lista apresenta os provedores cadastrados, busca, filtro com/sem diagrama, paginação e metadados da última alteração. Cada provedor abre seu próprio diagrama. O cadastro legado de ativos e seus snapshots permanecem no banco, sem conversão automática para diagramas.

O botão **Tela cheia**, no cabeçalho do diagrama, usa o monitor inteiro e oculta os menus do ERP. O cabeçalho compacto identifica o provedor e permite **Sair da tela cheia**. Esc também funciona com foco dentro do draw.io. O mesmo iframe é mantido ao entrar e sair, sem recarregar o arquivo. Para usar outro monitor, mova a janela do navegador antes de ativar o botão. Verificação no navegador: diagrama ampliado de 1136×690 para 1440×943 em uma tela de 1440×1000, saída pelo botão e por Esc, nenhum recarregamento do iframe e nenhum erro de JavaScript.

## Draw.io

O editor é servido pelo próprio ERP em `/drawio/index.html`, por um serviço Docker interno `drawio`, com imagem oficial fixada por versão e digest. Nenhuma porta adicional do editor é publicada. O Next encaminha os recursos para `http://drawio:8080/drawio/`; `DRAWIO_INTERNAL_URL` permite alterar o destino interno. O modo `offline=1` desabilita integrações de armazenamento em nuvem.

Ao abrir um provedor com topologia, o diagrama aparece em modo de consulta. **Editar topologia** abre o draw.io. **Salvar alterações** grava no ERP e cria uma revisão. Importação e criação abrem o editor para conferência antes da gravação. O editor avisa sobre alterações não salvas e permite baixar uma cópia.

Importação: `.drawio`, XML, SVG com atributo de conteúdo editável e PNG com metadados do draw.io. Limite de arquivo/XML de 8 MB. O editor mantém as páginas do arquivo; o servidor valida documentos compactados e não compactados, limita a expansão e rejeita entidades XML/DOCTYPE.

## Persistência e permissões

Uma topologia principal por cliente; diagramas com várias páginas podem representar POPs e outras subdivisões. `NetworkTopology` armazena a versão atual; `NetworkTopologyRevision` preserva cada versão anterior. XML criptografado com o mecanismo existente de segredos; listagem e histórico não retornam XML. A consulta ao diagrama individual é autenticada e restrita à equipe interna da Ajust. O corpo XML é ocultado dos logs de auditoria.

Analistas, gestores e administradores podem consultar, importar e editar. Clientes não acessam esta documentação interna. Toda gravação exige a versão esperada; gravações concorrentes não sobrescrevem silenciosamente a versão existente. Restaurar uma versão pelo histórico abre uma cópia no editor e, ao salvar, gera uma nova revisão.

Migração: `20261024160000_network_topologies`. Backup anterior à aplicação no servidor: `/tmp/ajust-topologia.wivMqa/database.dump`.

## Migração do BookStack

Origem: `https://bookstack.ajustconsulting.com.br`, estante `/shelves/diagramas-de-rede`. A coleta autenticada pela interface web percorreu 96 livros e 154 páginas, usando somente leitura. O XML editável foi extraído dos metadados `mxfile` das imagens PNG do draw.io; não foi necessário exportar manualmente pelo editor nem obter um token de API.

Conforme a orientação do usuário, a seleção para migração contém somente páginas marcadas como **ATUALIZADO/ATUALIZADA** no título. Foram identificados 82 livros, 83 páginas e 95 imagens com XML nessa seleção. Destas, 12 continham desenhos vazios, preservados na exportação mas desconsiderados no cadastro de topologias. Os XMLs foram validados, incluindo a leitura das páginas compactadas, e seus hashes SHA-256 foram conferidos. Títulos repetidos recebem arquivos separados por hash para evitar sobrescrita.

Arquivos e manifestos ficam fora do Git, em `/home/app/private-imports/bookstack-topologias-20261024/atualizados`, com diretórios privados e arquivos acessíveis somente ao usuário do servidor. O manifesto registra livro, página de origem, imagem de origem, arquivo, hash e quantidade de páginas e elementos. A coleta inicial das demais páginas permanece separada; elas não integram a exportação dos atualizados. Livros sem página marcada como atualizada e associações ambíguas exigem revisão antes de qualquer importação.

### Importação completa no ERP

`scripts/import-bookstack-topologies.ts` aplica o mapeamento revisado dos 82 livros selecionados. Foram consultados os 149 cadastros reais do diretório de clientes e as anotações existentes para conferir nomes comerciais e unidades. AF Telecom foi identificada pelo domínio de seu SGP nas anotações do cliente 90; Ativatec, pelas referências das anotações do cliente 143. O mapeamento fica explícito no importador, evitando aproximar indiscriminadamente nomes de empresas ou unidades diferentes.

Resultado: **82 provedores com topologia cadastrada**, sendo 71 novos clientes e 11 clientes já existentes. O ERP passou a ter 97 clientes no total; 15 clientes anteriores continuam sem um diagrama marcado como atualizado na estante consultada. A importação não cria O.S., ocorrências, contas de acesso ou tenants. Os cadastros novos mantêm razão social, documento, endereço e contatos reais quando confirmados no diretório; a procedência fica nos metadados internos.

Ultralink tinha um nome e um diagrama reais no BookStack, mas nenhum cadastro legal confirmado. Ela foi incluída com seu nome comercial e os dados legais ausentes. A migração `20261024182000_customer_optional_document` permite `Customer.taxId = NULL`, mantendo o índice único para documentos conhecidos. A tela de cadastro exibe **Não informado**, sem inventar CPF/CNPJ ou razão social.

Foi corrigida a associação anterior do diagrama **G5 Barra de Jangada**, indevidamente ligado à **G5 Jaboatão**. A topologia foi transferida para o cliente correto, preservando ID, revisões e auditoria. O Grupo Telecom tinha duas páginas marcadas como atualizadas: ambas foram preservadas em páginas separadas dentro da sua topologia.

O importador é somente leitura por padrão; `--apply` exige um backup PostgreSQL. A operação usa transação, criptografia, histórico e auditoria, verifica os hashes após gravar e preserva versões anteriores. A repetição com a mesma coleta não duplica clientes nem cria revisões iguais. Backup verificado anterior à importação: `/home/app/private-imports/bookstack-topologias-20261024/pre-complete-import.dump`. O relatório completo fica em `importacao-completa-erp.json` nessa mesma pasta privada.

Exportações com imagens ou bibliotecas externas precisam ter esses recursos incorporados ou migrados junto com o XML; não basta copiar um link privado do BookStack. Os XMLs selecionados foram inspecionados e não continham referências de imagem a URLs HTTP ou a uploads privados do BookStack.

Referências oficiais: [protocolo de integração draw.io](https://www.drawio.com/docs/reference/embed-mode/), [imagem Docker oficial](https://github.com/jgraph/docker-drawio).

## Verificação

`scripts/check-network-topologies.cjs` verifica o caminho real pelo navegador com um provedor temporário, editor draw.io real, importação, gravação, visualização, download, histórico, rejeição de versão antiga e apresentação mobile. `scripts/topology-review-fixture.ts` cria e remove exclusivamente dados identificados pelo token da verificação. Nenhuma topologia de cliente real é usada como rascunho de teste.

Os testes da API validam XMLs compactados, múltiplas páginas, arquivos inválidos e expansão excessiva, além de criptografia, isolamento, histórico e conflito de versões, com rollback dos dados de teste.

Resultado desta entrega: verificação de tipos da API e da interface concluída; ESLint dos componentes alterados sem erros; 20 testes da API aprovados. O roteiro de navegador passou com o draw.io local real, inclusive gravação de XML acima de 2 MB e listagem a 390 px. Provedores e diagramas temporários foram removidos ao final.

Na importação completa, os 82 XMLs foram relidos pela API e conferidos com os hashes do relatório. Os 82 visualizadores foram abertos pelo portal do analista, com confirmação de carregamento do draw.io e nenhum erro de JavaScript. A página cadastral da Ultralink foi consultada com documento ausente, sem falhas. A simulação posterior do importador encontrou os 82 clientes já cadastrados e nenhum novo cadastro necessário. As verificações de tipos da API e da interface passaram após tornar o documento opcional. Evidências privadas: `verificacao-completa-erp.json` na pasta da coleta.
