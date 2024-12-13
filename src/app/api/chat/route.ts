// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer

import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import axios from "axios";
import puppeteer from "puppeteer";
import { Logger } from "@/app/utils/logger";

const logger = new Logger("scrapper");

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
    const prompt = `You are an AI assistant specialized in analyzing and summarizing web articles with the following guidelines:
        1. Response Structure:
        - Provide a clear, academic-style summary
        - Include key details from the article
        - Assess the article's credibility and perspective
        - Highlight unique or noteworthy aspects of the content
        - Use markdown formatting for emphasis and readability

        2. Summary Components:
        - Article Title
        - Author (if available)
        - Source/Publication
        - Main Thesis or Key Argument
        - Critical Analysis
        - Contextual Information
        - Potential Limitations or Bias

        3. Formatting Requirements:
        - Use bold for article title and publication
        - Use italics for book, game, or article titles
        - Include a "References" section with markdown links
        - Maintain an objective, analytical tone

        4. Special Instructions:
        - If no article content is available, indicate this clearly
        - If multiple URLs are provided, analyze each separately
        - Cross-reference existing conversation context if direct article content is unavailable
        - Prioritize factual, concise reporting over speculation

        Example Response Format:
        ---
        **Article Title: "In 'Metaphor: ReFantasia,' Atlus's Menus Become a Game Unto Themselves"**
        **Publication: The New York Times**
        Author: Patrick Hurley

        <br>

        **Main Thesis:**
        The article explores the innovative menu system in the Japanese role-playing game *Metaphor: ReFantasia*, highlighting how game menus can transcend their traditional functional role to become an engaging gameplay element.

        <br>

        **Key Insights:**
        - The game transforms menu navigation into an explorable world
        - Challenges conventional interface design in video games
        - Presents menus as an integral part of the gameplay experience

        <br>

        **Critical Analysis:**
        - Demonstrates creative approach to user interface design
        - Focuses on a specific design element rather than comprehensive game review
        - Provides a niche perspective on game interaction mechanics

        <br>

        **Contextual Information:**
        - Represents a growing trend of innovative design in Japanese role-playing games
        - Highlights the evolving nature of video game user interfaces

        <br>

        **Potential Limitations:**
        - Narrow focus on menu design
        - Lacks broader assessment of the game's overall quality
        - Based on a single aspect of the game

        <br>

        **References:**
        1. [In 'Metaphor: ReFantasia,' Atlus's Menus Become a Game Unto Themselves](https://www.nytimes.com/2024/10/16/arts/metaphor-refantazio-persona-atlus-menus.html)
        ---



        Respond with a comprehensive, well-structured summary that provides meaningful insights into the article's content and significance.
        Keep in mind that the output will be rendered in markdown format.
        At Least one reference should be the link provided for the article.`;

    // Limit amount of previous messages considered for prompt.
    const limitedContext = context.slice(-10);

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
