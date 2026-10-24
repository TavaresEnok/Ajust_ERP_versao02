# O.S.: PDF, encerramento e anotações

## Interface

- Removido botão PDF/Imprimir do detalhe. **Exportar PDF** baixa um arquivo PDF real, sem diálogo de impressão e sem CSV. Contém protocolo, descrição, responsável, provedor, situação e histórico/anotações, com quebra de páginas.
- Exportação CSV da listagem não é oferecida ao analista. Relatórios gerenciais mantêm suas exportações próprias.
- Anotações da O.S. usam editor controlado: limpa somente após salvamento confirmado, preserva o texto em falhas, tem contador e limite de 20.000 caracteres no frontend/backend. Conteúdos extensos devem ser anexados.
- Autor pode editar anotações manuais. Edição tem controle de versão, sincroniza o espelho na ocorrência e registra a mensagem anterior em auditoria. Eventos automáticos e comentários originais importados não são tornados editáveis.
- Migração reconcilia anotações manuais anteriores quando existe espelho de mesma autoria, texto e horário, sem presumir que todo evento do histórico seja uma anotação editável.

## Encerramento

O analista tem **Encerrar O.S.** e registro da solução. Ordens vinculadas exclusivamente a snapshots históricos de engine v2, sem passos ACTIVE/WAITING, podem usar as transições ordinárias. Isso corrige o bloqueio indevido das importadas sem desativar processos ativos, aprovações ou controle de versão. O snapshot histórico não é transformado em um fluxo vivo nem gera tarefas retroativas por inferência.

Processos ativos continuam pelo motor operacional e exigem evidências e resultados reais. As validações não foram ignoradas. O texto da conclusão também recebe limite e contador de 20.000 caracteres.

## Verificação

463 testes da API aprovados antes da adição dos cinco testes específicos desta mudança; 11 já ignorados. Novos testes cobrem autoria, isolamento, espelho, concorrência e distinção de histórico versus processo ativo. Typecheck web/API e lint dos arquivos envolvidos sem erros (aviso anterior sobre argumento não utilizado no controller).

No navegador: criado atendimento temporário, anotação salva com limpeza do campo, edição persistida com versão incrementada, edição por outro usuário rejeitada. Download conferido pela assinatura `%PDF-` e extração de texto com protocolo e anotação corrigida. Botão de encerramento visível tanto no temporário quanto na O.S. SGP-11952. Nenhuma O.S. real foi encerrada. Atendimento temporário removido após a verificação; eventos de auditoria de teste preservados.

Migrações aditivas `20261022170000_editable_order_annotations` e `20261022170100_existing_manual_annotations` aplicadas ao ERP atual. Histórico existente, anexos e porta 8071 preservados.
