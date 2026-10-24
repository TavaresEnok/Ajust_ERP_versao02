# Relatórios de turno — 22/10/2026

> Especificação inicial substituída pela simplificação solicitada: ver [versão atual](relatorios-turno-simplificado-2026-10-22.md). Na interface atual só há data, e salvar compartilha diretamente com a equipe. Não há mais rascunho/publicação separados ou horários de expediente.

Acesso: `/analista/relatorios-turno`, em **Meu trabalho**. A gerência também dispõe de `/gerencia/relatorios-turno`.

## Uso

1. Novo relatório: selecionar plantão diurno/noturno e início/fim do expediente no horário de Fortaleza.
2. Registrar resumo, atividades, pendências e pontos de atenção. O modelo de texto é editável; não há geração de trabalho fictício.
3. Opcionalmente vincular O.S. reais, selecionando as atribuídas ao próprio usuário.
4. Salvar rascunho, privado ao autor, ou confirmar publicação para a equipe.
5. Consultar Meus relatórios ou Relatórios da equipe, com filtros por autor, plantão e intervalo de datas. Listagem paginada em grupos de 50.

O nome vem da conta autenticada. A data de referência vem do início do expediente em Fortaleza, mesmo quando termina no dia seguinte. Expedientes entre um minuto e 48 horas são aceitos.

## Permissões e integridade

- Analistas e gestores podem consultar publicações da equipe na própria empresa Ajust.
- Rascunhos são privados inclusive em relação a gestores. Somente o autor edita; não há exclusão pela interface/API.
- Clientes são bloqueados tanto pela navegação quanto pela API.
- Toda edição de uma publicação mantém a versão pública anterior, com conteúdo, turno, horários e vínculos de O.S. Rascunhos anteriores à publicação não são expostos como histórico público.
- Atualizações exigem a versão lida; uma edição concorrente retorna 409 em vez de sobrescrever outra versão.
- Auditoria de gravação com ação SHIFT_REPORT_SAVE, dentro da mesma transação. Vínculos de O.S. são validados contra empresa e exclusão lógica.
- Salvamento é **manual**, com indicação de alterações pendentes e preservação do texto em caso de erro. Há aviso ao fechar/recarregar com texto alterado. Salvar antes de navegar pelo menu; não há backup offline nem sincronização com Discord.

## Implementação e verificações

Migrações aditivas `20261022150000_shift_reports` e `20261022150100_shift_report_audit`, aplicadas somente no banco atual. Nenhum relatório real foi fabricado/importado do Discord. A porta 8071 não foi modificada.

Seis testes unitários cobrem acesso, escopo pessoal/equipe, isolamento, validação de expediente e privacidade no log de auditoria. A suíte geral da API aprovou 457 testes antes da adição do sexto teste específico (11 testes já ignorados). Conferência real de API com conta de analista, gerente e cliente verificou rascunho invisível ao gerente, publicação legível pela equipe, revisão preservada, rejeição de edição por outro autor e de versão antiga, além de referência noturna correta. Relatórios temporários de teste foram removidos ao final; eventos de auditoria da conferência são preservados. O teste final confirmou leitura, edição e salvamento de rascunho pela interface e ausência do texto privado no log geral. Os logs genéricos não duplicam o corpo dos novos relatórios.

Typecheck de web/API aprovado. Tela e formulário conferidos no navegador. Sem certificação adicional de prontidão de produção além dos critérios já documentados para o ERP.
