import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { CD } from './types';

// The API key is sourced from the environment variables via Vite's `define` config.
// FIX: Use process.env.API_KEY as per Gemini API guidelines.
const apiKey = process.env.API_KEY;

if (!apiKey) {
  // FIX: Updated error message to reflect the use of API_KEY.
  throw new Error("API_KEY is not set. Please ensure the API_KEY environment variable is configured correctly.");
}

const ai = new GoogleGenAI({ apiKey });

const albumInfoSchema = {
    type: Type.OBJECT,
    properties: {
        artist: {
            type: Type.STRING,
            description: "The name of the artist or band.",
        },
        title: {
            type: Type.STRING,
            description: "The title of the album.",
        },
        genre: {
            type: Type.STRING,
            description: "The primary genre of the album.",
        },
        year: {
            type: Type.INTEGER,
            description: "The year the album was originally released.",
        },
        version: {
            type: Type.STRING,
            description: "The specific version of the album if it is mentioned on the cover, such as 'Remastered' or 'Deluxe Edition'."
        },
        recordLabel: {
            type: Type.STRING,
            description: "The record label that released the album, if visible or known.",
        },
        tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of relevant tags for the album, such as sub-genres, musical styles, or notable facts.",
        },
        coverArtUrl: {
            type: Type.STRING,
            description: "A publicly accessible URL for the high-quality album cover art."
        }
    },
    required: ["artist", "title"],
};

const albumDetailsSchema = {
    type: Type.OBJECT,
    properties: {
        genre: {
            type: Type.STRING,
            description: "The primary genre of the album (e.g., 'Rock', 'Grunge', 'Alternative Rock').",
        },
        year: {
            type: Type.INTEGER,
            description: "The 4-digit year the album was originally released.",
        },
        recordLabel: {
            type: Type.STRING,
            description: "The original record label for the album.",
        },
        tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of 2-3 relevant tags for the album, such as sub-genres, musical styles, or notable facts.",
        },
    },
};

export async function getAlbumTrivia(artist: string, title: string): Promise<string | null> {
    try {
        const prompt = `Provide one interesting and brief piece of trivia about the album "${title}" by "${artist}". Respond with only a single, concise sentence.`;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const text = response.text;
        if (!text) {
            console.warn(`Gemini response for trivia for "${artist} - ${title}" was empty.`);
            return null;
        }

        return text.trim();

    } catch (error) {
        console.error(`Error fetching trivia for "${artist} - ${title}" with Gemini:`, error);
        throw error;
    }
}

export async function getAlbumDetails(artist: string, title: string): Promise<{ genre?: string; year?: number; recordLabel?: string; tags?: string[] } | null> {
    try {
        const textPart = {
            text: `For the album "${title}" by "${artist}", provide the original release year, the primary genre, the original record label, and an array of 2-3 relevant tags (e.g., musical style, notable facts). Respond in JSON format. If you cannot find the information, respond with an empty object.`,
        };
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: albumDetailsSchema,
            },
        });
        
        const text = response.text;
        if (!text) {
            console.warn(`Gemini response for album details for "${artist} - ${title}" was empty.`);
            return null;
        }

        const jsonString = text.trim();
        if (jsonString) {
            try {
                const albumData = JSON.parse(jsonString);
                return albumData as { genre?: string; year?: number; recordLabel?: string; tags?: string[] };
            } catch (e) {
                console.error("Failed to parse JSON response from Gemini for album details:", e);
                return null;
            }
        }
        return null;

    } catch (error) {
        console.error(`Error fetching album details for "${artist} - ${title}" with Gemini:`, error);
        throw error;
    }
}


export async function getAlbumInfo(imageBase64: string): Promise<Partial<Omit<CD, 'id'>> | null> {
    try {
        const imagePart = {
            inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
            },
        };

        const textPart = {
            text: `Analyze the provided image of a music album cover. Identify the artist, album title, genre, release year, record label, and the specific version of the album (e.g., 'Remaster', 'Deluxe Edition') if it is written on the cover. Also provide an array of 2-3 relevant tags (e.g., musical style, notable facts). Finally, find a public URL for a high-quality version of the cover art. Respond in JSON format. If you cannot identify the album, respond with an empty object.`,
        };
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: albumInfoSchema,
            },
        });
        
        const text = response.text;
        if (!text) {
            console.warn("Gemini response for scanned album info was empty.");
            return null;
        }

        const jsonString = text.trim();
        if (jsonString) {
            try {
                const albumData = JSON.parse(jsonString);
                
                if (albumData.artist && albumData.title) {
                    return albumData as Partial<Omit<CD, 'id'>>;
                }
            } catch (e) {
                console.error("Failed to parse JSON response from Gemini:", e);
                return null;
            }
        }
        return null;

    } catch (error) {
        console.error("Error analyzing album cover with Gemini:", error);
        throw error;
    }
}