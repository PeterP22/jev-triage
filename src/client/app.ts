// Browser entry point. The server compiles this on request (see /app.js in server.ts).
import { route, THRESHOLDS, type Answers } from "../shared/route.js";

interface TriageResult {
  message: string;
  answers: Answers & { intent: Answers["intent"] & { probabilities: Record<string, number> } };
  meta: { model: string; latencyMs: number; inputTokens: number; costUsd: number };
}

const SAMPLES = [
  "Hey, do you do online coaching? What's the monthly price and do you have spots open?",
  "This was the clearest explanation of agent evals I've seen. Thank you!",
  "How did you break through your 275 deadlift plateau? Stuck at 240 for months.",
  "Your form is dangerous and you clearly have no idea what you're talking about, clown.",
  "🔥🔥 Grow to 10k followers FAST 👉 bit.ly/x9promo DM me for promo rates",
  "We're a supplement brand and would love to send product and talk about a paid partnership.",
  "My lower back has been sharp-pain sore since Tuesday's pulls, should I keep training through it?",
  "Not sure RAG is dead like you said, long context still falls over on our 2M token corpora.",
  "lol",
  // Deliberately ambiguous: these are the ones the confidence bar exists for.
  "Interesting take. We should talk sometime.",
  "Is that program of yours actually worth it or nah",
  "Love your stuff! We help creators like you monetise, got 5 mins for a quick call?",
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const label = (action: string) => action.replace(/_/g, " ");
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

let minConfidence = THRESHOLDS.minConfidence;
let current: TriageResult | null = null;
const queue: TriageResult[] = [];

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

async function triage(message: string): Promise<TriageResult> {
  const body = await postJson<Omit<TriageResult, "message">>("/api/triage", { message, platform: "instagram" });
  return { message, ...body };
}

function bars(probabilities: Record<string, number>, winner: string) {
  return Object.entries(probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, p]) =>
        `<div class="bar${name === winner ? " win" : ""}"><span>${esc(name)}</span><i><b style="width:${p * 100}%"></b></i><span>${pct(p)}</span></div>`,
    )
    .join("");
}

function tag(automated: boolean, text: string) {
  return `<span class="tag ${automated ? "auto" : "human"}">${text}</span>`;
}

function renderCurrent() {
  if (!current) return;
  const { answers: a, meta } = current;
  const d = route(a, { minConfidence });
  $("out").innerHTML = `
    <div class="decision"><span class="action">${label(d.action)}</span>${tag(d.automated, d.automated ? "AUTOMATED" : "HUMAN")}</div>
    <p class="reason">${esc(d.reason)}</p>
    ${bars(a.intent.probabilities, a.intent.choice)}
    <div class="stats">
      <div class="stat">confidence<b>${pct(a.intent.confidence)}</b></div>
      <div class="stat">reply value<b>${a.reply_value.score.toFixed(2)} / 4</b></div>
      <div class="stat">spam<b>${pct(a.is_spam.noul)}</b></div>
      <div class="stat">toxic<b>${pct(a.is_toxic.noul)}</b></div>
      <div class="stat">health<b>${pct(a.needs_expert_care.noul)}</b></div>
      <div class="stat">latency<b>${meta.latencyMs} ms</b></div>
      <div class="stat">tokens in<b>${meta.inputTokens}</b></div>
      <div class="stat">cost<b>$${meta.costUsd.toFixed(6)}</b></div>
    </div>`;
}

function renderQueue() {
  if (!queue.length) return;
  const decisions = queue.map((r) => route(r.answers, { minConfidence }));
  $("rows").innerHTML = queue
    .map(
      (r, i) => `<tr><td class="msg">${esc(r.message)}</td><td>${esc(r.answers.intent.choice)}</td>
      <td class="mono">${pct(r.answers.intent.confidence)}</td>
      <td>${tag(decisions[i].automated, label(decisions[i].action))}</td>
      <td class="mono">${r.meta.latencyMs}</td></tr>`,
    )
    .join("");
  const automated = decisions.filter((d) => d.automated).length;
  const cost = queue.reduce((sum, r) => sum + r.meta.costUsd, 0);
  $("summary").textContent = `· ${automated}/${queue.length} automated · $${cost.toFixed(6)} total`;
}

async function run(messages: string[]) {
  const buttons = [$<HTMLButtonElement>("go"), $<HTMLButtonElement>("batch")];
  buttons.forEach((b) => (b.disabled = true));
  try {
    const results = await Promise.all(messages.map(triage));
    queue.unshift(...results);
    current = results[0];
    renderCurrent();
    renderQueue();
  } catch (err) {
    $("out").innerHTML = `<p class="error">${esc(errorText(err))}</p>`;
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

const msg = $<HTMLTextAreaElement>("msg");
$("samples").innerHTML = SAMPLES.map(
  (s, i) => `<button class="chip" data-i="${i}">${esc(s.length > 34 ? `${s.slice(0, 32)}…` : s)}</button>`,
).join("");
$("samples").addEventListener("click", (e) => {
  const i = (e.target as HTMLElement).dataset.i;
  if (i !== undefined) msg.value = SAMPLES[Number(i)];
});
$("go").addEventListener("click", () => {
  const message = msg.value.trim();
  if (message) run([message]);
});
$("batch").addEventListener("click", () => run(SAMPLES));

const slider = $<HTMLInputElement>("conf");
slider.value = String(minConfidence);
$("confv").textContent = minConfidence.toFixed(2);
slider.addEventListener("input", () => {
  minConfidence = Number(slider.value);
  $("confv").textContent = minConfidence.toFixed(2);
  renderCurrent();
  renderQueue();
});

$("banner").addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = $<HTMLInputElement>("key");
  const save = $<HTMLButtonElement>("savekey");
  const status = $("keymsg");
  save.disabled = true;
  status.className = "hint";
  status.textContent = "Checking key…";
  try {
    await postJson("/api/key", { apiKey: key.value });
    key.value = "";
    $("banner").hidden = true;
    $("out").innerHTML = `<p class="empty">Key saved. Nothing triaged yet.</p>`;
  } catch (err) {
    status.className = "hint error";
    status.textContent = errorText(err);
  } finally {
    save.disabled = false;
  }
});

fetch("/api/health")
  .then((r) => r.json())
  .then((h: { hasKey: boolean }) => {
    $("banner").hidden = h.hasKey;
  });
