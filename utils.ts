/**
 * Capitalizes the first letter of each word in a string, and lowercases the rest.
 * @param str The input string.
 * @returns The capitalized string.
 */
export const capitalizeWords = (str: string): string => {
  if (!str) return '';
  return str.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

/**
 * Calculates the Levenshtein distance between two strings.
 * @param s1 The first string.
 * @param s2 The second string.
 * @returns The Levenshtein distance.
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
 * @param s1 The first string.
 * @param s2 The second string.
 * @param threshold The similarity threshold (0 to 1). Defaults to 0.85.
 * @returns True if the strings are considered similar.
 */
export const areStringsSimilar = (s1: string, s2: string, threshold = 0.85): boolean => {
    if (!s1 || !s2) return false;
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return true;
    const similarity = 1 - (distance / maxLength);
    return similarity >= threshold;
};
