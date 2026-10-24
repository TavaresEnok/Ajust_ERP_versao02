import { Workspace } from "@/components/erp/workspace";
import { getPage } from "@/lib/navigation";
import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { canonicalWorkspacePath, isWorkspacePath } from "@/lib/erp/routes";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = "/" + slug.join("/");
  const publicTitles: Record<string, string> = { "/login": "Acesso", "/forgot-password": "Recuperação de senha", "/reset-password": "Redefinir senha", "/verify-analyst": "Área do analista", "/verify-manager": "Área da gerência" };
  const page = getPage(path);
  return { title: (publicTitles[path] || (path.startsWith("/csat/") ? "Pesquisa de satisfação" : page.title)) + " · Ajust ERP" };
}
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const path = "/" + slug.join("/");
  if (path === "/verify-analyst" || path === "/verify-manager") {
    const query = new URLSearchParams();
    Object.entries(await searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
      else if (value !== undefined) query.set(key, value);
    });
    const destination = path === "/verify-analyst" ? "/analista" : "/gerencia";
    redirect(destination + (query.size ? `?${query}` : ""));
  }
  const publicRoute = ["/login", "/forgot-password", "/reset-password"].includes(path) || (slug[0] === "csat" && slug.length === 2);
  if (publicRoute) return <Workspace path={path} />;
  const canonical = canonicalWorkspacePath(path);
  if (!isWorkspacePath(canonical)) notFound();
  if (canonical !== path) {
    const query = new URLSearchParams();
    Object.entries(await searchParams).forEach(([key, value]) => { if (Array.isArray(value)) value.forEach(item => query.append(key, item)); else if (value !== undefined) query.set(key, value); });
    redirect(canonical + (query.size ? `?${query}` : ""));
  }
  return <Workspace path={canonical} />;
}
