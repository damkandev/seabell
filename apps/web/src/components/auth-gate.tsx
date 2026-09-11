"use client";

import { useCallback, useEffect, useState } from "react";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { getCurrentUser, logout, type AuthUser } from "@/lib/auth-api";
import { PdfImporter } from "@/components/pdf-importer";

export function AuthGate() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUser(await getCurrentUser());
    } catch {
      setError("No se pudo conectar con el servicio de autenticación.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void getCurrentUser()
      .then((nextUser) => {
        if (mounted) setUser(nextUser);
      })
      .catch(() => {
        if (mounted) setError("No se pudo conectar con el servicio de autenticación.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <main className="grid min-h-svh place-items-center text-sm text-muted-foreground">Verificando sesión…</main>;
  }

  if (error) {
    return (
      <main className="grid min-h-svh place-items-center px-6 text-center">
        <div>
          <p className="text-sm text-destructive" role="alert">{error}</p>
          <Button className="mt-4" onClick={() => void loadSession()}>Reintentar</Button>
        </div>
      </main>
    );
  }

  return user ? (
    <div className="workspace-enter">
      <PdfImporter user={user} onLogout={async () => { await logout(); setUser(null); }} />
    </div>
  ) : <AuthScreen onAuthenticated={setUser} />;
}
