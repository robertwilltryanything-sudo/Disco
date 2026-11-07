import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';

/**
 * Robust helper to read and parse the JSON request body across both Vercel Serverless
 * Functions (where req.body may already be an object or string) and Node/Vite connect middleware.
 */
async function getRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const buffers: Buffer[] = [];
  for await (const chunk of req) {
    buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(buffers).toString('utf-8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Standardized response helper working for both Vercel response objects and raw ServerResponse.
 */
function sendResponse(res: any, statusCode: number, data: any) {
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

  // Sourced strictly from server environment variables (never prefixed with VITE_)
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;
  if (!apiKey) {
    return sendResponse(res, 503, {
      error: 'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY to your environment variables.'
    });
  }

  let body: any;
  try {
    body = await getRequestBody(req);
  } catch (err: any) {
    return sendResponse(res, 400, { error: 'Invalid JSON request body.' });
  }

  const { action } = body || {};
  const ai = new GoogleGenAI({ apiKey });

  try {
    switch (action) {
      case 'trivia': {
        const { artist, title } = body;
        if (!artist || !title) {
          return sendResponse(res, 400, { error: 'artist and title are required for trivia.' });
        }
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Provide one interesting brief piece of trivia about the album "${title}" by "${artist}". One concise sentence.`,
        });
        const trivia = response.text?.trim() || null;
        return sendResponse(res, 200, { trivia });
      }

      case 'details': {
        const { artist, title, wikiData, useSearch } = body;
        if (!artist || !title) {
          return sendResponse(res, 400, { error: 'artist and title are required for details.' });
        }

        const contextPrompt = wikiData
          ? `I already found some info: Year: ${wikiData.year}, Label: ${wikiData.record_label}, Genre: ${wikiData.genre}. Please verify and provide a professional 2-3 sentence review.`
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
          ...wikiData,
          ...parsed
        };

        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (grounding) {
          grounding.forEach((chunk: any) => {
            const url = chunk.web?.uri;
            if (url && url.includes('wikipedia.org/wiki/') && !mergedData.wikipedia_url) {
              mergedData.wikipedia_url = url;
            }
          });
        }

        return sendResponse(res, 200, { details: mergedData });
      }

      case 'identify': {
        const { base64Image } = body;
        if (!base64Image) {
          return sendResponse(res, 400, { error: 'base64Image is required for identification.' });
        }

        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
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

        const text = response.text;
        const identification = text ? JSON.parse(text) : null;
        return sendResponse(res, 200, { identification });
      }

      case 'discography': {
        const { artist } = body;
        if (!artist) {
          return sendResponse(res, 400, { error: 'artist is required for discography.' });
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
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            parsed.sort((a: any, b: any) => (a.year || 0) - (b.year || 0));
            discography = parsed;
          }
        }
        return sendResponse(res, 200, { discography });
      }

      case 'normalize-artists': {
        const { batch } = body;
        if (!Array.isArray(batch) || batch.length === 0) {
          return sendResponse(res, 400, { error: 'batch array of artist names is required.' });
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
${JSON.stringify(batch)}

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
    return sendResponse(res, 500, { error: msg });
  }
}
