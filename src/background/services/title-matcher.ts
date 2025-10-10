/**
 * Title Matcher
 *
 * Orchestrates multiple matching strategies to find the best HLTB match
 * for a given Steam game title.
 */

import { TitleNormalizer } from './title-normalizer';
import { SimilarityCalculator } from './similarity-calculator';
import {
  MANUAL_MAPPINGS,
  SKIP_GAMES,
  getManualMapping,
  getYearSpecificMapping,
  shouldSkipGame
} from '../data/manual-mappings';

export interface HLTBSearchResult {
  gameId: string;
  gameName: string;
  gameImage?: string;
  mainStory?: number | null;
  mainExtra?: number | null;
  completionist?: number | null;
  allStyles?: number | null;
  platforms?: string[];
  releaseDate?: string | null;
}

export interface MatchResult {
  match?: HLTBSearchResult;
  confidence: number;
  method: MatchMethod;
  skip?: boolean;
  reason?: string;
  normalizedSteam?: string;
  normalizedHltb?: string;
}

export type MatchMethod =
  | 'exact'
  | 'manual_mapping'
  | 'year_specific'
  | 'fuzzy_standard'
  | 'fuzzy_aggressive'
  | 'word_match'
  | 'skip';

export class TitleMatcher {
  private normalizer: TitleNormalizer;
  private calculator: SimilarityCalculator;

  // Confidence thresholds
  private readonly EXACT_MATCH_THRESHOLD = 1.0;
  private readonly FUZZY_MATCH_THRESHOLD = 0.8;
  private readonly AGGRESSIVE_MATCH_THRESHOLD = 0.7;
  private readonly WORD_MATCH_THRESHOLD = 0.75;

  constructor() {
    this.normalizer = new TitleNormalizer();
    this.calculator = new SimilarityCalculator();
  }

  /**
   * Find the best match for a Steam title from HLTB search results
   */
  async findBestMatch(
    steamTitle: string,
    hltbResults: HLTBSearchResult[]
  ): Promise<MatchResult | null> {
    const startTime = performance.now();

    if (!steamTitle || !hltbResults || hltbResults.length === 0) {
      return null;
    }

    // Normalize the Steam title
    const normalizedSteam = this.normalizer.normalize(steamTitle, 'standard');

    // Check if game should be skipped (multiplayer-only, etc.)
    if (shouldSkipGame(normalizedSteam)) {
      return {
        confidence: 1.0,
        method: 'skip',
        skip: true,
        reason: 'Multiplayer-only game with no completion times'
      };
    }

    // Extract year from title if present
    const year = this.normalizer.extractYear(steamTitle);

    // Strategy 1: Check year-specific mappings
    if (year) {
      const yearMapping = getYearSpecificMapping(normalizedSteam, year);
      if (yearMapping) {
        const yearMatch = this.findExactNormalizedMatch(yearMapping, hltbResults);
        if (yearMatch) {
          console.log(`[TitleMatcher] Year-specific match found: ${steamTitle} -> ${yearMatch.gameName}`);
          return {
            match: yearMatch,
            confidence: 1.0,
            method: 'year_specific',
            normalizedSteam,
            normalizedHltb: this.normalizer.normalize(yearMatch.gameName, 'standard')
          };
        }
      }
    }

    // Strategy 2: Check manual mappings
    const manualMapping = getManualMapping(normalizedSteam);
    if (manualMapping) {
      const manualMatch = this.findExactNormalizedMatch(manualMapping, hltbResults);
      if (manualMatch) {
        console.log(`[TitleMatcher] Manual mapping found: ${steamTitle} -> ${manualMatch.gameName}`);
        return {
          match: manualMatch,
          confidence: 1.0,
          method: 'manual_mapping',
          normalizedSteam,
          normalizedHltb: this.normalizer.normalize(manualMatch.gameName, 'standard')
        };
      }
    }

    // Strategy 3: Try exact match
    const exactMatch = this.findExactMatch(steamTitle, hltbResults);
    if (exactMatch) {
      console.log(`[TitleMatcher] Exact match found: ${steamTitle} -> ${exactMatch.gameName}`);
      return {
        match: exactMatch,
        confidence: 1.0,
        method: 'exact',
        normalizedSteam,
        normalizedHltb: this.normalizer.normalize(exactMatch.gameName, 'minimal')
      };
    }

    // Strategy 4: Try fuzzy matching with standard normalization
    const fuzzyMatch = this.findFuzzyMatch(steamTitle, hltbResults, 'standard');
    if (fuzzyMatch && fuzzyMatch.confidence >= this.FUZZY_MATCH_THRESHOLD) {
      console.log(
        `[TitleMatcher] Fuzzy match found: ${steamTitle} -> ${fuzzyMatch.match!.gameName} (${(
          fuzzyMatch.confidence * 100
        ).toFixed(1)}%)`
      );
      return fuzzyMatch;
    }

    // Strategy 5: Try word-based matching
    const wordMatch = this.findWordMatch(steamTitle, hltbResults);
    if (wordMatch && wordMatch.confidence >= this.WORD_MATCH_THRESHOLD) {
      console.log(
        `[TitleMatcher] Word match found: ${steamTitle} -> ${wordMatch.match!.gameName} (${(
          wordMatch.confidence * 100
        ).toFixed(1)}%)`
      );
      return wordMatch;
    }

    // Strategy 6: Try aggressive matching as last resort
    const aggressiveMatch = this.findFuzzyMatch(steamTitle, hltbResults, 'aggressive');
    if (aggressiveMatch && aggressiveMatch.confidence >= this.AGGRESSIVE_MATCH_THRESHOLD) {
      console.log(
        `[TitleMatcher] Aggressive match found: ${steamTitle} -> ${aggressiveMatch.match!.gameName} (${(
          aggressiveMatch.confidence * 100
        ).toFixed(1)}%)`
      );
      return aggressiveMatch;
    }

    const elapsedTime = performance.now() - startTime;
    console.log(`[TitleMatcher] No match found for: ${steamTitle} (${elapsedTime.toFixed(1)}ms)`);

    return null;
  }

