export interface PlexConfig {
  serverHost: string;
  authToken: string;
  preferredPlayer: 'plexamp' | 'plex_web';
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
    preferredPlayer: 'plexamp',
  };
}

export function savePlexConfig(config: PlexConfig): void {
  localStorage.setItem(PLEX_CONFIG_KEY, JSON.stringify(config));
}

export function getPlexampSearchUrl(artist: string, title?: string): string {
  const query = title ? `${artist} ${title}` : artist;
  return `plexamp://search?query=${encodeURIComponent(query)}`;
}

export function getPlexWebSearchUrl(artist: string, title?: string, serverHost?: string): string {
  const query = title ? `${artist} ${title}` : artist;
  if (serverHost && serverHost.trim()) {
    const cleanHost = serverHost.trim().replace(/\/+$/, '');
    return `${cleanHost}/web/index.html#!/search?query=${encodeURIComponent(query)}`;
  }
  return `https://app.plex.tv/desktop#!/search?query=${encodeURIComponent(query)}`;
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
    // Parse name from JSON or XML if needed
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
