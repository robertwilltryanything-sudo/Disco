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
  needsTokenRefresh?: boolean;
  loadPlexData: () => Promise<Map<string, PlexAlbumRecord> | null>;
}

const normalizePlexText = (str: string): string => {
  return str
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u0060]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const normalizeArtistKey = (artist: string): string => {
  let norm = normalizePlexText(artist);
  // Handle "Beatles, The" -> "the beatles"
  const trailingTheMatch = norm.match(/^(.+),\s*the$/i);
  if (trailingTheMatch) {
    norm = `the ${trailingTheMatch[1].trim()}`;
  }
  return norm;
};

const stripLeadingThe = (text: string): string => {
  const match = text.match(/^the\s+(.+)$/i);
  return match ? match[1].trim() : text;
};

const EDITION_TAG_PATTERN = /\s*[\(\[](?:[^)\]]*\b(?:remaster(?:ed)?|deluxe|expanded|anniversary|edition|bonus|mono|stereo|mix|version|disc\s*\d+|cd\s*\d*|lp|vinyl|sacd|explicit|clean|reissue|legacy|collector'?s?|special|super|box\s*set|original)\b[^)\]]*|\d{4}(?:\s*remaster(?:ed)?)?)[\)\]]\s*$/i;

const stripEditionSuffix = (title: string): string => {
  let current = title.trim();
  while (EDITION_TAG_PATTERN.test(current)) {
    const next = current.replace(EDITION_TAG_PATTERN, '').trim();
    if (!next || next === current) break;
    current = next;
  }
  return current;
};

export const PlexProvider: React.FC<PlexProviderProps> = ({
  children,
  driveSignedIn,
  needsTokenRefresh = false,
  loadPlexData,
}) => {
  const [plexMap, setPlexMap] = useState<Map<string, PlexAlbumRecord> | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!driveSignedIn) {
      setPlexMap(null);
      return;
    }

    if (needsTokenRefresh) {
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
  }, [driveSignedIn, needsTokenRefresh, loadPlexData]);

  // Build normalized & edition-flexible lookup indices from the loaded exact map
  const { normalizedMap, flexibleMap } = useMemo(() => {
    const normMap = new Map<string, PlexAlbumRecord>();
    const flexMap = new Map<string, PlexAlbumRecord>();

    if (!plexMap) {
      return { normalizedMap: normMap, flexibleMap: flexMap };
    }

    for (const [exactKey, record] of plexMap.entries()) {
      const sepIdx = exactKey.indexOf(':::');
      if (sepIdx === -1) continue;
      const rawArtist = exactKey.slice(0, sepIdx);
      const rawTitle = exactKey.slice(sepIdx + 3);

      const normArtist = normalizeArtistKey(rawArtist);
      const normTitle = normalizePlexText(rawTitle);
      if (normArtist && normTitle) {
        const normKey = `${normArtist}:::${normTitle}`;
        if (!normMap.has(normKey)) {
          normMap.set(normKey, record);
        }

        const flexArtist = stripLeadingThe(normArtist);
        const flexTitle = stripLeadingThe(stripEditionSuffix(normTitle));
        if (flexArtist && flexTitle) {
          const flexKey = `${flexArtist}:::${flexTitle}`;
          if (!flexMap.has(flexKey)) {
            flexMap.set(flexKey, record);
          }
        }
      }
    }

    return { normalizedMap: normMap, flexibleMap: flexMap };
  }, [plexMap]);

  const findPlexRecord = useCallback((artist?: string | null, title?: string | null): PlexAlbumRecord | null => {
    if (!plexMap || !artist || !title) return null;

    // 1. Exact match (highest priority)
    const exact = plexMap.get(`${artist}:::${title}`);
    if (exact) return exact;

    // 2. Normalized match (case, whitespace, quotes/dashes, accents, &, "Artist, The")
    const normArtist = normalizeArtistKey(artist);
    const normTitle = normalizePlexText(title);
    if (normArtist && normTitle) {
      const normalized = normalizedMap.get(`${normArtist}:::${normTitle}`);
      if (normalized) return normalized;

      // 3. Edition-stripped & leading-"The" flexible match
      const flexArtist = stripLeadingThe(normArtist);
      const flexTitle = stripLeadingThe(stripEditionSuffix(normTitle));
      if (flexArtist && flexTitle) {
        const flexible = flexibleMap.get(`${flexArtist}:::${flexTitle}`);
        if (flexible) return flexible;
      }
    }

    return null;
  }, [plexMap, normalizedMap, flexibleMap]);

  const isAvailableInPlex = useCallback((artist?: string | null, title?: string | null): boolean => {
    return findPlexRecord(artist, title) !== null;
  }, [findPlexRecord]);

  const getPlexKey = useCallback((artist?: string | null, title?: string | null): string | null => {
    return findPlexRecord(artist, title)?.plexKey || null;
  }, [findPlexRecord]);

  const getPlexGuid = useCallback((artist?: string | null, title?: string | null): string | null => {
    return findPlexRecord(artist, title)?.plexGuid || null;
  }, [findPlexRecord]);

  const getPlexRecord = useCallback((artist?: string | null, title?: string | null): PlexAlbumRecord | null => {
    return findPlexRecord(artist, title);
  }, [findPlexRecord]);

  const getPlexUrl = useCallback((artist?: string | null, title?: string | null): string | null => {
    const record = findPlexRecord(artist, title);
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
  }, [findPlexRecord]);

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
