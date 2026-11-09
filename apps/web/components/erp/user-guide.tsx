'use client';
/**
 * Guia de uso dentro do sistema. O analista vê o dia a dia; a gerência vê o mesmo e,
 * em seguida, os capítulos de gestão. Os prints ficam em /guia (só abrem com login).
 */
import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { AlertTriangle, Lightbulb, Search } from 'lucide-react';
import { PageHeading } from './primitives';

type Audience = 'analista' | 'gerencia';
type Topic = {
  id: string;
  title: string;
  /** Para que serve, em uma ou duas frases. */
  what: string;
  steps?: ReactNode[];
  image?: { src: string; alt: string; caption: string };
  tips?: ReactNode[];
  warn?: ReactNode[];
};
type Chapter = { id: string; title: string; intro: string; topics: Topic[] };

const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

// ---------------------------------------------------------------- dia a dia (analista e gerência)
const dayToDay: Chapter[] = [
  {
    id: 'comecar',
    title: 'Primeiros passos',
    intro: 'O básico para entrar e se localizar no sistema.',
    topics: [
      {
        id: 'entrar',
        title: 'Entrar e trocar a senha inicial',
        what: 'Você entra com o seu e-mail da Ajust e a senha que a gestão entregou. No primeiro acesso, troque essa senha por uma só sua.',
        steps: [
          <>
            Abra <B>erp.ajustconsulting.com.br</B> e entre com o seu e-mail (ex.:{' '}
            <B>fulano@ajustconsulting.com.br</B>) e a senha inicial.
          </>,
          <>
            No menu lateral, abra <B>Minha conta → Segurança</B> e troque a senha.
          </>,
          <>
            Para sair, clique no seu nome no canto superior direito e em <B>Sair</B>.
          </>,
        ],
        image: {
          src: '/guia/a-menu-perfil.jpg',
          alt: 'Menu do perfil aberto no canto superior direito',
          caption: 'Clicando no seu nome: preferências do perfil e sair.',
        },
        tips: [
          <>
            O ícone de sol/lua ao lado do sino troca o tema entre <B>claro</B> e <B>escuro</B>.
          </>,
          <>
            A busca no topo (<B>Ctrl + K</B>) leva direto para qualquer área.
          </>,
        ],
      },
      {
        id: 'painel',
        title: 'Meu painel: o resumo do seu dia',
        what: 'É a primeira tela. Mostra quantos atendimentos estão com você, quantos atrasaram, quantos vencem hoje e quantos você concluiu.',
        steps: [
          <>
            Os quatro cartões do topo são clicáveis: clique em <B>Minhas atrasadas</B> para ver só
            as que passaram do prazo.
          </>,
          <>
            Em <B>Visão geral da Ajust</B> você vê os números de toda a equipe.
          </>,
          <>
            O gráfico mostra quantas O.S. foram abertas e concluídas por dia no período escolhido.
          </>,
        ],
        image: {
          src: '/guia/a-painel.jpg',
          alt: 'Painel do analista com os cartões de ativas, atrasadas, vencem hoje e concluídas',
          caption: 'Cores ajudam a ler rápido: vinho = atraso, areia = atenção, verde = concluído.',
        },
      },
    ],
  },
  {
    id: 'atendimento',
    title: 'Atendimentos e O.S.',
    intro:
      'Um atendimento é o pedido do provedor (a ocorrência). Dentro dele ficam uma ou mais O.S., que são os trabalhos a fazer.',
    topics: [
      {
        id: 'minhas-ordens',
        title: 'Encontrar suas O.S.',
        what: 'Em Minhas ordens ficam as O.S. em que você é o responsável, com prazo e situação.',
        steps: [
          <>
            Abra <B>Minhas ordens</B> no menu lateral.
          </>,
          <>
            Use <B>Pendentes</B>, <B>Concluídas</B> ou <B>Todas as ordens</B> e, na linha{' '}
            <B>Prazo</B>, filtre por atrasadas, que vencem hoje ou pausadas.
          </>,
          <>
            Em <B>Todas da Ajust</B> aparecem as O.S. de toda a equipe.
          </>,
          <>Clique na O.S. para abrir.</>,
        ],
        image: {
          src: '/guia/a-minhas-ordens-4.jpg',
          alt: 'Lista Minhas ordens com quatro O.S. da INFOTEL',
          caption:
            'Exemplo real: a O.S. principal já fechada e as três entregas que o fluxo abriu sozinho.',
        },
      },
      {
        id: 'abrir',
        title: 'Abrir um atendimento',
        what: 'Quando um provedor pede algo, você registra o atendimento e a primeira O.S. de uma vez só.',
        steps: [
          <>
            Clique em <B>Novo atendimento</B> (no painel ou em Minhas ordens).
          </>,
          <>
            Em <B>Serviço do catálogo</B>, escolha o tipo de serviço. Título, tipo e prioridade se
            preenchem sozinhos, e o serviço já traz as etapas certas. Não gostou? Clique em{' '}
            <B>Desfazer</B>.
          </>,
          <>
            Preencha os três blocos: <B>O que aconteceu</B> (título e descrição), <B>Para quem</B>{' '}
            (provedor, origem, setor) e <B>Quem cuida</B> (analista e prioridade).
          </>,
          <>
            Clique em <B>Abrir atendimento</B>.
          </>,
        ],
        image: {
          src: '/guia/g-abrir-atendimento.png',
          alt: 'Formulário Abrir atendimento preenchido',
          caption: 'Os campos com * são obrigatórios. Os demais ficam em “Mais opções”.',
        },
        tips: [
          <>
            Se o pedido é de um caso que já existe, use a aba <B>Em ocorrência existente</B>: a O.S.
            entra no mesmo atendimento.
          </>,
          <>
            Fez o trabalho por telefone e só quer registrar? Marque{' '}
            <B>Registrar trabalho já realizado</B>: a O.S. já nasce concluída.
          </>,
        ],
        warn: [<>Se fechar a janela com algo preenchido, o sistema pergunta antes de descartar.</>],
      },
      {
        id: 'executar',
        title: 'Executar uma O.S. passo a passo',
        what: 'Dentro da O.S., a aba Atendimento mostra a etapa em que você está e o que precisa ser preenchido para concluir.',
        steps: [
          <>
            Abra a O.S. e clique em <B>Iniciar execução</B>. A O.S. passa para <B>Em análise</B> e o
            tempo começa a contar como trabalho seu.
          </>,
          <>Faça o trabalho de verdade (configurar, testar, validar).</>,
          <>
            Volte à O.S. e preencha as <B>evidências</B> pedidas (os campos com *), por exemplo{' '}
            <B>Resultado técnico</B>: o que foi feito e como foi validado.
          </>,
          <>Se a etapa tiver mais de um resultado possível, escolha o que aconteceu.</>,
          <>
            Clique no botão do fim: <B>Concluir etapa</B> (quando o fluxo continua) ou{' '}
            <B>Encerrar O.S.</B> (quando este é o último passo da O.S.).
          </>,
        ],
        image: {
          src: '/guia/a-registro-etapa.jpg',
          alt: 'Registro da etapa com o campo Resultado técnico e o botão Encerrar O.S.',
          caption:
            'O quadro cinza diz o que acontece depois: aqui, encerrar esta O.S. abre as entregas complementares.',
        },
        tips: [
          <>O botão fica apagado enquanto faltar alguma evidência obrigatória.</>,
          <>
            <B>Acessos e orientações técnicas</B> (à direita) leva direto ao cofre daquele provedor.
          </>,
        ],
      },
      {
        id: 'entregas',
        title: 'Quando aparecem O.S. novas sozinhas',
        what: 'Alguns serviços têm um fluxo com entregas em paralelo. Ao concluir a primeira etapa, o sistema abre as próximas O.S. automaticamente, no mesmo atendimento.',
        steps: [
          <>
            Exemplo: em <B>Configuração e ativação de equipamento</B>, depois da ativação nascem
            três O.S.: monitoramento, diagrama de rede e backup.
          </>,
          <>
            Elas vão para o responsável definido no fluxo ou, se não houver, para quem cuidava da
            O.S. principal.
          </>,
          <>
            Cada uma é executada como qualquer O.S. A ordem entre elas não importa. O atendimento só
            termina quando todas estiverem concluídas.
          </>,
        ],
        image: {
          src: '/guia/a-os-encerrada.jpg',
          alt: 'O.S. principal encerrada com as próximas entregas listadas',
          caption: 'Depois de encerrar a O.S. principal, as próximas entregas aparecem listadas.',
        },
      },
      {
        id: 'pausar',
        title: 'Pausar quando depende do cliente',
        what: 'Se você não consegue seguir por causa de terceiros (cliente, operadora, fornecedor), pause. Enquanto pausada, o prazo para de correr.',
        steps: [
          <>
            Na O.S., abra <B>Outras ações → Pausar atendimento</B>.
          </>,
          <>
            Escreva o motivo (ex.: <B>“Aguardando o cliente liberar acesso remoto à OLT”</B>) e
            confirme.
          </>,
          <>
            Quando puder seguir, use <B>Retomar atendimento</B>. O prazo volta a contar de onde
            parou.
          </>,
        ],
        image: {
          src: '/guia/a-os-pausada.jpg',
          alt: 'O.S. pausada mostrando desde quando e o motivo',
          caption:
            'A O.S. mostra desde quando está pausada e por quê. Isso também fica no histórico.',
        },
        warn: [<>Enquanto pausada, não dá para concluir a etapa: retome primeiro.</>],
      },
      {
        id: 'outras-acoes',
        title: 'Encaminhar, agendar, anotar e anexar',
        what: 'Tudo que acontece na O.S. fica registrado no Histórico, com data e autor.',
        steps: [
          <>
            <B>Encaminhar O.S.</B> (em Outras ações): passa a O.S. para outra pessoa. Explique o
            motivo.
          </>,
          <>
            <B>Agendar execução</B>: marca dia e hora para fazer o trabalho (ex.: janela de
            manutenção). Agendar não pausa o prazo.
          </>,
          <>
            Aba <B>Anotações</B>: registre andamento, testes feitos e orientações para a equipe.
          </>,
          <>
            Aba <B>Anexos</B>: prints, backups de configuração, documentos.
          </>,
          <>
            Aba <B>Histórico</B>: tudo que foi feito na O.S., em ordem.
          </>,
        ],
        image: {
          src: '/guia/a-os-historico.jpg',
          alt: 'Aba Histórico da O.S.',
          caption: 'O histórico é o que a gestão consulta para saber o que aconteceu.',
        },
      },
    ],
  },
  {
    id: 'provedores',
    title: 'Provedores, cofre e conhecimento',
    intro: 'Onde encontrar os dados de cada provedor, os acessos e o conhecimento da equipe.',
    topics: [
      {
        id: 'provedores-lista',
        title: 'Provedores',
        what: 'Cadastro de cada provedor atendido: dados, contatos, atendimentos e topologia de rede.',
        steps: [
          <>
            Abra <B>Provedores</B> e pesquise pelo nome.
          </>,
          <>
            Na página do provedor ficam os atendimentos dele e o diagrama de rede (aberto no
            draw.io).
          </>,
        ],
        image: {
          src: '/guia/a-provedores.jpg',
          alt: 'Lista de provedores',
          caption: 'Lista de provedores com busca.',
        },
      },
      {
        id: 'cofre',
        title: 'Cofre de credenciais',
        what: 'Guarda com segurança os acessos dos equipamentos e sistemas de cada provedor (OLTs, roteadores, switches, servidores, sistemas).',
        steps: [
          <>
            Abra <B>Cofre de credenciais</B> e escolha o provedor.
          </>,
          <>
            Use as categorias à esquerda (OLTs, Roteadores, Switches…) ou a busca para achar o
            equipamento.
          </>,
          <>
            Clique em <B>Ver acesso</B>. Para ver a senha, informe o <B>motivo</B> e a{' '}
            <B>sua senha</B> do ERP.
          </>,
          <>Use o botão de copiar ao lado de cada campo.</>,
        ],
        image: {
          src: '/guia/a-cofre-provedores.jpg',
          alt: 'Cofre: escolha do provedor',
          caption: 'Primeiro escolha o provedor; depois o equipamento.',
        },
        tips: [
          <>
            Itens em <B>A conferir</B> vieram das anotações antigas do SGP e precisam de revisão. A
            anotação original fica guardada dentro do próprio item.
          </>,
        ],
        warn: [
          <>
            Toda consulta de senha fica registrada (quem, quando e por quê). A senha some sozinha
            depois de 30 segundos ou quando você troca de aba.
          </>,
        ],
      },
      {
        id: 'ajustpedia',
        title: 'Ajustpedia, notas e gerador de senhas',
        what: 'A base de conhecimento da equipe e suas ferramentas pessoais.',
        steps: [
          <>
            <B>Ajustpedia</B>: procedimentos e comandos (BGP, CGNAT, Proxmox, ONUs…). Marque os
            favoritos com a estrela.
          </>,
          <>
            <B>Minhas notas</B>: anotações só suas.
          </>,
          <>
            <B>Gerador de senhas</B>: cria senhas fortes para usar nos equipamentos.
          </>,
        ],
        image: {
          src: '/guia/a-ajustpedia.jpg',
          alt: 'Ajustpedia',
          caption: 'Ajustpedia: artigos, comandos e categorias.',
        },
      },
    ],
  },
  {
    id: 'equipe-dia',
    title: 'Agenda, plantão e turno',
    intro: 'Organização da equipe no dia a dia.',
    topics: [
      {
        id: 'agenda',
        title: 'Agenda',
        what: 'Compromissos e execuções agendadas da equipe.',
        image: {
          src: '/guia/a-agenda.jpg',
          alt: 'Agenda',
          caption: 'Execuções agendadas aparecem aqui com dia e hora.',
        },
      },
      {
        id: 'escala',
        title: 'Escala de plantão',
        what: 'Mostra quem está de plantão nos sábados, domingos e feriados.',
        steps: [
          <>
            Em <B>Escala de plantão</B>, veja a próxima data especial e quem está escalado.
          </>,
          <>
            <B>Baixar meus plantões</B> gera um arquivo para colocar na agenda do celular.
          </>,
        ],
        image: {
          src: '/guia/a-escala.jpg',
          alt: 'Escala de plantão',
          caption: 'Próximas datas especiais e equipe escalada.',
        },
        warn: [
          <>
            <B>Ver exemplo</B> mostra uma escala fictícia só para demonstração. Uma faixa avisa
            enquanto ela estiver ativa.
          </>,
        ],
      },
      {
        id: 'turno',
        title: 'Relatório de turno',
        what: 'Registro do que aconteceu no turno, para quem assume o próximo.',
        image: {
          src: '/guia/a-relatorio-turno.jpg',
          alt: 'Relatórios de turno',
          caption: 'Registre o turno ao final do expediente ou do plantão.',
        },
      },
    ],
  },
];

