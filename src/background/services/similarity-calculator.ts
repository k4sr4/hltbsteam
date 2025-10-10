/**
 * Similarity Calculator
 *
 * Implements multiple string similarity algorithms for game title matching
 */

export class SimilarityCalculator {
  /**
   * Calculate Levenshtein (edit) distance between two strings
   * Measures the minimum number of single-character edits required to change one word into the other
   */
  levenshteinDistance(str1: string, str2: string): number {
    // Optimize for common cases
    if (str1 === str2) return 0;
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;

    const matrix: number[][] = [];

    // Initialize first column
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    // Initialize first row
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix with edit distances
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // Substitution
            matrix[i][j - 1] + 1,      // Insertion
            matrix[i - 1][j] + 1       // Deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate Levenshtein similarity (0-1 scale)
   */
  levenshteinSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Dice coefficient (bigram similarity)
   * Measures overlap of character pairs between two strings
   */
  diceCoefficient(str1: string, str2: string): number {
    // Handle edge cases
    if (str1 === str2) return 1.0;
    if (str1.length < 2 || str2.length < 2) return 0.0;

    const bigrams1 = this.getBigrams(str1);
    const bigrams2 = this.getBigrams(str2);

    if (bigrams1.length === 0 && bigrams2.length === 0) return 1.0;
    if (bigrams1.length === 0 || bigrams2.length === 0) return 0.0;

    // Count intersections
    const intersection = bigrams1.filter(bigram => bigrams2.includes(bigram));

    // Dice coefficient formula: 2 * |intersection| / (|set1| + |set2|)
    return (2.0 * intersection.length) / (bigrams1.length + bigrams2.length);
  }

  /**
   * Get all character bigrams from a string
   */
  private getBigrams(str: string): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
  }

  /**
   * Calculate Jaro similarity
   * Considers character matches and transpositions
   */
  jaro(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1.length || !str2.length) return 0.0;

    // Calculate match window (half the length of the longer string - 1)
    const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
    if (matchWindow < 1) return str1 === str2 ? 1.0 : 0.0;

    const matches1 = new Array(str1.length).fill(false);
    const matches2 = new Array(str2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < str1.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, str2.length);

      for (let j = start; j < end; j++) {
        if (matches2[j] || str1[i] !== str2[j]) continue;
        matches1[i] = matches2[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < str1.length; i++) {
      if (!matches1[i]) continue;
      while (!matches2[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    // Jaro formula: 1/3 * (m/s1 + m/s2 + (m-t)/m)
    return (
      (matches / str1.length +
        matches / str2.length +
        (matches - transpositions / 2) / matches) /
      3.0
    );
  }

  /**
   * Calculate Jaro-Winkler similarity
   * Jaro with prefix bonus
   */
  jaroWinkler(str1: string, str2: string, prefixScale: number = 0.1): number {
    const jaroScore = this.jaro(str1, str2);

    // Calculate common prefix length (max 4 characters)
    const prefixLength = this.commonPrefix(str1, str2, 4);

    // Jaro-Winkler formula: jaro + (prefix * scale * (1 - jaro))
    return jaroScore + prefixLength * prefixScale * (1.0 - jaroScore);
  }

  /**
   * Calculate length of common prefix
   */
  private commonPrefix(str1: string, str2: string, maxLength: number): number {
    const n = Math.min(str1.length, str2.length, maxLength);
    for (let i = 0; i < n; i++) {
      if (str1[i] !== str2[i]) return i;
    }
    return n;
  }

  /**
   * Calculate combined similarity score using multiple algorithms
   * Returns weighted average of Dice, Jaro-Winkler, and Levenshtein
   */
  combinedSimilarity(str1: string, str2: string): number {
    // Optimize for exact match
    if (str1 === str2) return 1.0;

    // Calculate individual scores
    const dice = this.diceCoefficient(str1, str2);
    const jaro = this.jaroWinkler(str1, str2);
    const lev = this.levenshteinSimilarity(str1, str2);

    // Weighted average (Jaro-Winkler has highest weight)
    // Dice: 30% - Good for partial matches
    // Jaro-Winkler: 40% - Good for typos and prefix matching
    // Levenshtein: 30% - Good for edit distance
    return dice * 0.3 + jaro * 0.4 + lev * 0.3;
  }

  /**
   * Calculate word-based similarity (Jaccard index)
   * Useful for comparing multi-word titles
   */
  wordSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 0));

    if (words1.size === 0 && words2.size === 0) return 1.0;
    if (words1.size === 0 || words2.size === 0) return 0.0;

    // Count intersection
    const intersection = [...words1].filter(word => words2.has(word)).length;

    // Jaccard index: |intersection| / |union|
    const union = words1.size + words2.size - intersection;
    return intersection / union;
  }

  /**
   * Calculate fuzzy similarity with multiple strategies
   * Returns the highest score from various approaches
   */
  fuzzyMatch(str1: string, str2: string): { score: number; method: string } {
    const scores = [
      { score: this.combinedSimilarity(str1, str2), method: 'combined' },
      { score: this.wordSimilarity(str1, str2), method: 'word' },
      { score: this.diceCoefficient(str1, str2), method: 'dice' },
      { score: this.jaroWinkler(str1, str2), method: 'jaro-winkler' }
    ];

    // Return the best score
    return scores.reduce((best, current) =>
      current.score > best.score ? current : best
    );
  }

  /**
   * Check if two strings are "close enough" based on threshold
   */
  isMatch(str1: string, str2: string, threshold: number = 0.8): boolean {
    return this.combinedSimilarity(str1, str2) >= threshold;
  }

  /**
   * Get similarity score as percentage string
   */
  getPercentage(str1: string, str2: string): string {
    const score = this.combinedSimilarity(str1, str2);
    return `${(score * 100).toFixed(1)}%`;
  }
}

// Export singleton instance
export const similarityCalculator = new SimilarityCalculator();