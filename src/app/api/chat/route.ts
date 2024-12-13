// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer

import { NextResponse } from "next/server";

import { Logger } from "@/app/utils/logger";
import { performScrape, ScrapedContent } from "@/app/utils/scrape";
import { LLM } from "@/app/utils/chat";
import { prompt } from "@/app/utils/prompt";

const logger = new Logger("scrapper");

// Regex pattern to match URLs
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

// Extracts URLs from msg and scrapes website data then feeding the data to prompt
export async function POST(req: Request) {
  try {
    const { message, context } = await req.json();

    // Extract all URLs
    const extractedUrls = message.match(URL_REGEX) || [];
    if (extractedUrls.length > 0) {
      console.log("Extracted URLs:", extractedUrls);
    }

    // Collect scraped content from all URLs
    const scrapedResults: ScrapedContent[] = [];
    for (const url of extractedUrls) {
      const scrapeResult = await performScrape(url);
      scrapedResults.push(scrapeResult);
    }

    // Construct context from scraped content
    const scrapedContext = scrapedResults
      .map(
        result =>
          `Content from ${result.url}:\nTitle: ${result.title}\n` +
          result.sections
            .map(section => `${section.type.toUpperCase()}: ${section.content}`)
            .join("\n")
      )
      .join("\n\n");

    // Prepare Messages to be passed to LLM
    const messages = [
      {
        role: "system",
        content: prompt,
      },
      // Include previous messages for extra context
      ...context.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user",
        content: `Question: ${message}\n\nScraped Context:\n${scrapedContext}`,
      },
    ];

    const response = await LLM(messages);

    return NextResponse.json({ role: "system", content: response });
  } catch (error) {
    console.error("An error occurred:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
