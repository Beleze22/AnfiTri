import { OwnerLoginForm } from "@/components/owner/OwnerLoginForm";

export default function ProprietarioLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <p className="text-caption font-semibold tracking-widest text-accent uppercase">
          anfitri
        </p>
        <h1 className="mt-2 text-page-title font-semibold text-text-primary">
          Área do proprietário
        </h1>
        <p className="mt-1 mb-5 text-body text-text-secondary">
          Acompanhe o desempenho das suas hospedagens.
        </p>
        <OwnerLoginForm />
      </div>
    </main>
  );
}
