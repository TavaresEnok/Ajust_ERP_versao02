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
import { OrderContractForm } from './order-contract-form';
export function OrderForm({
  open,
  onOpenChange,
  inline = false,
}: {
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
  inline?: boolean;
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
    <OrderContractForm
      fields={modules.orders.fields}
      connected={action.connected && allowed}
      pending={action.pending}
      label="Criar ordem de serviço"
      onSubmit={async (values) => {
        const record = await action.execute<ErpRecord>({
          path: '/service-orders',
          method: 'POST',
          body: values,
        });
        await refreshVisualData(mutate);
        setOpen(false);
        toast.success('Ordem criada no ERP');
        router.push(`${base}/ordens/${encodeURIComponent(record.id)}`);
      }}
    />
  );
  if (inline) return <section className="panel mx-auto max-w-3xl p-6">{form}</section>;
  return (
    <>
      {open === undefined && (
        <Button onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          Nova ordem de serviço
        </Button>
      )}
      <Dialog open={visible} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova ordem de serviço</DialogTitle>
            <DialogDescription>
              Uma nova solicitação, com tudo que sua equipe precisa.
            </DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    </>
  );
}
