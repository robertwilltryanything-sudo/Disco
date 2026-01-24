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
        console.error("Discography fetch error:", error);
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
        console.error("Trivia error:", error);
        return null;
    }
}

export async function getAlbumDetails(artist: string, title: string): Promise<any | null> {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: "Examine the album cover provided in the image and identify the Artist and Album Title. Return the data in the specified JSON format." }
                ]
            },
            config: {
                systemInstruction: "You are a world-class music database expert. Your task is to accurately identify album covers from photos and provide structured metadata including artist, title, year, genre, and record label.",
                responseMimeType: "application/json",
                responseSchema: albumInfoSchema,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        
        const text = response.text;
        if (!text) return null;
        
        const data = JSON.parse(text);
        return Object.keys(data).length === 0 ? null : data;
    } catch (error) {
        console.error("Album scan error:", error);
        return null;
    }
}