// ---------------------------------------------------------------- gestão (só gerência)
const management: Chapter[] = [
  {
    id: 'operacao',
    title: 'Acompanhar a operação',
    intro: 'Onde a gerência vê, em tempo real, o que precisa de atenção.',
    topics: [
      {
        id: 'painel-gerencia',
        title: 'Painel da gerência',
        what: 'Mostra todas as pendências da equipe: pendentes, atrasadas, que vencem em 2 h, sem responsável, pausadas e execuções agendadas.',
        steps: [
          <>Clique num cartão para listar só aquele grupo logo abaixo.</>,
          <>
            Em <B>Pendentes agora</B>, as atrasadas e críticas aparecem primeiro. Clique em{' '}
            <B>Abrir atendimento</B> para agir.
          </>,
          <>
            <B>Distribuição do trabalho</B> mostra quantas O.S. cada pessoa tem.
          </>,
        ],
        image: {
          src: '/guia/g-painel.jpg',
          alt: 'Painel da gerência',
          caption: 'Os cartões filtram a lista de pendências.',
        },
      },
      {
        id: 'prazos',
        title: 'Prazos da equipe',
        what: 'Todas as O.S. ativas ordenadas por prazo, para ver quem precisa de apoio.',
        image: {
          src: '/guia/g-prazos.jpg',
          alt: 'Prazos da equipe',
          caption: 'Atrasadas em destaque. Clique na O.S. para abrir.',
        },
      },
      {
        id: 'processos',
        title: 'Acompanhamento dos atendimentos (fluxo completo)',
        what: 'Para atendimentos com fluxo: mostra em que etapa está, as O.S. separadas e permite agir no processo inteiro.',
        steps: [
          <>
            Abra pela O.S. (<B>Acompanhar e concluir pelo processo</B>) ou pelo menu{' '}
            <B>Acompanhamento dos atendimentos</B>.
          </>,
          <>
            O quadro <B>Onde está o atendimento agora?</B> mostra a etapa atual. O diagrama pinta o
            que já foi feito.
          </>,
          <>
            Cada <B>Etapa atual</B> tem prazo, evidências, <B>O que foi feito</B> e o botão{' '}
            <B>Concluir etapa</B>. Em <B>Encaminhar esta etapa</B> você passa para outra pessoa.
          </>,
        ],
        image: {
          src: '/guia/g-etapa-atual.jpg',
          alt: 'Cartão da etapa atual com prazo, evidências e botão concluir',
          caption: 'A gerência também pode concluir etapas.',
        },
      },
      {
        id: 'processo-acoes',
        title: 'Pausar, retomar ou cancelar o processo inteiro',
        what: 'Os botões de “Processo inteiro” valem para todas as etapas daquele atendimento. Sempre pedem uma justificativa, que vai para o histórico.',
        steps: [
          <>
            <B>Pausar processo</B>: para tudo e o prazo deixa de correr.
          </>,
          <>
            <B>Retomar processo</B>: volta a andar.
          </>,
          <>
            <B>Cancelar processo</B>: cancela as O.S. ainda abertas. Não dá para desfazer.
          </>,
        ],
        image: {
          src: '/guia/g-dialogo-pausar.jpg',
          alt: 'Janela de confirmação para pausar o processo',
          caption: 'Toda ação no processo explica o efeito e pede justificativa.',
        },
      },
      {
        id: 'ocorrencias',
        title: 'Encerrar uma ocorrência',
        what: 'A ocorrência fecha sozinha quando todas as O.S. terminam. Se precisar encerrar antes, o sistema mostra quais O.S. serão concluídas junto.',
        steps: [
          <>
            Abra a ocorrência e clique em <B>Encerrar ocorrência</B>.
          </>,
          <>Confira a lista das O.S. que serão concluídas junto.</>,
          <>
            Escreva a conclusão, marque <B>Confirmo que o trabalho destas O.S. foi realizado</B> e
            confirme.
          </>,
        ],
        image: {
          src: '/guia/g-encerrar-ocorrencia.jpg',
          alt: 'Encerrar ocorrência com lista de O.S. pendentes e confirmação',
          caption: 'Só confirme trabalhos que foram feitos de verdade.',
        },
      },
      {
        id: 'aprovacao',
        title: 'Aprovação de fechamento',
        what: 'Só a gerência aprova. Ela é exigida apenas quando a O.S. é de prioridade Alta ou Crítica, está marcada como “exige aprovação” e passou do prazo. Nos outros casos, o analista encerra direto.',
        steps: [
          <>
            Quando houver, a O.S. fica em <B>Resolvida</B> aguardando a sua aprovação.
          </>,
          <>
            Abra a O.S., aba <B>Aprovações</B>, e aprove ou recuse com o motivo.
          </>,
        ],
      },
    ],
  },
  {
    id: 'regras',
    title: 'Fluxos e regras',
    intro: 'Como a gerência define o jeito de trabalhar: etapas, prazos e serviços.',
    topics: [
      {
        id: 'fluxos',
        title: 'Fluxos de atendimento',
        what: 'Um fluxo diz quais etapas um tipo de serviço tem, quem pode concluir, quais evidências exigir e o que vem depois de cada resultado.',
        steps: [
          <>
            Em <B>Fluxos e regras → Fluxos de atendimento</B>, cada cartão é um fluxo, com versão e
            os serviços que o usam. Clique para abrir.
          </>,
          <>
            Clique numa caixa do diagrama: a etapa abre à direita. Ajuste nome, setor, prazo,
            responsável padrão, evidências e quem pode concluir.
          </>,
          <>
            Em <B>Depois desta etapa</B>, cada resultado (ex.: “Concluído”, “Sem acesso”) leva a uma
            próxima etapa. Marque se o resultado encerra a O.S.
          </>,
          <>
            Use <B>Próxima etapa</B>, <B>Trabalho em paralelo</B> (abre O.S. separadas ao mesmo
            tempo) ou <B>Etapa avulsa</B>.
          </>,
          <>
            <B>Simular</B> mostra o caminho sem criar O.S. Depois, <B>Salvar rascunho</B> ou{' '}
            <B>Publicar</B>.
          </>,
        ],
        image: {
          src: '/guia/g-fluxo-editor.jpg',
          alt: 'Editor de fluxo com diagrama e painel da etapa',
          caption: 'Diagrama à esquerda, etapa selecionada à direita.',
        },
        tips: [
          <>
            Defina o <B>responsável padrão</B> de cada etapa: assim cada O.S. já nasce com a pessoa
            certa. Sem ele, a O.S. herda o responsável da O.S. principal.
          </>,
        ],
        warn: [
          <>
            Publicar vale para as O.S. novas. Atendimentos em andamento continuam na versão em que
            começaram. Sair do editor sem salvar pede confirmação.
          </>,
        ],
      },
      {
        id: 'publicar',
        title: 'Publicar e ligar o fluxo a um serviço',
        what: 'Um fluxo só é usado quando está publicado e ligado a um serviço do catálogo.',
        steps: [
          <>
            Clique em <B>Publicar</B> e confirme. A janela diz quais serviços passam a usar a
            versão.
          </>,
          <>
            Em <B>Vincular um serviço…</B> (abaixo do nome do fluxo), escolha o serviço do catálogo.
          </>,
        ],
        image: {
          src: '/guia/g-dialogo-publicar.jpg',
          alt: 'Confirmação de publicação do fluxo',
          caption: 'A confirmação mostra o efeito antes de publicar.',
        },
      },
      {
        id: 'servicos',
        title: 'Tipos de serviço (catálogo)',
        what: 'É a lista que aparece em “Serviço do catálogo” ao abrir um atendimento. Cada serviço tem tipo, prioridade padrão, tempo estimado e o fluxo que segue.',
        image: {
          src: '/guia/g-servicos.jpg',
          alt: 'Catálogo de serviços',
          caption: 'Serviços do catálogo e seus números.',
        },
      },
      {
        id: 'sla',
        title: 'Prazos (SLA) e calendário',
        what: 'As políticas de SLA definem o prazo de cada O.S. por prioridade e tipo. O calendário define dias e horários úteis e os feriados, que não contam no prazo.',
        steps: [
          <>
            <B>Políticas de SLA</B>: crie o prazo por prioridade (ex.: Crítica 4 h, Alta 8 h). Sem
            política, vale o padrão de 48 h.
          </>,
          <>
            <B>Calendário de SLA</B>: horário de trabalho por dia da semana e feriados.
          </>,
        ],
        image: {
          src: '/guia/g-politicas-sla.jpg',
          alt: 'Políticas de SLA',
          caption: 'Prazo da O.S. = política de SLA (não o prazo da etapa do fluxo).',
        },
      },
    ],
  },
  {
    id: 'equipe',
    title: 'Equipe, relatórios e controle',
    intro: 'Pessoas, escala, resultados e auditoria.',
    topics: [
      {
        id: 'equipe-tecnica',
        title: 'Equipe técnica',
        what: 'Lista de analistas, situação do acesso e O.S. de cada um.',
        steps: [
          <>
            <B>Adicionar integrante</B> cadastra uma pessoa nova.
          </>,
          <>
            Em <B>Usuários e acessos</B> você bloqueia ou libera o acesso e troca o perfil.
          </>,
        ],
        image: {
          src: '/guia/g-equipe.jpg',
          alt: 'Equipe técnica',
          caption: 'Situação do acesso e O.S. ativas por pessoa.',
        },
      },
      {
        id: 'escala-gerencia',
        title: 'Programar a escala de plantão',
        what: 'A gerência define a equipe de cada sábado, domingo e feriado.',
        steps: [
          <>
            Em <B>Escala de plantão</B>, clique em <B>Programar equipe</B> na data.
          </>,
          <>
            <B>Equipes padrão</B> define quem costuma trabalhar em cada tipo de dia.
          </>,
          <>
            <B>Adicionar feriado</B> inclui um feriado no calendário.
          </>,
        ],
        image: {
          src: '/guia/g-escala.jpg',
          alt: 'Escala de plantão (gerência)',
          caption: 'Datas pendentes de programação aparecem em destaque.',
        },
      },
      {
        id: 'relatorios',
        title: 'Relatórios',
        what: 'Volume de atendimentos, entregas, tempo de resolução, violações de SLA, desempenho da equipe e por provedor.',
        steps: [
          <>Escolha o período no topo.</>,
          <>
            Use as abas (Visão gerencial, Performance da equipe, Provedores…) e{' '}
            <B>Exportar dados consultados</B> para levar a uma planilha.
          </>,
        ],
        image: {
          src: '/guia/g-relatorios.jpg',
          alt: 'Relatórios',
          caption: 'Relatórios com período e exportação.',
        },
      },
      {
        id: 'auditoria',
        title: 'Auditoria: quem fez o quê',
        what: 'Registro de tudo que foi feito no sistema: criações, alterações, consultas ao cofre, logins.',
        image: {
          src: '/guia/g-auditoria.jpg',
          alt: 'Auditoria',
          caption: 'Filtre por pessoa, ação ou período.',
        },
      },
      {
        id: 'configuracoes',
        title: 'Configurações da empresa',
        what: 'Setores, origens de atendimento (WhatsApp, Ligação…), dados da empresa, notificações e integrações.',
        image: {
          src: '/guia/g-configuracoes.jpg',
          alt: 'Configurações',
          caption: 'Ajustes que valem para toda a empresa.',
        },
      },
    ],
  },
];

