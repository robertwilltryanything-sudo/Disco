# Deploying Your DiscO App

This guide will walk you through deploying your application to **Vercel**, a modern and powerful platform for web projects that offers a generous free tier and an excellent developer experience.

## Why Vercel is Recommended

Vercel is the best choice for this project because:
- It has first-class support for Vite, meaning it works **out-of-the-box with zero configuration**.
- It provides incredibly fast deployments and a global CDN to make your app fast for everyone.
- It automatically builds and deploys your site on every `git push`.
- It has a simple, secure interface for managing the environment variables needed for your API keys.

Deploying to other platforms like GitHub Pages is possible but often requires complex workarounds and is not recommended for this type of application.

---

## Important Note on Build Errors

You may encounter build errors during deployment. This is a common issue related to corrupt package caches or tool version inconsistencies on build servers. To solve this, this project has been configured to be more resilient:

1.  **Using the Required Node.js Version**: The `package.json` file instructs Vercel to use **Node.js v22.x**. This version is now required by the Vercel build environment to ensure compatibility with their platform updates.
2.  **Using `npm`**: The `vercel.json` file instructs Vercel to use the `npm` package manager. This is a strategic choice to bypass a persistent, environment-specific error that was occurring with `pnpm` on the Vercel build platform.
3.  **Clean Dependency Resolution**: The project uses a minimal `package-lock.json`. This ensures that `npm` resolves and installs fresh dependencies during deployment, preventing conflicts from an outdated or corrupt lock file.

With these settings, Vercel will automatically use the correct versions of Node.js and `npm`, install your dependencies cleanly, and build your project. **You do not need to override any settings in the Vercel UI.**

---

## 5-Minute Deployment Guide

### Step 1: Sign Up for Vercel

1.  Go to [vercel.com/signup](https://vercel.com/signup).
2.  **Sign up with your GitHub account**. This is the easiest way to connect your repository.

### Step 2: Import Your Project

1.  From your Vercel dashboard, click "**Add New...**" and select "**Project**".
2.  Find your **DiscO** GitHub repository and click "**Import**".

### Step 3: Configure Your Project

Vercel automatically detects that you're using Vite. You only need to add your environment variables.

#### Add Environment Variables
Expand the **Environment Variables** section in Vercel and add your secret keys:

-   **Key:** `VITE_API_KEY`
-   **Value:** *Your Google Gemini API Key*

The install command is handled by the `vercel.json` file in the repository.

### Step 4: Deploy!

1.  Click the "**Deploy**" button.
2.  Vercel will build and deploy your project.
3.  Once finished, you will get a live URL (e.g., `disco-app.vercel.app`).

Your application is now live! Every time you push changes to your main branch on GitHub, Vercel will automatically deploy the update.