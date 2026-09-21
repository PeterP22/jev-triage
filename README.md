# jev-triage

A sorting desk for a creator's comments and DMs, built on [Jev](https://typesafe.ai), TypeSafe's
System One model.

Every message gets read by Jev, then plain code decides what happens to it: flag it, draft a reply,
like it, hide it, archive it, or hand it to a human. The point is to stop reading everything and only
see the messages that matter.

## Why Jev

Jev does not generate text. You send it `state` plus typed questions and it returns structured answers
with calibrated probabilities:

- `choice` picks one option from a set
- `score` places the input on an ordered rubric
- `noul` returns the probability that a statement is true

At about $0.00003 per message it can afford to look at every single comment, which a normal LLM
cannot do cheaply. An LLM only needs to get involved for the few messages worth writing a reply to.

## What happens to a message

One API call asks five questions ([src/questions.ts](src/questions.ts)): what the person wants, how
much a personal reply is worth, and whether the message is spam, abusive, or mentions a health issue.
The rules in [src/shared/route.ts](src/shared/route.ts) then pick an action:

| Action | When |
|---|---|
| `notify_now` | Someone wants to pay, or a brand wants to collaborate |
| `draft_reply` | A real question worth answering |
| `like` | Praise, or a question not worth a full reply |
| `hide` | Spam or abuse, above a high probability bar |
| `archive` | Nothing actionable |
| `human_review` | Jev is not confident, the message mentions an injury or health issue, it is criticism, or a lead/collab also looks like spam |

Two rules are deliberate safety choices. Health-related messages never get an automated reply. A
lead or collab that scores as spam goes to a human rather than being hidden, because real sponsor
outreach reads a lot like spam and hiding one costs money.

The confidence slider in the UI sets how much you trust Jev. It re-routes the whole queue in the
browser from the probabilities already returned, without another API call.

## Run it

Needs Node 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3100>. On first run, paste a key from
[console.typesafe.ai/keys](https://console.typesafe.ai/keys) into the box at the top. The server checks
it against TypeSafe, saves it to `.env` (gitignored), and starts using it without a restart. The
server only listens on localhost. You can also set `TYPESAFE_API_KEY` in `.env` by hand; see
[.env.example](.env.example).

```bash
npm test
npm run typecheck
```

## Measured results

On `jev-1.13.0`, September 2026, 12 sample messages sent in parallel from Sydney:

- About 750 input tokens and $0.00003 per message
- 650 to 950 ms per message
- Confidence is close to 100% on clear messages and only drops on ambiguous ones

## Tuning

Jev reads instructions literally, so wording matters more than thresholds. Edit the questions in
`src/questions.ts` first and the thresholds at the top of `src/shared/route.ts` second. For example, a bare
"is this spam" question scored a genuine sponsor message at 89%; describing what counts as yes and no
brought it down to 70%.

Known model limits: <https://docs.typesafe.ai/model-jaggedness/jev-1.13>

## Not built yet

This is a demo: you paste messages in by hand and it only decides, it does not act.

- Pulling messages in from YouTube, Instagram, and other platforms
- Carrying out the actions (hiding, liking, sending a notification)
- Having an LLM write the `draft_reply` drafts for approval
