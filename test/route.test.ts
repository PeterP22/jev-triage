import assert from "node:assert/strict";
import { test } from "node:test";
import { route } from "../public/route.js";

const base = {
  intent: { choice: "praise", confidence: 0.95 },
  reply_value: { score: 1 },
  is_spam: { noul: 0.01 },
  is_toxic: { noul: 0.01 },
  needs_expert_care: { noul: 0.01 },
};

test("confident praise is liked automatically", () => {
  assert.equal(route(base).action, "like");
  assert.equal(route(base).automated, true);
});

test("low confidence escalates to a human regardless of intent", () => {
  const d = route({ ...base, intent: { choice: "lead", confidence: 0.4 } });
  assert.equal(d.action, "human_review");
  assert.equal(d.automated, false);
});

test("raising the confidence bar re-routes the same answers", () => {
  assert.equal(route(base, { minConfidence: 0.99 }).action, "human_review");
});

test("high spam probability hides even when intent disagrees", () => {
  assert.equal(route({ ...base, is_spam: { noul: 0.97 } }).action, "hide");
});

test("a collab that also looks like spam goes to a human, never hidden", () => {
  const d = route({ ...base, intent: { choice: "collab", confidence: 0.95 }, is_spam: { noul: 0.95 } });
  assert.equal(d.action, "human_review");
});

test("vague messages are archived unless they look worth a reply", () => {
  const other = { ...base, intent: { choice: "other", confidence: 0.9 } };
  assert.equal(route({ ...other, reply_value: { score: 0.5 } }).action, "archive");
  assert.equal(route({ ...other, reply_value: { score: 2 } }).action, "human_review");
});

test("spam intent under the hide bar is archived, not hidden", () => {
  const d = route({ ...base, intent: { choice: "spam", confidence: 0.95 }, is_spam: { noul: 0.6 } });
  assert.equal(d.action, "archive");
});

test("health mentions never get an automated reply", () => {
  const d = route({
    ...base,
    intent: { choice: "question", confidence: 0.95 },
    reply_value: { score: 3 },
    needs_expert_care: { noul: 0.8 },
  });
  assert.equal(d.action, "human_review");
});

test("leads notify, worthwhile questions get a draft, trivial ones a like", () => {
  assert.equal(route({ ...base, intent: { choice: "lead", confidence: 0.95 } }).action, "notify_now");
  const q = { ...base, intent: { choice: "question", confidence: 0.95 } };
  assert.equal(route({ ...q, reply_value: { score: 2.6 } }).action, "draft_reply");
  assert.equal(route({ ...q, reply_value: { score: 0.4 } }).action, "like");
});
