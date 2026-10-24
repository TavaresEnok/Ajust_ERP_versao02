# Cofre Meganet — execução em 23/10/2026

## Alterações aplicadas

- Inventário de 51 anotações, anteriormente representadas por 55 registros, revisado e identificado por categoria e contexto.
- Quatro switches Datacom separados pelos cabeçalhos explícitos dos locais.
- Seis fichas criadas pela separação entre aplicação e administração de servidor nos conjuntos phpIPAM e monitoramento. Banco e sistema operacional continuam com os rótulos originais, sem presumir igualdade de contas.
- Total resultante: 65 registros, incluindo documentos de referência preservados. Isso **não** representa 65 equipamentos distintos.
- ASN/prefixos classificados em Rede; links/operadoras em Circuitos. Não exigem senha.
- Ficha técnica criptografada, com consulta auditada e edição pelos perfis internos autorizados. Originais preservados separadamente.
- Documentos de referência omitidos na seleção inicial, consultáveis pela categoria DOCUMENTO ou pela busca.
- Alterações de dados auditadas e scripts com proteção contra repetição das criações.

## Limites e pendências de conteúdo

Não houve conexão experimental aos equipamentos. Informações antigas, identidade de contas e finalidade desconhecida permanecem sinalizadas. Registros potencialmente sobrepostos não foram fundidos. Os valores dos conjuntos complexos estão na ficha protegida, conservando rótulos e sequência; não foram todos convertidos em campos individuais de endpoint/porta/conta. As orientações públicas não contêm os valores de autenticação.

Backup anterior à reorganização: `/tmp/ajust-vault-pilot.WERLLl/database.dump`, acesso restrito. Esse backup é temporário e não substitui uma política de backup permanente com a chave de criptografia do cofre.

## Verificação

API e web passaram na checagem de tipos após a introdução da ficha protegida; 17 testes da API passaram. O teste de navegador verifica a navegação por provedor, a presença da ficha, os quatro switches separados e a ausência dos campos protegidos na listagem. Nenhuma senha é registrada nos logs dos scripts de organização.
