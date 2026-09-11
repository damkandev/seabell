"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authenticate, type AuthUser } from "@/lib/auth-api";

type AuthMode = "login" | "register";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (registering && password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      onAuthenticated(await authenticate(mode, email, password));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la operación.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell flex min-h-svh items-center justify-center bg-muted/30 px-6 py-12">
      <section className="auth-card relative z-10 w-full max-w-sm rounded-2xl border bg-background p-6 shadow-sm" aria-labelledby="auth-title">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">Seabell</p>
          <div key={mode} className="auth-copy">
            <h1 id="auth-title" className="mt-2 text-2xl font-semibold tracking-tight">
              {registering ? "Crea tu cuenta" : "Inicia sesión"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {registering ? "Guarda tu acceso para usar Seabell." : "Accede a tu espacio de trabajo."}
            </p>
          </div>
        </div>

        <form className="auth-form space-y-4" onSubmit={submit} aria-busy={submitting}>
          <div className="auth-field space-y-2">
            <label htmlFor="auth-email" className="text-sm font-medium">Email</label>
            <Input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="auth-field space-y-2">
            <label htmlFor="auth-password" className="text-sm font-medium">Contraseña</label>
            <Input id="auth-password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
            {registering && <p className="text-xs text-muted-foreground">Usa al menos 12 caracteres.</p>}
          </div>
          {registering && (
            <div className="auth-field space-y-2">
              <label htmlFor="auth-confirmation" className="text-sm font-medium">Repite la contraseña</label>
              <Input id="auth-confirmation" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </div>
          )}
          {error && <p className="auth-error text-sm text-destructive" role="alert">{error}</p>}
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting && <span className="auth-spinner" aria-hidden="true" />}
            {submitting ? "Enviando…" : registering ? "Crear cuenta" : "Iniciar sesión"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {registering ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => { setMode(registering ? "login" : "register"); setError(null); }}>
            {registering ? "Inicia sesión" : "Crea una cuenta"}
          </Button>
        </p>
      </section>
    </main>
  );
}
