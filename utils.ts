
import { CD } from "./types";

/**
 * Capitalizes the first letter of each word in a string, and lowercases the rest.
 * @param str The input string.
 * @returns The capitalized string.
 */
export const capitalizeWords = (str: unknown): string => {
  if (Array.isArray(str)) {
    return str.map(s => capitalizeWords(s)).join(', ');
  }
  if (typeof str !== 'string' || !str) {
    return '';
  }
  return str.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

/**
 * Returns a deterministic Tailwind background color class based on the input string,
 * using the dashboard's color palette.
 */
export const getBrandColor = (str: string): string => {
    const colors = [
        'bg-sky-300',
        'bg-orange-200',
        'bg-yellow-200',
        'bg-pink-300',
        'bg-teal-200',
        'bg-indigo-200',
        'bg-rose-200',
        'bg-lime-200',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

/**
 * Calculates the Levenshtein distance between two strings.
 */
const levenshteinDistance = (s1: string, s2: string): number => {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
};

/**
 * Checks if two strings are similar based on Levenshtein distance.
 */
export const areStringsSimilar = (s1: string, s2: string, threshold = 0.85): boolean => {
    if (!s1 || !s2) return false;
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return true;
    const similarity = 1 - (distance / maxLength);
    return similarity >= threshold;
};

/**
 * Heuristically determines the "best" CD from a group of duplicates.
 */
export const getBestCD = (cds: CD[]): CD => {
  if (cds.length === 0) {
    throw new Error("Cannot get best CD from an empty array.");
  }
  if (cds.length === 1) {
    return cds[0];
  }

  const scoreCD = (cd: CD): number => {
    let score = 0;
    if (cd.cover_art_url) score += 100;
    if (cd.genre) score += 10;
    if (cd.year) score += 10;
    if (cd.record_label) score += 10;
    if (cd.version) score += 5;
    if (cd.notes) score += 5;
    if (cd.tags && cd.tags.length > 0) score += cd.tags.length;
    return score;
  };

  return cds.sort((a, b) => {
    const scoreA = scoreCD(a);
    const scoreB = scoreCD(b);
    if (scoreA !== scoreB) {
      return scoreB - scoreA; 
    }
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  })[0];
};

/**
 * Looks up whether an artist already has a defined sort_name in an items list (collection or wantlist).
 * Matches case-insensitively and trimmed.
 */
export const findDefinedArtistSortName = (
  artistName: string | undefined | null,
  items: Array<{ artist?: string; sort_name?: string }> = []
): string | undefined => {
  if (!artistName) return undefined;
  const clean = artistName.trim().toLowerCase();
  if (!clean) return undefined;

  const found = items.find(item => 
    (item.artist || '').trim().toLowerCase() === clean && 
    typeof item.sort_name === 'string' &&
    item.sort_name.trim().length > 0
  );

  return found?.sort_name?.trim();
};

/**
 * Checks whether an album or wantlist item has the custom tag "CD Single" (case-insensitive).
 */
export const isCdSingle = (item: { tags?: string[] } | null | undefined): boolean => {
  if (!item || !Array.isArray(item.tags)) return false;
  return item.tags.some(tag => {
    if (typeof tag !== 'string') return false;
    const clean = tag.trim().toLowerCase();
    return clean === 'cd single' || clean === 'cd-single' || clean === 'cdsingle';
  });
};

/**
 * Compares two strings using Swedish collation rules ('sv') so that
 * characters like Å, Ä, Ö (e.g. the letter Ä in the name 'Pärt')
 * sort after Z according to Swedish alphabetical order.
 * This guarantees that names like 'Pärt' are sorted last under their initial letter 'P'.
 */
export const compareStrings = (a: string | null | undefined, b: string | null | undefined): number => {
  const strA = (a || '').trim();
  const strB = (b || '').trim();
  if (strA === strB) return 0;
  if (!strA) return 1;
  if (!strB) return -1;
  return strA.localeCompare(strB, 'sv', { numeric: true, sensitivity: 'base' }) || 
         strA.localeCompare(strB, 'sv', { numeric: true });
};

/**
 * Checks whether an artist or sort_name string signifies "Various Artists",
 * including compilations, soundtracks, or common multi-artist designations.
 */
export const isVariousArtists = (name: string | null | undefined): boolean => {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim().toLowerCase();
  if (!clean) return false;

  // Direct matches
  if (
    clean === 'various artists' ||
    clean === 'various artist' ||
    clean === 'various' ||
    clean === 'v.a.' ||
    clean === 'v/a' ||
    clean === 'va' ||
    clean === 'soundtrack' ||
    clean === 'soundtracks' ||
    clean === 'original soundtrack' ||
    clean === 'original motion picture soundtrack' ||
    clean === 'ost' ||
    clean === 'diverse' ||
    clean === 'blandade artister'
  ) {
    return true;
  }

  // Prefix matches (e.g. "Various Artists - ...", "Soundtrack - ...")
  if (
    clean.startsWith('various artists') ||
    clean.startsWith('various artist') ||
    clean.startsWith('various -') ||
    clean.startsWith('various /') ||
    clean.startsWith('v/a ') ||
    clean.startsWith('v.a. ') ||
    clean.startsWith('soundtrack -') ||
    clean.startsWith('original soundtrack -') ||
    clean.startsWith('ost -') ||
    clean.startsWith('blandade artister')
  ) {
    return true;
  }

  return false;
};

/**
 * Checks whether an album or wantlist item belongs to the "Various Artists" category.
 */
export const isCdVariousArtists = (
  item: { artist?: string; sort_name?: string } | null | undefined
): boolean => {
  if (!item) return false;
  return isVariousArtists(item.sort_name) || isVariousArtists(item.artist);
};