  /**
   * Find exact match using minimal normalization
   */
  private findExactMatch(
    steamTitle: string,
    hltbResults: HLTBSearchResult[]
  ): HLTBSearchResult | null {
    const normalized = this.normalizer.normalize(steamTitle, 'minimal');

    return (
      hltbResults.find(result => {
        const resultNormalized = this.normalizer.normalize(result.gameName, 'minimal');
        return normalized === resultNormalized;
      }) || null
    );
  }

  /**
   * Find match for an already-normalized title
   */
  private findExactNormalizedMatch(
    normalizedTitle: string,
    hltbResults: HLTBSearchResult[]
  ): HLTBSearchResult | null {
    return (
      hltbResults.find(result => {
        const resultNormalized = this.normalizer.normalize(result.gameName, 'standard');
        return normalizedTitle === resultNormalized;
      }) || null
    );
  }

  /**
   * Find fuzzy match using similarity algorithms
   */
  private findFuzzyMatch(
    steamTitle: string,
    hltbResults: HLTBSearchResult[],
    normalizationLevel: 'standard' | 'aggressive'
  ): MatchResult | null {
    const normalized = this.normalizer.normalize(steamTitle, normalizationLevel);
    let bestMatch: HLTBSearchResult | null = null;
    let bestScore = 0;

    for (const result of hltbResults) {
      const resultNormalized = this.normalizer.normalize(result.gameName, normalizationLevel);

      // Calculate similarity score
      const score = this.calculator.combinedSimilarity(normalized, resultNormalized);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }

    if (bestMatch && bestScore >= this.FUZZY_MATCH_THRESHOLD) {
      return {
        match: bestMatch,
        confidence: bestScore,
        method: normalizationLevel === 'standard' ? 'fuzzy_standard' : 'fuzzy_aggressive',
        normalizedSteam: normalized,
        normalizedHltb: this.normalizer.normalize(bestMatch.gameName, normalizationLevel)
      };
    }

    return null;
  }

