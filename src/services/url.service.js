// Service layer
const repository = require("../repositories/url.repository");
const base62 = require("../utils/base62");
const { getRedisClient } = require("../config/redis");

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

exports.createShortenUrl = async (originalUrl) => {
  // check if URL already exists
  if(!originalUrl) {
        throw new Error("Original URL is required...");
  }
  const id = await repository.create(originalUrl);
  let shortCode = base62.encode(id);

  // store the short code with the original URL
  await repository.updateCode(id, shortCode);
  
  // set cache (best-effort)
  try {
    const client = getRedisClient();
    if (client) {
      await client.set(shortCode, originalUrl, { EX: CACHE_TTL_SECONDS });
    }
  } catch (err) {
    // ignore redis errors
  }
  
  return {shortCode: `http://localhost:3000/api/urls/${shortCode}`};
}

exports.getOriginalUrl = async (code) => {
  // try cache first
  try {
    const client = getRedisClient();
    if (client) {
      const cached = await client.get(code);
      if (cached) return cached;
    }
  } catch (err) {
    // ignore redis errors and fallback to DB
  }
  
  const data = await repository.findByShortCode(code);
  if (!data) {
    throw new Error("URL not found...");
  }
  
  // populate cache (best-effort)
  try {
    const client = getRedisClient();
    if (client) {
      await client.set(code, data.originalUrl, { EX: CACHE_TTL_SECONDS });
    }
  } catch (err) {
    // ignore
  }
  
  return data.originalUrl;
}
