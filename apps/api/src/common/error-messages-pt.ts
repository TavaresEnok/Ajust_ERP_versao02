/**
 * Mensagens de erro da API em português (auditoria C-080). A tradução é feita na saída
 * (filtro global), então o código e os códigos de status continuam iguais e nada que
 * compare o texto original quebra. Mensagens já em português passam sem alteração.
 */
const EXACT: Record<string, string> = {
  'Missing tenantId': 'Sessão sem empresa selecionada. Entre novamente.',
  'Missing authentication': 'Entre no sistema para continuar.',
  'Missing Bearer token.': 'Entre no sistema para continuar.',
  'Invalid or expired access token.': 'Sua sessão expirou. Entre novamente.',
  'Session is revoked, invalid, or expired.':
    'Sua sessão expirou ou foi encerrada. Entre novamente.',
  'Invalid credentials.': 'E-mail, usuário ou senha inválidos.',
  'Invalid user.': 'Usuário inválido.',
  'Invalid or expired reset token.': 'O link de redefinição é inválido ou expirou. Peça um novo.',
  'Service order not found.': 'O.S. não encontrada.',
  'Order not found.': 'O.S. não encontrada.',
  'Service order is not accessible.': 'Você não tem acesso a esta O.S.',
  'Occurrence not found.': 'Ocorrência não encontrada.',
  'Occurrence not found for this tenant.': 'Ocorrência não encontrada nesta empresa.',
  'Tenant not found.': 'Empresa não encontrada.',
  'Tenant is inactive or suspended.': 'A empresa está inativa ou suspensa.',
  'Tenant is unavailable.': 'A empresa não está disponível.',
  'Tenant scope mismatch for session.': 'A sessão não pertence a esta empresa. Entre novamente.',
  'Tenant membership is no longer valid.': 'Seu acesso a esta empresa foi removido.',
  'Tenant logo not found.': 'Logo da empresa não encontrado.',
  'Tenant already exists or has conflicting unique fields.':
    'Já existe uma empresa com esses dados (CNPJ, nome curto ou domínio).',
  'Tenant could not be updated due to conflicting unique fields.':
    'Não foi possível atualizar: outro cadastro já usa esses dados.',
  'Credential not found.': 'Credencial não encontrada.',
  'User not found.': 'Usuário não encontrado.',
  'User not found': 'Usuário não encontrado.',
  'User is inactive or not found.': 'Usuário inativo ou não encontrado.',
  'User is already linked to this tenant.': 'Este usuário já pertence a esta empresa.',
  'User membership not found for this tenant.': 'Este usuário não pertence a esta empresa.',
  'User has no tenant membership for requested scope.':
    'Este usuário não tem acesso à empresa pedida.',
  'User has no tenant membership.': 'Este usuário não pertence a nenhuma empresa.',
  'User has no membership for this tenant.': 'Este usuário não pertence a esta empresa.',
  'User could not be created. Check unique constraints.':
    'Não foi possível criar o usuário. Confira se o e-mail já está em uso.',
  'User could not be updated. Check unique constraints.':
    'Não foi possível atualizar o usuário. Confira se o e-mail já está em uso.',
  'You cannot remove your own active account.': 'Você não pode remover a sua própria conta.',
  'You can only remove your own time entries.':
    'Você só pode remover os seus próprios apontamentos.',
  'This action is outside of your tenant scope.': 'Esta ação está fora da sua empresa.',
  'Role not found.': 'Perfil de acesso não encontrado.',
  'Policy not found': 'Política não encontrada.',
  'Override policies require a serviceOrderType.': 'Exceções de SLA exigem o tipo de serviço.',
  'New SLA policies require priority and hours.':
    'Informe a prioridade e as horas da política de SLA.',
  'An equivalent SLA policy already exists.': 'Já existe uma política de SLA equivalente.',
  'Asset not found.': 'Ativo não encontrado.',
  'Note not found.': 'Nota não encontrada.',
  'Knowledge article not found.': 'Artigo não encontrado.',
  'Time entry not found.': 'Apontamento não encontrado.',
  'Schedule not found.': 'Plantão não encontrado.',
  'Survey not found.': 'Pesquisa não encontrada.',
  'Survey already answered.': 'Esta pesquisa já foi respondida.',
  'Score must be between 1 and 5.': 'A nota deve ser de 1 a 5.',
  'Annotation message is required.': 'Escreva o texto da anotação.',
  'Workflow not found': 'Workflow não encontrado.',
  'Workflow must contain exactly one trigger node.':
    'O workflow precisa ter exatamente um gatilho.',
  'Workflow must contain at least one node.': 'O workflow precisa ter ao menos um passo.',
  'Workflow must contain at least one action node.': 'O workflow precisa ter ao menos uma ação.',
  'Workflow does not allow self-loop edges.':
    'Um passo do workflow não pode apontar para ele mesmo.',
  'Workflow contains edges pointing to non-existent nodes.':
    'O workflow tem ligações para passos que não existem.',
  'Disable the current 2FA configuration before replacing it.':
    'Desative a verificação em duas etapas atual antes de configurar outra.',
  'Unsupported logo. Use a png, jpg, or webp file up to 5 MB.':
    'Logo não aceito. Use um arquivo PNG, JPG ou WEBP de até 5 MB.',
  'Internal server error': 'Erro interno. Tente novamente; se continuar, avise a Ajust.',
  Unauthorized: 'Não autorizado.',
  Forbidden: 'Acesso negado.',
  'Forbidden resource': 'Acesso negado.',
  'Not Found': 'Não encontrado.',
  'Bad Request': 'Requisição inválida.',
  Conflict: 'Conflito: o registro foi alterado.',
};

