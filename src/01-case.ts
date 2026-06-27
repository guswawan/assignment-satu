import "dotenv/config";
import { getModel } from "./utils";
import { createParsedCompletion } from "@anvia/core";
import z from "zod";

const PROMPT_INTENT = {
  billing_complaint: `You are a billing support specialist. The user was charged incorrectly. Be empathetic and tell them a refund will be processed in 2-4 business days.`,
  billing_inquiry: `You are a billing support specialist. Ask for account details and answer billing questions clearly and politely.`,
  technical: `You are a technical support engineer. Give concrete debugging steps.`,
  general: `You are a general support assistant. Give a short helpful answer.`,
  escalate_human: `You are a senior support agent handling an urgent escalation. Be empathetic, apologize sincerely, and assure the customer support a human will contact them within 15 minutes. Always provide a ticket number format: #ESCAL-XXXXXX`,
};

const PromptIntentSchema = z.object({
  intent: z.enum([
    "billing_complaint",
    "billing_inquiry",
    "technical",
    "general",
    "escalate_human",
  ]),
  sentiment: z.enum(["angry", "frustrated", "neutral", "positive"]),
  confidence_score: z.number(),
  reasoning: z.string(),
});

const ResponseSchema = z.object({
  response: z.string(),
});

type Classification = z.infer<typeof PromptIntentSchema>;

async function classifyIntent(userMessage: string) {
  const extractedIntent = await createParsedCompletion(getModel(), {
    instructions: `You are an intent classifier for customer support. Classify the intent of the user to route to the correct agent`,
    input: `User input: ${userMessage}`,
    schema: PromptIntentSchema,
  });

  console.log("classifyIntent:", extractedIntent.data);
  console.log(PROMPT_INTENT[extractedIntent.data.intent]);
  return extractedIntent.data;
}

async function routeAndRes(
  userMessage: string,
  classification: Classification,
): Promise<string> {
  const { intent, sentiment } = classification;

  const resolvedIntent = sentiment === "angry" ? "escalate_human" : intent;

  const result = await createParsedCompletion(getModel(), {
    instructions: PROMPT_INTENT[resolvedIntent],
    input: `User message: ${userMessage}`,
    schema: ResponseSchema,
  });

  console.log("routeAndRes:", result.data);
  return result.data.response;
}

async function main(prompt: string) {
  console.log(`User:\n${prompt}`);

  const classification = await classifyIntent(prompt);

  const response = await routeAndRes(prompt, classification);
  console.log(`\nAgent:\n${response}`);
}

// main("How can i get refund for my order?");
main("Why was I charged twice? Please fix it now.");
