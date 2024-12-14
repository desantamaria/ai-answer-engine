// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer

import { NextResponse } from "next/server";

import { Logger } from "@/app/utils/logger";
import { performScrape, ScrapedContent } from "@/app/utils/scrape";
import { Message, PerformGroq } from "@/app/utils/chat";
import { prompt } from "@/app/utils/prompt";
import { Redis } from "@upstash/redis";
import { timeStamp } from "console";

const logger = new Logger("api route");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Regex pattern to match URLs
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

// Extracts URLs from msg and scrapes website data then feeding the data to prompt
export async function POST(req: Request) {
  try {
    const { message, context, conversationId } = await req.json();

    // Extract all URLs
    logger.info(`Extracting URLs from prompt`);
    const extractedUrls = message.match(URL_REGEX) || [];
    if (extractedUrls.length > 0) {
      //   logger.info("Extracted URLs:", extractedUrls);
      logger.info(`Extracted ${extractedUrls.length} URLs from prompt`);
    } else {
      logger.warn(`No URLs were extracted`);
    }

    // Collect scraped content from all URLs
    logger.info(`Processing all extracted URLs`);
    const scrapedResults: ScrapedContent[] = [];
    for (const url of extractedUrls) {
      const scrapeResult = await performScrape(url);
      scrapedResults.push(scrapeResult);
    }
    logger.info(`All extracted URLs have been processed`);

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
      ...context.map((msg: Message) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user",
        content: `Question: ${message}\n\nScraped Context:\n${scrapedContext}`,
      },
    ];

    const response = await PerformGroq(messages);

    // Prepare for DB storage
    const existingConversation = (await redis.get(
      `conversation:${conversationId}`
    )) || {
      id: conversationId,
      message: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update conversation in Redis
    const updatedConversation = {
      ...existingConversation,
      messages: [
        ...context.map((msg: Message) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: "user", content: message, timestamp: new Date().toISOString() },
        {
          role: "assistant",
          content: response,
          timestamp: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    // Store updated conversation in Redis
    await redis.set(`conversation:${conversationId}`, updatedConversation);

    return NextResponse.json({
      role: "system",
      content: response,
      conversationId,
    });
  } catch (error) {
    logger.error("An error occurred:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
