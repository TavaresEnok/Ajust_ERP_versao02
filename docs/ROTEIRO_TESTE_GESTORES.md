# Roteiro de teste e aprovação · gestores

Ambiente: https://erp.ajustconsulting.com.br · base zerada de atendimentos em 09/11/2026.
Marque cada item como **OK** ou descreva o problema (print ajuda).

## 1. Acesso
- [ ] Entrar com o próprio usuário; trocar o tema claro/escuro no ícone do topo.
- [ ] Sair e entrar de novo; errar a senha uma vez e conferir a mensagem.

## 2. Abrir atendimento
- [ ] "Novo atendimento" → escolher um serviço do catálogo: título, tipo e prioridade preenchem sozinhos e dá para **Desfazer**.
- [ ] Preencher os três blocos (O que aconteceu, Para quem, Quem cuida) e abrir.
- [ ] Abrir um segundo atendimento **numa ocorrência existente** (aba do topo do formulário).
- [ ] Em "Mais opções", conferir que **Aberto por** já vem com o seu nome.
- [ ] Registrar um **trabalho já realizado**: a O.S. deve nascer concluída.

## 3. Andamento e prazo
- [ ] Mover a O.S. por análise → aguardando terceiros (o prazo **pausa**) → retomar.
- [ ] Mudar a prioridade e ver o prazo recalculado.
- [ ] Concluir e **aprovar o fechamento**; conferir o histórico da O.S.
- [ ] Painel da gerência: os números (pendentes, atrasadas, vencem em 2h) acompanham o que você fez.

## 4. Cofre dos provedores
- [ ] Abrir um provedor (ex.: INFOTEL, CNB TELECOM, PIXFIBRA) e navegar pelas categorias.
- [ ] "Ver acesso" → revelar a senha (pede motivo e sua senha) → copiar → a janela se limpa sozinha.
- [ ] Categoria **A conferir**: abrir alguns itens, comparar com a **anotação original** (protegida no próprio item) e corrigir nome, tipo, usuário ou senha. Ao trocar a categoria, o item sai de "A conferir".
- [ ] Apontar itens com nome ou categoria errados (o nome vem do título da anotação no SGP).

## 5. Equipe e escala
- [ ] Escala de plantão: programar a equipe de um sábado.
- [ ] Topologia de um provedor abre no draw.io.

## O que já foi carregado
| Origem | O que entrou |
|---|---|
| SGP · clientes | 150 provedores (todos os 149 do SGP + 1 antigo sem CNPJ) |
| SGP · anotações | 3.621 itens no cofre de 143 provedores; 675 marcados **A conferir** (anotação com vários usuários/senhas ou sem senha identificável) |
| BookStack | 82 topologias de rede |

Itens do cofre importados guardam a anotação original criptografada; toda revelação fica registrada na auditoria.
