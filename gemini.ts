import { GoogleGenAI, Type, GenerateContentResponse, ThinkingLevel } from "@google/genai";
import { CD } from './types';
import { getMetadataFromInfobox, searchWikipediaForArticle } from './wikipedia';

/**
 * Global queue to prevent hitting RPM (Requests Per Minute) limits
 */
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 2500; // Reduced to 2.5 seconds for better responsiveness

/**
 * Sleep helper for backoff
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Normalizes API errors, identifying quota limits.
 */
function handleApiError(error: any, operation: string): string {
    console.error(`Gemini API Error during ${operation}:`, error);
    const message = error?.message || String(error);
    if (message.includes('429') || message.includes('QUOTA') || message.includes('RESOURCE_EXHAUSTED')) {
        return "Quota exceeded. Please wait a moment.";
    }
    if (message.includes('API_KEY_INVALID') || message.includes('key not found')) {
        return "Invalid or missing API Key. Check your environment settings.";
    }
    return message;
}

/**
 * Wrapper for Gemini API calls with exponential backoff and rate limiting
 */
async function callWithRetry(operation: () => Promise<any>, maxRetries = 3): Promise<any> {
    let lastErr: any;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Robust rate limiting: reserve a slot in the future
            const now = Date.now();
            let waitTime = 0;
            
            if (now < lastRequestTime + MIN_REQUEST_GAP) {
                waitTime = (lastRequestTime + MIN_REQUEST_GAP) - now;
                lastRequestTime += MIN_REQUEST_GAP;
            } else {
                lastRequestTime = now;
            }

            if (waitTime > 0) {
                await sleep(waitTime + (Math.random() * 500));
            }

            return await operation();
        } catch (error: any) {
            lastErr = error;
            const msg = error?.message || String(error);
            const isQuotaError = msg.includes('429') || msg.includes('QUOTA') || msg.includes('RESOURCE_EXHAUSTED');
            
            if (isQuotaError && i < maxRetries - 1) {
                // Exponential backoff: 5s, 10s, 20s...
                const waitTime = Math.pow(2, i + 1) * 2500;
                console.warn(`Quota hit. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
                await sleep(waitTime);
                continue;
            }
            throw error;
        }
    }
    throw lastErr;
}

/**
 * Robustly parses key-value pairs from prose if the model returns text instead of strict JSON.
 */
function parseAlbumMetadata(text: string): any {
    const data: any = {};
    const lines = text.split('\n');
    
    const extract = (key: string, regex: RegExp) => {
        for (const line of lines) {
            const match = line.match(regex);
            if (match && match[1]) {
                data[key] = match[1].trim();
                break;
            }
        }
    };

    extract('genre', /Genre:\s*(.*)/i);
    extract('year', /Year:\s*(\d{4})/i);
    extract('record_label', /Label:\s*(.*)/i);
    extract('producer', /Producer:\s*(.*)/i);
    extract('wikipedia_url', /Wikipedia:\s*(https?:\/\/[^\s]+)/i);
    
    if (data.year) data.year = parseInt(data.year, 10);

    // Review is usually the largest paragraph or specifically labeled
    const reviewMatch = text.match(/Review:\s*([\s\S]*?)(?=\n[A-Z][a-z]+:|$)/i);
    if (reviewMatch) {
        data.review = reviewMatch[1].trim();
    } else {
        // Fallback: search for long descriptive sentences
        const paragraphs = text.split('\n\n').filter(p => p.length > 50);
        if (paragraphs.length > 0) data.review = paragraphs[paragraphs.length - 1].trim();
    }

    return data;
}

export async function getAlbumTrivia(artist: string, title: string): Promise<string | null> {
    const cacheKey = `album-trivia-cache-${artist}-${title}`.toLowerCase().replace(/\s+/g, '-');
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    const ai = new GoogleGenAI({ apiKey });

    try {
        return await callWithRetry(async () => {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Provide one interesting brief piece of trivia about the album "${title}" by "${artist}". One concise sentence.`,
                config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            });
            const result = response.text?.trim() || null;
            if (result) {
                localStorage.setItem(cacheKey, result);
            }
            return result;
        });
    } catch (error) {
        handleApiError(error, 'getAlbumTrivia');
        return null;
    }
}

