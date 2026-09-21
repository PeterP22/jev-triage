// Every question Jev is asked lives here, so the wording is easy to review and tune.
// Thresholds that act on the answers live in public/route.js.
import { choice, noul, score } from "@typesafe-ai/sdk";

export const QUESTIONS = {
  intent: choice("What is the main intent of this message to the creator?", {
    question: "Asks for information or advice, e.g. about training, programming, AI tools, or a past post",
    lead: "Wants to pay for something: coaching, consulting, a product, or asks about pricing or availability",
    collab: "A brand, sponsor, or another creator proposing a partnership, feature, or collaboration",
    praise: "Compliment, thanks, or encouragement with nothing that needs an answer",
    criticism: "Disagrees with, corrects, or criticises the content or the creator",
    spam: "Promotion, scam, bot text, or link-dropping unrelated to the content",
    other: "None of the above, or too short or vague to tell",
  }),
  reply_value: score("How valuable is it for the creator to personally reply to this message?", [
    "No value: nothing to respond to",
    "Low value: a like or emoji is enough",
    "Worth a short reply when there is time",
    "Should get a thoughtful reply today",
    "Must reply: business opportunity or a reputational risk if ignored",
  ]),
  is_spam: noul("The message is spam, a scam, or automated promotion"),
  is_toxic: noul("The message contains harassment, slurs, or a personal attack"),
  needs_expert_care: noul(
    "The message describes an injury, a medical condition, or a mental health struggle",
  ),
};
