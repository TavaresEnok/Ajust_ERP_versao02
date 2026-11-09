'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useErp, useErpAction } from '@/lib/erp/gateway';
import { modules } from '@/lib/erp/modules';
import { refreshVisualData, useRouteBase } from '@/lib/erp/visual-data';
import type { ErpRecord } from '@/lib/erp/contracts';
import { AttendanceIntake, type IntakeOccurrence } from './attendance-intake';
export function OrderForm({
  open,
  onOpenChange,
  inline = false,
  providerId,
  occurrence,
  onCreated,
}: {
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
  inline?: boolean;
  providerId?: string;
  occurrence?: IntakeOccurrence;
  onCreated?: () => Promise<unknown>;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const visible = open ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const close = () => {
    setDirty(false);
    setConfirmDiscard(false);
    setOpen(false);
  };
  const { scope } = useErp();
  const action = useErpAction();
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const base = useRouteBase();
  const allowed = !scope || modules.orders.createRoles!.includes(scope.role);
  const form = (
    <AttendanceIntake
      providerId={providerId}
      occurrence={occurrence}
      connected={action.connected && allowed}
      pending={action.pending}
      onDirtyChange={setDirty}
      onSubmit={async (path, values) => {
        const record = await action.execute<ErpRecord>({
          path,
          method: 'POST',
          body: values,
        });
        await refreshVisualData(mutate);
        await onCreated?.();
        close();
        toast.success(
          path.endsWith('/occurrences')
            ? 'Ocorrência e primeira O.S. criadas'
            : 'O.S. adicionada à ocorrência',
        );
        const occurrenceId = path.endsWith('/occurrences') ? record.id : record.occurrenceId;
        router.push(`${base}/ocorrencias/${encodeURIComponent(String(occurrenceId))}/ordens`);
      }}
    />
  );
  if (inline) return <section className="panel mx-auto max-w-3xl p-6">{form}</section>;
  return (
    <>
      {open === undefined && (
        <Button onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          {occurrence ? 'Adicionar O.S.' : 'Novo atendimento'}
        </Button>
      )}
      <Dialog
        open={visible}
        onOpenChange={(value) =>
          value ? setOpen(true) : dirty ? setConfirmDiscard(true) : close()
        }
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {occurrence ? 'Adicionar O.S. à ocorrência' : 'Abrir atendimento'}
            </DialogTitle>
            <DialogDescription>
              {occurrence
                ? 'O provedor e o vínculo com a ocorrência já estão definidos.'
                : 'Cadastre a demanda e sua primeira ordem de serviço em uma única operação.'}
            </DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDiscard} onOpenChange={(value) => !value && setConfirmDiscard(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar o que foi preenchido?</DialogTitle>
            <DialogDescription>
              O atendimento ainda não foi aberto. Se fechar agora, o que você digitou será perdido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              Continuar preenchendo
            </Button>
            <Button variant="destructive" onClick={close}>
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
