"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useErp, useErpQuery } from "@/lib/erp/gateway";

export function useTenantIdentity() {
  const { scope } = useErp();
  const query = useErpQuery<{ name?: string; user?: { name?: string }; tenant?: { id?: string; tradeName?: string } }>(scope ? "/auth/me" : null);
  const tenant = query.data?.tenant;
  return { ...query, name: query.data?.user?.name || query.data?.name, tenantName: tenant?.id === scope?.tenantId ? tenant?.tradeName : undefined };
}
function LogoImage({ blob, name }: { blob: Blob; name: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { const url = URL.createObjectURL(blob); setSrc(url); return () => URL.revokeObjectURL(url); }, [blob]);
  return src ? <img src={src} alt={`Logo de ${name}`} className="size-8 rounded-md bg-card object-contain" onError={() => setSrc("")} /> : <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-sm font-semibold text-primary">{name.charAt(0).toLocaleUpperCase("pt-BR")}</span>;
}
export function TenantLogo({ name, tenantId }: { name: string; tenantId?: string }) {
  const { scope, transport } = useErp();
  const selectedId = tenantId || scope?.tenantId;
  const logo = useSWR<Blob>(scope && selectedId && transport?.download ? ["tenant-logo", scope.sessionKey, selectedId] : null, async () => {
    const blob = await transport!.download!(`/iam/tenants/${encodeURIComponent(selectedId!)}/logo`);
    if (blob.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(blob.type)) throw new Error("Formato de logo não suportado.");
    return blob;
  }, { shouldRetryOnError: false, revalidateOnFocus: false });
  return logo.data ? <LogoImage key={selectedId} blob={logo.data} name={name} /> : <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-sm font-semibold text-primary">{name.charAt(0).toLocaleUpperCase("pt-BR")}</span>;
}
