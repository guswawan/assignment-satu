import "dotenv/config";
import { OpenAIClient } from "@anvia/openai";
import { tavily } from "@tavily/core";

const openClient = new OpenAIClient({
  apiKey: process.env.GEMINI_API_KEY,
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export function getModel(model: string = "gemini-3.1-flash-lite") {
  return openClient.completionModel(model);
}

export const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY!,
});
