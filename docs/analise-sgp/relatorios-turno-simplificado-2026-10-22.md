# Relatórios de turno — versão simplificada

Solicitação do usuário: retirar início/fim, rascunhos e botão de publicação. Usar apenas data e tornar o relatório salvo visível à equipe.

- Data selecionada pelo autor, plantão diurno/noturno e texto do relatório. Nome vem da sessão autenticada.
- Um único botão **Salvar relatório**; o salvamento compartilha imediatamente com analistas e gestores da Ajust. Clientes continuam bloqueados. Minhas notas é o lugar para rascunhos.
- Vínculo de O.S. por busca de ID/UUID/protocolo: digitar, buscar, conferir título/protocolo e clicar para vincular. Resultados limitados a dez, validados na empresa autenticada. Vínculos persistidos mostram protocolo após reabrir.
- Tabela de data, analista, plantão e Abrir ao lado do conteúdo em telas largas; empilhamento em telas pequenas. Filtros por autor, data e plantão aplicados no servidor.
- Paginação de 50 registros no banco, ordenação determinística por data/criação/ID. Conteúdo e histórico de revisões só são consultados ao abrir o relatório; não se carrega o texto de mil relatórios na listagem.
- Preservados controle de versão concorrente, histórico e edição exclusiva pelo autor.

A migração aditiva tornou opcionais as antigas colunas de horários, preservadas por compatibilidade histórica mas não usadas no fluxo novo. Foi conferida ausência de rascunhos privados antes da mudança. Nenhuma conta ou relatório real foi excluído.

Validação: sete testes específicos aprovados, incluindo consulta da página que contém o milésimo registro (offset 950, limite 50), sem criar mil relatórios fictícios. Typecheck web/API. A capacidade estrutural de paginação não equivale a um benchmark de carga de produção.
