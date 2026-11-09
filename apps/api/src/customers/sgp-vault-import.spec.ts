import {
  buildSgpVaultEntries,
  safeTitle,
  categoryOf,
  numberRepeatedNames,
  titleFrom,
} from './sgp-vault-import';

const ids = { customerId: 89, noteId: 501 };

describe('importação do cofre a partir das anotações do SGP', () => {
  it('usa o título da anotação como nome, sem emoji, prefixo ou entidades HTML', () => {
    const [entry] = buildSgpVaultEntries(
      '🖥️ ACESSO OLT VSOL MURIBECA 02<br>IP: 10.0.0.2<br>Login: admin<br>Senha: s3gr3d0',
      ids,
    );
    expect(entry.equipmentName).toBe('OLT VSOL MURIBECA 02');
    expect(entry.equipmentType).toBe('OLT');
    expect(entry.host).toBe('10.0.0.2');
    expect(entry.username).toBe('admin');
    expect(entry.secret).toBe('s3gr3d0');
    expect(entry.reviewRequired).toBe(false);
    expect(entry.externalId).toBe('ajustconsulting.sgp.net.br:cliente:89:anotacao:501:parte:0');
    expect(titleFrom(['CCR 1016 - C&Acirc;MERAS'])).toBe('CCR 1016 - C&Acirc;MERAS');
    expect(
      buildSgpVaultEntries('CCR 1016 - C&Acirc;MERAS<br>IP: 1.1.1.1<br>Senha: x', ids)[0]
        .equipmentName,
    ).toBe('CCR 1016 - CÂMERAS');
  });

  it('a categoria vem do título antes do corpo', () => {
    expect(categoryOf('RB 4011 - PARATIBE', 'ligada na OLT do pop')).toBe('ROUTER');
    expect(categoryOf('SW3-BARRA-CURCURANA', '')).toBe('SW');
    expect(categoryOf('Wireguard', '')).toBe('ACESSO REMOTO');
    expect(categoryOf('Acesso', 'painel do zabbix')).toBe('SISTEMA');
  });

  it('acesso sem senha ou com vários pares vai para A CONFERIR', () => {
    const [semSenha] = buildSgpVaultEntries('ZABBIX<br>URL: https://z.exemplo<br>Login: noc', ids);
    expect(semSenha.equipmentType).toBe('A CONFERIR');
    expect(semSenha.reviewRequired).toBe(true);
    const [varios] = buildSgpVaultEntries(
      'PAINEL<br>Login: a<br>Senha: 1<br>Login: b<br>Senha: 2',
      ids,
    );
    expect(varios.ambiguous).toBe(true);
    expect(varios.equipmentType).toBe('A CONFERIR');
  });

  it('anotação só informativa vira documento ou rede/links, sem acesso', () => {
    const [info] = buildSgpVaultEntries('Contato da operadora New fast<br>Telefone 81 0000', ids);
    expect(info.equipmentType).toBe('CIRCUITOS');
    expect(info.accessMethod).toBe('SEM_ACESSO');
  });

  it('numera nomes repetidos do mesmo provedor', () => {
    expect(
      numberRepeatedNames([{ equipmentName: 'ZABBIX' }, { equipmentName: 'zabbix' }]).map(
        (e) => e.equipmentName,
      ),
    ).toEqual(['ZABBIX', 'zabbix (2)']);
  });

  it('a senha nunca vai parar no nome do equipamento', () => {
    expect(safeTitle('VPN Abc123!xyz', ['Abc123!xyz'])).toBe('VPN');
    expect(safeTitle('192.141.106.50/Segr3do', ['Segr3do'])).toBe('192.141.106.50');
    expect(safeTitle('P@ss1234!x', [])).toBe('');
    const [entry] = buildSgpVaultEntries('Zq9#kLm2$vXp<br>Login: noc<br>Senha: Zq9#kLm2$vXp', ids);
    expect(entry.equipmentName).not.toContain('Zq9#kLm2$vXp');
    expect(entry.secret).toBe('Zq9#kLm2$vXp');
  });
});
