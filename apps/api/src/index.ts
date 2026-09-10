import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import auth from "./routes/auth.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", auth);

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
