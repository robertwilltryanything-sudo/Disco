import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { CD, DiscographyAlbum } from './types';

// Use the API key exclusively from the environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const albumInfoSchema = {
    type: Type.OBJECT,
    properties: {
        artist: { type: Type.STRING, description: "The name of the artist or band." },
        title: { type: Type.STRING, description: "The title of the album." },
        genre: { type: Type.STRING, description: "The primary genre." },
        year: { type: Type.INTEGER, description: "Original release year." },
        version: { type: Type.STRING, description: "Edition details (e.g., 'Remastered')." },
        record_label: { type: Type.STRING, description: "Record label name." },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Descriptive tags." },
        cover_art_url: { type: Type.STRING, description: "Direct image URL if found." },
        wikipedia_url: { type: Type.STRING, description: "The verified Wikipedia album article URL." },
        review: { type: Type.STRING, description: "A concise 2-3 sentence critical review of the album." }
    },
    required: ["artist", "title"],
};

const albumDetailsSchema = {
    type: Type.OBJECT,
    properties: {
        genre: { type: Type.STRING },
        year: { type: Type.INTEGER },
        record_label: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        wikipedia_url: { type: Type.STRING },
        review: { type: Type.STRING, description: "A concise 2-3 sentence critical review of the album." }
    },
};

const discographySchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            year: { type: Type.INTEGER },
        },
        required: ["title", "year"],
    },
};

/**
 * Normalizes API errors, identifying quota limits.
 */
function handleApiError(error: any, operation: string): string {
    console.error(`Gemini API Error during ${operation}:`, error);
    const message = error?.message || String(error);
    if (message.includes('429') || message.includes('QUOTA') || message.includes('RESOURCE_EXHAUSTED')) {
        return "Quota exceeded. Please wait a moment.";
    }
    return message;
}

export async function getArtistDiscography(artistName: string): Promise<DiscographyAlbum[] | null> {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Provide a list of official studio albums for "${artistName}". Include title and original release year. Respond in JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: discographySchema,
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
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Provide one interesting brief piece of trivia about the album "${title}" by "${artist}". One concise sentence.`,
            config: {
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return response.text?.trim() || null;
    } catch (error) {
        const msg = handleApiError(error, 'getAlbumTrivia');
        if (msg.includes('Quota')) throw new Error(msg);
        return null;
    }
}

export async function getAlbumDetails(artist: string, title: string): Promise<any | null> {
    try {
        // Use Gemini 3 with Google Search to find ACTUAL verified URLs
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Find accurate metadata and verified web links for the album "${title}" by "${artist}". 
            You MUST find the real Wikipedia album URL. 
            Also provide a 2-3 sentence professional review of why this album is significant.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: albumDetailsSchema,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        
        // Extract URLs from search grounding if the model didn't put them in the JSON
        const data = JSON.parse(response.text || '{}');
        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        if (grounding) {
            grounding.forEach((chunk: any) => {
                const url = chunk.web?.uri;
                if (url) {
                    if (url.includes('wikipedia.org/wiki/') && !data.wikipedia_url) data.wikipedia_url = url;
                }
            });
        }

        return data;
    } catch (error) {
        handleApiError(error, 'getAlbumDetails');
        return null;
    }
}

export async function getAlbumInfo(base64Image: string): Promise<Partial<CD> | null> {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: "Identify the album from this cover art. Return JSON with artist, title, year, genre, record_label, a short review, and verified Wikipedia URL. Use Google Search to ensure the Wikipedia URL is NOT a 404." }
                ]
            },
            config: {
                systemInstruction: "You are a highly accurate music metadata assistant. Use Google Search to verify all links before returning them. Accuracy is paramount.",
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: albumInfoSchema,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        
        const text = response.text;
        if (!text) return null;
        
        const data = JSON.parse(text);
        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        if (grounding) {
            grounding.forEach((chunk: any) => {
                const url = chunk.web?.uri;
                if (url) {
                    if (url.includes('wikipedia.org/wiki/') && !data.wikipedia_url) data.wikipedia_url = url;
                }
            });
        }
        
        return data;
    } catch (error) {
        handleApiError(error, 'getAlbumInfo');
        throw error;
    }
}