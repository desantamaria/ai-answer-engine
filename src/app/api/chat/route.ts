// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer

import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import axios from "axios";
const cheerio = require("cheerio");

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

    // Perform Web Scrape using Cheerio
    const scrapedResults = await Promise.all(
      extractedUrls.map(async url => {
        try {
          const response = await axios.get(url);
          const html = response.data;
          const $ = cheerio.load(html);

          return {
            url: url,
            title: $("h1").text().trim(),
            contents: $("p")
              .map((_: any, el: any) => $(el).text().trim())
              .get(),
          };
        } catch (error) {
          console.error(`Error scraping ${url}:`, error);
          return {
            url: url,
            title: "",
            contents: [],
          };
        }
      })
    );

    console.log(scrapedResults);

    // Generate LLM Response
    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Please respond to the prompt given a json representing articles that the user is asking about. The html part is in content",
        },
        { role: "user", content: data },
        { role: "user", content: scrapedResults.toString() },
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
