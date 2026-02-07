// IMPORTANT: Your Google Client ID is sourced from the `VITE_GOOGLE_CLIENT_ID` environment variable.
const rawClientId = process.env.VITE_GOOGLE_CLIENT_ID;

// Validate that it's a non-empty string and not the literal word "undefined"
const clientId = (rawClientId && rawClientId !== "undefined" && rawClientId.length > 10) ? rawClientId : null;

if (!clientId) {
  console.warn("Google Drive Sync: VITE_GOOGLE_CLIENT_ID is not configured or invalid. Sync will be disabled.");
}

export const GOOGLE_CLIENT_ID = clientId;

// The scope for the Google Drive API.
export const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

// The name of the file where the collection data will be stored in Google Drive.
export const COLLECTION_FILENAME = 'disco_collection_data.json';