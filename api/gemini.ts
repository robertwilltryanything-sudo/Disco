import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_TEXT_FIELD_LEN = 300;
const MAX_BATCH_SIZE = 100;
const MAX_BATCH_ITEM_LEN = 200;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

class PayloadTooLargeError extends Error {
  constructor(message = 'Request payload exceeds maximum allowed size.') {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

class InvalidJsonError extends Error {
  constructor(message = 'Invalid JSON request body.') {
    super(message);
    this.name = 'InvalidJsonError';
  }
}

function getExpectedHosts(req: any): Set<string> {
  const hosts = new Set<string>();
  const addHosts = (val: unknown) => {
    if (typeof val !== 'string') return;
    val.split(',').forEach((part) => {
      const cleaned = part.trim().toLowerCase();
      if (cleaned) hosts.add(cleaned);
    });
  };
  addHosts(req.headers?.['x-forwarded-host']);
  addHosts(req.headers?.host);
  return hosts;
}

function isAllowedOrigin(req: any): boolean {
  const origin = req.headers?.origin;
  if (!origin || typeof origin !== 'string') {
    return true;
  }
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const expectedHosts = getExpectedHosts(req);
    if (expectedHosts.has(parsed.host.toLowerCase())) {
      return true;
    }
    const isLocalOrigin = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const hasLocalHost = Array.from(expectedHosts).some(
      (h) => h.startsWith('localhost') || h.startsWith('127.0.0.1')
    );
    return isLocalOrigin && hasLocalHost;
  } catch {
    return false;
  }
}

function getClientIp(req: any): string {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(req: any): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (rateLimitStore.size > 500) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt <= now) rateLimitStore.delete(key);
    }
  }
  const ip = getClientIp(req);
  const existing = rateLimitStore.get(ip);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function normalizeNonEmptyString(val: unknown, maxLen = MAX_TEXT_FIELD_LEN): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

function sanitizeHttpUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Ignore malformed URLs
  }
  return undefined;
}

function sanitizeWikiData(raw: unknown): Record<string, any> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, any>;
  const safe: Record<string, any> = {};

  if (typeof src.year === 'number' && Number.isFinite(src.year) && src.year >= 1900 && src.year <= 2100) {
    safe.year = Math.floor(src.year);
  }
  const label = normalizeNonEmptyString(src.record_label, 200);
  if (label) safe.record_label = label;

  const producer = normalizeNonEmptyString(src.producer, 200);
  if (producer) safe.producer = producer;

  if (Array.isArray(src.genre)) {
    const genres = src.genre
      .map((g) => normalizeNonEmptyString(g, 80))
      .filter((g): g is string => g !== null)
      .slice(0, 15);
    if (genres.length > 0) safe.genre = genres;
  }

  const wikiUrl = sanitizeHttpUrl(src.wikipedia_url);
  if (wikiUrl) safe.wikipedia_url = wikiUrl;

  return Object.keys(safe).length > 0 ? safe : null;
}

/**
 * Reads and parses the JSON request body across Vercel Serverless Functions and Node/Vite middleware,
 * enforcing a strict maximum payload size.
 */
async function getRequestBody(req: any): Promise<any> {
  const contentLengthHeader = req.headers?.['content-length'];
  if (typeof contentLengthHeader === 'string') {
    const declaredSize = Number(contentLengthHeader);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
      throw new PayloadTooLargeError();
    }
  }

  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      if (req.body.byteLength > MAX_BODY_BYTES) {
        throw new PayloadTooLargeError();
      }
      const raw = req.body.toString('utf-8').trim();
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch {
        throw new InvalidJsonError();
      }
    }
    if (typeof req.body === 'object') {
      const approxSize = Buffer.byteLength(JSON.stringify(req.body), 'utf-8');
      if (approxSize > MAX_BODY_BYTES) {
        throw new PayloadTooLargeError();
      }
      return req.body;
    }
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf-8') > MAX_BODY_BYTES) {
        throw new PayloadTooLargeError();
      }
      if (!req.body.trim()) return {};
      try {
        return JSON.parse(req.body);
      } catch {
        throw new InvalidJsonError();
      }
    }
  }

  const buffers: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : Buffer.from(chunk);
    totalBytes += buf.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      if (typeof req.destroy === 'function') req.destroy();
      throw new PayloadTooLargeError();
    }
    buffers.push(buf);
  }
  const raw = Buffer.concat(buffers).toString('utf-8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidJsonError();
  }
}

