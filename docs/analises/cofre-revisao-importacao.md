# Revisão do cofre: importação das anotações do SGP e telas

Data: 12/11/2026. Base analisada: produção, 3.621 itens de 143 provedores (dos 150 cadastrados).
A análise leu cada item decifrado dentro do servidor e só gerou contagens; nenhuma senha foi
exibida ou copiada.

## Resumo

- **Nada se perdeu.** Todos os 3.621 itens guardam a anotação original do SGP, inteira e
  protegida, dentro do próprio item.
- **2.388 itens (66%) foram importados completos**: endereço, usuário e senha nos campos certos.
- **O restante tem a informação guardada, mas mal organizada**: está só no texto de "dados
  adicionais", e não nos campos que o analista copia e que a extensão usa.
- **As telas mostram bem o item simples e mal os demais**: itens com vários acessos, anotações
  que não são acesso e itens sem senha.

## Problemas nos dados

| # | Problema | Itens | Efeito para o analista |
|---|----------|------:|------------------------|
| D1 | Vários usuários e senhas grudados num campo só ("usuario1 / usuario2", "senha1 / senha2") | 183 (154 com pares que casam) | Copiar usuário ou senha traz os dois juntos; a entrada automática não funciona |
| D2 | Nota com mais de um acesso (2 ou mais senhas rotuladas) e só o primeiro virou campo | 389 | Os outros acessos ficam escondidos no texto |
| D3 | Método de acesso "OUTROS" quando a nota diz telnet, winbox, ssh ou web | 362 de 1.544 (telnet 161, winbox 121, ssh 43, web 37) | O item não diz como entrar |
| D4 | Nota cita a porta e o campo de endereço ficou sem ela | 681 | O analista precisa abrir os dados adicionais para achar a porta |
| D5 | Endereço com texto sobrando ("http://1.2.3.4/%20(GRAFANA)"), ou nome com código HTML | 23 | "Abrir site" abre endereço errado |
| D6 | Texto protegido ainda com códigos HTML (&amp;nbsp; e parecidos) | 51 | Texto sujo, e senha com caractere trocado em alguns casos |
| D7 | Itens "A conferir" | 675 | Ver detalhamento abaixo |
| D8 | Nome genérico "Acesso · anotação SGP 1234" | 88 | Não dá para achar pelo nome |
| D9 | Nome repetido com sufixo "(2)", "(3)" | 251 | Aceitável: são notas diferentes com o mesmo título no SGP |
| D10 | Duplicados exatos (mesmo provedor, endereço, usuário e senha) | 52 a mais, em 49 grupos | Lista poluída |
| D11 | "Ambiente: NAO_INFORMADO" | 3.556 | Informação sem valor ocupando a tela |
| D12 | Senha igual ao usuário | 57 | Provavelmente verdadeiro (admin/admin); só conferir |
| D13 | Provedores sem nenhum item no cofre | 7 | Conferir se não tinham anotações no SGP |

### D7: o que são os 675 "A conferir"

- **261 têm endereço e senha rotulada na nota** e ficaram sem usuário e senha nos campos, porque
  a nota tem mais de um acesso ou um formato diferente. Dá para organizar automaticamente a
  maior parte.
- **397 têm endereço, mas não têm credencial**: são links (Drive, painéis), contatos e
  equipamentos anotados só com o IP.
- **17 não têm endereço**: avisos e textos, como "bloco de IPs X não deve ser roteado".
- Só 36 dos 675 ficaram sem endereço no campo.

O nome "A conferir" passa a ideia de erro, mas a maioria é só informação que não é um acesso.

### D13: provedores sem itens

CLEYTON BARBOSA DA SILVA, LOGLINK INFORMATICA, NETKOM, TIAGO OLIVEIRA SILVA, TWIX TELECOM
COMUNICACAO MULTIMIDIA, ULTRALINK, YAGO BEZZERA BRASILIANO.

## Problemas nas telas

