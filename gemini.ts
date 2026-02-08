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
        cover_art_url: { type: Type.STRING, description: "A URL if identifiable, but usually leave empty for frontend to find." }
    },
    required: ["artist", "title"],
};

const albumDetailsSchema = {
    type: Type.OBJECT,
    properties: {
        genre: { type: Type.STRING },
        year: { type: Type.INTEGER },
        record_label: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } }
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
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Search your database for the album "${title}" by artist "${artist}". Provide the original release year, primary genre, record label, and 3 descriptive tags. If you cannot find the exact album, return your best guess based on the artist's style.`,
            config: {
                systemInstruction: "You are a music encyclopedia. Provide accurate metadata. If details are uncertain, provide the most likely values based on the artist's history.",
                responseMimeType: "application/json",
                responseSchema: albumDetailsSchema,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        const text = response.text;
        if (!text || text === '{}') return null;
        return JSON.parse(text);
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
                    { text: "Identify the album from this cover art. Return the artist, title, year, genre, and record label in JSON format. Be precise." }
                ]
            },
            config: {
                systemInstruction: "You are a highly accurate music metadata assistant. Identify albums from cover art images. Always return valid JSON matching the requested schema.",
                responseMimeType: "application/json",
                responseSchema: albumInfoSchema,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        
        const text = response.text;
        if (!text) return null;
        
        return JSON.parse(text);
    } catch (error) {
        handleApiError(error, 'getAlbumInfo');
        throw error;
    }
}