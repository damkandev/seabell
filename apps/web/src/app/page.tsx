import { AuthGate } from "@/components/auth-gate";
import Image from "next/image";

export default function Home() {
  return (
    <>
      <div className="hidden md:block">
        <AuthGate />
      </div>
      <main className="sb-paper flex min-h-screen flex-col items-center justify-center px-6 text-center md:hidden" aria-labelledby="desktop-only-title">
        <Image src="/logo.svg" alt="" width={64} height={64} unoptimized className="mb-6 size-16" aria-hidden="true" />
        <p className="sb-label mb-3 text-[var(--sb-color-logo)]">Seabell / workspace</p>
        <h1 id="desktop-only-title" className="sb-heading max-w-md text-3xl">
          Seabell está disponible únicamente desde PC
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Abre Seabell desde un computador para revisar y anotar tus documentos PDF.
        </p>
      </main>
    </>
  );
}
