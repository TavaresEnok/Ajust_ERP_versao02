# Topologia de rede por provedor

## Navegação

No portal do analista, **Escala de plantão** pertence a **Meu trabalho**.

**Topologia de rede** substitui a antiga tela de equipamentos em `/analista/ativos` e `/gerencia/ativos`. A lista apresenta os provedores cadastrados, busca, filtro com/sem diagrama, paginação e metadados da última alteração. Cada provedor abre seu próprio diagrama. O cadastro legado de ativos e seus snapshots permanecem no banco, sem conversão automática para diagramas.

## Draw.io

O editor é servido pelo próprio ERP em `/drawio/index.html`, por um serviço Docker interno `drawio`, com imagem oficial fixada por versão e digest. Nenhuma porta adicional do editor é publicada. O Next encaminha os recursos para `http://drawio:8080/drawio/`; `DRAWIO_INTERNAL_URL` permite alterar o destino interno. O modo `offline=1` desabilita integrações de armazenamento em nuvem.

Ao abrir um provedor com topologia, o diagrama aparece em modo de consulta. **Editar topologia** abre o draw.io. **Salvar alterações** grava no ERP e cria uma revisão. Importação e criação abrem o editor para conferência antes da gravação. O editor avisa sobre alterações não salvas e permite baixar uma cópia.

Importação: `.drawio`, XML, SVG com atributo de conteúdo editável e PNG com metadados do draw.io. Limite de arquivo/XML de 8 MB. O editor mantém as páginas do arquivo; o servidor valida documentos compactados e não compactados, limita a expansão e rejeita entidades XML/DOCTYPE.

## Persistência e permissões

Uma topologia principal por cliente; diagramas com várias páginas podem representar POPs e outras subdivisões. `NetworkTopology` armazena a versão atual; `NetworkTopologyRevision` preserva cada versão anterior. XML criptografado com o mecanismo existente de segredos; listagem e histórico não retornam XML. A consulta ao diagrama individual é autenticada e restrita à equipe interna da Ajust. O corpo XML é ocultado dos logs de auditoria.

Analistas, gestores e administradores podem consultar, importar e editar. Clientes não acessam esta documentação interna. Toda gravação exige a versão esperada; gravações concorrentes não sobrescrevem silenciosamente a versão existente. Restaurar uma versão pelo histórico abre uma cópia no editor e, ao salvar, gera uma nova revisão.

Migração: `20261024160000_network_topologies`. Backup anterior à aplicação no servidor: `/tmp/ajust-topologia.wivMqa/database.dump`.

## Migração do BookStack

A integração está pronta para receber arquivos reais. Origem informada: `https://bookstack.ajustconsulting.com.br`, estante `/shelves/diagramas-de-rede`. Exemplo: livro `sofianet`, página `diagrama-sofianet-atualizado`. Ainda falta o token de API de uma conta autorizada a consultar essa estante, suas páginas e imagens. A documentação da instância está em `/api/docs`, mediante login.

O arquivo local `.env.bookstack` contém a URL e campos vazios `BOOKSTACK_TOKEN_ID` e `BOOKSTACK_TOKEN_SECRET`. Esse arquivo é ignorado pelo Git. O token herda as permissões da conta: para uma migração somente de leitura, usar um usuário com a permissão de acesso à API e leitura do conteúdo necessário. A API permite ler estantes, livros, páginas e dados das imagens; não é necessário exportar manualmente cada diagrama.

Nenhum diagrama foi inventado ou atribuído automaticamente a clientes reais. Exportações com imagens ou bibliotecas externas precisam ter esses recursos incorporados ou migrados junto com o XML; não basta copiar um link privado do BookStack. A migração deverá identificar os livros da estante, correlacioná-los aos provedores cadastrados e preservar os dados editáveis dos desenhos, sinalizando nomes ambíguos para revisão.

Referências oficiais: [protocolo de integração draw.io](https://www.drawio.com/docs/reference/embed-mode/), [imagem Docker oficial](https://github.com/jgraph/docker-drawio).

## Verificação

`scripts/check-network-topologies.cjs` verifica o caminho real pelo navegador com um provedor temporário, editor draw.io real, importação, gravação, visualização, download, histórico, rejeição de versão antiga e apresentação mobile. `scripts/topology-review-fixture.ts` cria e remove exclusivamente dados identificados pelo token da verificação. Nenhuma topologia de cliente real é usada como rascunho de teste.

Os testes da API validam XMLs compactados, múltiplas páginas, arquivos inválidos e expansão excessiva, além de criptografia, isolamento, histórico e conflito de versões, com rollback dos dados de teste.

Resultado desta entrega: verificação de tipos da API e da interface concluída; ESLint dos componentes alterados sem erros; 20 testes da API aprovados. O roteiro de navegador passou com o draw.io local real, inclusive gravação de XML acima de 2 MB e listagem a 390 px. Provedores e diagramas temporários foram removidos ao final.
