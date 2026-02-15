import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { CD, DiscographyAlbum } from './types';

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

export async function getArtistDiscography(artistName: string): Promise<DiscographyAlbum[] | null> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing from environment.");
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Provide a list of official studio albums for "${artistName}". Include title and original release year. Respond in JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            year: { type: Type.INTEGER },
                        },
                        required: ["title", "year"],
                    },
                },
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        return JSON.parse(response.text || '[]');
    } catch (error) {
        handleApiError(error, 'getArtistDiscography');
        return null;
    }
}

export async function getAlbumTrivia(artist: string, title: string): Promise<string | null> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Provide one interesting brief piece of trivia about the album "${title}" by "${artist}". One concise sentence.`,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text?.trim() || null;
    } catch (error) {
        handleApiError(error, 'getAlbumTrivia');
        return null;
    }
}

export async function getAlbumDetails(artist: string, title: string): Promise<any | null> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key configuration error.");
    const ai = new GoogleGenAI({ apiKey });

    try {
        // When using googleSearch grounding, we avoid strict JSON mode as the citations break parsing.
        // We ask for a specific text format that we can parse manually.
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Search for accurate metadata for the album "${title}" by "${artist}".
            Return the info in this EXACT format:
            Genre: [Primary Genre]
            Year: [4-digit Release Year]
            Label: [Record Label]
            Wikipedia: [Full URL to Wikipedia album page]
            Review: [A professional 2-3 sentence review of the album's impact]`,
            config: {
                tools: [{ googleSearch: {} }],
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        
        const text = response.text || '';
        const data = parseAlbumMetadata(text);
        
        // Always attempt to pull extra URLs from grounding metadata as a backup
        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (grounding) {
            grounding.forEach((chunk: any) => {
                const url = chunk.web?.uri;
                if (url && url.includes('wikipedia.org/wiki/') && !data.wikipedia_url) {
                    data.wikipedia_url = url;
                }
            });
        }

        return (data.genre || data.year || data.review) ? data : null;
    } catch (error) {
        const msg = handleApiError(error, 'getAlbumDetails');
        throw new Error(msg);
    }
}

export async function getAlbumInfo(base64Image: string): Promise<Partial<CD> | null> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing.");
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: "Identify the album from this cover art. Return JSON with artist, title, year, genre, record_label, a short review, and verified Wikipedia URL." }
                ]
            },
            config: {
                systemInstruction: "You are a highly accurate music metadata assistant. Accuracy is paramount.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        artist: { type: Type.STRING },
                        title: { type: Type.STRING },
                        genre: { type: Type.STRING },
                        year: { type: Type.INTEGER },
                        version: { type: Type.STRING },
                        record_label: { type: Type.STRING },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        wikipedia_url: { type: Type.STRING },
                        review: { type: Type.STRING }
                    },
                    required: ["artist", "title"],
                },
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        
        const text = response.text;
        if (!text) return null;
        return JSON.parse(text);
    } catch (error) {
        const msg = handleApiError(error, 'getAlbumInfo');
        throw new Error(msg);
    }
}