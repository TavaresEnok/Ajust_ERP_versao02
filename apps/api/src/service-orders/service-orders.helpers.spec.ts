import { csvCell, compactRecord, reduceCountRows } from './service-orders.helpers';

describe('service-orders.helpers', () => {
  describe('csvCell', () => {
    it('retorna string vazia para null e undefined', () => {
      expect(csvCell(null)).toBe('');
      expect(csvCell(undefined)).toBe('');
    });

    it('converte número para string', () => {
      expect(csvCell(42)).toBe('42');
    });

    it('escapa aspas envolvendo o valor em aspas duplas', () => {
      expect(csvCell('a"b')).toBe('"a""b"');
    });

    it('escapa vírgulas', () => {
      expect(csvCell('a,b')).toBe('"a,b"');
    });

    it('escapa quebras de linha (CRLF → LF e envolve em aspas)', () => {
      expect(csvCell('a\r\nb')).toBe('"a\nb"');
      expect(csvCell('a\nb')).toBe('"a\nb"');
      expect(csvCell('a\rb')).toBe('"a\nb"');
    });

    it('não escapa valor simples', () => {
      expect(csvCell('abc')).toBe('abc');
      expect(csvCell('123')).toBe('123');
    });
  });

  describe('compactRecord', () => {
    it('remove chaves com valor undefined', () => {
      expect(compactRecord({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
    });

    it('preserva null (apenas undefined é removido)', () => {
      expect(compactRecord({ a: null, b: 0, c: '' })).toEqual({ a: null, b: 0, c: '' });
    });

    it('retorna objeto vazio se tudo é undefined', () => {
      expect(compactRecord({ a: undefined, b: undefined })).toEqual({});
    });
  });

  describe('reduceCountRows', () => {
    it('inicializa todas as chaves com zero', () => {
      const result = reduceCountRows([], ['ABERTA', 'FECHADA'] as const);
      expect(result).toEqual({ ABERTA: 0, FECHADA: 0 });
    });

    it('sobrescreve zero com valores da lista', () => {
      const rows = [
        { key: 'ABERTA' as const, count: 5 },
        { key: 'FECHADA' as const, count: 3 },
      ];
      expect(reduceCountRows(rows, ['ABERTA', 'FECHADA'] as const)).toEqual({
        ABERTA: 5,
        FECHADA: 3,
      });
    });
  });
});
