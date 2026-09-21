import { fileURLToPath } from "node:url";
import express from "express";
import { APIError, TypeSafeClient } from "@typesafe-ai/sdk";
import { QUESTIONS } from "./questions.js";
import { route } from "../public/route.js";

// Jev pricing: $0.042 per million input tokens, output free.
const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;
const MAX_MESSAGE_CHARS = 4000;

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

const hasKey = Boolean(process.env.TYPESAFE_API_KEY);
const client = hasKey ? new TypeSafeClient() : null;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey });
});

app.post("/api/triage", async (req, res) => {
  const { message, platform } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message must be a non-empty string" });
    return;
  }
  if (!client) {
    res.status(503).json({ error: "TYPESAFE_API_KEY is not set. Copy .env.example to .env and add a key." });
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
app.listen(port, () => {
  console.log(`jev-triage on http://localhost:${port}${hasKey ? "" : "  (no TYPESAFE_API_KEY set)"}`);
});
