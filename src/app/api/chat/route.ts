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
    const data = await req.text();

    // Extract URLs
    const extractedUrls = data.match(URL_REGEX) || [];
    if (extractedUrls.length > 0) {
      console.log("Extracted URLs:", extractedUrls);
    }

    // Test SCRAPE
    extractedUrls.forEach(async url => {
      const scrapeResult = await performScrape(url);
      console.log(scrapeResult);
    });

    // Generate LLM Response
    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Please respond to the prompt given an data from articles that the user is asking about",
        },
        { role: "user", content: data },
        // { role: "user", content: scrapedResults.toString() },
      ],
      model: "llama3-8b-8192",
    });
    const response = chatCompletion.choices[0].message.content;

    return NextResponse.json({ role: "ai", content: response });
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
  const response = await axios.get(url);
  const html = response.data;
  return cheerioParse(url, html);
}

async function puppeteerScrape(url: string): Promise<ScrapedContent> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const html = await page.content();

  const result = await cheerioParse(url, html);
  await browser.close();

  return result;
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
