import {parseTotp,totp} from './totp';
describe('TOTP RFC 6238',()=>{
  const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // gitleaks:allow -- published RFC 6238 test vector
  it.each([[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])('matches published SHA1 vector at %s',(time,code)=>{
    expect(totp(`otpauth://totp/test?secret=${secret}&digits=8`,Number(time)*1000).code).toBe(code);
  });
  it('rejects unsupported algorithms and malformed input',()=>{
    expect(()=>parseTotp('123456')).toThrow();
    expect(()=>parseTotp(`otpauth://hotp/test?secret=${secret}`)).toThrow();
    expect(()=>parseTotp(`otpauth://totp/test?secret=${secret}&algorithm=md5`)).toThrow();
  });
});
