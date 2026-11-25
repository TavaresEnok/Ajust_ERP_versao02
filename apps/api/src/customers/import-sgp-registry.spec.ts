import { PrismaClient } from '@prisma/client';
import { importSgpRegistry, sanitizeCustomer, sanitizeTechnicians } from './import-sgp-registry';

// Fictícios: os clientes reais ficam em config/sgp-customers.json, fora do Git.
const CUSTOMERS = [60, 108, 53, 89, 25, 9].map((id, index) => ({
  id,
  taxId: `1122233300${String(index + 10).padStart(4, '0')}`,
  tradeName: `PROVEDOR ${index + 1}`,
}));

describe('SGP cadastral allowlist', () => {
  it('keeps customer registration/contact fields, never credentials, financial or service data', () => {
    const sanitized = sanitizeCustomer(
      {
        id: 60,
        nome: 'PROVEDOR 1 original',
        cpfcnpj: '11.222.333/0000-10',
        tipo: 'J',
        endereco: { cidade: 'Recife', logradouro: 'Rua A', senha: 'secret' },
        contatos: {
          emails: [' a@example.com ', 'a@example.com'],
          celulares: ['123'],
          outros: ['sensitive'],
        },
        contratos: [{ senha: 'secret' }],
        titulos: [{ valor: 999 }],
        observacao: 'sensitive',
        dataNascimento: 'private',
      },
      CUSTOMERS[0],
    );
    expect(sanitized.legalName).toBe('PROVEDOR 1 original');
    expect(sanitized.contacts.emails).toEqual(['a@example.com']);
    expect(JSON.stringify(sanitized)).not.toMatch(/secret|sensitive|999|private/);
    expect(sanitized.address.cidade).toBe('Recife');
  });
  it('rejects mismatched identity rather than trusting filters', () => {
    expect(() => sanitizeCustomer({ id: 61, cpfcnpj: '11222333000010' }, CUSTOMERS[0])).toThrow(
      'divergente',
    );
    expect(() => sanitizeCustomer({ id: 60, cpfcnpj: '00000000000000' }, CUSTOMERS[0])).toThrow(
      'divergente',
    );
  });
  it('distinguishes people from the two operational accounts', () => {
    const records = sanitizeTechnicians([
      { id: 15, username: 'vitor', nome: 'Vitor Andrade' },
      { id: 23, username: 'Chamados_em_Espera', nome: '' },
      { id: 37, username: 'sistema_os', nome: 'Sistema O.S' },
    ]);
    expect(records.filter((x) => !x.operational).map((x) => x.id)).toEqual([15]);
    expect(records.filter((x) => x.operational)).toHaveLength(2);
  });
  it('refuses duplicate, invalid and unnamed person identities', () => {
    expect(() =>
      sanitizeTechnicians([
        { id: 1, username: 'x', nome: 'X' },
        { id: 1, username: 'y', nome: 'Y' },
      ]),
    ).toThrow('duplicado');
    expect(() => sanitizeTechnicians([{ id: 1, username: 'x', nome: '' }])).toThrow('sem nome');
    expect(() => sanitizeTechnicians({ detail: 'denied' })).toThrow();
  });
  it('dry-run reads cadastral endpoints only, with contracts/titles omitted, and never writes', async () => {
    const previous = process.env.SGP_TOKEN;
    process.env.SGP_TOKEN = 'test-secret';
    const transaction = jest.fn();
    const fakePrisma = {
      tenant: {
        findUnique: async () => ({
          id: 'test',
          slug: 'ajust-demo',
          status: 'ACTIVE',
          deletedAt: null,
        }),
      },
      role: { findUnique: async () => ({ id: 'tech' }) },
      $transaction: transaction,
    };
    const paths: string[] = [];
    const fetcher = jest.fn(async (url: string, init: RequestInit) => {
      paths.push(new URL(url).pathname);
      const params = init.body as URLSearchParams;
      expect(params.get('token')).toBe('test-secret');
      if (url.endsWith('/tecnicos/'))
        return new Response(JSON.stringify([{ id: 15, username: 'vitor', nome: 'Vitor Andrade' }]));
      expect(params.get('omitir_contratos')).toBe('1');
      expect(params.get('omitir_titulos')).toBe('1');
      const spec = CUSTOMERS.find((x) => String(x.id) === params.get('cliente_id'))!;
      return new Response(
        JSON.stringify({ clientes: [{ id: spec.id, nome: spec.tradeName, cpfcnpj: spec.taxId }] }),
      );
    });
    try {
      const result = await importSgpRegistry(
        fakePrisma as unknown as PrismaClient,
        false,
        fetcher as unknown as typeof fetch,
        CUSTOMERS,
      );
      expect(result.status).toBe('DRY_RUN');
      expect(transaction).not.toHaveBeenCalled();
      expect(paths).toHaveLength(7);
      expect(new Set(paths)).toEqual(new Set(['/api/ura/clientes/', '/api/ura/tecnicos/']));
      expect(result.plan.people).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.SGP_TOKEN;
      else process.env.SGP_TOKEN = previous;
    }
  });
});
