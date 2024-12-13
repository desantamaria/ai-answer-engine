import axios from "axios";
import puppeteer from "puppeteer";

const cheerio = require("cheerio");

export interface ScrapedContent {
  url: string;
  title: string;
  sections: {
    type: "heading" | "paragraph" | "list";
    content: string;
  }[];
}

export async function performScrape(url: string): Promise<ScrapedContent> {
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
