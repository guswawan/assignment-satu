import { getModel } from "./utils";
import { createParsedCompletion } from "@anvia/core";
import { readFile } from "node:fs/promises";
import z from "zod";
import "dotenv/config";

const ExtractionSchema = z.object({
  decisions: z.array(z.string()),
  risks: z.array(
    z.object({
      description: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    }),
  ),
  action_items: z.array(
    z.object({
      task: z.string(),
      owner: z.string(),
      deadline: z.string().optional(),
    }),
  ),
});

type ExtractionResult = z.infer<typeof ExtractionSchema>;

function splitIntoChunks(text: string, chunkSize: number = 20000): string[] {
  const chunks: string[] = [];
  const lines = text.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    if ((currentChunk + line).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += line + "\n";
  }

  console.log("currentChunk", currentChunk);
  console.log("chunks", chunks);

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function mapChunks(chunks: string[]): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length}...`);

    const result = await createParsedCompletion(getModel(), {
      instructions: `You are an expert meeting analyst. Extract structured information from the meeting transcript.

      DECISIONS: Final conclusions that were explicitly agreed upon or announced.
      - Must be a concrete outcome, not an opinion or suggestion
      - Look for phrases like "we decided", "we'll go with", "that's final", "we agreed"
      - Do NOT include items still under discussion

      RISKS: Problems, concerns, or uncertainties that could negatively impact the project.
      - Assign severity: "high" (blocks progress), "medium" (needs monitoring), "low" (minor concern)
      - Look for phrases like "I'm concerned", "the risk is", "we haven't done", "it's unstable"
      - Include both technical and non-technical risks

      ACTION ITEMS: Specific tasks explicitly assigned to a named person.
      - Must have a clear owner (person's name)
      - Include deadline if mentioned, otherwise omit
      - Look for phrases like "can you", "please", "will you", "I'll handle", "assigned to"
      - Do NOT include vague tasks with no owner

      Only extract what is explicitly stated. Do not infer or assume.`,
      input: `Transcript chunk ${i + 1}:\n\n${chunks[i]}`,
      schema: ExtractionSchema,
    });

    results.push(result.data);
  }

  return results;
}

async function reduceResults(
  chunkResults: ExtractionResult[],
): Promise<ExtractionResult> {
  const merged = {
    decisions: chunkResults.flatMap((r) => r.decisions),
    risks: chunkResults.flatMap((r) => r.risks),
    action_items: chunkResults.flatMap((r) => r.action_items),
  };

  console.log(`\nMerging ${chunkResults.length} chunks...`);
  console.log(
    `Raw: ${merged.decisions.length} decisions, ${merged.risks.length} risks, ${merged.action_items.length} action items`,
  );

  const result = await createParsedCompletion(getModel(), {
    instructions: `You are an expert meeting analyst.
    You receive raw extracted data from multiple chunks of the same meeting transcript.
    Some items may be duplicated or slightly rephrased across chunks.

    Your job is to produce one final clean list for each category:

    DECISIONS — Keep only unique decisions. If two items describe the same decision, keep the most complete version.

    RISKS — Keep only unique risks. If two items describe the same risk, keep the one with the most detail. Do not downgrade severity — if the same risk appears as "medium" in one chunk and "high" in another, keep "high".

    ACTION ITEMS — Keep only unique tasks. If the same task appears multiple times, keep the version with the most complete information. Do not merge different tasks into one.

    Do not add, infer, or summarize anything beyond what is in the raw data.`,
    input: `Raw merged extraction:\n${JSON.stringify(merged, null, 2)}`,
    schema: ExtractionSchema,
  });

  return result.data;
}

async function main() {
  let transcript: string;

  try {
    transcript = await readFile("data/transcript_meeting.txt", {
      encoding: "utf-8",
    });
    console.log(`Transcript loaded (${transcript.length} chars)\n`);
  } catch (error) {
    console.error("File not found");

    process.exit(1);
  }

  const chunks = splitIntoChunks(transcript);
  console.log(`Split into ${chunks.length} chunks\n`);

  console.log("extracting each chunk...");
  const chunkResults = await mapChunks(chunks);

  console.log("\nmerging and deduplicating...");
  const finalResult = await reduceResults(chunkResults);

  console.log("\nFinal Result:\n");
  console.log(JSON.stringify(finalResult, null, 2));
}

main();