/**
 * Standardized response helper working for both Vercel response objects and raw ServerResponse.
 */
function sendResponse(res: any, statusCode: number, data: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (typeof res.status === 'function') {
    res.status(statusCode);
  } else {
    res.statusCode = statusCode;
  }

  if (typeof res.json === 'function') {
    res.json(data);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }
}

/**
 * Robustly parses key-value pairs from Gemini text response if not formatted as JSON.
 */
function parseAlbumMetadata(text: string): any {
  const data: any = {};
  const lines = text.split('\n');

  const extract = (key: string, regex: RegExp) => {
    for (const line of lines) {
      const match = line.match(regex);
      if (match && match[1]) {
        data[key] = match[1].trim().replace(/^[*#•-]\s*/, '');
        break;
      }
    }
  };

  extract('genre', /Genre:\s*(.*)/i);
  if (data.genre) {
    data.genre = data.genre.split(',').map((g: string) => g.trim()).filter((g: string) => g.length > 0);
  } else {
    data.genre = [];
  }
  extract('year', /Year:\s*(\d{4})/i);
  extract('record_label', /Label:\s*(.*)/i);
  extract('producer', /Producer:\s*(.*)/i);
  extract('sort_name', /SortName:\s*(.*)/i);
  extract('wikipedia_url', /Wikipedia:\s*(https?:\/\/[^\s]+)/i);

  if (data.year) data.year = parseInt(data.year, 10);
  if (data.wikipedia_url) {
    data.wikipedia_url = sanitizeHttpUrl(data.wikipedia_url);
  }

  const reviewMatch = text.match(/Review:\s*([\s\S]*?)(?=\n[A-Z][a-z]+:|$)/i);
  if (reviewMatch) {
    data.review = reviewMatch[1].trim();
  } else {
    const paragraphs = text.split('\n\n').filter((p: string) => p.length > 50);
    if (paragraphs.length > 0) data.review = paragraphs[paragraphs.length - 1].trim();
  }

  return data;
}

/**
 * Vercel Serverless Function handler for /api/gemini
 * Securely proxies calls to Google Gemini without exposing the API key to the client browser.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return sendResponse(res, 405, { error: 'Method Not Allowed. Use POST.' });
  }

  if (!isAllowedOrigin(req)) {
    return sendResponse(res, 403, { error: 'Forbidden: Cross-origin request denied.' });
  }

  const rateLimit = checkRateLimit(req);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSec));
    return sendResponse(res, 429, { error: 'Too many requests. Please wait a moment and try again.' });
  }

  // Sourced strictly from server environment variables (never prefixed with VITE_)
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return sendResponse(res, 503, {
      error: 'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY to your environment variables.'
    });
  }

  let body: any;
  try {
    body = await getRequestBody(req);
  } catch (err: any) {
    if (err instanceof PayloadTooLargeError) {
      return sendResponse(res, 413, { error: err.message });
    }
    return sendResponse(res, 400, { error: 'Invalid JSON request body.' });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendResponse(res, 400, { error: 'Request body must be a JSON object.' });
  }

  const action = normalizeNonEmptyString(body.action, 50);
  if (!action) {
    return sendResponse(res, 400, { error: 'A valid action is required.' });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    switch (action) {
      case 'trivia': {
        const artist = normalizeNonEmptyString(body.artist);
        const title = normalizeNonEmptyString(body.title);
        if (!artist || !title) {
          return sendResponse(res, 400, { error: 'artist and title must be non-empty strings (max 300 chars).' });
        }
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Provide one interesting brief piece of trivia about the album "${title}" by "${artist}". One concise sentence.`,
        });
        const trivia = response.text?.trim() || null;
        return sendResponse(res, 200, { trivia });
      }

      case 'details': {
        const artist = normalizeNonEmptyString(body.artist);
        const title = normalizeNonEmptyString(body.title);
        if (!artist || !title) {
          return sendResponse(res, 400, { error: 'artist and title must be non-empty strings (max 300 chars).' });
        }
        const safeWikiData = sanitizeWikiData(body.wikiData);
        const useSearch = Boolean(body.useSearch);

        const contextPrompt = safeWikiData
          ? `I already found some info: Year: ${safeWikiData.year ?? 'Unknown'}, Label: ${safeWikiData.record_label ?? 'Unknown'}, Genre: ${Array.isArray(safeWikiData.genre) ? safeWikiData.genre.join(', ') : 'Unknown'}. Please verify and provide a professional 2-3 sentence review.`
          : `Search for accurate metadata.`;

        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `${contextPrompt} for the album "${title}" by "${artist}".
          Return the info in this EXACT format:
          Genre: [Primary Genre, Secondary Genre, etc. (comma separated)]
          Year: [4-digit Release Year]
          Label: [Record Label]
          Producer: [Album Producer(s)]
          SortName: [The name used for sorting. For solo artists, use 'Surname, First Name'. For bands, use the full band name (ignoring 'The' if it starts with it). Examples: 'David Bowie' -> 'Bowie, David', 'Pink Floyd' -> 'Pink Floyd', 'The Beatles' -> 'Beatles', 'Grateful Dead' -> 'Grateful Dead', 'Creedence Clearwater Revival' -> 'Creedence Clearwater Revival', 'Ella Fitzgerald & Louis Armstrong' -> 'Fitzgerald, Ella & Louis Armstrong']
          Wikipedia: [Full URL to Wikipedia album page]
          Review: [A professional 2-3 sentence review of the album's impact]`,
          config: {
            tools: useSearch ? [{ googleSearch: {} }] : undefined,
          },
        });

        const text = response.text || '';
        const parsed = parseAlbumMetadata(text);
        const mergedData = {
          ...(safeWikiData || {}),
          ...parsed
        };

        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (grounding) {
          grounding.forEach((chunk: any) => {
            const url = sanitizeHttpUrl(chunk.web?.uri);
            if (url && url.includes('wikipedia.org/wiki/') && !mergedData.wikipedia_url) {
              mergedData.wikipedia_url = url;
            }
          });
        }

        return sendResponse(res, 200, { details: mergedData });
      }

      case 'identify': {
        if (typeof body.base64Image !== 'string' || !body.base64Image.trim()) {
          return sendResponse(res, 400, { error: 'base64Image must be a non-empty base64 string.' });
        }

        const stripped = body.base64Image.trim().replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, '');
        if (!stripped || stripped.length > MAX_BODY_BYTES || !/^[A-Za-z0-9+/=\s]+$/.test(stripped)) {
          return sendResponse(res, 400, { error: 'Invalid or oversized base64Image payload.' });
        }

        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: stripped } },
              { text: "Identify the album from this cover art. Return JSON with artist and title only." }
            ]
          },
          config: {
            systemInstruction: "You are a highly accurate music metadata assistant. Identify the album cover provided. Return ONLY JSON.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                artist: { type: Type.STRING },
                title: { type: Type.STRING },
              },
              required: ["artist", "title"],
            },
          },
        });

        const text = response.text?.trim();
        let identification: { artist: string; title: string } | null = null;
        if (text) {
          try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && typeof parsed.artist === 'string' && typeof parsed.title === 'string') {
              identification = { artist: parsed.artist.trim(), title: parsed.title.trim() };
            }
          } catch {
            return sendResponse(res, 502, { error: 'AI service returned an invalid identification format.' });
          }
        }
        return sendResponse(res, 200, { identification });
      }

      case 'discography': {
        const artist = normalizeNonEmptyString(body.artist);
        if (!artist) {
          return sendResponse(res, 400, { error: 'artist must be a non-empty string (max 300 chars).' });
        }

        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Provide a complete, accurate, chronological list of main studio albums by the artist/band "${artist}". 
          Exclude any live albums, compilations, EP, box sets, soundtracks (unless it is a core studio album), and bootlegs.
          For each album, provide the title and the original release year (4-digit year).
          Format the response strictly as a JSON array of objects, with each object having exactly "title" and "year" keys. No explanation or code blocks outside the JSON array itself.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  year: { type: Type.INTEGER }
                },
                required: ["title", "year"]
              }
            },
          }
        });

        const text = response.text?.trim() || null;
        let discography: any[] = [];
        if (text) {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              parsed.sort((a: any, b: any) => (a.year || 0) - (b.year || 0));
              discography = parsed;
            }
          } catch {
            return sendResponse(res, 502, { error: 'AI service returned an invalid discography format.' });
          }
        }
        return sendResponse(res, 200, { discography });
      }

      case 'normalize-artists': {
        if (!Array.isArray(body.batch) || body.batch.length === 0 || body.batch.length > MAX_BATCH_SIZE) {
          return sendResponse(res, 400, { error: `batch must be an array of 1 to ${MAX_BATCH_SIZE} artist names.` });
        }
        const safeBatch: string[] = [];
        for (const item of body.batch) {
          const cleaned = normalizeNonEmptyString(item, MAX_BATCH_ITEM_LEN);
          if (!cleaned) {
            return sendResponse(res, 400, { error: `Each artist in batch must be a non-empty string (max ${MAX_BATCH_ITEM_LEN} chars).` });
          }
          safeBatch.push(cleaned);
        }

        const prompt = `You are an expert music archivist and librarian cataloger.
For each music artist in this list, determine if they are a BAND / MUSICAL GROUP or an INDIVIDUAL / SOLO ARTIST.
Format their official library "sort_name" following standard record store / library catalog rules:

RULES:
1. BANDS/GROUPS (e.g., Dire Straits, Def Leppard, Tangerine Dream, Dinosaur Jr., Fleetwood Mac, Pink Floyd, The Clash):
   sort_name MUST remain the band name. If it begins with "The ", strip "The " for sorting (e.g. "The Clash" -> "Clash"). DO NOT reverse words in band names.
2. INDIVIDUAL SOLO ARTISTS (e.g., David Bowie, Kate Bush, Bruce Springsteen, Neil Young, Michael Jackson):
   sort_name MUST be "Surname, First Name" (e.g. "Bowie, David", "Bush, Kate", "Springsteen, Bruce").
3. SOLO ARTIST WITH BACKING BAND (e.g., Tom Petty and the Heartbreakers, Nick Cave & The Bad Seeds):
   sort_name MUST be "Surname, First Name & The [Band]" (e.g. "Petty, Tom & The Heartbreakers").
4. MONONYMS / STAGE MONIKERS (e.g., Prince, Madonna, Cher, Sting, Bjork, Beck, Seal):
   sort_name is the moniker as-is (e.g. "Prince").
5. VARIOUS ARTISTS / COMPILATIONS / SOUNDTRACKS (e.g., Various Artists, Various, Soundtrack, V/A):
   sort_name MUST be "Various Artists", is_group: true, sort_letter: "VA".

Artists to catalog:
${JSON.stringify(safeBatch)}

Respond ONLY with a JSON array of objects with these keys:
- "artist": exact string from input
- "is_group": boolean (true if band/group/ensemble, false if individual solo artist)
- "sort_name": string (the exact formatted sort name)
- "sort_letter": single uppercase character A-Z or # (or "VA" for Various Artists)`;

        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });

        const text = response.text || '';
        let normalized: any[] = [];
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            normalized = parsed;
          }
        } catch {
          normalized = [];
        }

        return sendResponse(res, 200, { normalized });
      }

      default:
        return sendResponse(res, 400, { error: `Unknown action: "${action}"` });
    }
  } catch (error: any) {
    console.error('Gemini Serverless Function Error:', error);
    const msg = error?.message || String(error);
    if (msg.includes('429') || msg.includes('QUOTA') || msg.includes('RESOURCE_EXHAUSTED')) {
      return sendResponse(res, 429, { error: 'Gemini quota exceeded. Please wait a moment and try again.' });
    }
    return sendResponse(res, 500, { error: 'Failed to process request with the AI service.' });
  }
}
