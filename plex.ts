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

export function getPlexampSearchQuery(artist: string, title?: string): string {
  const cleanArtist = cleanSearchString(artist);
  const cleanTitle = title ? cleanSearchString(title) : '';
  return cleanTitle ? `${cleanArtist} ${cleanTitle}` : cleanArtist;
}

export function getPlexampSearchUrl(artist: string, title?: string): string {
  const query = getPlexampSearchQuery(artist, title);
  return `plexamp://search?query=${encodeURIComponent(query)}`;
}

export function getPlexWebSearchUrl(artist: string, title?: string, serverHost?: string, customPlexUrl?: string): string {
  if (customPlexUrl && customPlexUrl.trim()) {
    return customPlexUrl.trim();
  }
  const query = getPlexampSearchQuery(artist, title);
  if (serverHost && serverHost.trim()) {
    const cleanHost = serverHost.trim().replace(/\/+$/, '');
    return `${cleanHost}/web/index.html#!/search?query=${encodeURIComponent(query)}`;
  }
  return `https://app.plex.tv/desktop#!/search?query=${encodeURIComponent(query)}`;
}

export interface PlexSearchResult {
  ratingKey: string;
  machineIdentifier?: string;
  title: string;
  artist?: string;
  type: 'album' | 'artist';
  webUrl: string;
  hostedWebUrl?: string;
  deepLinkUrl?: string;
}

export async function searchPlexLibrary(artist: string, title?: string): Promise<PlexSearchResult | null> {
  const config = getPlexConfig();
  if (!config.serverHost) return null;

  const cleanHost = config.serverHost.trim().replace(/\/+$/, '');
  const token = config.authToken.trim();

  try {
    let machineIdentifier = '';
    try {
      const idRes = await fetch(`${cleanHost}/identity${token ? `?X-Plex-Token=${encodeURIComponent(token)}` : ''}`, {
        headers: { Accept: 'application/json' }
      });
      if (idRes.ok) {
        const idData = await idRes.json();
        machineIdentifier = idData?.MediaContainer?.machineIdentifier || '';
      }
    } catch (e) {
      // ignore
    }

    const query = getPlexampSearchQuery(artist, title);
    const searchUrl = `${cleanHost}/hubs/search?query=${encodeURIComponent(query)}&limit=5${token ? `&X-Plex-Token=${encodeURIComponent(token)}` : ''}`;

    const res = await fetch(searchUrl, {
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const hubs = data?.MediaContainer?.Hub || [];

    const targetType = title ? 'album' : 'artist';
    const hub = hubs.find((h: any) => h.type === targetType) || hubs.find((h: any) => h.type === 'album' || h.type === 'artist');

    if (hub && hub.Metadata && hub.Metadata.length > 0) {
      const item = hub.Metadata[0];
      const ratingKey = item.ratingKey;

      const webUrl = machineIdentifier
        ? `${cleanHost}/web/index.html#!/server/${machineIdentifier}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`
        : `${cleanHost}/web/index.html#!/search?query=${encodeURIComponent(query)}`;

      const hostedWebUrl = machineIdentifier
        ? `https://app.plex.tv/desktop#!/server/${machineIdentifier}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`
        : `https://app.plex.tv/desktop#!/search?query=${encodeURIComponent(query)}`;

      const deepLinkUrl = machineIdentifier
        ? `plex://server/${machineIdentifier}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`
        : undefined;

      return {
        ratingKey,
        machineIdentifier,
        title: item.title,
        artist: item.parentTitle || item.grandparentTitle || artist,
        type: item.type === 'artist' ? 'artist' : 'album',
        webUrl,
        hostedWebUrl,
        deepLinkUrl,
      };
    }
  } catch (err) {
    console.warn('Plex library search check failed or CORS blocked:', err);
  }

  return null;
}

export async function openInPlexamp(artist: string, title?: string): Promise<{ query: string; copied: boolean }> {
  const query = getPlexampSearchQuery(artist, title);
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(query);
      copied = true;
    }
  } catch (e) {
    // ignore clipboard permission errors
  }

  // Launch plexamp protocol safely without navigating the current web page away
  const url = getPlexampSearchUrl(artist, title);
  const link = document.createElement('a');
  link.href = url;
  link.click();

  return { query, copied };
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

