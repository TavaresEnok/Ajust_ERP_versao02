'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Star,
  LockKeyhole,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Brand } from './primitives';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useErpPublicAction, useErpPublicQuery } from '@/lib/erp/gateway';
import { errorMessage, type BffAuthResult, type PublicSurvey } from '@/lib/erp/contracts';
import { QueryState } from './contract-form';

const reviewAccounts = [
  {
    role: 'Gerente',
    identifier: 'gestores.admin@ajust.invalid',
    password: 'Aj!LFOUfO0c-ODE500KG7vu',
  },
  {
    role: 'Analista · Anderson Alves',
    identifier: 'anderson.alves@ajust.invalid',
    password: 'Aj!4z0KrFoMZfoS1mgvGPBG',
  },
  {
    role: 'Cliente · Meganet',
    identifier: 'meganet.teste@ajust.invalid',
    password: 'Aj!OVmPYgYoasNbqTNZZP0t',
  },
];

export function AuthPage({ mode }: { mode: string }) {
  const [sent, setSent] = useState(false);
  const [show, setShow] = useState(false);
  const [authStep, setAuthStep] = useState<
    'credentials' | 'two-factor' | 'bootstrap-request' | 'bootstrap-verify'
  >('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [bootstrapEmail, setBootstrapEmail] = useState('');
  const router = useRouter();
  const action = useErpPublicAction();
  const [challenge, setChallenge] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!challenge) return;
    const timer = setTimeout(() => {
      setChallenge('');
      setAuthStep('credentials');
      setError('O desafio expirou. Entre novamente para receber um novo desafio.');
    }, 300000);
    return () => clearTimeout(timer);
  }, [challenge]);
  const isLogin = mode === 'login' && authStep === 'credentials';
  const isTwoFactor = mode.startsWith('verify-') || authStep === 'two-factor';
  const isBootstrapRequest = mode === 'login' && authStep === 'bootstrap-request';
  const isBootstrapVerify = mode === 'login' && authStep === 'bootstrap-verify';
  const isForgot = mode === 'forgot-password';
  const isReset = mode === 'reset-password';
  const title = isLogin
    ? 'Bom ter você por aqui.'
    : isBootstrapRequest
      ? 'Configure seu primeiro acesso.'
      : isBootstrapVerify
        ? 'Valide seu primeiro acesso.'
        : isForgot
          ? 'Esqueceu sua senha?'
          : isReset
            ? 'Uma nova senha.'
            : 'Verifique sua identidade.';
  return (
    <div className="auth-screen">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-[10px] text-white/70">
            <span className="size-1.5 rounded-full bg-chart-2" />
            GESTÃO QUE CONECTA
          </span>
          <h1 className="max-w-lg text-5xl leading-[1.17] font-medium tracking-[-2px]">
            Uma operação
            <br />
            mais conectada.
            <br />
            <span className="text-chart-2">Um dia mais leve.</span>
          </h1>
          <p className="mt-7 max-w-sm text-sm leading-7 text-white/60">
            Pessoas, conhecimento e atendimentos em uma experiência feita para simplificar o seu
            trabalho.
          </p>
          <div className="mt-12 flex gap-4">
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/15">
              <ShieldCheck className="size-5 text-chart-2" />
            </span>
            <div>
              <p className="text-xs">Sua operação, em boas mãos.</p>
              <p className="mt-2 text-[10px] text-white/50">
                Clareza, segurança e produtividade em cada detalhe.
              </p>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-white/40">© 2026 Ajust Tecnologia · Feito para conectar.</p>
      </section>
      <section className="auth-form">
        <div>
          <div className="mb-12 lg:hidden">
            <Brand />
          </div>
          {sent ? (
            <div>
              <span className="mb-5 flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                <CheckCircle2 className="size-6" />
              </span>
              <h2 className="text-2xl font-semibold tracking-tight">
                {action.connected
                  ? 'Solicitação recebida pelo ERP'
                  : isLogin
                    ? 'Prévia da tela de acesso'
                    : isForgot
                      ? 'Solicitação demonstrada'
                      : isReset
                        ? 'Redefinição demonstrada'
                        : 'Verificação demonstrada'}
              </h2>
              <p className="my-5 text-sm leading-7 text-muted-foreground">
                {action.connected
                  ? isForgot
                    ? 'Se o e-mail informado estiver cadastrado, você receberá as instruções de recuperação.'
                    : 'O ERP confirmou a operação solicitada. Você pode voltar para o acesso.'
                  : 'Prévia de interface: nenhum e-mail, senha ou credencial foi enviado ou armazenado. Conecte o adaptador público do BFF para habilitar o fluxo real.'}
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs text-primary-foreground"
              >
                Explorar o redesign
                <ArrowRight className="size-4" />
              </Link>
              <button
                onClick={() => setSent(false)}
                className="mt-5 block text-xs text-muted-foreground"
              >
                Voltar ao formulário
              </button>
            </div>
          ) : (
            <>
              <span className="mb-5 inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-1 text-[9px] text-primary">
                <LockKeyhole className="size-3" />
                {action.connected ? 'ACESSO AO ERP' : 'PRÉVIA DE INTERFACE'}
              </span>
              <h2 className="text-[28px] font-semibold tracking-[-1px]">{title}</h2>
              <p className="mt-3 mb-8 text-xs leading-6 text-muted-foreground">
                {isLogin
                  ? 'Acesse seu workspace e mantenha tudo no melhor ritmo.'
                  : isBootstrapRequest
                    ? 'Informe o CNPJ da empresa e o e-mail cadastrado para solicitar um código de uso único.'
                    : isBootstrapVerify
                      ? 'Use o código recebido para definir sua senha inicial.'
                      : isForgot
                        ? 'Informe seu e-mail para visualizar o fluxo de recuperação.'
                        : isReset
                          ? 'Escolha uma senha forte para continuar.'
                          : 'Informe o código de seis dígitos do seu aplicativo autenticador.'}
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError('');
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  const rawIdentifier = String(data.get('identifier') || identifier).trim();
                  const cnpj = rawIdentifier
                    .split('')
                    .filter((character) => character >= '0' && character <= '9')
                    .join('');
                  const email = String(data.get('bootstrapEmail') || bootstrapEmail).trim();
                  try {
                    if (isBootstrapRequest || isBootstrapVerify) {
                      if (cnpj.length !== 14 || !email)
                        throw new Error('Informe um CNPJ válido e o e-mail cadastrado.');
                    }
                    if (isBootstrapVerify) {
                      const code = String(data.get('code') || '');
                      const password = String(data.get('password') || '');
                      const confirmation = String(data.get('confirmPassword') || '');
                      if (
                        code.length !== 6 ||
                        !Array.from(code).every((digit) => digit >= '0' && digit <= '9')
                      )
                        throw new Error('Informe o código de seis dígitos.');
                      if (password.length < 8)
                        throw new Error('A nova senha deve conter pelo menos 8 caracteres.');
                      if (password !== confirmation) throw new Error('As senhas não coincidem.');
                    }
                    if (isReset && data.get('password') !== data.get('confirmPassword'))
                      throw new Error('As senhas não coincidem.');
                    if (!action.connected) {
                      setSent(true);
                      form.reset();
                      return;
                    }
                    const token = new URLSearchParams(window.location.search).get('token');
                    if (isBootstrapRequest) {
                      const result = await action.execute<{ success?: boolean }>({
                        path: '/auth/bootstrap/request-otp',
                        method: 'POST',
                        body: { cnpj, email },
                      });
                      if (!result?.success)
                        throw new Error(
                          'O BFF não confirmou a solicitação do código de primeiro acesso.',
                        );
                      setIdentifier(cnpj);
                      setBootstrapEmail(email);
                      setAuthStep('bootstrap-verify');
                      form.reset();
                      return;
                    }
                    let response: BffAuthResult;
                    if (isBootstrapVerify) {
                      const validation = await action.execute<{
                        success?: boolean;
                        bootstrapToken?: string;
                      }>({
                        path: '/auth/bootstrap/validate-otp',
                        method: 'POST',
                        body: {
                          cnpj,
                          email,
                          otp: data.get('code'),
                          newPassword: data.get('password'),
                        },
                      });
                      if (!validation?.success || !validation.bootstrapToken)
                        throw new Error(
                          'O BFF não confirmou a validação do código de primeiro acesso.',
                        );
                      response = await action.execute<BffAuthResult>({
                        path: '/auth/login',
                        method: 'POST',
                        body: {
                          identifier: cnpj,
                          email: bootstrapEmail,
                          password: data.get('password'),
                          bootstrapToken: validation.bootstrapToken,
                        },
                      });
                    } else {
                      const body = isLogin
                        ? {
                            identifier: data.get('identifier'),
                            password: data.get('password'),
                            next:
                              new URLSearchParams(window.location.search).get('next') || undefined,
                          }
                        : isForgot
                          ? { email: data.get('identifier') }
                          : isReset
                            ? { token, newPassword: data.get('password') }
                            : {
                                temporaryToken: challenge || data.get('temporaryToken'),
                                code: data.get('code'),
                                next:
                                  new URLSearchParams(window.location.search).get('next') ||
                                  undefined,
                              };
                      if (isReset && (!token || token.length < 20))
                        throw new Error(
                          'O link de redefinição não contém um token válido. Solicite um novo link.',
                        );
                      response = await action.execute<BffAuthResult>({
                        path: `/auth/${isLogin ? 'login' : isForgot ? 'forgot-password' : isReset ? 'reset-password' : 'verify-2fa'}`,
                        method: 'POST',
                        body,
                      });
                    }
                    form.reset();
                    if (response?.twoFactorRequired && response.temporaryToken) {
                      setChallenge(response.temporaryToken);
                      setAuthStep('two-factor');
                      return;
                    }
                    if (isForgot || isReset) {
                      setSent(true);
                      return;
                    }
                    if (!response?.authenticated)
                      throw new Error(
                        'O BFF não confirmou uma sessão autenticada. Não foi concedido acesso.',
                      );
                    setChallenge('');
                    setAuthStep('credentials');
                    const destination = response.redirectTo;
                    const allowedHomes = ['/gerencia', '/analista', '/cliente'];
                    const safeDestination =
                      destination &&
                      !destination.startsWith('//') &&
                      !destination.split('/').includes('..') &&
                      allowedHomes.some(
                        (home) => destination === home || destination.startsWith(home + '/'),
                      );
                    router.replace(safeDestination ? destination : '/');
                    router.refresh();
                  } catch (cause) {
                    setError(errorMessage(cause));
                  }
                }}
              >
                <FieldGroup>
                  {(isLogin || isForgot || isBootstrapRequest || isBootstrapVerify) && (
                    <Field>
                      <FieldLabel htmlFor="auth-identifier">
                        {isBootstrapRequest || isBootstrapVerify
                          ? 'CNPJ da empresa'
                          : isForgot
                            ? 'E-mail corporativo'
                            : 'E-mail corporativo ou CNPJ'}
                      </FieldLabel>
                      <Input
                        id="auth-identifier"
                        name="identifier"
                        type={isForgot ? 'email' : 'text'}
                        placeholder={
                          isBootstrapRequest || isBootstrapVerify
                            ? '00.000.000/0000-00'
                            : 'voce@empresa.com.br'
                        }
                        required
                        autoComplete={isForgot ? 'email' : 'username'}
                        value={isForgot ? undefined : identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                        readOnly={isBootstrapVerify}
                      />
                    </Field>
                  )}
                  {(isBootstrapRequest || isBootstrapVerify) && (
                    <Field>
                      <FieldLabel htmlFor="bootstrap-email">E-mail cadastrado</FieldLabel>
                      <Input
                        id="bootstrap-email"
                        name="bootstrapEmail"
                        type="email"
                        value={bootstrapEmail}
                        onChange={(event) => setBootstrapEmail(event.target.value)}
                        required
                        autoComplete="email"
                        readOnly={isBootstrapVerify}
                      />
                    </Field>
                  )}
                  {(isLogin || isReset || isBootstrapVerify) && (
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor="auth-password">
                          {isReset || isBootstrapVerify ? 'Nova senha' : 'Senha'}
                        </FieldLabel>
                        {isLogin && (
                          <Link href="/forgot-password" className="text-[10px] text-primary">
                            Esqueceu a senha?
                          </Link>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          id="auth-password"
                          name="password"
                          type={show ? 'text' : 'password'}
                          placeholder={
                            isLogin
                              ? 'Digite sua senha'
                              : 'Crie uma senha com pelo menos 8 caracteres'
                          }
                          required
                          minLength={8}
                          autoComplete={isLogin ? 'current-password' : 'new-password'}
                          value={isLogin ? password : undefined}
                          onChange={(event) => {
                            if (isLogin) setPassword(event.target.value);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShow(!show)}
                          className="absolute top-2 right-3 text-muted-foreground"
                          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </Field>
                  )}
                  {(isBootstrapVerify || isReset) && (
                    <Field>
                      <FieldLabel htmlFor="auth-confirm-password">Confirme a nova senha</FieldLabel>
                      <Input
                        id="auth-confirm-password"
                        name="confirmPassword"
                        type={show ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                    </Field>
                  )}
                  {(isTwoFactor || isBootstrapVerify) && (
                    <Field>
                      {isTwoFactor && !challenge && (
                        <>
                          <FieldLabel htmlFor="temporary-token">
                            Token temporário do desafio
                          </FieldLabel>
                          <Input
                            id="temporary-token"
                            name="temporaryToken"
                            type="password"
                            minLength={20}
                            required
                            autoComplete="off"
                          />
                        </>
                      )}
                      <FieldLabel htmlFor="verify-code">
                        {isBootstrapVerify ? 'Código de primeiro acesso' : 'Código de verificação'}
                      </FieldLabel>
                      <Input
                        id="verify-code"
                        name="code"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="000000"
                        required
                        autoComplete="one-time-code"
                      />
                    </Field>
                  )}
                </FieldGroup>
                {error && (
                  <p className="mt-4 text-xs text-danger" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" className="mt-6 w-full" disabled={action.pending}>
                  {isLogin
                    ? action.connected
                      ? 'Entrar no ERP'
                      : 'Visualizar acesso'
                    : isBootstrapRequest
                      ? 'Solicitar código de primeiro acesso'
                      : isBootstrapVerify
                        ? 'Validar código e definir senha'
                        : isForgot
                          ? 'Continuar recuperação'
                          : isReset
                            ? 'Redefinir senha'
                            : 'Validar código'}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </form>
              {isLogin && action.connected && (
                <section
                  className="mt-8 border-t border-border pt-6"
                  aria-label="Acessos para demonstração"
                >
                  <div className="mb-4">
                    <h2 className="text-xs font-semibold uppercase tracking-wide">
                      Acessos de demonstração
                    </h2>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Selecione um perfil para preencher o login e a senha.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {reviewAccounts.map((account) => (
                      <button
                        key={account.role}
                        type="button"
                        onClick={() => {
                          setIdentifier(account.identifier);
                          setPassword(account.password);
                          setShow(false);
                          setError('');
                        }}
                        className="rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className="block text-xs font-medium">{account.role}</span>
                        <span className="mt-1 block break-all text-[10px] text-muted-foreground">
                          {account.identifier}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                          {account.password}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <p className="mt-5 text-[10px] leading-5 text-muted-foreground">
                {action.connected
                  ? 'Acesse com as credenciais fornecidas pela sua empresa.'
                  : 'O acesso está temporariamente indisponível.'}
              </p>
              <div className="mt-8 border-t border-border pt-5">
                {isBootstrapRequest || isBootstrapVerify ? (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setAuthStep('credentials');
                      setError('');
                    }}
                  >
                    <ArrowLeft className="size-3" />
                    Voltar para o acesso
                  </button>
                ) : (
                  !isLogin && (
                    <Link href="/login" className="text-link">
                      <ArrowLeft className="size-3" />
                      Voltar para o acesso
                    </Link>
                  )
                )}
                {isLogin && (
                  <button
                    type="button"
                    className="mt-4 block text-xs text-primary hover:underline"
                    onClick={() => {
                      setAuthStep('bootstrap-request');
                      setError('');
                    }}
                  >
                    Primeiro acesso? Configure sua senha
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
export function SatisfactionPage({ token }: { token: string }) {
  const [score, setScore] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);
  const action = useErpPublicAction();
  const survey = useErpPublicQuery<PublicSurvey>(
    token ? `/csat/survey/${encodeURIComponent(token)}` : null,
  );
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6">
      <Link href="/" className="mb-10">
        <Brand />
      </Link>
      <section className="panel w-full max-w-lg p-8 text-center">
        {sent ? (
          <>
            <CheckCircle2 className="mx-auto mb-5 size-12 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Obrigado pelo seu feedback!</h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              O ERP confirmou o recebimento da sua avaliação. Obrigado por nos ajudar a melhorar.
            </p>
            <Link href="/cliente" className="mt-6 text-link">
              Voltar para o portal
              <ArrowRight />
            </Link>
          </>
        ) : (
          <>
            <p className="mini-label mb-4">SUA EXPERIÊNCIA IMPORTA</p>
            <h1 className="text-2xl font-semibold tracking-tight">Como foi seu atendimento?</h1>
            <p className="my-5 text-xs leading-6 text-muted-foreground">
              Conte como foi sua experiência com nossa equipe.
              <br />
              {survey.data
                ? `${survey.data.order.protocol} · ${survey.data.order.type}`
                : 'Pesquisa vinculada a um token individual de atendimento.'}
            </p>
            <div
              className="my-7 flex justify-center gap-3"
              role="group"
              aria-label="Avaliação de satisfação"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  aria-label={n + ' estrelas'}
                  aria-pressed={score === n}
                  onClick={() => setScore(n)}
                >
                  <Star
                    className={cn(
                      'size-9 transition-colors',
                      score >= n ? 'fill-warning text-warning' : 'text-border',
                    )}
                  />
                </button>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                setValidated(false);
                if (!action.connected) {
                  setValidated(true);
                  return;
                }
                try {
                  if (!survey.data || survey.data.answered)
                    throw new Error('Esta pesquisa não está disponível ou já foi respondida.');
                  const comment = String(new FormData(e.currentTarget).get('comment') || '').trim();
                  await action.execute({
                    path: `/csat/survey/${encodeURIComponent(token)}/answer`,
                    method: 'POST',
                    body: { score, ...(comment ? { comment } : {}) },
                  });
                  setSent(true);
                  await survey.mutate();
                } catch (error) {
                  setError(errorMessage(error));
                }
              }}
            >
              <Field>
                <FieldLabel htmlFor="csat-comment">Quer compartilhar mais alguma coisa?</FieldLabel>
                <Textarea
                  id="csat-comment"
                  name="comment"
                  maxLength={4000}
                  placeholder="Seu comentário é opcional..."
                />
              </Field>
              <QueryState loading={survey.isLoading} error={survey.error} />
              {survey.data?.answered && (
                <p role="status" className="mt-4 text-xs">
                  Esta pesquisa já foi respondida.
                </p>
              )}
              {error && (
                <p role="alert" className="mt-4 text-xs text-danger">
                  {error}
                </p>
              )}
              {validated && (
                <p role="status" className="mt-4 text-xs text-primary">
                  Avaliação validada · não enviada. Backend público não conectado.
                </p>
              )}
              <Button
                type="submit"
                className="mt-5 w-full"
                disabled={
                  !score ||
                  action.pending ||
                  (action.connected && (!survey.data || survey.data.answered))
                }
              >
                {action.connected ? 'Enviar avaliação' : 'Validar avaliação sem enviar'}
              </Button>
            </form>
            <p className="mt-4 text-[10px] text-muted-foreground">
              {action.connected
                ? 'Resposta única vinculada ao token desta pesquisa.'
                : 'Prévia visual. Nenhuma resposta é enviada ao servidor.'}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
