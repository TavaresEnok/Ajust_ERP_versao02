# Revisão operacional do analista — 23/10/2026

## Objetivo e escopo

Revisar o uso diário do analista no ERP 8070, do clique à API, persistência e atualização da tela. Não houve alteração da versão 8071, implantação de novos módulos ou mudança das permissões de gestão. Componentes compartilhados foram ajustados quando necessários às jornadas do analista.

## Correções

- Início em um clique mantido; encerramento com um único botão de confirmação, sem seletor duplicado. O menu de outras ações fecha após a escolha e identifica o formulário selecionado.
- Após pausar, a próxima ação passa a ser retomar; encaminhamento, agendamento e remoção de janela retornam à ação principal. Reabertura usa o mesmo tratamento de envio, confirmação e falhas.
- A tela explica quando o encerramento exige o responsável atual ou a gestão, bloqueia a confirmação que seria rejeitada pelo fluxo e oferece o encaminhamento para si próprio, com passagem de atendimento. Não foi relaxada a permissão do servidor.
- A conclusão aguarda o carregamento dos dados do fluxo, apresenta erro com nova tentativa se a consulta falhar e não envia uma conclusão sem as opções necessárias.
- O atalho legado **Atendimento rápido** foi retirado do analista: criava O.S. avulsa, rejeitada pelo contrato atual. A abertura fica em **Novo atendimento**, criando ocorrência e primeira O.S. juntas; entregas adicionais continuam vinculadas à ocorrência.
- Busca de O.S. agora inclui o provedor; filtro de provedor consulta o cadastro completo e é aplicado no banco antes da paginação. Removida a segunda filtragem local que descartava resultados já encontrados pelo servidor.
- Formulários operacionais bloqueiam novo envio até terminar a operação completa, incluindo atualização da tela. Edição identifica a confirmação como **Salvar alterações**.
- Relatórios de turno mostram o limite de 50 mil caracteres e o mínimo de 20, em vez de deixar o botão bloqueado sem explicação. A pesquisa e o vínculo por protocolo foram exercitados.
- Agenda do analista sem controles de evento global, RRULE e campos administrativos. Compromissos próprios podem ser criados e editados; globais e eventos de outra pessoa abrem para consulta, sem botões que resultariam em 403.
- Escala de plantão sem criação/remoção para analista. A busca de navegação não oferece outro portal ao analista.
- Monitor de SLA do analista consulta suas ordens com paginação completa. Links antigos para abas técnicas da O.S. abrem o acompanhamento operacional, não uma aba escondida. Relógio de risco atualizado a cada minuto.
- Removidas mensagens técnicas desnecessárias no catálogo e no cadastro de provedores. Datas das anotações em Fortaleza. Ajustpedia sem dois elementos `main` aninhados.

## Verificação

56 testes aprovados em seis suítes, incluindo integração real com rollback (`PROCESS_DB_TESTS=1`): operações, abertura de ocorrência/O.S., listagem e filtros, relatórios de turno e agenda. Typecheck de web/API aprovado.

`scripts/check-analyst-actions.cjs` executa, com API e banco reais:

1. Criar atendimento pela interface e adicionar uma segunda O.S. na mesma ocorrência.
2. Buscar por provedor e selecionar o filtro de provedor.
3. Iniciar, pausar e retomar; agendar no sábado e remover a janela.
4. Encaminhar a outro responsável, conferir o bloqueio explicado de encerramento e assumir novamente.
5. Editar a O.S.; criar e corrigir anotação; conferir limpeza do campo após salvar.
6. Enviar e baixar um arquivo texto, comparando seu conteúdo.
7. Concluir, reabrir e gerar um PDF real.
8. Criar relatório de turno com O.S. vinculada pelo protocolo.
9. Editar nota com salvamento automático e conferir o conteúdo após recarregar.
10. Criar e editar compromisso próprio; conferir evento global somente para consulta e ausência de **Novo plantão**.

O script usa provedor, ordens, ocorrência, notas, relatório, compromissos e anexo temporários identificados por UUID. A limpeza valida esses identificadores antes de remover apenas os dados criados pelo teste; preserva registros anteriores e auditoria.

`scripts/check-analyst-pages.cjs` percorre as 13 páginas do menu e verifica exceções e respostas 4xx/5xx. A regressão do cofre validou seleção de provedor, detalhes, orientações, histórico, confirmação de exclusão cancelada, modos de visualização, gerador de senha e Ajustpedia, sem revelar ou alterar senhas reais.

## Limites

Esta é evidência das jornadas acima, não uma garantia de ausência de defeitos em toda combinação possível. Não foram alteradas senhas/2FA reais, escalas reais, credenciais ou equipamentos preexistentes para testar escrita. Integrações externas e o funcionamento completo dos portais de gestão/cliente não fazem parte desta revisão. Os requisitos de produção documentados anteriormente permanecem, especialmente HTTPS, retirada dos acessos rápidos de teste e backups permanentes.
