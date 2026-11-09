# Correção do SLA individual dos analistas

## Problema e resultado

Na revisão da gerência, a coluna de SLA da equipe e o cartão do integrante consumiam `slaPercentage`, mas `/iam/users` não calculava nem retornava esse campo. A tela ficava sem um indicador verificável e sem explicar a base utilizada.

A API agora retorna o percentual, o número de O.S. avaliadas e quantas cumpriram o prazo. A equipe e o detalhe do integrante apresentam o percentual com formatação brasileira e a amostra, por exemplo, **66,7% · 2 de 3 O.S. no prazo**. Ausência de amostra aparece como **Sem base**, distinguindo-a de um resultado real de **0%**.

## Regra adotada

- Considera todo o histórico das ordens atribuídas **atualmente** ao integrante, tanto do ERP quanto importadas.
- Avalia somente `RESOLVIDA` e `FECHADA`, elegíveis para SLA e com conclusão válida: não anterior à criação nem futura.
- Compara `resolvedAt` com `deadlineAt`, incluindo o instante exato do prazo. Usa `closedAt` quando não existe data de resolução.
- O fechamento administrativo posterior à resolução não prejudica uma entrega concluída no prazo.
- Exclui registros demonstrativos e excluídos, cancelamentos, ordens abertas/reabertas e registros de outras empresas.
- Calcula `no prazo / avaliadas × 100`, arredondado para uma casa decimal. Retorna `null` se não houver amostra.
- Transferências alteram o histórico apresentado, porque a dimensão é o responsável atual. A interface explica esse limite; este indicador não atribui individualmente o tempo de trabalho de cada participante de uma O.S.

As contagens e o SLA usam uma única agregação no PostgreSQL, com o identificador da empresa parametrizado e uma mesma fotografia dos dados. Isso também elimina a inconsistência possível nas duas consultas separadas usadas anteriormente para subtrair demonstrações. O histórico completo não é carregado na memória da API.

## Verificação

O teste de navegador usa PostgreSQL descartável e a API real, sem respostas simuladas. Inclui resolução anterior ao fechamento administrativo, importação SGP, conclusão exatamente no prazo, atraso, inelegibilidade, cancelamento, ordem aberta/reaberta, datas ausentes/inválidas/futuras, demonstração, exclusão e isolamento entre empresas. Confere a API, a tabela da equipe e o detalhe do integrante, além da atualização após transferência e da transição para ausência de amostra.

Resultado desta execução:

- **9 de 9 cenários da gerência aprovados**, incluindo o novo cenário individual.
- **687 testes da API aprovados**, com 22 testes condicionados a banco fora da execução unitária.
- Compilação da API e do frontend, TypeScript dos quatro pacotes, lint dos arquivos alterados e formatação aprovados.
- Evidências em `/tmp/ajust-manager-journey.M83nGF/`, incluindo `browser/` com a captura `08-sla-individual.png`, logs e compilações. Resultado completo em `journey.log` nessa pasta.
- Teste unitário confere associação dos resultados ao integrante, arredondamento, zero real, ausência de amostra e parametrização da empresa. As regras SQL são exercitadas com PostgreSQL real pelo teste de navegador.

Reprodução:

```bash
pnpm test:manager:journey
```

A correção está no código. Não houve implantação em produção nem alteração dos dados em uso. A homologação de usabilidade com analistas e gestores reais continua sendo o próximo passo antes da ampliação da operação.
