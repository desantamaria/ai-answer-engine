// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer

import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import axios from "axios";
import puppeteer from "puppeteer";

const cheerio = require("cheerio");

interface ScrapedContent {
  url: string;
  title: string;
  sections: {
    type: "heading" | "paragraph" | "list";
    content: string;
  }[];
}

// Regex pattern to match URLs
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

// Initialize Groq
const client = new Groq({
  apiKey: process.env["GROQ_API_KEY"],
});

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

    console.log(scrapedContext);

    // TODO: Improve prompt
    const prompt = `You are a helpful assistant. 
          The user will provide a question and several URLs. 
          Use the scraped content from these URLs to provide a comprehensive, context-aware response.
          If the scraped content is relevant, incorporate it into your answer.
          If the scraped content is not helpful, rely on your existing knowledge.
          
          For each article separate the responses and provide the link and title before responding to any article.

          If no scraped article is provided, consider the previous messages in the conversation between the system and the user instead of relying on the scraped data. 
          `;

    // Limit amount of previous messages considered for prompt.
    const limitedContext = context.slice(-5);

    // Generate LLM Response with both original prompt and scraped context
    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: prompt,
        },
        // Include previous messages for extra context
        ...limitedContext.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: "user",
          content: `Question: ${message}\n\nScraped Context:\n${scrapedContext}`,
        },
      ],
      model: "llama3-8b-8192",
    });

    const response = chatCompletion.choices[0].message.content;

    return NextResponse.json({ role: "system", content: response });
  } catch (error) {
    console.error("An error occurred:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

async function performScrape(url: string): Promise<ScrapedContent> {
  try {
    const cheerioResult = await axiosScrape(url);
    if (cheerioResult.sections.length > 0) {
      return cheerioResult;
    }
    return await puppeteerScrape(url);
  } catch (error) {
    console.error(`Error while scraping for: ${url}`, error);
    return {
      url,
      title: "",
      sections: [],
    };
  }
}

async function axiosScrape(url: string): Promise<ScrapedContent> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Referer: "https://www.google.com/",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    return cheerioParse(url, response.data);
  } catch (error) {
    console.error(`Axios scrape failed for ${url}:`, error);
    return {
      url,
      title: "",
      sections: [],
    };
  }
}

async function puppeteerScrape(url: string): Promise<ScrapedContent> {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Navigate to url
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 10000,
    });

    // Wait for page to load body
    await page.waitForSelector("body", { timeout: 5000 });

    const html = await page.content();
    const result = await cheerioParse(url, html);

    return result;
  } catch (error) {
    console.error(`Puppeteer scrape failed for ${url}:`, error);
    return {
      url,
      title: "",
      sections: [],
    };
  } finally {
    if (browser) await browser.close();
  }
}

async function cheerioParse(url: string, html: any): Promise<ScrapedContent> {
  const $ = cheerio.load(html);
  const sections: ScrapedContent["sections"] = [];

  // Headings
  $("h1, h2, h3").each((_: any, heading: any) => {
    sections.push({
      type: "heading",
      content: $(heading).text().trim(),
    });
  });

  // Paragraphs
  $("p").each((_: any, paragraph: any) => {
    sections.push({
      type: "paragraph",
      content: $(paragraph).text().trim(),
    });
  });

  // Lists
  $("ul, ol").each((_: any, list: any) => {
    sections.push({
      type: "list",
      content: $(list).text().trim(),
    });
  });

  return {
    url,
    title: $("h1").first().text().trim(),
    sections: sections,
  };
}
