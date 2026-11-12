import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidade · Extensão Ajust Cofre',
  description: 'Como a extensão Ajust Cofre trata os dados de acesso.',
};

/** Página pública exigida pela Chrome Web Store para a extensão Ajust Cofre. */
export default function ExtensionPrivacyPage() {
  const h2 = 'mt-8 text-lg font-semibold text-foreground';
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-7 text-muted-foreground">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Ajust ERP</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        Política de privacidade da extensão Ajust Cofre
      </h1>
      <p className="mt-2">Última atualização: 12 de novembro de 2026.</p>

      <h2 className={h2}>Para que serve</h2>
      <p>
        A Ajust Cofre é uma extensão de uso interno da equipe da Ajust Consulting. Ela entra
        automaticamente nos sistemas dos provedores atendidos pela Ajust, preenchendo usuário, senha
        e código de verificação em duas etapas (2FA) guardados no cofre do Ajust ERP
        (erp.ajustconsulting.com.br). Ela só funciona para quem tem uma conta ativa no Ajust ERP.
      </p>

      <h2 className={h2}>Quais dados a extensão usa</h2>
      <ul className="list-disc pl-6">
        <li>
          Informações de autenticação (usuário, senha e código 2FA de uso único) de um acesso que o
          próprio usuário escolheu no cofre do Ajust ERP e confirmou com o motivo e a sua senha.
        </li>
        <li>O endereço do site desse acesso, para abrir a aba e conferir onde preencher.</li>
      </ul>
      <p>
        A extensão não lê o histórico de navegação, não coleta o conteúdo das páginas e não registra
        o que o usuário digita.
      </p>

      <h2 className={h2}>Como os dados são tratados</h2>
      <ul className="list-disc pl-6">
        <li>
          Os dados chegam da página do Ajust ERP somente quando o usuário clica em “Entrar
          automaticamente”.
        </li>
        <li>
          Ficam apenas na memória do navegador (armazenamento de sessão da extensão), nunca em
          disco, e são apagados assim que o login termina, quando a aba é fechada ou em até 3
          minutos.
        </li>
        <li>
          São preenchidos somente na aba aberta pela extensão e apenas se o endereço for exatamente
          o cadastrado no cofre. Se o site redirecionar para outro endereço, nada é preenchido.
        </li>
        <li>
          A extensão não envia dados para nenhum servidor: ela não faz requisições próprias. Os
          dados vão apenas para o site do próprio acesso, como aconteceria se o usuário os
          digitasse.
        </li>
        <li>
          A chave do autenticador 2FA nunca sai do Ajust ERP; a extensão recebe só os códigos de uso
          único, que expiram em segundos.
        </li>
      </ul>

      <h2 className={h2}>Compartilhamento</h2>
      <p>
        Os dados não são vendidos, não são compartilhados com terceiros e não são usados para
        publicidade, perfis de usuário, análise de crédito ou qualquer finalidade além de entrar no
        sistema escolhido pelo usuário.
      </p>

      <h2 className={h2}>Registro e auditoria</h2>
      <p>
        Cada entrada automática fica registrada no histórico do Ajust ERP (quem, quando, qual acesso
        e o motivo informado), como qualquer outra consulta ao cofre.
      </p>

      <h2 className={h2}>Contato</h2>
      <p>
        Dúvidas sobre esta política: Ajust Consulting, pelo e-mail{' '}
        <a className="text-primary underline" href="mailto:contato@ajustconsulting.com.br">
          contato@ajustconsulting.com.br
        </a>
        .
      </p>
    </main>
  );
}
