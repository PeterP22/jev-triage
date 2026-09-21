import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { APIError, AuthenticationError, TypeSafeClient } from "@typesafe-ai/sdk";
import { QUESTIONS } from "./questions.js";
import { route } from "../public/route.js";

// Jev pricing: $0.042 per million input tokens, output free.
const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;
const MAX_MESSAGE_CHARS = 4000;

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

const ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));
let client = process.env.TYPESAFE_API_KEY ? new TypeSafeClient() : null;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey: client !== null });
});

// Saves a key pasted into the UI to .env. The server only listens on loopback, and the key is
// checked against the API before anything is written. It is never logged or sent back.
app.post("/api/key", async (req, res) => {
  const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
  if (!apiKey || /\s/.test(apiKey)) {
    res.status(400).json({ error: "Paste the key on its own, with no spaces or line breaks." });
    return;
  }
  const candidate = new TypeSafeClient({ apiKey });
  try {
    await candidate.models.list();
  } catch (err) {
    const rejected = err instanceof AuthenticationError;
    res.status(rejected ? 401 : 502).json({
      error: rejected
        ? "TypeSafe rejected that key."
        : `Could not check the key with TypeSafe: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }
  const kept = existsSync(ENV_PATH)
    ? readFileSync(ENV_PATH, "utf8")
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith("TYPESAFE_API_KEY="))
    : [];
  writeFileSync(ENV_PATH, [...kept, `TYPESAFE_API_KEY=${apiKey}`, ""].join("\n"));
  client = candidate;
  res.json({ ok: true });
});

app.post("/api/triage", async (req, res) => {
  const { message, platform } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message must be a non-empty string" });
    return;
  }
  if (!client) {
    res.status(503).json({ error: "No API key yet. Paste one into the box at the top of the page." });
    return;
  }

  const started = performance.now();
  try {
    const result = await client.systemOne({
      state: {
        creator: "Solo creator posting about AI engineering and powerlifting",
        platform: typeof platform === "string" ? platform : "unknown",
        message: message.slice(0, MAX_MESSAGE_CHARS),
      },
      questions: QUESTIONS,
    });
    res.json({
      answers: result.answers,
      decision: route(result.answers),
      meta: {
        model: result.model,
        latencyMs: Math.round(performance.now() - started),
        inputTokens: result.usage.input_tokens,
        costUsd: result.usage.input_tokens * USD_PER_INPUT_TOKEN,
      },
    });
  } catch (err) {
    const status = err instanceof APIError && typeof err.status === "number" ? err.status : 502;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const port = Number(process.env.PORT ?? 3100);
app.listen(port, "127.0.0.1", () => {
  console.log(`jev-triage on http://localhost:${port}${client ? "" : "  (no TYPESAFE_API_KEY set)"}`);
});
