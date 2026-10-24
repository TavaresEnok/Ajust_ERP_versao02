# Atendimento Ajust — revisão de 23/10/2026

## Operação adotada

- A Ajust é a empresa; os provedores são seus clientes.
- Nova demanda cria ocorrência e primeira O.S. juntas. Cada O.S. pertence a uma ocorrência; entregas adicionais devem atender ao mesmo objetivo.
- Atendimento resolvido pelo chat pode ser registrado já concluído no fluxo simples, com resultado técnico.
- A pessoa que abre escolhe um responsável. Setor organiza o trabalho, não substitui a atribuição individual.
- Analista trabalha pela O.S.: iniciar, anotar, encaminhar, agendar, pausar/retomar e concluir. Não precisa administrar um motor de processos.
- Encaminhamento mantém a mesma O.S., prazo e histórico, com passagem de atendimento escrita.
- Encerramento da ocorrência depende das entregas pendentes. Conclusão conjunta exige confirmação da lista; novas O.S. derivadas permanecem abertas para execução própria. Cada conclusão é transacional; se outra falhar, as já concluídas não são desfeitas.
- Reabertura não recria automaticamente entregas já geradas.

## SLA e agenda são diferentes

Contagem padrão: segunda a sexta, 00:00–24:00, America/Fortaleza. Sábado e domingo não contam para SLA, mas aceitam agendamento e execução normalmente.

DNS: 48 horas úteis, para todos os clientes e prioridades. Segunda às 06h → quarta às 06h. Sexta às 06h → terça às 06h.

Prioridade organiza a fila, sem reduzir automaticamente o prazo. Agendamento não pausa SLA. Pausa exige justificativa, fica no histórico e aparece no painel gerencial; retomada desconta o período útil pausado. Ordens pausadas não entram na fila de violações em contagem ativa.

Somente DNS teve prazo confirmado. Outros tipos usam 48h úteis provisórias, não um compromisso contratual confirmado. Feriados e os demais prazos precisam de definição da gestão.

## Quatro modelos publicados

1. Atendimento simples: executar, registrar resultado e encerrar.
2. Preparação e execução agendada: preparar e repassar; executar e validar na mesma O.S.
3. Configuração de equipamento: concluir a configuração gera monitoramento, diagrama e backup, em paralelo.
4. Alteração de topologia: concluir a alteração gera monitoramento e diagrama.

Os modelos controlam a execução operacional. Automações pontuais permanecem separadas. Na base revisada não havia regras legadas ativas equivalentes. Sem responsável específico configurado no bloco, a entrega derivada herda o responsável da O.S. principal; a gestão deve definir a distribuição definitiva.

Manutenção com impacto pode registrar janela, impacto e plano de reversão, vinculados à gestão de mudanças. Não foi criada aprovação obrigatória para todo atendimento.

## Roteiro dos gestores

1. Acesse http://168.194.13.18:8070/login e use os atalhos de demonstração.
2. Como analista, abra Minhas ordens. Confira situação atual, prazo e agendamento; os botões executam ações na própria O.S.
3. Use **Ver atendimento completo** e expanda **Acompanhar etapas**. Azul identifica etapa atual, verde concluída e amarelo espera. O desenho representa os registros da execução, não apenas um modelo.
4. Na ocorrência de configuração de OLT, veja a principal encerrada e as entregas complementares independentes.
5. Na O.S. BGP agendada, confira a janela de sábado às 02h, sem alteração automática do prazo.
6. Como gerente, confira alertas de pausa e horário agendado sem início registrado. Defina os demais prazos em Políticas de SLA e responsáveis nos modelos.
7. Como cliente, confira suas demandas; controles operacionais internos ficam bloqueados.

## Dados e segurança da alteração

Base conferida: 26 clientes, 66 O.S., 63 execuções e quatro modelos publicados. Nenhuma O.S. sem ocorrência. As 60 O.S. do cenário de volume mantêm, por analista ativo, cinco abertas, cinco em atendimento e dez fechadas. Os exemplos permanecem identificados como demonstração, não atividade real da equipe.

Foram substituídos três modelos antigos de protótipo sem execuções vinculadas e três itens antigos de catálogo de demonstração. Não foram apagados clientes ou analistas nesta revisão.

Backup anterior às alterações: `/tmp/ajust-operacao-revisao.d695cH/database.dump` (acesso restrito). Não usar `/tmp` como retenção permanente de backup de produção. A versão 8071 não foi alterada.

## Verificação

92 testes aprovados em oito suítes, incluindo calendário, criação, conclusão, permissões, pausa, transferência, criação de três derivadas e reabertura sem duplicação. Teste de integração usa rollback e não deixa registros de teste. Compilação de tipos de API, worker e web verificada.

Navegação de gerente, Anderson e cliente Meganet verificada no navegador: login, controles da O.S., acompanhamento dentro da ocorrência e bloqueio do endpoint operacional para cliente.

Isso prepara a demonstração, não certifica produção. Antes de uso real: confirmar políticas e distribuição, retirar acessos rápidos de teste, revisar credenciais, HTTPS, backups permanentes e procedimentos de restauração.
