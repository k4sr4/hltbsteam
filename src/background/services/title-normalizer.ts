/**
 * Title Normalizer
 *
 * Provides multiple levels of game title normalization to handle
 * variations between Steam and HLTB titles.
 */

export type NormalizationLevel = 'minimal' | 'standard' | 'aggressive';

export class TitleNormalizer {
  private readonly SPECIAL_CHARS = /[®™©]/g;
  private readonly PUNCTUATION = /[:'"\-–—]/g;
  private readonly WHITESPACE = /\s+/g;
  private readonly ARTICLES = /^(the|a|an)\s+/i;

  /**
   * Normalize a game title with specified level
   */
  normalize(title: string, level: NormalizationLevel = 'standard'): string {
    if (!title) return '';

    let normalized = title;

    switch (level) {
      case 'minimal':
        // Just basic cleanup
        normalized = this.removeSpecialChars(normalized);
        normalized = this.normalizeWhitespace(normalized);
        normalized = this.toLowerCase(normalized);
        break;

      case 'standard':
        // Standard normalization
        normalized = this.removeSpecialChars(normalized);
        normalized = this.removePunctuation(normalized);
        normalized = this.normalizeWhitespace(normalized);
        normalized = this.toLowerCase(normalized);
        break;

      case 'aggressive':
        // Maximum normalization
        normalized = this.removeSpecialChars(normalized);
        normalized = this.removePunctuation(normalized);
        normalized = this.removeArticles(normalized);
        normalized = this.removeSubtitles(normalized);
        normalized = this.removeEditions(normalized);
        normalized = this.expandAcronyms(normalized);
        normalized = this.normalizeNumbers(normalized);
        normalized = this.normalizeWhitespace(normalized);
        normalized = this.toLowerCase(normalized);
        break;
    }

    return normalized.trim();
  }

  /**
   * Remove special trademark/copyright symbols
   */
  private removeSpecialChars(title: string): string {
    return title.replace(this.SPECIAL_CHARS, '');
  }

  /**
   * Remove or normalize punctuation
   */
  private removePunctuation(title: string): string {
    return title.replace(this.PUNCTUATION, ' ');
  }

  /**
   * Normalize whitespace to single spaces
   */
  private normalizeWhitespace(title: string): string {
    return title.replace(this.WHITESPACE, ' ');
  }

  /**
   * Convert to lowercase
   */
  private toLowerCase(title: string): string {
    return title.toLowerCase();
  }

  /**
   * Remove leading articles (the, a, an)
   */
  private removeArticles(title: string): string {
    return title.replace(this.ARTICLES, '');
  }

  /**
   * Remove subtitles (everything after : or – or -)
   */
  private removeSubtitles(title: string): string {
    // Match everything before the first colon or long dash
    const match = title.match(/^([^:–\-]+)/);
    return match ? match[1].trim() : title;
  }

  /**
   * Remove edition suffixes
   */
  private removeEditions(title: string): string {
    const editions = [
      'game of the year edition',
      'goty edition',
      'goty',
      'definitive edition',
      'enhanced edition',
      'special edition',
      'deluxe edition',
      'ultimate edition',
      'complete edition',
      'collectors edition',
      'gold edition',
      'platinum edition',
      'remastered',
      'remake',
      'directors cut',
      'digital deluxe'
    ];

    let result = title.toLowerCase();

    editions.forEach(edition => {
      // Remove edition with optional preceding dash or space
      const regex = new RegExp(`\\s*[-–]?\\s*${edition}\\s*$`, 'gi');
      result = result.replace(regex, '');
    });

    return result.trim();
  }

  /**
   * Expand common gaming acronyms to full titles
   */
  private expandAcronyms(title: string): string {
    const acronyms: Record<string, string> = {
      'cs:go': 'counter strike global offensive',
      'csgo': 'counter strike global offensive',
      'cs go': 'counter strike global offensive',
      'pubg': 'playerunknowns battlegrounds',
      'gta': 'grand theft auto',
      'cod': 'call of duty',
      'bf': 'battlefield',
      'r6': 'rainbow six',
      'r6s': 'rainbow six siege',
      'dota': 'defense of the ancients',
      'tf2': 'team fortress 2',
      'mw': 'modern warfare',
      'mw2': 'modern warfare 2',
      'mw3': 'modern warfare 3',
      'bo': 'black ops',
      'bo2': 'black ops 2',
      'bo3': 'black ops 3',
      'bo4': 'black ops 4'
    };

    const lower = title.toLowerCase().trim();

    // Check for exact acronym match
    if (acronyms[lower]) {
      return acronyms[lower];
    }

    // Check if title starts with acronym
    for (const [acronym, expanded] of Object.entries(acronyms)) {
      if (lower.startsWith(acronym + ' ') || lower.startsWith(acronym + ':')) {
        return title.replace(new RegExp(`^${acronym}`, 'i'), expanded);
      }
    }

    return title;
  }

  /**
   * Normalize numbers and Roman numerals
   */
  private normalizeNumbers(title: string): string {
    // Roman numerals to Arabic conversion
    const romanNumerals: Record<string, string> = {
      ' ii': ' 2',
      ' iii': ' 3',
      ' iv': ' 4',
      ' v': ' 5',
      ' vi': ' 6',
      ' vii': ' 7',
      ' viii': ' 8',
      ' ix': ' 9',
      ' x': ' 10',
      ' xi': ' 11',
      ' xii': ' 12'
    };

    let result = title.toLowerCase();

    // Convert Roman numerals to Arabic numbers
    Object.entries(romanNumerals).forEach(([roman, arabic]) => {
      // Match Roman numeral at word boundary
      result = result.replace(new RegExp(roman + '(?=\\s|$)', 'gi'), arabic);
    });

    // Also handle written numbers to digits
    const writtenNumbers: Record<string, string> = {
      ' one': ' 1',
      ' two': ' 2',
      ' three': ' 3',
      ' four': ' 4',
      ' five': ' 5',
      ' six': ' 6',
      ' seven': ' 7',
      ' eight': ' 8',
      ' nine': ' 9',
      ' ten': ' 10'
    };

    Object.entries(writtenNumbers).forEach(([written, digit]) => {
      result = result.replace(new RegExp(written + '(?=\\s|$)', 'gi'), digit);
    });

    return result;
  }

  /**
   * Get core title components for matching
   */
  getCoreWords(title: string, minLength: number = 3): string[] {
    const normalized = this.normalize(title, 'standard');
    return normalized
      .split(' ')
      .filter(word => word.length >= minLength)
      .filter(word => !this.isCommonWord(word));
  }

  /**
   * Check if word is a common/stop word
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at',
      'to', 'for', 'with', 'from', 'by', 'as', 'is', 'was',
      'edition', 'game', 'collection'
    ]);

    return commonWords.has(word.toLowerCase());
  }

  /**
   * Extract year from title if present
   */
  extractYear(title: string): number | null {
    // Match year in parentheses: (2016), (2022), etc.
    const yearMatch = title.match(/\((\d{4})\)/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 1980 && year <= new Date().getFullYear() + 2) {
        return year;
      }
    }
    return null;
  }

  /**
   * Remove year from title
   */
  removeYear(title: string): string {
    return title.replace(/\s*\(\d{4}\)\s*/g, ' ').trim();
  }

  /**
   * Normalize ampersands
   */
  normalizeAmpersands(title: string): string {
    return title.replace(/\s*&\s*/g, ' and ');
  }
}

// Export singleton instance
export const titleNormalizer = new TitleNormalizer();