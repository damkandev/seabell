import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Context, Hono } from "hono";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import {
  createSessionToken,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  hashSessionToken,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  verifyPassword,
} from "../lib/auth.js";

const auth = new Hono();

type Credentials = { email: string; password: string };

async function readCredentials(c: Context) {
  try {
    const body = await c.req.json<Partial<Credentials>>();
    if (typeof body.email !== "string" || typeof body.password !== "string") return null;

    const email = normalizeEmail(body.email);
    return isValidEmail(email) && isValidPassword(body.password) ? { email, password: body.password } : null;
  } catch {
    return null;
  }
}

function publicUser(user: typeof users.$inferSelect) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

async function currentUser(c: Context) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const db = getDb();

  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user ?? null;
}

auth.post("/register", async (c) => {
  const credentials = await readCredentials(c);
  if (!credentials) return c.json({ error: "Invalid email or password" }, 400);
  const db = getDb();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, credentials.email)).limit(1);
  if (existing.length > 0) return c.json({ error: "Email already registered" }, 409);

  const [user] = await db
    .insert(users)
    .values({ id: crypto.randomUUID(), email: credentials.email, passwordHash: await hashPassword(credentials.password) })
    .returning();
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: hashSessionToken(token), userId: user.id, expiresAt });
  setSessionCookie(c, token, expiresAt);

  return c.json({ user: publicUser(user) }, 201);
});

auth.post("/login", async (c) => {
  const credentials = await readCredentials(c);
  if (!credentials) return c.json({ error: "Invalid email or password" }, 400);
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, credentials.email)).limit(1);
  const valid = await verifyPassword(credentials.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) return c.json({ error: "Invalid email or password" }, 401);

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: hashSessionToken(token), userId: user.id, expiresAt });
  setSessionCookie(c, token, expiresAt);

  return c.json({ user: publicUser(user) });
});

auth.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const user = await currentUser(c);
  return user ? c.json({ user }) : c.json({ error: "Not authenticated" }, 401);
});

export default auth;