const faqAnalyst: [string, ReactNode][] = [
  [
    'Não encontro uma O.S.',
    <>
      Em <B>Minhas ordens</B>, use <B>Todas as ordens</B> e a aba <B>Todas da Ajust</B>, ou procure
      pelo protocolo na busca.
    </>,
  ],
  [
    'O botão de concluir está apagado.',
    <>Falta preencher alguma evidência com *, ou a O.S. está pausada (retome antes).</>,
  ],
  [
    'Apareceram O.S. novas que eu não abri.',
    <>
      São as próximas entregas do fluxo daquele serviço. Veja “Quando aparecem O.S. novas sozinhas”.
    </>,
  ],
  [
    'O cliente não responde e o prazo está acabando.',
    <>
      Use <B>Outras ações → Pausar atendimento</B> com o motivo. O prazo para enquanto estiver
      pausada.
    </>,
  ],
  [
    'Registrei algo errado.',
    <>
      Escreva a correção em <B>Anotações</B>. O histórico guarda tudo. Se a O.S. já foi encerrada,
      peça à gerência para reabrir.
    </>,
  ],
  ['Esqueci minha senha.', <>Peça à gerência para redefinir o seu acesso.</>],
];
const faqManager: [string, ReactNode][] = [
  [
    'Um analista não consegue entrar.',
    <>
      Veja em <B>Equipe técnica</B> se o acesso está <B>Bloqueado</B> e libere em{' '}
      <B>Usuários e acessos</B>.
    </>,
  ],
  [
    'Mudei o fluxo e as O.S. em andamento não mudaram.',
    <>Está certo: cada atendimento segue a versão em que começou. A nova vale para os próximos.</>,
  ],
  [
    'Quero que cada entrega vá para uma pessoa diferente.',
    <>
      No fluxo, defina o <B>responsável padrão</B> de cada etapa e publique.
    </>,
  ],
];
const glossary: [string, string][] = [
  ['Ocorrência', 'O atendimento como um todo: o pedido do provedor. Reúne uma ou mais O.S.'],
  ['O.S.', 'Ordem de serviço: um trabalho a fazer, com responsável e prazo.'],
  ['Fluxo', 'O roteiro de etapas que um tipo de serviço segue.'],
  ['Etapa', 'Um passo do fluxo. Tem evidências obrigatórias e resultados.'],
  ['Resultado', 'O que aconteceu na etapa (ex.: Concluído, Sem acesso). Define o próximo passo.'],
  [
    'Trabalho em paralelo',
    'Quando o fluxo abre várias O.S. ao mesmo tempo, uma para cada entrega.',
  ],
  [
    'SLA / prazo',
    'Tempo para concluir a O.S. Vem das políticas de SLA e conta só em horário útil.',
  ],
  ['Pausar', 'Parar o atendimento por causa de terceiros. O prazo para de correr.'],
  ['Encaminhar', 'Passar a O.S. ou a etapa para outra pessoa, com motivo.'],
];

