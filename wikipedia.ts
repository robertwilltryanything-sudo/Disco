/**
 * Searches Wikipedia for a relevant article title.
 * @param artist The artist's name.
 * @param title The album's title.
 * @returns A promise that resolves to the article title or null.
 */
async function searchWikipediaForArticle(artist: string, title: string): Promise<string | null> {
    const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
    
    const searchTerms: string[] = [
        `${title} (${artist} album)`,
        title,
    ];

    for (const term of searchTerms) {
        const params = new URLSearchParams({
            action: 'query',
            list: 'search',
            srsearch: term,
            srlimit: '1',
            format: 'json',
            origin: '*'
        });

        try {
            const response = await fetch(`${WIKIPEDIA_API_ENDPOINT}?${params}`);
            if (!response.ok) continue;
            const data = await response.json();

            if (data.query.search.length > 0) {
                return data.query.search[0].title;
            }
        } catch (error) {
            console.error(`Error searching Wikipedia for term "${term}":`, error);
        }
    }

    // Fallback using opensearch for broader matching
    const generalSearchTerm = `${artist} ${title}`;
     const params2 = new URLSearchParams({
        action: 'opensearch',
        search: generalSearchTerm,
        limit: '1',
        namespace: '0',
        format: 'json',
        origin: '*'
    });
    
    try {
        const response2 = await fetch(`${WIKIPEDIA_API_ENDPOINT}?${params2}`);
        if (!response2.ok) return null;
        const data2 = await response2.json();

        if (data2[1] && data2[1].length > 0) {
            return data2[1][0];
        }
    } catch (error) {
        console.error(`Error with opensearch for "${generalSearchTerm}":`, error);
    }
    
    return null;
}

/**
 * Extracts the primary cover art filename from a Wikipedia article's infobox wikitext.
 * @param pageTitle The title of the Wikipedia article.
 * @returns A promise that resolves to the filename (e.g., "File:Image.jpg") or null.
 */
async function getCoverFilenameFromInfobox(pageTitle: string): Promise<string | null> {
    const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        titles: pageTitle,
        format: 'json',
        origin: '*'
    });
    
    const response = await fetch(`${WIKIPEDIA_API_ENDPOINT}?${params}`);
    const data = await response.json();
    
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId === '-1' || !pages[pageId].revisions) {
        return null;
    }
    
    const wikitext = pages[pageId].revisions[0]['*'];
    const coverRegex = /\|\s*Cover\s*=\s*(.+?)\n/i;
    const match = wikitext.match(coverRegex);
    
    if (match && match[1]) {
        // Clean the extracted string from wiki markup to get just the filename.
        let filename = match[1].trim();
        // Remove wiki link syntax, e.g., [[File:filename.jpg]] -> filename.jpg
        filename = filename.replace(/\[\[(?:File:)?|\]\]/g, '');
        // Remove any image attributes, which come after a pipe, e.g., filename.jpg|thumb -> filename.jpg
        filename = filename.split('|')[0].trim();

        if (filename) {
            return `File:${filename}`;
        }
    }
    
    return null;
}

/**
 * Retrieves all image filenames used on a given Wikipedia page.
 * @param pageTitle The title of the Wikipedia article.
 * @returns A promise that resolves to an array of image file titles (e.g., "File:Image.jpg").
 */
async function getAllImageFilesFromArticle(pageTitle: string): Promise<string[]> {
    const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
        action: 'query',
        prop: 'images',
        titles: pageTitle,
        format: 'json',
        origin: '*'
    });
    
    const response = await fetch(`${WIKIPEDIA_API_ENDPOINT}?${params}`);
    const data = await response.json();
    
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId === '-1' || !pages[pageId].images) {
        return [];
    }
    
    return pages[pageId].images.map(({ title }: { title: string }) => title);
}

/**
 * Gets a full, sized image URL from a file title (e.g., "File:Image.jpg").
 * @param fileTitle The title of the file.
 * @returns A promise that resolves to the full image URL or null.
 */
