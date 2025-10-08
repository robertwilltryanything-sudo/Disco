// IMPORTANT: Your Google Client ID is now sourced from environment variables.
//
// For local development:
// 1. Create a file named `.env.local` in the root of your project.
// 2. Add the following line to it, replacing the placeholder with your actual Client ID:
//    VITE_GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
//
// For deployment (via the provided GitHub Action):
// - This value is set using a repository secret named `VITE_GOOGLE_CLIENT_ID`.
//
// If you don't have a Client ID, follow these instructions:
// 1. Go to the Google Cloud Console: https://console.cloud.google.com/
// 2. Create a new project.
// 3. Go to "APIs & Services" > "Credentials".
// 4. Click "Create Credentials" > "OAuth client ID".
// 5. Select "Web application" as the application type.
// 6. Under "Authorized JavaScript origins", add your local development URL (e.g., http://localhost:5173) and your final deployment URL (from GitHub Pages).
// 7. Click "Create" and copy the "Client ID".
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// The scope for the Google Drive API.
// 'drive.file' scope allows the app to create, read, and modify files it creates.
// It does not grant access to other files in the user's Drive.
export const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

// The name of the file where the collection data will be stored in Google Drive.
export const COLLECTION_FILENAME = 'disco_collection_data.json';
