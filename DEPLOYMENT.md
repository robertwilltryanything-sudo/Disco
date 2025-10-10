# Deploying Your DiscO App

This guide will walk you through deploying your application to [Netlify](https://www.netlify.com/), a modern and powerful platform for web projects that offers a generous free tier. It's often easier and faster for deploying React applications than GitHub Pages.

## Step 1: Sign Up for Netlify

1.  Go to [app.netlify.com/signup](https://app.netlify.com/signup).
2.  Sign up with your GitHub account. This will make connecting your repository easy.

## Step 2: Create a New Site

1.  Once you're logged in, click the "**Add new site**" button and select "**Import an existing project**".
2.  Choose **GitHub** as your provider and authorize Netlify to access your repositories.
3.  Select the repository for your **DiscO** application.

## Step 3: Configure Build Settings

Netlify will automatically detect that you have a Vite project. The default settings should be correct, but you should verify them:

-   **Build command:** `npm run build`
-   **Publish directory:** `dist`

## Step 4: Add Environment Variables

This is the most important step. Your application needs the API key and Google Client ID to function correctly.

1.  Before deploying, go to the site's settings. Navigate to **Site configuration > Environment variables**.
2.  Click "**Add a variable**" and create the following two variables:

    -   **Key:** `VITE_API_KEY`
    -   **Value:** *Your Google Gemini API Key*

    -   **Key:** `VITE_GOOGLE_CLIENT_ID`
    -   **Value:** *Your Google Cloud OAuth 2.0 Client ID*

    *These are the same secrets you were using for the GitHub Actions workflow.*

## Step 5: Deploy!

1.  Go back to the deploy screen and click the "**Deploy site**" button.
2.  Netlify will start building and deploying your application. You can watch the progress in the deploy logs.
3.  Once it's finished, Netlify will give you a unique URL (like `random-name-12345.netlify.app`) where your live application is running. You can customize this domain later in the site settings.

That's it! Your application is now live. Netlify will automatically redeploy your site every time you push changes to your `main` branch.
