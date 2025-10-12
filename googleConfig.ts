// IMPORTANT: Your Google Client ID is sourced from the `GOOGLE_CLIENT_ID` environment variable.
// This is a requirement for the execution environment.
//
// For deployment (e.g., on Vercel):
// - This value is set using an environment variable named `GOOGLE_CLIENT_ID`.
//
// If you don't have a Client ID, follow these instructions:
// 1. Go to the Google Cloud Console: https://console.cloud.google.com/
// 2. Create a new project.
// 3. Go to "APIs & Services" > "Credentials".
// 4. Click "Create Credentials" > "OAuth client ID".
// 5. Select "Web application" as the application type.
// 6. Under "Authorized JavaScript origins", add your local development URL (e.g., http://localhost:5173) and your final deployment URL.
// 7. Click "Create" and copy the "Client ID".
const clientId = process.env.GOOGLE_CLIENT_ID;

if (!clientId) {
  // This warning is helpful for developers to know why sync is not working.
  console.warn("GOOGLE_CLIENT_ID is not configured. Google Drive Sync will be disabled.");
}

export const GOOGLE_CLIENT_ID = clientId;

// The scope for the Google Drive API.
// 'drive.file' scope allows the app to create, read, and modify files it creates.
// It does not grant access to other files in the user's Drive.
export const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

// The name of the file where the collection data will be stored in Google Drive.
export const COLLECTION_FILENAME = 'disco_collection_data.json';