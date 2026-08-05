export type PlexLinkFormat = 'listen_plex' | 'plexamp_app' | 'app_plex_web' | 'local_server';

export interface PlexConfig {
  serverHost: string;
  authToken: string;
  linkFormat?: PlexLinkFormat;
}

const PLEX_CONFIG_KEY = 'disco_plex_config';

export function getPlexConfig(): PlexConfig {
  const saved = localStorage.getItem(PLEX_CONFIG_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        serverHost: parsed.serverHost || '',
        authToken: parsed.authToken || '',
        linkFormat: parsed.linkFormat || 'plexamp_app',
      };
    } catch (e) {
      // ignore
    }
  }
  return {
    serverHost: '',
    authToken: '',
    linkFormat: 'plexamp_app',
  };
}

export function savePlexConfig(config: PlexConfig): void {
  localStorage.setItem(PLEX_CONFIG_KEY, JSON.stringify(config));
}

export function extractRatingKeyFromUrl(url: string): string | null {
  if (!url) return null;
  const decoded = decodeURIComponent(url);

  // Match ratingKey=12345
  const matchRatingKey = decoded.match(/ratingKey=(\d+)/i);
  if (matchRatingKey) return matchRatingKey[1];

  // Match /library/metadata/12345
  const matchMetadata = decoded.match(/\/library\/metadata\/(\d+)/i);
  if (matchMetadata) return matchMetadata[1];

  // Match /album/12345 or /item/12345 or /metadata/12345
  const matchPath = decoded.match(/\/(?:album|item|metadata)\/(\d+)/i);
  if (matchPath) return matchPath[1];

  return null;
}

export function extractMachineIdFromUrl(url: string): string | null {
  if (!url) return null;
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/\/server\/([a-f0-9]+)\//i);
  return match ? match[1] : null;
}

export function formatPlexUrl(
  ratingKey: string,
  format: PlexLinkFormat = 'plexamp_app',
  machineIdentifier?: string,
  serverHost?: string
): string {
  switch (format) {
    case 'plexamp_app':
      return `plexamp://album?ratingKey=${ratingKey}`;
    case 'listen_plex':
      return `https://listen.plex.tv/album?ratingKey=${ratingKey}`;
    case 'app_plex_web':
      if (machineIdentifier) {
        return `https://app.plex.tv/desktop#!/server/${machineIdentifier}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`;
      }
      return `plexamp://album?ratingKey=${ratingKey}`;
    case 'local_server':
      if (serverHost && machineIdentifier) {
        const cleanHost = serverHost.trim().replace(/\/+$/, '');
        return `${cleanHost}/web/index.html#!/server/${machineIdentifier}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`;
      }
      return `plexamp://album?ratingKey=${ratingKey}`;
    default:
      return `plexamp://album?ratingKey=${ratingKey}`;
  }
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
  const config = getPlexConfig();
  const targetFormat = config.linkFormat || 'plexamp_app';

  if (customPlexUrl && customPlexUrl.trim()) {
    const trimmed = customPlexUrl.trim();
    if (trimmed.startsWith('plexamp://')) {
      return trimmed;
    }
    const ratingKey = extractRatingKeyFromUrl(trimmed);
    if (ratingKey) {
      const machineId = extractMachineIdFromUrl(trimmed);
      return formatPlexUrl(ratingKey, targetFormat, machineId || undefined, serverHost || config.serverHost);
    }
    return trimmed;
  }
  const query = getPlexampSearchQuery(artist, title);
  if (targetFormat === 'plexamp_app') {
    return `plexamp://search?query=${encodeURIComponent(query)}`;
  }
  if (serverHost && serverHost.trim()) {
    const cleanHost = serverHost.trim().replace(/\/+$/, '');
    return `${cleanHost}/web/index.html#!/search?query=${encodeURIComponent(query)}`;
  }
  return `plexamp://search?query=${encodeURIComponent(query)}`;
}

export interface PlexSearchResult {
  ratingKey: string;
  machineIdentifier?: string;
  title: string;
  artist?: string;
  type: 'album' | 'artist';
  bestPlexUrl: string;
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

      const bestPlexUrl = formatPlexUrl(ratingKey, config.linkFormat || 'plexamp_app', machineIdentifier, cleanHost);

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
        bestPlexUrl,
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

export interface DiscoveredPlexServer {
  name: string;
  clientIdentifier: string;
  connections: { uri: string; local: boolean; protocol: string; address: string; port: number }[];
  bestSecureUrl?: string;
}

export async function discoverPlexServersFromPlexTv(authToken: string): Promise<DiscoveredPlexServer[]> {
  if (!authToken || !authToken.trim()) {
    throw new Error('X-Plex-Token is required to discover your Plex Media Server URLs');
  }
  const token = authToken.trim();
  
  try {
    const res = await fetch(`https://plex.tv/api/v2/resources?includeHttps=1&X-Plex-Token=${encodeURIComponent(token)}`, {
      headers: {
        'Accept': 'application/json',
        'X-Plex-Client-Identifier': 'disco-music-app',
        'X-Plex-Product': 'Disco Music Manager',
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Invalid X-Plex-Token. Please check your token and try again.');
      }
      throw new Error(`plex.tv returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    const servers: DiscoveredPlexServer[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.provides && item.provides.includes('server')) {
          const rawConns = item.connections || [];
          const connections = rawConns.map((c: any) => ({
            uri: c.uri,
            local: !!c.local,
            protocol: c.protocol || 'http',
            address: c.address,
            port: c.port,
          }));

          // Pick best secure HTTPS connection (preferably local https or public https)
          const secureConns = connections.filter((c: any) => c.uri.startsWith('https://'));
          const bestSecureUrl = secureConns.find((c: any) => c.local)?.uri || secureConns[0]?.uri || connections[0]?.uri;

          servers.push({
            name: item.name || 'Plex Media Server',
            clientIdentifier: item.clientIdentifier,
            connections,
            bestSecureUrl,
          });
        }
      }
    }
    return servers;
  } catch (err: any) {
    console.warn('Failed to discover Plex servers from plex.tv:', err);
    throw new Error(err.message || 'Failed to fetch servers from plex.tv');
  }
}

export async function testPlexServerConnection(serverHost: string, authToken: string): Promise<{ success: boolean; message: string; name?: string }> {
  if (!serverHost) {
    return { success: false, message: 'Server Host URL is required' };
  }

  const cleanHost = serverHost.trim().replace(/\/+$/, '');
  const isAppHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isServerHttp = cleanHost.startsWith('http://');

  if (isAppHttps && isServerHttp) {
    return {
      success: false,
      message: 'Browser restriction: This app is on HTTPS, so browsers block unencrypted http:// local server calls (Mixed Content). Use your secure Plex URL (e.g. https://...plex.direct:32400 or HTTPS remote address) or your X-Plex-Token.'
    };
  }

  const testUrl = `${cleanHost}/identity${authToken ? `?X-Plex-Token=${encodeURIComponent(authToken.trim())}` : ''}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

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
      return { 
        success: false, 
        message: 'Connection timed out. Ensure host URL is accessible from your network. If using a local IP (192.168.x.x), use your secure Plex HTTPS URL (https://[ip-with-dashes].[hash].plex.direct:32400).' 
      };
    }
    return { success: false, message: `Could not reach Plex Server: ${err.message || 'Network error or CORS restriction'}` };
  }
}