async function getImageUrlFromFileTitle(fileTitle: string): Promise<string | null> {
    const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
        action: 'query',
        titles: fileTitle,
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '500', // Request a 500px wide thumbnail for performance and consistency
        format: 'json',
        origin: '*'
    });

    const response = await fetch(`${WIKIPEDIA_API_ENDPOINT}?${params}`);
    const data = await response.json();

    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    if (pageId === '-1' || !pages[pageId].imageinfo) {
        return null;
    }
    
    return pages[pageId].imageinfo[0].thumburl || pages[pageId].imageinfo[0].url;
}

/**
 * Finds album cover art by searching a Wikipedia article for all images and ranking them.
 * This is more robust than just looking at the infobox and can find alternate/version covers.
 * @param artist The artist's name.
 * @param title The album's title.
 * @returns A promise that resolves to an array of URLs for the cover art, or null if none are found.
 */
export async function findCoverArt(artist: string, title: string): Promise<string[] | null> {
    console.log(`Searching for cover art for "${artist} - ${title}" on Wikipedia...`);

    try {
        // 1. Find the most relevant Wikipedia article.
        const articleTitle = await searchWikipediaForArticle(artist, title);
        if (!articleTitle) {
            console.log("Could not find a matching Wikipedia article.");
            return null;
        }
        console.log(`Found article: "${articleTitle}"`);

        // 2. Get all potential cover art filenames from the article.
        const [infoboxCover, allImages] = await Promise.all([
            getCoverFilenameFromInfobox(articleTitle),
            getAllImageFilesFromArticle(articleTitle)
        ]);

        const candidateFiles = new Set(allImages);
        if (infoboxCover) {
            candidateFiles.add(infoboxCover); // Ensure primary cover is included
        }
        
        if (candidateFiles.size === 0) {
            console.log("No images found on the article page.");
            return null;
        }

        // 3. Filter and rank the images to find the best matches.
        const lowerCaseTitle = title.toLowerCase();
        
        const rankedImages = Array.from(candidateFiles)
            .map(fileTitle => {
                const lowerCaseFile = fileTitle.toLowerCase();
                let score = 0;

                // Exclude non-cover image types
                if (lowerCaseFile.endsWith('.svg') || lowerCaseFile.includes('logo')) {
                    return { fileTitle, score: -1 };
                }
                // Allow common image formats
                if (!/\.(png|jpg|jpeg|webp|gif)$/.test(lowerCaseFile)) {
                     return { fileTitle, score: -1 };
                }

                // Score based on keywords and if it's the official infobox cover
                if (lowerCaseFile.includes('cover')) score += 20;
                if (lowerCaseFile.includes('artwork')) score += 15;
                if (fileTitle === infoboxCover) score += 50; 

                // Score based on matching title strings (normalizing spaces and underscores)
                const normalizedFile = lowerCaseFile.replace(/ /g, '_');
                const normalizedTitle = lowerCaseTitle.replace(/ /g, '_');
                if (normalizedFile.includes(normalizedTitle)) score += 10;

                return { fileTitle, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);

        if (rankedImages.length === 0) {
            console.log("No suitable cover images found after ranking.");
            return null;
        }

        // 4. Get URLs for the top candidates (up to 8).
        const topCandidates = rankedImages.slice(0, 8).map(item => item.fileTitle);
        const urlPromises = topCandidates.map(getImageUrlFromFileTitle);
        const urls = await Promise.all(urlPromises);
        
        // Remove any nulls and duplicates
        const finalUrls = [...new Set(urls.filter((url): url is string => url !== null))];
        
        if (finalUrls.length > 0) {
            console.log(`Found ${finalUrls.length} potential cover art image(s).`);
            return finalUrls;
        }

        console.log("Could not retrieve final image URLs.");
        return null;

    } catch (error) {
        console.error(`An error occurred during the Wikipedia search for "${artist} - ${title}":`, error);
        return null;
    }
}