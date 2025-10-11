# Deploying Your DiscO App

This guide will walk you through deploying your application to [Vercel](https://vercel.com/), a modern and powerful platform for web projects that offers a generous free tier and an excellent developer experience, especially for Vite + React applications.

## Why Vercel?

Vercel is a great choice for this project because:
- It has first-class support for Vite, meaning it works out-of-the-box with zero configuration.
- It provides incredibly fast deployments and a global CDN to make your app fast for everyone.
- It automatically builds and deploys your site on every `git push`.
- It has a simple interface for managing environment variables to keep your API keys safe.

## Step 1: Sign Up for Vercel

1.  Go to [vercel.com/signup](https://vercel.com/signup).
2.  Sign up with your GitHub account. This is the easiest way to connect your repository.

## Step 2: Import Your Project

1.  From your Vercel dashboard, click "**Add New...**" and select "**Project**".
2.  Choose your **DiscO** GitHub repository and click "**Import**".

## Step 3: Configure Your Project

Vercel will automatically detect that you have a Vite project and a `package-lock.json` file, so it will use **npm** for installation. The default settings should be perfect.

-   **Framework Preset:** `Vite`
-   **Build & Output Settings:** These will be configured automatically.
-   **Install Command:** Vercel will automatically use `npm install`. The `preinstall` script in your `package.json` will also run, clearing the cache to prevent build errors.

## Step 4: Add Environment Variables

This is the most important step for your app to function correctly.

1.  In the project configuration screen, expand the **Environment Variables** section.
2.  Add the following two variables:

    -   **Key:** `VITE_API_KEY`
    -   **Value:** *Your Google Gemini API Key*

    -   **Key:** `VITE_GOOGLE_CLIENT_ID`
    -   **Value:** *Your Google Cloud OAuth 2.0 Client ID*

## Step 5: Deploy!

1.  Click the "**Deploy**" button.
2.  Vercel will pull your code, install dependencies, build your project, and deploy it.
3.  Once finished, you will get a live URL (like `disco.vercel.app`).

## Step 6: Update Google Cloud Console

For Google Sign-In to work on your new live URL, you must add it to your list of authorized origins.

1. Go to the [Google Cloud Console Credentials page](https://console.cloud.google.com/apis/credentials).
2. Click on your OAuth 2.0 Client ID.
3. Under **Authorized JavaScript origins**, click **+ ADD URI**.
4. Paste your new Vercel URL (e.g., `https://your-project-name.vercel.app`) and press Enter.
5. Click **Save**.

Your application is now live! Every time you push to your `main` branch, Vercel will automatically build and deploy the changes.