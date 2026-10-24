# Integração IXC usada pelo Hub Ajust

Este documento descreve o contrato observado no código atual do Hub Ajust para outro serviço implementar chamadas de leitura e testes. Não contém credenciais reais. Obtenha URL e token por canal seguro e use uma conta de integração com permissões mínimas.

## Documentação IXC

- [Documentação API IXC Provedor](https://wikiapiprovedor.ixcsoft.com.br/)
- [Como gerar token para integrações API](https://wiki-erp.ixcsoft.com.br/documentacao/guias-tutoriais/api/como-gerar-um-token-para-integracoes-api)

## Configuração da conexão

O Hub mantém a configuração por empresa (tenant), nos campos `tenants.ixc_url` e `tenants.ixc_token`; o seletor `tenants.erp_system` deve ser `ixc`. A configuração é mantida pelo painel administrativo. A URL é o host IXC, por exemplo `https://ixc.exemplo.com.br` (sem `/webservice/v1` no final, pois o código acrescenta o caminho).

No Hub, `ixc_url` e `ixc_token` ficam no banco PostgreSQL, não nas variáveis gerais de `.env`. Para o sistema novo, prefira uma credencial própria com permissões mínimas, ou distribua a credencial existente por um gerenciador de segredos. Não a coloque em código, documentação, tickets ou logs.

## Autenticação e formato

O serviço usa `POST` com JSON para `https://<host>/webservice/v1/<tabela>`. Cabeçalhos:

```http
ixcsoft: listar
Authorization: Basic <base64(token)>
Content-Type: application/json
```

O código atual codifica o valor de `ixc_token` em Base64 e o envia como `Authorization: Basic ...`. Base64 é apenas codificação, não proteção. Use HTTPS e proteja o token como senha.

## Chamadas que o Hub faz

### Listar tickets atribuídos a usuário(s)

`POST /webservice/v1/su_ticket`

```json
{
  "qtype": "su_ticket.id_usuarios",
  "query": "<ID_USUARIO_IXC>",
  "oper": "=",
  "page": "1",
  "rp": "200",
  "sortname": "su_ticket.id",
  "sortorder": "desc"
}
```

O Hub pagina em lotes de 200 até não haver mais resultados. Para cada usuário configurado, busca tickets e elimina duplicatas por `id`.

### Buscar chamado/OS associado a um ticket

`POST /webservice/v1/su_oss_chamado`

```json
{
  "qtype": "su_oss_chamado.id_ticket",
  "query": "<ID_TICKET>",
  "oper": "=",
  "page": "1",
  "rp": "1"
}
```

O Hub usa o ticket como registro principal e consulta o chamado associado para complementar status, datas, técnico e cliente. Para o protocolo exibido ao operador, prioriza `su_ticket.protocolo`.

### Exemplo de teste com cURL

Defina `IXC_BASE_URL` e `IXC_TOKEN` no ambiente local, sem colocar valores reais no histórico do shell. O exemplo a seguir mostra a chamada; o processo cliente precisa Base64-encodar o token conforme o código do Hub:

```bash
AUTH=$(printf '%s' "$IXC_TOKEN" | base64 | tr -d '\n')
curl --fail-with-body --silent --show-error \
  -X POST "$IXC_BASE_URL/webservice/v1/su_ticket" \
  -H "ixcsoft: listar" \
  -H "Authorization: Basic $AUTH" \
  -H 'Content-Type: application/json' \
  --data '{"qtype":"su_ticket.id_usuarios","query":"<ID_USUARIO_IXC>","oper":"=","page":"1","rp":"1","sortname":"su_ticket.id","sortorder":"desc"}'
```

Substitua `<ID_USUARIO_IXC>` por um usuário permitido para a integração. Comece com `rp: "1"` e validação de leitura antes de executar sincronizações maiores.

## Como a sincronização entra no Hub

O worker Celery procura tenants com `ixc_url` e `ixc_token`; quando `erp_system == "ixc"`, chama `IxcSyncService`. A busca é restringida pelos IDs configurados em `sgp_ajust_user_id` e pela configuração de usuários monitorados. O Hub grava/atualiza ordens de serviço localmente. Os estados IXC `F`, `E`, `C`, `RE`, `CA` e `FE` são tratados como encerrados.

## Limitações e segurança observadas no código

- A sincronização atual é somente leitura no IXC (`ixcsoft: listar`), mas os dois clientes precisam receber permissões estritamente necessárias.
- `ixc_sync.py` desabilita a verificação de certificado TLS (`verify=False`). Um cliente novo deve validar certificados normalmente; considere corrigir essa opção no Hub.
- O código atual de configuração administrativa serializa `ixc_token` em respostas da API. Evite reutilizar esse endpoint para distribuir o segredo; idealmente, a resposta deve mascará-lo e permitir atualização sem leitura.
- Há credenciais IXC e credenciais de usuário de aplicação hardcoded em `backend/scripts/create_upconnect.py`. Trate-as como expostas: revogue/rotacione-as no sistema de origem e no Hub, remova os valores do histórico Git e verifique cópias de backup. Este documento não reproduz esses valores.

## Onde conferir a implementação

- Cliente, autenticação HTTP, tabelas, filtros e paginação: `backend/app/services/ixc_sync.py`
- Seleção do conector e sincronização periódica: `backend/app/worker.py`
- Campos por tenant: `backend/app/models/tenants.py`
- Tela de configuração: `frontend/src/views/admin/AdminTenantConfigView.vue`
- Script legado contendo credenciais hardcoded: `backend/scripts/create_upconnect.py` (não compartilhar; rotacionar os segredos)
