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
      onSubmit={async (path, values) => {
        const record = await action.execute<ErpRecord>({
          path,
          method: 'POST',
          body: values,
        });
        await refreshVisualData(mutate);
        await onCreated?.();
        setOpen(false);
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
      <Dialog open={visible} onOpenChange={setOpen}>
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
    </>
  );
}
