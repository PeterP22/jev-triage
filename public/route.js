// Routing policy: Jev answers *what* the message is; this code decides *what to do*.
// Shared by the server, the tests, and the browser (the threshold slider re-routes instantly
// from the probabilities already returned, without another API call).

/** @typedef {"hide" | "human_review" | "notify_now" | "draft_reply" | "like" | "archive"} Action */

/**
 * @typedef {object} Answers
 * @property {{ choice: string, confidence: number }} intent
 * @property {{ score: number }} reply_value
 * @property {{ noul: number }} is_spam
 * @property {{ noul: number }} is_toxic
 * @property {{ noul: number }} needs_expert_care
 */

export const THRESHOLDS = {
  /** Below this intent confidence nothing is automated; a human looks at it. */
  minConfidence: 0.7,
  /** Hiding is destructive, so it needs a high bar. */
  hideSpam: 0.9,
  hideToxic: 0.85,
  /** Health-related messages never get an automated reply. */
  expertCare: 0.5,
  /** reply_value at or above this makes a question worth drafting a reply for. */
  replyWorthy: 1.5,
};

/**
 * @param {Answers} a
 * @param {Partial<typeof THRESHOLDS>} [overrides]
 * @returns {{ action: Action, reason: string, automated: boolean }}
 */
export function route(a, overrides = {}) {
  const t = { ...THRESHOLDS, ...overrides };
  const pct = (/** @type {number} */ n) => `${Math.round(n * 100)}%`;

  if (a.is_spam.noul >= t.hideSpam) {
    // Real sponsors read a lot like spam. Hiding one costs money, so a disagreement goes to a human.
    if (a.intent.choice === "lead" || a.intent.choice === "collab")
      return {
        action: "human_review",
        reason: `${a.intent.choice} intent but spam probability ${pct(a.is_spam.noul)}`,
        automated: false,
      };
    return { action: "hide", reason: `spam probability ${pct(a.is_spam.noul)}`, automated: true };
  }
  if (a.is_toxic.noul >= t.hideToxic)
    return { action: "hide", reason: `toxic probability ${pct(a.is_toxic.noul)}`, automated: true };
  if (a.needs_expert_care.noul >= t.expertCare)
    return { action: "human_review", reason: "mentions injury or health; no automated reply", automated: false };
  if (a.intent.confidence < t.minConfidence)
    return {
      action: "human_review",
      reason: `intent "${a.intent.choice}" only ${pct(a.intent.confidence)} confident`,
      automated: false,
    };

  switch (a.intent.choice) {
    case "lead":
    case "collab":
      return { action: "notify_now", reason: `${a.intent.choice}: money on the table`, automated: true };
    case "question":
      return a.reply_value.score >= t.replyWorthy
        ? { action: "draft_reply", reason: "question worth answering; hand to an LLM for a draft", automated: true }
        : { action: "like", reason: "low-value question", automated: true };
    case "praise":
      return { action: "like", reason: "praise needs no reply", automated: true };
    case "criticism":
      return { action: "human_review", reason: "criticism: reply in your own voice", automated: false };
    case "spam":
      // Intent says spam but the spam noul was under the hide bar: bury it rather than destroy it.
      return { action: "archive", reason: "likely spam, below the auto-hide bar", automated: true };
    default:
      if (a.reply_value.score >= t.replyWorthy)
        return { action: "human_review", reason: "unclear intent but looks worth a reply", automated: false };
      return { action: "archive", reason: "nothing actionable", automated: true };
  }
}
