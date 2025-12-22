/**
 * Searches Wikipedia for a relevant article title.
 * @param artist The artist's name.
 * @param title The album's title.
 * @returns A promise that resolves to the article title or null.
 */
async function searchWikipediaForArticle(artist: string, title: string): Promise<string | null> {
    const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
    
    // Multiple variations of search terms to increase hit rate
    const searchTerms: string[] = [
        `${title} (${artist} album)`,
        `${title} (album)`,
        `${artist} ${title}`,
        title,
    ];

    for (const term of searchTerms) {
        const params = new URLSearchParams({
            action: 'query',
            list: 'search',
            srsearch: term,
            srlimit: '3', // Check top 3 results to bypass disambiguations
            format: 'json',
            origin: '*'
        });

        try {
            const response = await fetch(`${WIKIPEDIA_API_ENDPOINT}?${params}`);
            if (!response.ok) continue;
            const data = await response.json();

            if (data.query.search.length > 0) {
                // Filter out common non-album pages like "List of..." or disambiguations
                const bestMatch = data.query.search.find((res: any) => 
                    !res.title.toLowerCase().includes('discography') && 
                    !res.title.toLowerCase().includes('(disambiguation)')
                );
                if (bestMatch) return bestMatch.title;
                return data.query.search[0].title;
            }
        } catch (error) {
            console.error(`Error searching Wikipedia for term "${term}":`, error);
        }
    }

    // Fallback using opensearch
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
    // Look for cover in album/release infoboxes
    const coverRegex = /\|\s*cover\s*=\s*(.+?)\n/i;
    const match = wikitext.match(coverRegex);
    
    if (match && match[1]) {
        let filename = match[1].trim();
        filename = filename.replace(/\[\[(?:File:)?|\]\]/g, '');
        filename = filename.split('|')[0].trim();

        if (filename && !filename.includes('{{')) { // Skip templates
            return filename.startsWith('File:') ? filename : `File:${filename}`;
        }
    }
    
    return null;
}

/**
 * Retrieves all image filenames used on a given Wikipedia page.
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
 * Gets a full, sized image URL from a file title.
 */
async function getImageUrlFromFileTitle(fileTitle: string): Promise<string | null> {
    const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
        action: 'query',
        titles: fileTitle,
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '800', // High res for better display
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
 */
export async function findCoverArt(artist: string, title: string): Promise<string[] | null> {
    try {
        const articleTitle = await searchWikipediaForArticle(artist, title);
        if (!articleTitle) return null;

        const [infoboxCover, allImages] = await Promise.all([
            getCoverFilenameFromInfobox(articleTitle),
            getAllImageFilesFromArticle(articleTitle)
        ]);

        const candidateFiles = new Set(allImages);
        if (infoboxCover) candidateFiles.add(infoboxCover);
        
        if (candidateFiles.size === 0) return null;

        const lowerCaseTitle = title.toLowerCase();
        const lowerCaseArtist = artist.toLowerCase();
        
        const rankedImages = Array.from(candidateFiles)
            .map(fileTitle => {
                const lowerCaseFile = fileTitle.toLowerCase();
                let score = 5; // Base score for any valid image

                // Exclude obvious non-covers
                if (lowerCaseFile.endsWith('.svg') || lowerCaseFile.includes('logo') || lowerCaseFile.includes('icon')) {
                    return { fileTitle, score: -1 };
                }
                if (!/\.(png|jpg|jpeg|webp|gif)$/.test(lowerCaseFile)) {
                     return { fileTitle, score: -1 };
                }

                // High priority for infobox items
                if (fileTitle === infoboxCover) score += 100; 
                
                // Content-based boosts
                if (lowerCaseFile.includes('cover')) score += 50;
                if (lowerCaseFile.includes('artwork')) score += 30;
                if (lowerCaseFile.includes('front')) score += 20;

                // Relevance-based boosts
                if (lowerCaseFile.includes(lowerCaseTitle.replace(/ /g, '_'))) score += 40;
                if (lowerCaseFile.includes(lowerCaseArtist.replace(/ /g, '_'))) score += 10;

                return { fileTitle, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);

        if (rankedImages.length === 0) return null;

        const topCandidates = rankedImages.slice(0, 10).map(item => item.fileTitle);
        const urlPromises = topCandidates.map(getImageUrlFromFileTitle);
        const urls = await Promise.all(urlPromises);
        
        const finalUrls = [...new Set(urls.filter((url): url is string => url !== null))];
        return finalUrls.length > 0 ? finalUrls : null;

    } catch (error) {
        console.error(`Wikipedia search failed:`, error);
        return null;
    }
}