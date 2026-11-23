import { classifySample } from './sample-classification';
import {
  assertPublishable,
  makeOperationalDefinition,
  validateOperational,
} from './operational-definition';
import { ajustFlow } from './ajust-default-flows';
import { safeSgpText } from './import-sgp-sample';

describe('Reviewed SGP pilot definitions', () => {
  it('classifies source content rather than assuming every OLT or migration label means installation', () => {
    expect(classifySample(8911, 'CONFIGURAÇÃO OLT').name).toContain('ENERGIA');
    expect(classifySample(11892, 'MIGRAÇÃO DE EQUIPAMENTO').name).toContain('AUTENTICAÇÃO');
    expect(classifySample(11931, 'MIGRAÇÃO DE EQUIPAMENTO').name).toContain('SCRIPT');
    expect(classifySample(999999, 'Outro tipo').reviewed).toBe(false);
  });
  it('defines one order for DNS and script delivery, three child orders only for the OLT example', () => {
    for (const type of ['VERIFICAÇÃO DE DNS', 'PREPARAÇÃO DE SCRIPT DE MIGRAÇÃO']) {
      const d = makeOperationalDefinition(type);
      expect(new Set(d.nodes.filter((n) => n.kind === 'task').map((n) => n.orderKey))).toEqual(
        new Set(['root']),
      );
    }
    const script = makeOperationalDefinition('PREPARAÇÃO DE SCRIPT DE MIGRAÇÃO');
    expect(script.nodes.find((n) => n.id === 'validacao')!.name).toContain('sem executar');
    const olt = makeOperationalDefinition('CONFIGURAÇÃO OLT');
    expect(olt.nodes.filter((n) => n.kind === 'task' && n.orderKey !== 'root')).toHaveLength(3);
  });
  it('distinguishes DNS security, installation and resolution evidence', () => {
    const security = makeOperationalDefinition('SEGURANÇA DO DNS RECURSIVO');
    expect(security.nodes.find((n) => n.id === 'diagnostico')!.requiredFields.join(' ')).toContain(
      'CERT.br',
    );
    const installation = makeOperationalDefinition('IMPLANTAÇÃO DE DNS');
    expect(installation.nodes.find((n) => n.id === 'execucao')!.name).toContain('Implantar');
  });
  it('rejects disconnected nodes and invalid join gates before publication', () => {
    const d = makeOperationalDefinition('CONFIGURAÇÃO OLT');
    d.nodes.find((n) => n.id === 'reunir')!.waitFor = ['backup'];
    expect(() => validateOperational(d)).toThrow('Junção');
    const simple = makeOperationalDefinition('DNS');
    simple.nodes.find((n) => n.id === 'triagem')!.routes = { Falha: 'inexistente' };
    expect(() => validateOperational(simple)).toThrow('Destino');
  });
  it('removes credential-bearing lines and embedded URL credentials without discarding technical lines', () => {
    const safe = safeSgpText(
      'Porta PON 3\nCredenciais admin/admin\nsenha: secreta\nhttps://login:segredo@example.test/a\nDiagnóstico registrado',
    );
    expect(safe).toContain('Porta PON 3');
    expect(safe).toContain('Diagnóstico registrado');
    expect(safe).not.toContain('admin/admin');
    expect(safe).not.toContain('secreta');
    expect(safe).not.toContain('segredo');
  });
  describe('assertPublishable (desenhos que publicam mas travam o atendimento)', () => {
    it('aceita todos os fluxos de fábrica e os modelos gerados do piloto', () => {
      for (const code of ['AJUST_SIMPLES', 'AJUST_MUDANCA', 'AJUST_EQUIPAMENTO'])
        expect(() => assertPublishable(validateOperational(ajustFlow(code)))).not.toThrow();
      for (const type of ['VERIFICAÇÃO DE DNS', 'CONFIGURAÇÃO OLT', 'IMPLANTAÇÃO DE DNS'])
        expect(() =>
          assertPublishable(validateOperational(makeOperationalDefinition(type))),
        ).not.toThrow();
    });
    it('recusa AJUST_SIMPLES com mais de uma etapa', () => {
      const d = ajustFlow('AJUST_MUDANCA');
      d.code = 'AJUST_SIMPLES';
      expect(() => assertPublishable(validateOperational(d))).toThrow('exatamente uma etapa');
    });
    it('recusa ramo paralelo que não chega a uma junção', () => {
      const d = validateOperational(ajustFlow('AJUST_EQUIPAMENTO'));
      const join = d.nodes.find((n) => n.kind === 'join')!;
      const end = d.nodes.find((n) => n.kind === 'end')!;
      // Os ramos passam a ir direto ao fim e a junção sai do desenho.
      for (const id of join.waitFor)
        d.nodes.find((n) => n.id === id)!.routes = { Concluído: end.id };
      d.nodes = d.nodes.filter((n) => n.id !== join.id);
      expect(() => validateOperational(d)).not.toThrow();
      expect(() => assertPublishable(d)).toThrow('não chega a uma junção');
    });
    it('recusa laço que volta a um bloco paralelo', () => {
      const d = validateOperational(ajustFlow('AJUST_EQUIPAMENTO'));
      const fork = d.nodes.find((n) => n.kind === 'fork')!;
      const join = d.nodes.find((n) => n.kind === 'join')!;
      const end = d.nodes.find((n) => n.kind === 'end')!;
      // Depois da junção, uma validação que pode mandar refazer tudo desde o início.
      const start = d.nodes.find((n) => n.id === d.start)!;
      d.nodes.push({
        ...start,
        id: 'validar',
        name: 'Validar entrega',
        routes: { Aprovado: end.id, Refazer: d.start },
        closeOn: [],
      });
      join.routes = { Concluído: 'validar' };
      expect(fork).toBeDefined();
      expect(() => validateOperational(d)).not.toThrow();
      expect(() => assertPublishable(d)).toThrow('volta a');
    });
    it('recusa resultado que encerra a O.S. seguido de etapa na mesma O.S.', () => {
      const d = validateOperational(ajustFlow('AJUST_MUDANCA'));
      d.nodes.find((n) => n.id === 'preparar')!.closeOn = ['Preparação concluída'];
      expect(() => validateOperational(d)).not.toThrow();
      expect(() => assertPublishable(d)).toThrow('encerra a O.S., mas o fluxo continua');
    });
  });
});
