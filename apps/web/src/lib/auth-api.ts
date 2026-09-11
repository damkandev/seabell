export type AuthUser = {
  id: string;
  email: string;
  createdAt: string;
};

type AuthResponse = { user?: AuthUser; error?: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function readResponse(response: Response): Promise<AuthResponse> {
  const body = (await response.json().catch(() => ({}))) as AuthResponse;
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la operación.");
  return body;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
  if (response.status === 401) return null;
  return (await readResponse(response)).user ?? null;
}

export async function authenticate(path: "login" | "register", email: string, password: string) {
  return (await readResponse(
    await fetch(`${API_URL}/auth/${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  )).user as AuthUser;
}

export async function logout() {
  await readResponse(await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }));
}