const PREFIX: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^Role is not allowed to (.+)\.$/, () => 'Seu perfil não tem permissão para esta ação.'],
  [
    /^Role (.+) cannot assign (.+)\.$/,
    (m) => `O perfil ${m[1]} não pode atribuir o perfil ${m[2]}.`,
  ],
  [/^Unsupported extension: (.+)$/, (m) => `Extensão de arquivo não aceita: ${m[1]}.`],
  [/^Unsupported mime type: (.+)$/, (m) => `Tipo de arquivo não aceito: ${m[1]}.`],
  [/^File too large: (.+)$/, (m) => `Arquivo grande demais: ${m[1]}.`],
  [/^Attachment limit exceeded\..*$/, () => 'Limite de anexos da O.S. excedido.'],
  [/^Max (\d+) files per request\.$/, (m) => `No máximo ${m[1]} arquivos por envio.`],
  [/^At least one file is required\.$/, () => 'Selecione pelo menos um arquivo.'],
  [/^Attachment not found\.$/, () => 'Anexo não encontrado.'],
  [
    /^Attachment file not found on disk\.$/,
    () => 'O arquivo do anexo não foi encontrado no servidor.',
  ],
  [/^Internal attachment not accessible to customer\.$/, () => 'Este anexo é interno.'],
  [
    /^Transition (\S+) -> (\S+) is not allowed\.$/,
    (m) => `Não é possível passar de ${m[1]} para ${m[2]}.`,
  ],
  [/^RFC (.+)$/, () => 'RFC não encontrada ou já está nesta situação.'],
  [/^tenantId cannot be passed (.+)\./, () => 'Requisição inválida: a empresa vem da sessão.'],
];

export function translateErrorMessage(message: string): string {
  const exact = EXACT[message];
  if (exact) return exact;
  for (const [pattern, build] of PREFIX) {
    const match = message.match(pattern);
    if (match) return build(match);
  }
  return message;
}

/** Zod em português para os erros de validação mais comuns. */
/** Nome do campo como aparece na tela (C-080); campos sem tradução saem como no schema. */
const FIELD_LABEL: Record<string, string> = {
  identifier: 'e-mail ou usuário',
  email: 'e-mail',
  password: 'senha',
  currentPassword: 'senha atual',
  newPassword: 'nova senha',
  name: 'nome',
  title: 'título',
  description: 'descrição',
  type: 'tipo de serviço',
  priority: 'prioridade',
  status: 'situação',
  toStatus: 'próxima etapa',
  reason: 'justificativa',
  requester: 'solicitante',
  sector: 'setor',
  origin: 'origem',
  provider: 'provedor',
  customerId: 'provedor',
  occurrenceId: 'ocorrência',
  ownerUserId: 'aberto por',
  assigneeUserId: 'analista responsável',
  deadlineAt: 'prazo',
  deadlineReason: 'motivo da mudança de prazo',
  expectedVersion: 'versão da O.S.',
  scheduledAt: 'data agendada',
  message: 'texto',
  roleCode: 'função',
  tenantId: 'empresa',
  startsAt: 'início',
  endsAt: 'término',
  minutes: 'minutos',
  hours: 'horas',
  host: 'host',
  username: 'usuário',
  secret: 'senha',
  environment: 'ambiente',
  firstOrder: 'primeira O.S.',
};

function fieldLabel(path: unknown[] | undefined) {
  const parts = (path ?? []).filter((p): p is string => typeof p === 'string');
  if (!parts.length) return 'campo';
  return FIELD_LABEL[parts[parts.length - 1]] ?? parts.join('.');
}

export function translateZodIssue(issue: { code: string; message: string; path?: unknown[] }) {
  const field = fieldLabel(issue.path);
  if (issue.message === 'Required') return `Preencha ${field}.`;
  if (issue.code === 'invalid_type') return `Valor inválido em ${field}.`;
  if (
    issue.code === 'invalid_string' ||
    issue.code === 'invalid_format' ||
    /Invalid (email|uuid|datetime)/i.test(issue.message)
  )
    return `Formato inválido em ${field}.`;
  if (issue.code === 'too_small') return `Valor curto demais em ${field}.`;
  if (issue.code === 'too_big') return `Valor longo demais em ${field}.`;
  if (issue.code === 'invalid_enum_value' || issue.code === 'invalid_value')
    return `Opção inválida em ${field}.`;
  return issue.message;
}
