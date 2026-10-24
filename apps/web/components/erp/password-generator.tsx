'use client';
import { useState } from 'react';
import { KeyRound, Copy, RefreshCw, LockKeyhole } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/erp/clipboard';
import { toast } from 'sonner';

export function generatePassword(length: number, symbols: boolean, numbers: boolean) {
  const groups = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ...(numbers ? ['0123456789'] : []),
    ...(symbols ? ['!@#$%&*()_+-=?:'] : []),
  ];
  const alphabet = groups.join('');
  const index = (max: number) => {
    const buffer = new Uint32Array(1),
      ceiling = Math.floor(4294967296 / max) * max;
    do {
      crypto.getRandomValues(buffer);
    } while (buffer[0] >= ceiling);
    return buffer[0] % max;
  };
  // Rejection sampling keeps every allowed password equally likely, while requiring each selected class.
  let result = '';
  do {
    result = Array.from({ length }, () => alphabet[index(alphabet.length)]).join('');
  } while (!groups.every((group) => [...result].some((c) => group.includes(c))));
  return result;
}
export function PasswordGenerator() {
  const [open, setOpen] = useState(false),
    [length, setLength] = useState(18),
    [symbols, setSymbols] = useState(true),
    [numbers, setNumbers] = useState(true),
    [password, setPassword] = useState('');
  const generate = (l = length, s = symbols, n = numbers) => setPassword(generatePassword(l, s, n));
  return (
    <>
      <button
        className="nav-item w-full"
        onClick={() => {
          generate();
          setOpen(true);
        }}
      >
        <KeyRound />
        <span>Gerador de senhas</span>
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setPassword('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyhole className="size-5 text-primary" />
              Gerador de senhas
            </DialogTitle>
            <DialogDescription>Crie uma senha e copie para o cadastro desejado.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 flex items-center gap-2">
            <output className="min-w-0 flex-1 break-all rounded-xl bg-muted p-4 text-center font-mono text-base select-all">
              {password}
            </output>
            <Button
              aria-label="Copiar senha gerada"
              onClick={async () => {
                if (await copyToClipboard(password)) toast.success('Senha copiada.');
                else toast.error('Não foi possível copiar.');
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-center text-xs font-medium text-emerald-600">
            Aleatoriedade criptográfica · {length} caracteres
          </p>
          <label className="mt-3 text-sm">
            Tamanho da senha <span className="float-right font-mono text-primary">{length}</span>
            <input
              aria-label="Tamanho da senha"
              className="mt-3 w-full accent-primary"
              type="range"
              min={12}
              max={64}
              value={length}
              onChange={(e) => {
                const n = Number(e.target.value);
                setLength(n);
                generate(n);
              }}
            />
          </label>
          <div className="flex gap-5 rounded-xl border border-border p-4 text-sm">
            <label>
              <input
                type="checkbox"
                checked={symbols}
                onChange={(e) => {
                  setSymbols(e.target.checked);
                  generate(length, e.target.checked, numbers);
                }}
              />{' '}
              Símbolos
            </label>
            <label>
              <input
                type="checkbox"
                checked={numbers}
                onChange={(e) => {
                  setNumbers(e.target.checked);
                  generate(length, symbols, e.target.checked);
                }}
              />{' '}
              Números
            </label>
          </div>
          <Button onClick={() => generate()}>
            <RefreshCw className="size-4" />
            Gerar nova combinação
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
