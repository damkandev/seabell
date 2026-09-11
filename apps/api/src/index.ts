import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./routes/auth.js";
import laws from "./routes/laws.js";

dotenv.config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)) });
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const app = new Hono();
const webOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowLocalOrigins = process.env.COOKIE_SECURE === "false";
const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.get("/health", (c) => c.json({ status: "ok" }));
app.use("/auth/*", cors({
  origin: (origin) => webOrigins.includes(origin) || (allowLocalOrigins && localOrigin.test(origin)) ? origin : undefined,
  credentials: true,
}));
app.route("/auth", auth);
app.route("/laws", laws);

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
