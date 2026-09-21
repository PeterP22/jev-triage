# jev-triage

Confidence-gated inbox triage for a creator's comments and DMs, built on
[Jev](https://typesafe.ai), TypeSafe's System One model.

Jev does not generate text. You send it `state` plus typed questions (`choice`, `score`, `noul`) and it
returns structured answers with calibrated probabilities in roughly 100 ms at $0.042 per million input
tokens. That makes it a fit for the part of an inbox pipeline an LLM is too slow and expensive for:
looking at every single message.

## How it works

1. `POST /api/triage` sends the message to Jev with five questions in **one call**
   ([src/questions.ts](src/questions.ts)): intent, reply value, spam, toxicity, and health mention.
2. [public/route.js](public/route.js) turns the answers into an action in plain code:
   `hide`, `notify_now`, `draft_reply`, `like`, `archive`, or `human_review`.
3. Anything below the confidence bar goes to a human. Destructive actions need a higher bar.
   Health mentions are never automated.

The UI's confidence slider re-routes the whole queue client-side from the probabilities already
returned, so you can see the automation rate trade off against risk without another API call.

`draft_reply` is where a generative model would plug in: Jev filters the firehose, an LLM only sees
the few messages worth writing for.

## Run

```bash
npm install
cp .env.example .env   # add TYPESAFE_API_KEY from https://console.typesafe.ai/keys
npm run dev            # http://localhost:3100
```

```bash
npm test
npm run typecheck
```

## Tuning

Questions and thresholds are deliberately kept in two small files. Jev reads instructions literally,
so edit the criteria wording in `src/questions.ts` first, thresholds in `public/route.js` second.
Known model limits: <https://docs.typesafe.ai/model-jaggedness/jev-1.13>
