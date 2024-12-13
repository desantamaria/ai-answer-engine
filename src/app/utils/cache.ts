import { Redis } from "@upstash/redis";
import { Logger } from "./logger";
import { ScrapedContent } from "./scrape";

const logger = new Logger("cache");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CACHE_TTL = 7 * (24 * 60 * 60);
const MAX_CACHE_SIZE = 1024000;

function getCacheKey(url: string): string {
  const sanitizedUrl = url.substring(0, 200);
  return `scrape:${sanitizedUrl}`;
}

// Validation function for ScrapedContent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidScrappedContent(data: any): data is ScrapedContent {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.url === "string" &&
    typeof data.title == "string" &&
    // typeof data.sections === "object" &&
    // data.sections.length > 1 &&
    (data.error === null || typeof data.error === "string")
  );
}

export async function getCacheContent(
  url: string
): Promise<ScrapedContent | null> {
  try {
    const cacheKey = getCacheKey(url);
    logger.info(`Checking cache for key: ${cacheKey}`);
    const cached = await redis.get(cacheKey);

    if (!cached) {
      logger.info(`Cache miss - No cached content found for ${url}`);
      return null;
    }

    logger.info(`Cache hit - Found cached content for: ${url}`);

    // Handle both string and object responses from Redis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    if (typeof cached == "string") {
      try {
        parsed = JSON.parse(cached);
      } catch (parseError) {
        logger.error(`JSON parse error for cache content: ${parseError}`);
        await redis.del(cacheKey);
        return null;
      }
    } else {
      parsed = cached;
    }

    // TODO Implement Validation for cached data

    // if (isValidScrappedContent(parsed)) {
    //   const age = Date.now() - (parsed.cachedAt || 0);
    //   logger.info(`Cache content age: ${Math.round(age / 1000 / 60)} minutes`);
    //   return parsed;
    // }
    return parsed;

    // logger.warn(`Invalid cached content format for URL: ${url}`);
    // await redis.del(cacheKey);
    // return null;
  } catch (error) {
    logger.error(`Cached retrieval error: ${error}`);
    return null;
  }
}

export async function cacheContent(
  url: string,
  content: ScrapedContent
): Promise<void> {
  try {
    const cacheKey = getCacheKey(url);
    content.cachedAt = Date.now();

    // Validate content before serializing
    // if (!isValidScrappedContent(content)) {
    //   logger.error(`Attempted to cache invalid content format for URL: ${url}`);
    //   return;
    // }

    const serialized = JSON.stringify(content);

    if (serialized.length > MAX_CACHE_SIZE) {
      logger.warn(
        `Content too large to cache for URL: ${url} (${serialized.length} bytes)`
      );
      return;
    }

    await redis.set(cacheKey, serialized, { ex: CACHE_TTL });
    logger.info(
      `Successfully cached content for: ${url} (${serialized.length} bytes, TTL: ${CACHE_TTL})`
    );
  } catch (error) {
    logger.error(`Cache storage error: ${error}`);
  }
}