| # | Problema | Onde |
|---|----------|------|
| U1 | Item sem senha mostra "••••••••" com botões de ver e copiar, como se houvesse senha | Detalhe do item (909 itens sem senha) |
| U2 | Usuário "a / b" aparece como um usuário só | Lista e detalhe |
| U3 | Selo do método mostra "ACESSO" ou "SEM_ACESSO", texto técnico | Detalhe |
| U4 | "Ambiente: NAO_INFORMADO" em quase todos os itens | Detalhe |
| U5 | Anotações que são texto (avisos, documentos) aparecem como acesso, com campos "Não informado", e o texto fica escondido atrás de "Consultar dados adicionais" | Detalhe de "A conferir" e "Documentos" |
| U6 | A aba "Orientações" mostra só "Importado da anotação SGP #1234"; as orientações de verdade estão nos dados adicionais | Detalhe |
| U7 | Título longo cortado no meio da palavra na lista e enorme no cabeçalho do detalhe | Lista e detalhe |
| U8 | Porta e método ("Porta TELNET: 23935") só aparecem nos dados adicionais | Detalhe |
| U9 | Os três cartões do topo (provedores, última alteração, itens) repetem números gerais dentro de cada provedor e empurram a lista para baixo | Cofre do provedor, pior no celular |
| U10 | No celular, a lista de categorias vira uma faixa horizontal que esconde as demais | Cofre do provedor |
| U11 | Limite de 30 consultas por hora por analista: cada "dados adicionais" conta, e sem a janela de senha o analista consulta mais | Regra do servidor |

O que está bom: a busca (já prioriza o nome), as categorias à esquerda, o carregamento rápido
(INFOTEL com 169 itens em 0,6 s), o bloco "dados adicionais" (separa IP, login e senha com
botão de copiar) e o histórico por item.

## Plano de correção proposto

Antes de qualquer mudança: cópia de segurança da tabela do cofre. A anotação original de cada
item nunca é alterada.

**Etapa 1: dados, automático e conferido por contagem**
1. Separar os 154 itens "usuario1 / usuario2" em acessos distintos dentro do mesmo item.
2. Ler as notas com vários acessos (389) e criar um acesso estruturado para cada um.
3. Preencher método (telnet, winbox, ssh, web) e porta a partir da nota.
4. Limpar endereços e nomes com lixo e os textos com códigos HTML.
5. Reclassificar "A conferir": com credencial organizada vai para a categoria certa (pelo nome:
   OLT, switch, Zabbix...); link sem credencial vai para "Links e referências"; texto vai para
   "Documentos". Fica em "A conferir" só o que for ambíguo de verdade.
6. Dar nome aos 88 genéricos (pelo domínio ou pela primeira linha da nota).
7. Marcar os duplicados exatos para revisão, sem apagar.

**Etapa 2: telas**
1. Item sem senha: mostrar "Sem senha cadastrada", sem bolinhas.
2. Vários acessos: um bloco por acesso, cada um com copiar e "Entrar automaticamente".
3. Mostrar método e porta em português no bloco do acesso; esconder "Ambiente" não informado.
4. Anotação que é texto: abrir como documento (texto em destaque), sem campos de acesso vazios.
5. Orientações: mostrar o texto da nota sem as senhas; tirar o "Importado da anotação...".
6. Títulos longos: cortar com reticências na palavra; cabeçalho com tamanho normal.
7. Tirar os cartões gerais de dentro do provedor; no celular, categorias em lista que abre.
8. Subir o limite de consultas por hora (sugestão: 120 analista, 240 gerente).

## Por provedor

Colunas: itens | a conferir | usuário "a / b" | nome genérico | sem endereço (fora documentos
e circuitos) | método "OUTROS" com IP.

