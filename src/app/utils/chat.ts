import { prompt } from "./prompt";
import Groq from "groq-sdk";

export type Message = {
  role: "user" | "system";
  content: string;
};

// Initialize Groq
const client = new Groq({
  apiKey: process.env["GROQ_API_KEY"],
});

export async function LLM(messages: Message[]) {
  // Generate LLM Response with both original prompt and scraped context
  const chatCompletion = await client.chat.completions.create({
    messages: messages,
    model: "llama3-8b-8192",
  });

  return chatCompletion.choices[0].message.content;
}
