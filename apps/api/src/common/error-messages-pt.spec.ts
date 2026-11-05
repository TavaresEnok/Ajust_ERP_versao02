import { translateErrorMessage, translateZodIssue } from './error-messages-pt';

describe('mensagens de erro em português (C-080)', () => {
  it('traduz mensagens conhecidas e preserva as que já estão em português', () => {
    expect(translateErrorMessage('Service order not found.')).toBe('O.S. não encontrada.');
    expect(translateErrorMessage('Role is not allowed to update notes.')).toBe(
      'Seu perfil não tem permissão para esta ação.',
    );
    expect(translateErrorMessage('Unsupported extension: .exe')).toBe(
      'Extensão de arquivo não aceita: .exe.',
    );
    expect(translateErrorMessage('A O.S. já está nesta etapa.')).toBe(
      'A O.S. já está nesta etapa.',
    );
    expect(translateErrorMessage('mensagem desconhecida')).toBe('mensagem desconhecida');
  });

  it('traduz erros de validação do Zod', () => {
    expect(translateZodIssue({ code: 'invalid_type', message: 'Required', path: ['title'] })).toBe(
      'Preencha título.',
    );
    expect(
      translateZodIssue({ code: 'too_small', message: 'x', path: ['firstOrder', 'description'] }),
    ).toBe('Valor curto demais em descrição.');
    expect(translateZodIssue({ code: 'invalid_type', message: 'x', path: ['campoNovo'] })).toBe(
      'Valor inválido em campoNovo.',
    );
    expect(
      translateZodIssue({ code: 'invalid_string', message: 'Invalid email', path: ['email'] }),
    ).toBe('Formato inválido em e-mail.');
  });
});
