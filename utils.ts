
import { CD } from "./types";

/**
 * Capitalizes the first letter of each word in a string, and lowercases the rest.
 * @param str The input string.
 * @returns The capitalized string.
 */
export const capitalizeWords = (str: unknown): string => {
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
