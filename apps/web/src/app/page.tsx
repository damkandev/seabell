import { AuthGate } from "@/components/auth-gate";

export default function Home() {
  return (
    <>
      <div className="hidden md:block">
        <AuthGate />
      </div>
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center md:hidden" aria-labelledby="desktop-only-title">
        <h1 id="desktop-only-title" className="text-2xl font-semibold tracking-tight">
          Seabell está disponible únicamente desde PC
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Abre Seabell desde un computador para revisar y anotar tus documentos PDF.
        </p>
      </main>
    </>
  );
}
