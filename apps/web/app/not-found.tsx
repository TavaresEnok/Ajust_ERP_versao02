import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section className="panel max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço não existe ou você não tem acesso a ele.
        </p>
        <Link href="/" className="mt-5 inline-block text-sm font-medium text-primary underline">
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
