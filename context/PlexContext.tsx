import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface PlexContextType {
  isAvailableInPlex: (artist?: string | null, title?: string | null) => boolean;
  plexAlbumCount: number;
}

const PlexContext = createContext<PlexContextType>({
  isAvailableInPlex: () => false,
  plexAlbumCount: 0,
});

export const usePlex = () => useContext(PlexContext);

interface PlexProviderProps {
  children: React.ReactNode;
  driveSignedIn: boolean;
  loadPlexData: () => Promise<Set<string> | null>;
}

export const PlexProvider: React.FC<PlexProviderProps> = ({ children, driveSignedIn, loadPlexData }) => {
  const [plexSet, setPlexSet] = useState<Set<string> | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!driveSignedIn) {
      setPlexSet(null);
      return;
    }

    loadPlexData()
      .then(set => {
        if (isMounted && set) {
          setPlexSet(set);
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
    if (!plexSet || !artist || !title) return false;
    return plexSet.has(`${artist}:::${title}`);
  }, [plexSet]);

  const value = useMemo(() => ({
    isAvailableInPlex,
    plexAlbumCount: plexSet ? plexSet.size : 0,
  }), [isAvailableInPlex, plexSet]);

  return (
    <PlexContext.Provider value={value}>
      {children}
    </PlexContext.Provider>
  );
};
