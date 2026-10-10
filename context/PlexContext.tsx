import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export const PLEX_SERVER_ID = 'a28ad8bce9efafd6bb189ece805f9f280011caa3';

export interface PlexAlbumRecord {
  plexKey: string;
  plexGuid?: string;
  lastPlayedAt?: string | number | null;
  playCount?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Formats a Plex date value safely into an unambiguous English date string, e.g. "29 May 2026".
 * Returns null if the value is missing or unparseable.
 */
export const formatPlexDate = (val?: string | number | null): string | null => {
  if (val == null || val === '') return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Handle pure YYYY-MM-DD strings without timezone shift
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const year = dateMatch[1];
      const mIdx = parseInt(dateMatch[2], 10) - 1;
      const day = parseInt(dateMatch[3], 10);
      if (mIdx >= 0 && mIdx < 12 && day >= 1 && day <= 31) {
        return `${day} ${MONTH_NAMES[mIdx]} ${year}`;
      }
    }
  }

  let d: Date;
  if (typeof val === 'number') {
    d = new Date(val < 10000000000 ? val * 1000 : val);
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      d = new Date(num < 10000000000 ? num * 1000 : num);
    } else {
      d = new Date(trimmed);
    }
  } else {
    d = new Date(val);
  }

  if (isNaN(d.getTime())) return null;

  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

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

/**
 * Builds the verified direct Plexamp URL for an album by its plexGuid.
 * E.g., for plexGuid "plex://album/5d07c193403c640290857c55" ->
 * https://listen.plex.tv/album/5d07c193403c640290857c55
 */
export const buildPlexampUrl = (plexGuid?: string | null): string | null => {
  if (!plexGuid) return null;
  const cleanGuid = String(plexGuid).trim();
  if (!cleanGuid) return null;
  const albumId = cleanGuid.replace(/^plex:\/\/album\//, '').trim();
  if (!albumId) return null;
  return `https://listen.plex.tv/album/${albumId}`;
};

/**
 * Detects iPhone, iPad, iPod, and iPadOS devices (including desktop-mode iPad Safari).
 */
export const isAppleMobileDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';

  // Explicit iPhone, iPad, iPod in user agent
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return true;
  }

  // iPadOS 13+ desktop-class Safari detection:
  // Reports Mac user agent/platform, but has multi-touch capability
  if ((platform === 'MacIntel' || /Macintosh/i.test(userAgent)) &&
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1) {
    return true;
  }

  return false;
};

export const PLEX_TARGET_NAME = 'disco-plex';

/**
 * Returns 'disco-plex' on desktop to reuse the single Plex Web tab,
 * and '_blank' on Apple mobile devices for Plexamp.
 */
export const getPlexLinkTarget = (): string => {
  return isAppleMobileDevice() ? '_blank' : PLEX_TARGET_NAME;
};

/**
 * For named target 'disco-plex' on desktop, omit rel="noopener noreferrer"
 * because noopener/noreferrer causes modern browsers to treat it as a new
 * isolated context and prevents reusing the named tab.
 * On Apple mobile devices targeting '_blank' for Plexamp, use 'noopener noreferrer'.
 */
export const getPlexLinkRel = (): string | undefined => {
  return isAppleMobileDevice() ? 'noopener noreferrer' : undefined;
};

interface PlexContextType {
  isAvailableInPlex: (artist?: string | null, title?: string | null) => boolean;
  getPlexUrl: (artist?: string | null, title?: string | null) => string | null;
  getPlexKey: (artist?: string | null, title?: string | null) => string | null;
  getPlexGuid: (artist?: string | null, title?: string | null) => string | null;
  getPlexRecord: (artist?: string | null, title?: string | null) => PlexAlbumRecord | null;
  getPlexTarget: () => string;
  getPlexRel: () => string | undefined;
  plexAlbumCount: number;
}

const PlexContext = createContext<PlexContextType>({
  isAvailableInPlex: () => false,
  getPlexUrl: () => null,
  getPlexKey: () => null,
  getPlexGuid: () => null,
  getPlexRecord: () => null,
  getPlexTarget: () => PLEX_TARGET_NAME,
  getPlexRel: () => undefined,
  plexAlbumCount: 0,
});

export const usePlex = () => useContext(PlexContext);

interface PlexProviderProps {
  children: React.ReactNode;
  driveSignedIn: boolean;
  loadPlexData: () => Promise<Map<string, PlexAlbumRecord> | null>;
}

export const PlexProvider: React.FC<PlexProviderProps> = ({ children, driveSignedIn, loadPlexData }) => {
  const [plexMap, setPlexMap] = useState<Map<string, PlexAlbumRecord> | null>(null);

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
    return plexMap.get(`${artist}:::${title}`)?.plexKey || null;
  }, [plexMap]);

  const getPlexGuid = useCallback((artist?: string | null, title?: string | null): string | null => {
    if (!plexMap || !artist || !title) return null;
    return plexMap.get(`${artist}:::${title}`)?.plexGuid || null;
  }, [plexMap]);

  const getPlexRecord = useCallback((artist?: string | null, title?: string | null): PlexAlbumRecord | null => {
    if (!plexMap || !artist || !title) return null;
    return plexMap.get(`${artist}:::${title}`) || null;
  }, [plexMap]);

  const getPlexUrl = useCallback((artist?: string | null, title?: string | null): string | null => {
    if (!plexMap || !artist || !title) return null;
    const record = plexMap.get(`${artist}:::${title}`);
    if (!record) return null;

    // Mobile (iPhone / iPad / iPod): open in Plexamp using listen.plex.tv/album/<guid>
    if (isAppleMobileDevice()) {
      const mobileUrl = buildPlexampUrl(record.plexGuid);
      if (mobileUrl) {
        return mobileUrl;
      }
      // If a matching album has no plexGuid, fall back to the existing Plex Web URL rather than generating an invalid mobile URL.
    }

    // Desktop: open in Plex Web using existing server ID and plexKey
    return buildPlexWebUrl(record.plexKey);
  }, [plexMap]);

  const value = useMemo(() => ({
    isAvailableInPlex,
    getPlexUrl,
    getPlexKey,
    getPlexGuid,
    getPlexRecord,
    getPlexTarget: getPlexLinkTarget,
    getPlexRel: getPlexLinkRel,
    plexAlbumCount: plexMap ? plexMap.size : 0,
  }), [isAvailableInPlex, getPlexUrl, getPlexKey, getPlexGuid, getPlexRecord, plexMap]);

  return (
    <PlexContext.Provider value={value}>
      {children}
    </PlexContext.Provider>
  );
};