export async function getAlbumDetails(artist: string, title: string): Promise<any | null> {
    const cacheKey = `album-details-cache-${artist}-${title}`.toLowerCase().replace(/\s+/g, '-');
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
    }

    // --- STEP 1: Try Deterministic Sources (Wikipedia) ---
    console.log(`Attempting deterministic lookup for ${artist} - ${title}...`);
    let wikiData: any = null;
    let articleTitle: string | null = null;
    try {
        articleTitle = await searchWikipediaForArticle(artist, title);
        if (articleTitle) {
            wikiData = await getMetadataFromInfobox(articleTitle);
            if (wikiData) {
                wikiData.wikipedia_url = `https://en.wikipedia.org/wiki/${encodeURIComponent(articleTitle)}`;
            }
        }
    } catch (e) {
        console.warn("Wikipedia metadata fetch failed:", e);
    }

    // If we found good data from Wikipedia, we can return it immediately 
    // to keep the app responsive, especially if we have Year and Genre.
    if (wikiData && wikiData.year && wikiData.genre) {
        console.log("Found sufficient metadata on Wikipedia. Returning immediately.");
        // We still want a review eventually, but let's prioritize speed for now.
        // We'll save it to cache so we don't fetch again.
        localStorage.setItem(cacheKey, JSON.stringify(wikiData));
        return wikiData;
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return wikiData;
    }

    const ai = new GoogleGenAI({ apiKey });

    const fetchDetails = async (useSearch: boolean) => {
        return await callWithRetry(async () => {
            // If we have Wiki data, we can provide it as context to Gemini
            const contextPrompt = wikiData ? 
                `I already found some info: Year: ${wikiData.year}, Label: ${wikiData.record_label}, Genre: ${wikiData.genre}. Please verify and provide a professional 2-3 sentence review.` :
                `Search for accurate metadata.`;

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `${contextPrompt} for the album "${title}" by "${artist}".
                Return the info in this EXACT format:
                Genre: [Primary Genre]
                Year: [4-digit Release Year]
                Label: [Record Label]
                Producer: [Album Producer(s)]
                Wikipedia: [Full URL to Wikipedia album page]
                Review: [A professional 2-3 sentence review of the album's impact]`,
                config: {
                    tools: useSearch ? [{ googleSearch: {} }] : undefined,
                    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
                },
            });
            
            const text = response.text || '';
            const data = parseAlbumMetadata(text);
            
            // Merge with Wikipedia data
            const mergedData = {
                ...wikiData,
                ...data
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

            const result = (mergedData.genre || mergedData.year || mergedData.review) ? mergedData : null;
            if (result) {
                localStorage.setItem(cacheKey, JSON.stringify(result));
            }
            return result;
        }, 2); // Only 2 retries for enrichment to avoid long spins
    };

    try {
        // If we have partial wiki data, we might skip the search tool to save quota
        const shouldSearch = !wikiData || !wikiData.year;
        return await fetchDetails(shouldSearch);
    } catch (error: any) {
        const msg = error?.message || String(error);
        if (msg.includes('429') || msg.includes('QUOTA') || msg.includes('RESOURCE_EXHAUSTED')) {
            console.warn("Google Search quota hit, retrying without search tool...");
            try {
                // Fallback to internal knowledge if search quota is hit
                return await fetchDetails(false);
            } catch (innerError) {
                const finalMsg = handleApiError(innerError, 'getAlbumDetails_fallback');
                throw new Error(finalMsg);
            }
        }
        const msgFinal = handleApiError(error, 'getAlbumDetails');
        throw new Error(msgFinal);
    }
}

export async function getAlbumInfo(base64Image: string): Promise<Partial<CD> | null> {
    console.log("Starting album identification from image...");
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing.");
    const ai = new GoogleGenAI({ apiKey });

    try {
        const identification = await callWithRetry(async () => {
            console.log("Calling Gemini Vision for identification...");
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
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
                    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
                },
            });
            
            const text = response.text;
            if (!text) return null;
            const result = JSON.parse(text);
            console.log("Identification successful:", result);
            return result;
        });

        if (identification && identification.artist && identification.title) {
            console.log(`Fetching rich metadata for ${identification.artist} - ${identification.title}...`);
            const details = await getAlbumDetails(identification.artist, identification.title);
            return {
                ...identification,
                ...details
            };
        }

        return identification;
    } catch (error) {
        const msg = handleApiError(error, 'getAlbumInfo');
        throw new Error(msg);
    }
}
