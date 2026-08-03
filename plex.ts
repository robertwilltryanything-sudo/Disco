export interface PlexConfig {
  serverHost: string;
  authToken: string;
}

const PLEX_CONFIG_KEY = 'disco_plex_config';

export function getPlexConfig(): PlexConfig {
  const saved = localStorage.getItem(PLEX_CONFIG_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
  }
  return {
    serverHost: '',
    authToken: '',
  };
}

export function savePlexConfig(config: PlexConfig): void {
  localStorage.setItem(PLEX_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Strips out edition information, remaster tags, year brackets, and disc numbers 
 * so Plexamp search matches the clean album title directly.
 */
export function cleanSearchString(str: string): string {
  if (!str) return '';
  return str
    .replace(/\(.*?\)/g, '') // remove parenthetical notes like (2009 Remaster), (Deluxe Version)
    .replace(/\[.*?\]/g, '') // remove bracketed notes like [Bonus Tracks]
    .replace(/ - .*(remaster|deluxe|edition|version|bonus|disc|cd).*/gi, '') // remove trailing " - Remastered 2011"
    .replace(/\b(remastered|deluxe edition|bonus track|special edition|expanded edition|anniversary edition|collector's edition|disc \d+|cd \d+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPlexampSearchUrl(artist: string, title?: string): string {
  const cleanArtist = cleanSearchString(artist);
  const cleanTitle = title ? cleanSearchString(title) : '';
  const query = cleanTitle ? `${cleanArtist} ${cleanTitle}` : cleanArtist;
  return `plexamp://search?query=${encodeURIComponent(query)}`;
}

export async function testPlexServerConnection(serverHost: string, authToken: string): Promise<{ success: boolean; message: string; name?: string }> {
  if (!serverHost) {
    return { success: false, message: 'Server Host URL is required' };
  }

  const cleanHost = serverHost.trim().replace(/\/+$/, '');
  const testUrl = `${cleanHost}/identity${authToken ? `?X-Plex-Token=${encodeURIComponent(authToken.trim())}` : ''}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, message: `Server returned HTTP ${res.status}. Check your URL or Token.` };
    }

    const text = await res.text();
    let name = 'Plex Media Server';
    if (text.includes('MediaContainer')) {
      const match = text.match(/claimed="([^"]+)"/) || text.match(/machineIdentifier="([^"]+)"/);
      if (match) name = `Plex Server (${match[1].substring(0, 8)})`;
    }
    
    return { success: true, message: 'Successfully connected to Plex Media Server!', name };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: 'Connection timed out. Ensure host IP is accessible and server is running.' };
    }
    return { success: false, message: `Could not reach Plex Server: ${err.message || 'Network error or CORS restriction'}` };
  }
}