function TopicBlock({ topic }: { topic: Topic }) {
  return (
    <article id={topic.id} className="scroll-mt-24 panel flex flex-col gap-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">{topic.title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{topic.what}</p>
      </div>
      <div className="flex flex-col gap-5">
        {topic.steps && (
          <ol className="flex flex-col gap-3">
            {topic.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-6">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        )}
        {topic.image && (
          <figure className="flex max-w-4xl flex-col gap-2">
            <a href={topic.image.src} target="_blank" rel="noreferrer" title="Abrir imagem maior">
              <Image
                src={topic.image.src}
                alt={topic.image.alt}
                width={1180}
                height={820}
                loading="lazy"
                className="h-auto w-full rounded-lg border border-border"
              />
            </a>
            <figcaption className="text-xs text-muted-foreground">{topic.image.caption}</figcaption>
          </figure>
        )}
      </div>
      {topic.tips?.map((tip, i) => (
        <p
          key={`t${i}`}
          className="tone-surface tone-info flex gap-2 rounded-lg border p-3 text-sm leading-6"
        >
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-info" />
          <span className="text-muted-foreground">{tip}</span>
        </p>
      ))}
      {topic.warn?.map((w, i) => (
        <p
          key={`w${i}`}
          className="tone-surface tone-warning flex gap-2 rounded-lg border p-3 text-sm leading-6"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span className="text-muted-foreground">{w}</span>
        </p>
      ))}
    </article>
  );
}

/** Texto pesquisável de um tópico (títulos e descrição). */
const topicText = (t: Topic) => `${t.title} ${t.what}`.toLowerCase();

export function UserGuide({ audience }: { audience: Audience }) {
  const [query, setQuery] = useState('');
  const parts = useMemo(
    () =>
      audience === 'gerencia'
        ? [
            { title: 'Parte 1 · O dia a dia (igual ao analista)', chapters: dayToDay },
            { title: 'Parte 2 · Gestão', chapters: management },
          ]
        : [{ title: '', chapters: dayToDay }],
    [audience],
  );
  const q = query.trim().toLowerCase();
  const filtered = parts.map((part) => ({
    ...part,
    chapters: part.chapters
      .map((c) => ({ ...c, topics: c.topics.filter((t) => !q || topicText(t).includes(q)) }))
      .filter((c) => c.topics.length),
  }));
  const faq = audience === 'gerencia' ? [...faqAnalyst, ...faqManager] : faqAnalyst;
  const quick =
    audience === 'gerencia'
      ? [
          ['Acompanhar a operação', 'painel-gerencia'],
          ['Montar um fluxo', 'fluxos'],
          ['Encerrar uma ocorrência', 'ocorrencias'],
          ['Prazos (SLA)', 'sla'],
        ]
      : [
          ['Abrir um atendimento', 'abrir'],
          ['Executar uma O.S.', 'executar'],
          ['Pausar quando depende do cliente', 'pausar'],
          ['Ver uma senha no cofre', 'cofre'],
        ];
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeading
        title={audience === 'gerencia' ? 'Guia da gerência' : 'Guia do analista'}
        description={
          audience === 'gerencia'
            ? 'Tudo o que o analista faz no dia a dia e, em seguida, as ferramentas de gestão. Com prints do sistema e exemplos reais.'
            : 'Como usar o sistema no dia a dia, do primeiro acesso ao encerramento de uma O.S. Com prints do sistema e exemplos reais.'
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quick.map(([label, id]) => (
          <a
            key={id}
            href={`#${id}`}
            className="panel tone-surface tone-info p-4 text-sm font-medium transition hover:border-primary/40"
          >
            {label} →
          </a>
        ))}
      </div>
      <label className="panel flex items-center gap-3 px-4 py-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Procure um assunto (ex.: pausar, cofre, fluxo, senha)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Procurar no guia"
        />
      </label>

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Índice do guia"
          className="panel hidden flex-col gap-1 p-4 text-sm lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
        >
          {filtered.map((part) => (
            <div key={part.title} className="flex flex-col gap-1">
              {part.title && (
                <p className="mt-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {part.title.split(' · ')[1]}
                </p>
              )}
              {part.chapters.map((c) => (
                <div key={c.id} className="flex flex-col">
                  <a href={`#${c.id}`} className="py-1 font-medium hover:text-primary">
                    {c.title}
                  </a>
                  {c.topics.map((t) => (
                    <a
                      key={t.id}
                      href={`#${t.id}`}
                      className="py-0.5 pl-3 text-xs text-muted-foreground hover:text-primary"
                    >
                      {t.title}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <a href="#duvidas" className="mt-2 py-1 font-medium hover:text-primary">
            Dúvidas frequentes
          </a>
          <a href="#glossario" className="py-1 font-medium hover:text-primary">
            Glossário
          </a>
        </nav>

        <div className="flex min-w-0 flex-col gap-10">
          {filtered.every((p) => !p.chapters.length) && (
            <p className="text-sm text-muted-foreground">
              Nada encontrado para “{query}”. Tente outra palavra ou veja as dúvidas frequentes.
            </p>
          )}
          {filtered.map((part) => (
            <div key={part.title} className="flex flex-col gap-10">
              {part.title && part.chapters.length > 0 && (
                <h2 className="border-b border-border pb-2 text-2xl font-semibold">{part.title}</h2>
              )}
              {part.chapters.map((c) => (
                <section key={c.id} id={c.id} className="flex scroll-mt-24 flex-col gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{c.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{c.intro}</p>
                  </div>
                  {c.topics.map((t) => (
                    <TopicBlock key={t.id} topic={t} />
                  ))}
                </section>
              ))}
            </div>
          ))}

          <section id="duvidas" className="flex scroll-mt-24 flex-col gap-3">
            <h2 className="text-xl font-semibold">Dúvidas frequentes</h2>
            {faq.map(([question, answer]) => (
              <details key={question} className="panel group px-5 py-4">
                <summary className="cursor-pointer text-sm font-medium">{question}</summary>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
              </details>
            ))}
          </section>

          <section id="glossario" className="flex scroll-mt-24 flex-col gap-3">
            <h2 className="text-xl font-semibold">Glossário</h2>
            <dl className="panel grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-[180px_1fr]">
              {glossary.map(([term, meaning]) => (
                <div key={term} className="contents">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-muted-foreground">{meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
