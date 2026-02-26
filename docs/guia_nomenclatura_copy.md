# Guia de Nomenclatura e Copy (Freeze)

## Objetivo
Padronizar os textos do ERP para evitar divergencia entre telas de Gerencia, Analista e Cliente.

## Termos oficiais
- **Ocorrencia**: registro principal da demanda.
- **O.S**: ordem de servico vinculada a uma ocorrencia.
- **SLA**: prazo e conformidade de atendimento.
- **Provedor**: cliente ISP (tenant).
- **Tenant**: isolamento logico de dados por cliente.
- **Analista responsavel**: dono operacional da ocorrencia/O.S.
- **Solicitante**: pessoa do provedor que abriu a demanda.

## Relacao entre entidades
- Fluxo oficial: `Provedor -> Ocorrencia -> O.S`.
- Uma ocorrencia pode ter varias O.S.
- Uma O.S pertence a uma unica ocorrencia.

## Padrao de escrita
- Usar sempre: **Ocorrencia**, **O.S**, **Analista**, **Provedor**, **SLA**.
- Evitar variacoes no mesmo produto (ex.: "OS", "Ordem de Servico", "Ticket") quando o contexto for o mesmo.
- Priorizar textos curtos e objetivos em botoes e labels.

## Labels oficiais (UI)
- **Acao**
- **Atrasadas**
- **Vencem Hoje**
- **Data de Criacao**
- **Descricao**
- **Historico**
- **Configuracoes**
- **Relatorios**
- **Gestao de Clientes**
- **Integracao**
- **Reconciliacao**

## Estados oficiais (negocio)
- **Ocorrencia**: Aberta, Em execucao, Pendente, Encerrada.
- **O.S**: Ag. Terceiros, Resolvida, Fechada, Cancelada, Reaberta.

## Regras por perfil (texto de interface)
- **Gerencia**: visao executiva, desempenho, risco, SLA, governanca.
- **Analista**: operacao diaria, ocorrencias, O.S, anotacoes, anexos.
- **Cliente**: acompanhamento de ocorrencias e atualizacoes; sem detalhe interno desnecessario.

## Mensagens de feedback (padrao)
- Sucesso: "X atualizado com sucesso."
- Erro: "Falha ao X."
- Sem dados: "Nenhum registro encontrado."
- Permissao: "Perfil sem permissao para X."
- Contexto ausente: "Tenant nao identificado."

## Convencao para novos textos
1. Reutilizar termos desta pagina.
2. Nao criar sinonimos para a mesma entidade.
3. Revisar consistencia entre menu, tabela, modal e toast.
4. Em duvida, priorizar a linguagem do modulo Analista para operacao e da Gerencia para executivo.

