import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "./http.js";

let client: Anthropic | null = null;

export function claude(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(500, "The AI service is not configured yet.");
    client = new Anthropic({ maxRetries: 2, timeout: 58_000 });
  }
  return client;
}

/** Best quality, for reading resumes. Override with PARSE_MODEL. */
export const DEEP_MODEL = process.env.PARSE_MODEL || "claude-opus-5";
/** Faster and cheaper, for scoring many jobs and chat. Override with FAST_MODEL. */
export const FAST_MODEL = process.env.FAST_MODEL || "claude-sonnet-5";

interface StructuredArgs {
  model: string;
  system: string;
  content: Anthropic.Messages.ContentBlockParam[];
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

/** Calls Claude and returns JSON that is guaranteed to match the schema. */
export async function structured<T>({ model, system, content, schema, maxTokens = 8000, effort = "medium" }: StructuredArgs): Promise<T> {
  const res = await claude().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content }],
    output_config: { effort, format: { type: "json_schema", schema } },
  });
  if (res.stop_reason === "refusal") throw new HttpError(422, "The AI could not process that content.");
  if (res.stop_reason === "max_tokens") throw new HttpError(502, "The AI response was cut off. Please try again.");
  const text = res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")?.text;
  if (!text) throw new HttpError(502, "The AI returned nothing. Please try again.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(502, "The AI response could not be read. Please try again.");
  }
}

/**
 * Truth guard. Any number in AI written text must already appear in the source text
 * (the user's resume or the job posting). Returns false when something was invented.
 */
export function numbersSupported(text: string, ...sources: string[]): boolean {
  const corpus = sources.join(" ").toLowerCase().replace(/,/g, "");
  const nums = text.toLowerCase().replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? [];
  return nums.every((n) => corpus.includes(n));
}
