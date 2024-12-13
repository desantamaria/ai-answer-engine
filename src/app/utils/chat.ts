import Groq from "groq-sdk";
import { Logger } from "./logger";

export type Message = {
  role: "user" | "system";
  content: string;
};

const logger = new Logger("cache");

// Initialize Groq
const client = new Groq({
  apiKey: process.env["GROQ_API_KEY"],
});

export async function PerformGroq(messages: Message[]) {
  // Generate LLM Response with both original prompt and scraped context

  logger.info(`Generating response from Groq Client`);
  const chatCompletion = await client.chat.completions.create({
    messages: messages,
    model: "llama3-8b-8192",
  });

  logger.info(`Successful response from Groq Client`);

  return chatCompletion.choices[0].message.content;
}
