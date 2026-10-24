# Versão anterior do Ajust ERP

Para comparação com o redesign atual, foi publicada uma cópia isolada do código disponível imediatamente antes da migração visual.

- Commit: `09ffe985adbd617d81621e35bd56853f886e2405` (`feat(core): gestao de sessoes, rate limiting ixc, snapshots cmdb com diff e escala on-call`)
- Data do commit: 16/10/2026 19:59 UTC
- Código isolado em: `/home/app/projects/Ajust_ERP-pre-redesign`
- Interface anterior: http://168.194.13.18:8071
- Interface atual: http://168.194.13.18:8070
- API anterior (uso interno da interface antiga): porta 8091
- API atual: porta 8092 (a porta 8071, antes usada pela API atual, foi liberada para a interface antiga)

## Limite da recuperação

Não existe nas referências Git locais/remotas consultadas um commit de 06/10/2026. A referência completa mais próxima anterior à troca de frontend é a de 16/10/2026. Portanto, ela não pode ser garantida como exatamente “duas semanas atrás”.

## Dados e isolamento

A API antiga usa o banco `ajust_erp_historic`, criado como cópia do banco atual no momento da publicação. É um banco separado: gravações feitas pela versão antiga não alteram o banco da versão atual. Porém, a cópia reflete os dados existentes no momento em que foi criada, não o estado dos dados no dia do commit; ela pode conter cadastros e registros migrados depois daquela versão do código.

## Operação

O checkout atual não foi revertido nem substituído. Os serviços da versão anterior rodam em containers Compose próprios, com o código em `/home/app/projects/Ajust_ERP-pre-redesign`. O arquivo Compose dessa cópia contém os ajustes locais necessários para usar as portas e o banco separados.

## Ajustes para a comparação visual

Após publicar a versão anterior, foram feitos dois ajustes locais na cópia de comparação:

- a tela de análise de provedores passou a paginar ocorrências em lotes de até 200, respeitando o limite da API;
- foi incluída uma tabela em linhas e colunas com o cadastro dos seis provedores SGP já existentes no banco copiado, pois esse cadastro independente não fazia parte do frontend do commit antigo. Os cartões iniciais foram substituídos pela tabela a pedido do usuário.

Essa grade é somente leitura e usa os registros existentes em `Customer`; não cria O.S. nem ocorrências artificiais. Esses ajustes estão no checkout de comparação, não no commit original de 16/10 nem no frontend atual da porta 8070.
