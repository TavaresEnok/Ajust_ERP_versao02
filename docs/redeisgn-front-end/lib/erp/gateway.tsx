"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import useSWR, { SWRConfig } from "swr";
import { ErpError, type ErpRequest, type ErpScope, type ErpTransport } from "./contracts";
const ErpContext = createContext<{ transport: ErpTransport | null; publicTransport: ErpTransport | null; scope: ErpScope | null }>({ transport: null, publicTransport: null, scope: null });
export function ErpProvider({ transport = null, publicTransport = null, scope = null, children }: { transport?: ErpTransport | null; publicTransport?: ErpTransport | null; scope?: ErpScope | null; children: ReactNode }) {
  return <SWRConfig key={scope ? `${scope.sessionKey}:${scope.tenantId}:${scope.role}` : "disconnected"} value={{ provider: () => new Map(), shouldRetryOnError: false }}><ErpContext.Provider value={{ transport, publicTransport, scope }}>{children}</ErpContext.Provider></SWRConfig>;
}
export function useErp() { return useContext(ErpContext); }
export function useErpQuery<T>(path: string | null) {
  const { transport, scope } = useErp();
  const result = useSWR<T>(transport && scope && path ? ["erp", scope.sessionKey, scope.tenantId, scope.role, path] : null, () => transport!.request<T>({ path: path! }));
  return { ...result, connected: Boolean(transport && scope) };
}
export function useErpAction() {
  const { transport, scope } = useErp();
  const [pending, setPending] = useState(false);
  async function execute<T>(request: ErpRequest): Promise<T> {
    if (!transport || !scope) throw new ErpError("Backend não conectado. Nenhum dado foi enviado.");
    setPending(true);
    try { return await transport.request<T>(request); } finally { setPending(false); }
  }
  return { execute, pending, connected: Boolean(transport && scope) };
}
export function useErpPublicQuery<T>(path: string | null) {
  const { publicTransport } = useErp();
  const result = useSWR<T>(publicTransport && path ? ["erp-public", path] : null, () => publicTransport!.request<T>({ path: path! }), { shouldRetryOnError: false, revalidateOnFocus: false });
  return { ...result, connected: Boolean(publicTransport) };
}
export function useErpPublicAction() {
  const { publicTransport } = useErp();
  const [pending, setPending] = useState(false);
  async function execute<T>(request: ErpRequest): Promise<T> { if (!publicTransport) throw new ErpError("Backend público não conectado."); setPending(true); try { return await publicTransport.request<T>(request); } finally { setPending(false); } }
  return { execute, pending, connected: Boolean(publicTransport) };
}
export function createSameOriginTransport(basePath: string): ErpTransport {
  if (!basePath.startsWith("/") || basePath.startsWith("//") || /[?#]/.test(basePath)) throw new Error("O adaptador deve apontar para um BFF da mesma origem.");
  const url = (path: string) => { if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) throw new Error("Caminho de API inválido."); return basePath.replace(/\/$/, "") + path; };
  async function response(path: string, init?: RequestInit) {
    const res = await fetch(url(path), { ...init, credentials: "same-origin", cache: "no-store", redirect: "error" });
    if (!res.ok) throw new ErpError(`O servidor recusou a operação (${res.status}).`, res.status);
    return res;
  }
  return {
    async request<T>({ path, method = "GET", body, signal }: ErpRequest) {
      const multipart = body instanceof FormData;
      const res = await response(path, { method, signal, headers: body !== undefined && !multipart ? { "Content-Type": "application/json" } : undefined, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
      return (res.status === 204 ? undefined : await res.json()) as T;
    },
    async download(path) { return (await response(path)).blob(); },
    async downloadWithMetadata(path) { const res = await response(path); const rows = res.headers.get("x-export-rows"); const disposition = res.headers.get("content-disposition") || ""; const match = disposition.match(/filename="([^"]+)"/i); return { blob: await res.blob(), fileName: match?.[1]?.replace(/[\\/\r\n]/g, "_").slice(0, 180), rowCount: rows !== null && Number.isFinite(Number(rows)) ? Number(rows) : undefined, truncated: res.headers.get("x-export-truncated") === "true" }; },
  };
}
