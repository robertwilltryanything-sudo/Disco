/**
 * NOTE: The MusicBrainz API cannot be reliably called directly from a web browser.
 * Their API policy requires a custom `User-Agent` header, which is a "forbidden header"
 * that browsers do not allow JavaScript to set for security reasons. Any attempt to
 * call the API without this header will be blocked by their servers.
 * 
 * The only way to use this API from a browser is through a complex OAuth2 flow or
 * by proxying requests through a backend server, neither of which are suitable for
 * this application's architecture.
 * 
 * Therefore, this function is now a placeholder. It will immediately return `null`,
 * allowing the application's logic in `AddCDForm.tsx` to seamlessly fall back to
 * the robust Wikipedia search implementation.
 *
 * For more details, see:
 * https://musicbrainz.org/doc/Development/XML_Web_Service/Rate_Limiting
 * https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name
 */
export async function findCoverArtFromMusicBrainz(_artist: string, _title: string, _version: string): Promise<string[] | null> {
    // This console warning is for developers to understand why the fallback is happening.
    console.warn("MusicBrainz search is disabled due to browser User-Agent limitations. Falling back to Wikipedia search.");
    return null;
}