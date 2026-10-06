import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export const PLEX_SERVER_ID = 'a28ad8bce9efafd6bb189ece805f9f280011caa3';

/**
 * Builds the verified direct Plex Web URL for an album by its plexKey.
 * E.g., for plexKey "104941" ->
 * https://app.plex.tv/desktop/#!/server/a28ad8bce9efafd6bb189ece805f9f280011caa3/details?key=%2Flibrary%2Fmetadata%2F104941
 */
export const buildPlexWebUrl = (plexKey?: string | null): string | null => {
  if (!plexKey) return null;
  const cleanKey = String(plexKey).trim();
  if (!cleanKey) return null;
  const metadataKey = cleanKey.startsWith('/library/metadata/')
    ? cleanKey
    : `/library/metadata/${cleanKey}`;
  return `https://app.plex.tv/desktop/#!/server/${PLEX_SERVER_ID}/details?key=${encodeURIComponent(metadataKey)}`;
};

interface PlexContextType {
  isAvailableInPlex: (artist?: string | null, title?: string | null) => boolean;
  getPlexUrl: (artist?: string | null, title?: string | null) => string | null;
  getPlexKey: (artist?: string | null, title?: string | null) => string | null;
  plexAlbumCount: number;
}

const PlexContext = createContext<PlexContextType>({
  isAvailableInPlex: () => false,
  getPlexUrl: () => null,
  getPlexKey: () => null,
  plexAlbumCount: 0,
});

export const usePlex = () => useContext(PlexContext);

interface PlexProviderProps {
  children: React.ReactNode;
  driveSignedIn: boolean;
  loadPlexData: () => Promise<Map<string, string> | null>;
}

export const PlexProvider: React.FC<PlexProviderProps> = ({ children, driveSignedIn, loadPlexData }) => {
  const [plexMap, setPlexMap] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!driveSignedIn) {
      setPlexMap(null);
      return;
    }

    loadPlexData()
      .then(map => {
        if (isMounted && map) {
          setPlexMap(map);
        }
      })
      .catch(() => {
        // Silently ignore: no error banner or interruption to Disco workflow
      });

    return () => {
      isMounted = false;
    };
  }, [driveSignedIn, loadPlexData]);

  // Exact matching: Disco artist === Plex artist AND Disco title === Plex title
  const isAvailableInPlex = useCallback((artist?: string | null, title?: string | null): boolean => {
    if (!plexMap || !artist || !title) return false;
    return plexMap.has(`${artist}:::${title}`);
  }, [plexMap]);

  const getPlexKey = useCallback((artist?: string | null, title?: string | null): string | null => {
    if (!plexMap || !artist || !title) return null;
    return plexMap.get(`${artist}:::${title}`) || null;
  }, [plexMap]);

  const getPlexUrl = useCallback((artist?: string | null, title?: string | null): string | null => {
    const key = getPlexKey(artist, title);
    return buildPlexWebUrl(key);
  }, [getPlexKey]);

  const value = useMemo(() => ({
    isAvailableInPlex,
    getPlexUrl,
    getPlexKey,
    plexAlbumCount: plexMap ? plexMap.size : 0,
  }), [isAvailableInPlex, getPlexUrl, getPlexKey, plexMap]);

  return (
    <PlexContext.Provider value={value}>
      {children}
    </PlexContext.Provider>
  );
};