  /**
   * Find match using word-based similarity (Jaccard index)
   */
  private findWordMatch(
    steamTitle: string,
    hltbResults: HLTBSearchResult[]
  ): MatchResult | null {
    const normalized = this.normalizer.normalize(steamTitle, 'standard');
    const steamWords = this.normalizer.getCoreWords(normalized, 3);

    if (steamWords.length === 0) return null;

    let bestMatch: HLTBSearchResult | null = null;
    let bestScore = 0;

    for (const result of hltbResults) {
      const resultNormalized = this.normalizer.normalize(result.gameName, 'standard');
      const resultWords = this.normalizer.getCoreWords(resultNormalized, 3);

      if (resultWords.length === 0) continue;

      // Calculate word overlap
      const intersection = steamWords.filter(word => resultWords.includes(word)).length;
      const union = new Set([...steamWords, ...resultWords]).size;
      const jaccardScore = intersection / union;

      // Also check character-level similarity for matched words
      const charScore = this.calculator.combinedSimilarity(normalized, resultNormalized);

      // Combined score (60% word match, 40% character similarity)
      const combinedScore = jaccardScore * 0.6 + charScore * 0.4;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestMatch = result;
      }
    }

    if (bestMatch && bestScore >= this.WORD_MATCH_THRESHOLD) {
      return {
        match: bestMatch,
        confidence: bestScore,
        method: 'word_match',
        normalizedSteam: normalized,
        normalizedHltb: this.normalizer.normalize(bestMatch.gameName, 'standard')
      };
    }

    return null;
  }

  /**
   * Batch match multiple titles
   */
  async batchMatch(
    steamTitles: Array<{ title: string; searchResults: HLTBSearchResult[] }>
  ): Promise<Map<string, MatchResult | null>> {
    const results = new Map<string, MatchResult | null>();

    for (const { title, searchResults } of steamTitles) {
      const match = await this.findBestMatch(title, searchResults);
      results.set(title, match);
    }

    return results;
  }

  /**
   * Get detailed match info for debugging
   */
  async getMatchDetails(
    steamTitle: string,
    hltbResults: HLTBSearchResult[]
  ): Promise<{
    steamNormalized: { minimal: string; standard: string; aggressive: string };
    candidates: Array<{
      title: string;
      normalized: { minimal: string; standard: string; aggressive: string };
      scores: {
        dice: number;
        jaro: number;
        levenshtein: number;
        combined: number;
        word: number;
      };
    }>;
  }> {
    const details = {
      steamNormalized: {
        minimal: this.normalizer.normalize(steamTitle, 'minimal'),
        standard: this.normalizer.normalize(steamTitle, 'standard'),
        aggressive: this.normalizer.normalize(steamTitle, 'aggressive')
      },
      candidates: hltbResults.map(result => {
        const normalized = {
          minimal: this.normalizer.normalize(result.gameName, 'minimal'),
          standard: this.normalizer.normalize(result.gameName, 'standard'),
          aggressive: this.normalizer.normalize(result.gameName, 'aggressive')
        };

        const scores = {
          dice: this.calculator.diceCoefficient(
            details.steamNormalized.standard,
            normalized.standard
          ),
          jaro: this.calculator.jaroWinkler(
            details.steamNormalized.standard,
            normalized.standard
          ),
          levenshtein: this.calculator.levenshteinSimilarity(
            details.steamNormalized.standard,
            normalized.standard
          ),
          combined: this.calculator.combinedSimilarity(
            details.steamNormalized.standard,
            normalized.standard
          ),
          word: this.calculator.wordSimilarity(
            details.steamNormalized.standard,
            normalized.standard
          )
        };

        return {
          title: result.gameName,
          normalized,
          scores
        };
      })
    };

    return details;
  }
}

// Export singleton instance
export const titleMatcher = new TitleMatcher();