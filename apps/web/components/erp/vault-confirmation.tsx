'use client';
import { useRef, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export type VaultConfirmation = { reason: string; currentPassword: string };
export function useVaultConfirmation() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const resolve = useRef<((value: VaultConfirmation | null) => void) | null>(null);
  useEffect(
    () => () => {
      resolve.current?.(null);
    },
    [],
  );
  function finish(value: VaultConfirmation | null) {
    resolve.current?.(value);
    resolve.current = null;
    setPassword('');
    setReason('');
    setOpen(false);
  }
  function request() {
    resolve.current?.(null);
    setOpen(true);
    return new Promise<VaultConfirmation | null>((done) => {
      resolve.current = done;
    });
  }
  const dialog = (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) finish(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consultar cofre</DialogTitle>
          <DialogDescription>
            Informe o motivo e confirme sua senha. A consulta ficará registrada no histórico.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            finish({ reason: reason.trim(), currentPassword: password });
          }}
        >
          <label className="block">
            Motivo da consulta
            <input
              className="block w-full rounded border p-2"
              required
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="block">
            Sua senha atual
            <input
              className="block w-full rounded border p-2"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={!reason.trim() || !password}>
            Confirmar consulta
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
  return { request, dialog };
}
