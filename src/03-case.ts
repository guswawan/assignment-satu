import { getModel, tavilyClient } from "./utils";
import { createParsedCompletion } from "@anvia/core";
import z from "zod";
import "dotenv/config";

const SearchQueriesSchema = z.object({
  queries: z.array(z.string()),
});

const CompanyProfileSchema = z.object({
  name: z.string().describe("Legal Company Name"),
  industry: z.string().describe("Company Industry"),
  website: z.string().describe("Company Website URL"),
  summary: z.string().describe("Short Company Profile"),
  founded: z.string().optional().describe("Company Date Founded"),
  stockTicker: z.string().describe("Company Stock Ticker"),
  headquarters: z.string().describe("Company Headquarters Address"),
});

const userInput = "PT Sariguna Primatirta";

const QUERY_PROMPT = `
  You are an expert in company research, What you need to find is detailed company informations
  including the company's name, industry, location, and any other relevant details.
  Generate 5 most important query to be searched in google to get the most detailed information about the company.
  Each query must be a non-empty string. Do NOT include empty strings.
  `;

const PROFILE_PROMPT = `
You are a business analyst.
Build a short company profile based ONLY on the search results provided.
Extract the key information from the web search results, if you can't find the information please return 'NONE' without quote.
`;

const response = await createParsedCompletion(getModel(), {
  instructions: QUERY_PROMPT,
  input: `User input: ${userInput}`,
  schema: SearchQueriesSchema,
});

console.log(response.data.queries);

const data = await Promise.all(
  response.data.queries.map(async (query) => {
    const searchResult = await tavilyClient.search(query, {
      searchDepth: "basic",
    });
    return searchResult;
  }),
);

console.log(data);

const searchContext = data
  .flatMap((r) => r.results)
  .map((r) => `Source: ${r.url}\n${r.content}`)
  .join("\n\n");

const profileResponse = await createParsedCompletion(getModel(), {
  instructions: PROFILE_PROMPT,
  input: `Search results:\n${searchContext}`,
  schema: CompanyProfileSchema,
});

console.log(profileResponse.data);
