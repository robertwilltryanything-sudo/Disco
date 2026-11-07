import { CD } from './types';
import { getMetadataFromInfobox, searchWikipediaForArticle } from './wikipedia';

/**
 * Global queue to prevent rapid sequential requests
 */
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 1500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Normalizes API errors for user feedback.
 */
function handleApiError(error: any, operation: string): string {
    console.error(`Gemini proxy error during ${operation}:`, error);
    const message = error?.message || String(error);
    if (message.includes('429') || message.includes('QUOTA') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
        return "Quota exceeded. Please wait a moment.";
    }
    if (message.includes('API_KEY') || message.includes('key not configured')) {
        return "Gemini API key is not configured on the server. Please check your deployment settings.";
    }
    return message;
}

/**
 * Client-side proxy invoker calling /api/gemini
 */
async function callGeminiProxy<T>(action: string, payload: any): Promise<T> {
    const now = Date.now();
    let waitTime = 0;
    if (now < lastRequestTime + MIN_REQUEST_GAP) {
        waitTime = (lastRequestTime + MIN_REQUEST_GAP) - now;
        lastRequestTime += MIN_REQUEST_GAP;
    } else {
        lastRequestTime = now;
    }

    if (waitTime > 0) {
        await sleep(waitTime);
    }

    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...payload }),
    });

    if (!response.ok) {
        let errMessage = `Server returned status ${response.status}`;
        try {
            const data = await response.json();
            if (data?.error) errMessage = data.error;
        } catch {
            // ignore JSON parse error on non-200
        }
        throw new Error(errMessage);
    }

    return await response.json();
}

export async function getAlbumTrivia(artist: string, title: string): Promise<string | null> {
    const cacheKey = `album-trivia-cache-${artist}-${title}`.toLowerCase().replace(/\s+/g, '-');
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    try {
        const result = await callGeminiProxy<{ trivia: string | null }>('trivia', { artist, title });
        const trivia = result?.trivia || null;
        if (trivia) {
            localStorage.setItem(cacheKey, trivia);
        }
        return trivia;
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
    try {
        const articleTitle = await searchWikipediaForArticle(artist, title);
        if (articleTitle) {
            wikiData = await getMetadataFromInfobox(articleTitle);
            if (wikiData) {
                wikiData.wikipedia_url = `https://en.wikipedia.org/wiki/${encodeURIComponent(articleTitle)}`;
            }
        }
    } catch (e) {
        console.warn("Wikipedia metadata fetch failed:", e);
    }

    // If we found good data from Wikipedia, return immediately
    if (wikiData && wikiData.year && wikiData.genre && wikiData.genre.length > 0) {
        console.log("Found sufficient metadata on Wikipedia. Returning immediately.");
        localStorage.setItem(cacheKey, JSON.stringify(wikiData));
        return wikiData;
    }

    try {
        const shouldSearch = !wikiData || !wikiData.year;
        const result = await callGeminiProxy<{ details: any }>('details', {
            artist,
            title,
            wikiData,
            useSearch: shouldSearch,
        });

        const details = result?.details || null;
        if (details && (details.genre || details.year || details.review)) {
            localStorage.setItem(cacheKey, JSON.stringify(details));
            return details;
        }

        return wikiData;
    } catch (error: any) {
        const msg = error?.message || String(error);
        if (msg.includes('429') || msg.includes('QUOTA') || msg.includes('quota')) {
            console.warn("Quota hit on search, retrying without search tool...");
            try {
                const fallbackResult = await callGeminiProxy<{ details: any }>('details', {
                    artist,
                    title,
                    wikiData,
                    useSearch: false,
                });
                const details = fallbackResult?.details || null;
                if (details) {
                    localStorage.setItem(cacheKey, JSON.stringify(details));
                    return details;
                }
            } catch (innerError) {
                const finalMsg = handleApiError(innerError, 'getAlbumDetails_fallback');
                throw new Error(finalMsg);
            }
        }
        const finalMsg = handleApiError(error, 'getAlbumDetails');
        throw new Error(finalMsg);
    }
}

export async function getAlbumInfo(base64Image: string): Promise<Partial<CD> | null> {
    console.log("Starting album identification from image via server proxy...");

    try {
        const result = await callGeminiProxy<{ identification: { artist: string; title: string } | null }>('identify', {
            base64Image,
        });

        const identification = result?.identification;
        if (identification && identification.artist && identification.title) {
            console.log(`Identification successful: ${identification.artist} - ${identification.title}. Fetching details...`);
            const details = await getAlbumDetails(identification.artist, identification.title);
            return {
                ...identification,
                ...details,
            };
        }

        return identification || null;
    } catch (error) {
        const msg = handleApiError(error, 'getAlbumInfo');
        throw new Error(msg);
    }
}

/**
 * Fetches a chronological list of main studio albums by an artist via /api/gemini
 */
export async function getArtistStudioDiscography(artist: string): Promise<{ title: string; year: number }[] | null> {
    const cacheKey = `artist-discography-cache-${artist}`.toLowerCase().replace(/\s+/g, '-');
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
    }

    try {
        const result = await callGeminiProxy<{ discography: { title: string; year: number }[] }>('discography', {
            artist,
        });

        const discography = result?.discography;
        if (Array.isArray(discography)) {
            localStorage.setItem(cacheKey, JSON.stringify(discography));
            return discography;
        }

        return null;
    } catch (error) {
        handleApiError(error, 'getArtistStudioDiscography');
        return null;
    }
}
