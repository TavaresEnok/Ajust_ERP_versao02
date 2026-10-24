import { createHmac } from 'node:crypto';

export function parseTotp(input: string) {
  let secret=input, algorithm='sha1', digits=6, period=30;
  if(input.startsWith('otpauth://')) {
    const url=new URL(input);
    if(url.hostname!=='totp') throw new Error('Use uma chave TOTP ou URL otpauth://totp.');
    secret=url.searchParams.get('secret')||'';
    algorithm=(url.searchParams.get('algorithm')||'SHA1').toLowerCase();
    digits=Number(url.searchParams.get('digits')||6); period=Number(url.searchParams.get('period')||30);
  }
  secret=secret.replace(/\s/g,'').toUpperCase().replace(/=+$/,'');
  if(!/^[A-Z2-7]{16,256}$/.test(secret)||!['sha1','sha256','sha512'].includes(algorithm)||![6,8].includes(digits)||!Number.isInteger(period)||period<15||period>120) throw new Error('Configuração TOTP inválida.');
  return {secret,algorithm,digits,period};
}

export function totp(input: string, now=Date.now()) {
  const config=parseTotp(input);
  let bits=0,value=0; const bytes:number[]=[];
  for(const character of config.secret) {
    value=(value<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(character);bits+=5;
    if(bits>=8){bits-=8;bytes.push((value>>>bits)&255);}
  }
  const counter=Math.floor(now/1000/config.period), buffer=Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest=createHmac(config.algorithm,Buffer.from(bytes)).update(buffer).digest();
  const offset=digest[digest.length-1]&15;
  const number=digest.readUInt32BE(offset)&0x7fffffff;
  return {code:String(number%10**config.digits).padStart(config.digits,'0'),validUntil:(counter+1)*config.period*1000,period:config.period,serverTime:now};
}