| Provedor | Itens | A conferir | "a / b" | Genérico | Sem endereço | OUTROS com IP |
|---|---:|---:|---:|---:|---:|---:|
Output format is unaligned.
Field separator is " | ".
| AJUST CONSULTING | 187 | 51 | 6 | 2 | 13 | 16 |
| CNB TELECOM | 187 | 11 | 1 | 0 | 3 | 177 |
| INFOTEL | 176 | 35 | 7 | 0 | 6 | 58 |
| PIXFIBRA | 113 | 17 | 4 | 1 | 1 | 36 |
| FLASH NET TELECOMUNICACOES | 103 | 28 | 0 | 3 | 6 | 26 |
| MARTINS TELECOM (DESATIVADO) | 100 | 15 | 4 | 1 | 11 | 20 |
| UP CONNECT FIBRA | 74 | 11 | 2 | 0 | 10 | 21 |
| VIBE | 72 | 8 | 8 | 5 | 4 | 37 |
| ULTRANET | 72 | 15 | 3 | 4 | 6 | 20 |
| I4 TELECOM | 72 | 11 | 5 | 2 | 3 | 34 |
| MEGANET | 65 | 5 | 8 | 0 | 12 | 27 |
| G5 JABOATÃO | 65 | 13 | 3 | 1 | 4 | 25 |
| POWERTEC TELECOMUNICAÇÕES | 64 | 17 | 1 | 3 | 1 | 30 |
| PLANALTO NET | 62 | 5 | 1 | 0 | 1 | 34 |
| RIONET | 60 | 13 | 7 | 3 | 2 | 27 |
| GL SOLUÇÕES | 57 | 13 | 3 | 6 | 3 | 20 |
| PGI TELECOM | 53 | 12 | 4 | 1 | 2 | 30 |
| PONTE DIGITAL | 53 | 13 | 5 | 0 | 1 | 27 |
| AF TELECOM | 52 | 7 | 1 | 0 | 1 | 17 |
| SOFIANET | 51 | 9 | 3 | 1 | 0 | 28 |
| MGN FIBRA | 50 | 13 | 8 | 0 | 2 | 22 |
| CONECT | 50 | 8 | 1 | 4 | 1 | 26 |
| MAXIMANET | 47 | 18 | 3 | 0 | 2 | 23 |
| TC+ FIBRA | 46 | 8 | 3 | 0 | 5 | 11 |
| VESCNET | 45 | 7 | 1 | 0 | 0 | 25 |
| AQUI TELECOM | 44 | 8 | 0 | 1 | 2 | 17 |
| GRUPO FLASHNET / IB TELECOM | 42 | 9 | 2 | 0 | 1 | 17 |
| INET | 38 | 4 | 1 | 0 | 1 | 10 |
| INFORTEC | 36 | 13 | 1 | 0 | 4 | 10 |
| WELL FIBRA | 36 | 10 | 3 | 3 | 2 | 18 |
| CYBERNET | 36 | 9 | 1 | 1 | 3 | 11 |
| G5 CABO | 35 | 8 | 2 | 2 | 3 | 18 |
| MOOD | 32 | 3 | 2 | 1 | 2 | 11 |
| KM TELECOM | 32 | 13 | 2 | 2 | 4 | 7 |
| BVNET | 31 | 8 | 1 | 0 | 5 | 10 |
| SN TELECOM | 30 | 8 | 2 | 1 | 1 | 9 |
| UM FIBRA | 29 | 3 | 0 | 3 | 1 | 18 |
| HOMENET | 29 | 6 | 2 | 0 | 0 | 13 |
| ECOTELECOM | 28 | 4 | 4 | 0 | 0 | 10 |
| G5 UNYNET - THIAGO | 28 | 1 | 2 | 0 | 0 | 15 |
| CELLNEET | 27 | 6 | 1 | 0 | 1 | 10 |
| SUCUPIRA NET | 26 | 6 | 1 | 0 | 1 | 14 |
| G5 WILL | 25 | 5 | 2 | 2 | 2 | 11 |
| INSNET | 25 | 8 | 0 | 0 | 0 | 9 |
| GRUPO TELECOM | 24 | 15 | 1 | 0 | 1 | 9 |
| ALYSON NET | 24 | 0 | 2 | 0 | 0 | 12 |
| SIN FIBRA | 23 | 6 | 0 | 6 | 3 | 9 |
| NAVEGANET | 23 | 3 | 2 | 0 | 0 | 8 |
| NETSETUP | 23 | 0 | 3 | 0 | 0 | 10 |
| FIBERMAIS | 22 | 2 | 0 | 1 | 1 | 9 |
| ALPHAVILLE (DESATIVADO) | 22 | 7 | 2 | 0 | 3 | 9 |
| FUTURE TELECOM | 22 | 2 | 1 | 0 | 0 | 12 |
| MCNET | 22 | 5 | 0 | 2 | 1 | 8 |
| VOICECORP TELECOMUNICACOES | 22 | 1 | 1 | 0 | 0 | 14 |
| VOO TELECOM | 21 | 2 | 0 | 0 | 1 | 10 |
| MULTNET | 21 | 2 | 2 | 0 | 0 | 10 |
| LINSNET | 21 | 3 | 0 | 0 | 2 | 16 |
| T S MONTENEGRO SERVICOS DE TI | 21 | 10 | 0 | 0 | 1 | 1 |
| SIMONE BARBOSA DO NASCIMENTO SOUZA COMUNICAÇÃO | 19 | 7 | 1 | 0 | 3 | 9 |
| ATIVATEC | 19 | 2 | 2 | 0 | 1 | 8 |
| ELO | 19 | 4 | 1 | 1 | 3 | 5 |
| QUALYNET | 19 | 3 | 1 | 8 | 1 | 10 |
| JANET | 18 | 6 | 5 | 0 | 0 | 8 |
| NEW CONNECT | 18 | 3 | 1 | 0 | 0 | 5 |
| CAVALCANTINET | 18 | 2 | 0 | 4 | 2 | 12 |
| JRNET | 18 | 2 | 1 | 0 | 1 | 3 |
| SUPERNET CAMARAGIBE | 16 | 1 | 0 | 0 | 2 | 9 |
| REAL NET | 16 | 3 | 1 | 1 | 2 | 7 |
| MOND TELECOM | 16 | 3 | 0 | 0 | 1 | 6 |
| INFOLINK TELECOM | 16 | 4 | 0 | 0 | 1 | 3 |
| MAS.NET | 15 | 2 | 1 | 1 | 0 | 7 |
| OGA FIBRA | 15 | 3 | 2 | 0 | 0 | 8 |
| GO FIBRA SERVICOS DE COMUNICACOES | 15 | 4 | 0 | 0 | 1 | 8 |
| RCR TELECOM | 15 | 0 | 0 | 0 | 0 | 4 |
| ALPHANET | 15 | 1 | 1 | 0 | 0 | 9 |
| ICONLINK | 14 | 2 | 2 | 0 | 1 | 5 |
| VIASKY INTERNET | 14 | 9 | 0 | 0 | 1 | 4 |
| SCHIVAS TELECOM | 13 | 2 | 0 | 0 | 0 | 11 |
| LINE CONECT COMUNICACOES | 13 | 1 | 0 | 1 | 3 | 8 |
| GMAX SÃO LOURENÇO | 13 | 1 | 2 | 0 | 2 | 4 |
| TONYNET | 13 | 3 | 0 | 0 | 1 | 7 |
| LIVRE LINK SERVIÇOS DE TELECOMUNICAÇÕES | 12 | 1 | 1 | 6 | 1 | 9 |
| ULTRAFIBRA | 12 | 0 | 1 | 0 | 0 | 5 |
| PONTONET | 12 | 2 | 1 | 0 | 0 | 6 |
| CLICK NET | 12 | 3 | 0 | 0 | 0 | 8 |
| CENTRALNET | 12 | 2 | 0 | 0 | 0 | 5 |
| FOX SOLUÇÕES TELECOM C.A | 11 | 5 | 0 | 2 | 0 | 9 |
| FNET JABOATAO | 11 | 0 | 0 | 0 | 0 | 9 |
| L. LUCAS DA SILVA | 11 | 1 | 0 | 0 | 0 | 5 |
| RNET | 11 | 1 | 3 | 0 | 1 | 9 |
| ZOOM FIBRA | 10 | 2 | 2 | 1 | 0 | 5 |
| LINK WIRELESS LINKTECH SOLUCOES | 10 | 7 | 0 | 0 | 0 | 5 |
| NECONET (DESATIVADO) | 10 | 0 | 1 | 0 | 0 | 4 |
| G5 PIEDADE | 9 | 2 | 2 | 0 | 0 | 5 |
| SUPERNET | 9 | 1 | 0 | 0 | 2 | 5 |
| UM TELECOM | 8 | 1 | 0 | 0 | 0 | 2 |
| G5 BARRA DE JANGADA | 8 | 0 | 1 | 0 | 0 | 4 |
| MUNDONET | 8 | 0 | 2 | 0 | 0 | 5 |
| PERNAMBUCO AGENCIA PRODUTORA DE EVENTOS CORPORATIVOS | 7 | 1 | 1 | 0 | 1 | 1 |
| JDI TELECOM | 7 | 0 | 0 | 0 | 0 | 4 |
| G4 TELECOM SERVICOS DE TELECOMUNICACOES | 7 | 0 | 1 | 0 | 0 | 5 |
| BCA LINK | 7 | 1 | 0 | 0 | 1 | 2 |
| DINHONET | 7 | 0 | 2 | 0 | 1 | 4 |
| FORTE NET | 7 | 0 | 1 | 0 | 0 | 3 |
| MEGALINK TELECOM | 7 | 1 | 1 | 0 | 0 | 5 |
| TECH SOLUÇÕES | 6 | 0 | 0 | 0 | 0 | 3 |
| SHALOMFIBRA | 6 | 0 | 1 | 0 | 0 | 1 |
| G5 PRAZERES | 6 | 1 | 0 | 0 | 0 | 5 |
| NETMANIA | 6 | 0 | 0 | 0 | 0 | 2 |
| PRIME NET TELECOM | 6 | 1 | 0 | 0 | 0 | 5 |
| FOXNET | 6 | 0 | 1 | 0 | 0 | 3 |
| BWN COMUNICACAO | 6 | 0 | 0 | 1 | 0 | 3 |
| WORLD FIBRA | 5 | 1 | 1 | 0 | 0 | 2 |
| SONIC NET PE | 5 | 1 | 0 | 0 | 0 | 4 |
| POWERNET TELECOMUNICACOES | 5 | 2 | 0 | 0 | 0 | 4 |
| N. P PROVEDORES DE ACESSO AS REDES DE COMUNICACOES | 5 | 2 | 0 | 0 | 0 | 2 |
| GFIBRA | 5 | 2 | 0 | 0 | 0 | 2 |
| SPEED CONNECTION | 5 | 2 | 1 | 0 | 0 | 2 |
| VGL TELECOM | 4 | 0 | 0 | 0 | 0 | 2 |
| F. NET TECNOLOGIA | 4 | 1 | 0 | 0 | 1 | 2 |
| ORA SERVICOS DE TELECOMUNICACOES | 4 | 4 | 0 | 0 | 0 | 2 |
| VOOLPNET | 4 | 1 | 0 | 0 | 0 | 2 |
| I3 FIBRA SERVICOS DE COMUNICACAO | 4 | 0 | 0 | 0 | 0 | 1 |
| DUNET | 4 | 1 | 0 | 0 | 0 | 2 |
| ASSOCIACAO EDUCACIONAL E CULTURAL ARCO IRIS | 4 | 1 | 1 | 0 | 0 | 2 |
| ONDANET | 3 | 0 | 0 | 0 | 0 | 1 |
| MURILO NET | 3 | 0 | 0 | 0 | 0 | 2 |
| GMAX ITAMARACÁ (DESATIVADO) | 3 | 0 | 0 | 0 | 0 | 1 |
| COMERCIAL BEZERRA | 3 | 0 | 0 | 0 | 0 | 3 |
| CN FIBRA | 3 | 0 | 1 | 0 | 0 | 1 |
| LELO NET (DESATIVADO) | 3 | 1 | 0 | 0 | 0 | 2 |
| POWER FIBRA SERVICOS DE COMUNICACAO | 2 | 0 | 0 | 0 | 0 | 1 |
| RONNY NET | 2 | 1 | 0 | 0 | 0 | 2 |
| POWERFLASH | 2 | 0 | 0 | 0 | 0 | 1 |
| TBNET INFORMATICA | 1 | 0 | 1 | 0 | 0 | 0 |
| CIX TELECOM | 1 | 0 | 0 | 0 | 0 | 0 |
| PLAYNET | 1 | 0 | 0 | 0 | 0 | 0 |
| ONDA NET | 1 | 0 | 0 | 0 | 0 | 1 |
| PAULO DA SILVA JUNIOR | 1 | 0 | 0 | 0 | 0 | 0 |
| JNET TECNOLOGIA EM INTERNET | 1 | 0 | 0 | 0 | 0 | 1 |
| STR NET | 1 | 0 | 0 | 0 | 0 | 1 |
| WINS MARKETING | 1 | 1 | 0 | 0 | 1 | 0 |
| GD TECH IPTV | 1 | 0 | 0 | 0 | 0 | 0 |
