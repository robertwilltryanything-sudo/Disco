import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { CD, DiscographyAlbum } from './types';

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
 * Uses 'gemini-flash-lite-latest' for the highest free-tier availability.
 * Provides a massive daily quota (1500+ requests) compared to Gemini 3 (20 requests).
 */
export async function getArtistDiscography(artistName: string): Promise<DiscographyAlbum[] | null> {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: `Provide a list of official studio albums for "${artistName}". Include title and original release year. Respond in JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: discographySchema,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        return JSON.parse(response.text || '[]');
    } catch (error) {
        console.error("Discography fetch error:", error);
        return null;
    }
}

export async function getAlbumTrivia(artist: string, title: string): Promise<string | null> {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: `Provide one interesting brief piece of trivia about the album "${title}" by "${artist}". One concise sentence.`,
            config: {
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return response.text?.trim() || null;
    } catch (error) {
        console.error("Trivia error:", error);
        return null;
    }
}

export async function getAlbumDetails(artist: string, title: string): Promise<any | null> {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: `Details for album "${title}" by "${artist}": year, genre, label, and 2-3 tags. JSON format.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: albumDetailsSchema,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Album details error:", error);
        return null;
    }
}

export async function getAlbumInfo(base64Image: string): Promise<Partial<CD> | null> {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: "Identify the album from this cover art. Return the artist, title, year, genre, and record label in JSON format. Be precise." }
                ]
            },
            config: {
                systemInstruction: "You are a highly accurate music metadata assistant. Identify albums from cover art images. Always return valid JSON matching the requested schema. If an album cannot be identified with high confidence, return a reasonable guess or leave fields blank if completely unknown, but the JSON structure must always be valid.",
                responseMimeType: "application/json",
                responseSchema: albumInfoSchema,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        
        const text = response.text;
        if (!text) {
            console.error("Empty response from Gemini API for getAlbumInfo");
            return null;
        }
        
        const data = JSON.parse(text);
        if (!data.artist || !data.title) {
            console.warn("Gemini returned partial JSON missing required fields:", data);
            return data.artist || data.title ? data : null;
        }
        
        return data;
    } catch (error) {
        console.error("Album scan error:", error);
        throw error;
    }
}