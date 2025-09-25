name: "Game Title Matching"
description: |

## Purpose
Implement intelligent game title matching algorithms to accurately map Steam game titles to HowLongToBeat entries, handling variations, special characters, subtitles, and regional differences.

## Core Principles
1. **Context is King**: Include comprehensive title variation patterns and edge cases
2. **Validation Loops**: Test with extensive game title dataset
3. **Information Dense**: Use proven string matching algorithms
4. **Progressive Success**: Try exact match first, then progressively fuzzier methods
5. **Accuracy First**: Prefer no match over wrong match

---

## Goal
Create a sophisticated title matching system that achieves 95%+ accuracy in mapping Steam titles to HLTB entries, handling all common variations and edge cases.

## Why
- **Title Variations**: Steam and HLTB often use different title formats
- **User Experience**: Wrong data is worse than no data
- **Regional Differences**: Games have different names in different regions
- **Special Characters**: Handling ™, ®, punctuation differences

## What
Title matching system providing:
- Multiple matching algorithms
- Title normalization pipeline
- Similarity scoring system
- Manual mapping database
- Fuzzy matching with thresholds
- Subtitle handling
- Series number detection
- Acronym expansion
- Common word removal
- Confidence scoring

### Success Criteria
- [ ] 95%+ matching accuracy
- [ ] < 1% false positives
- [ ] Handles all special characters
- [ ] Matches despite subtitle differences
- [ ] Performance < 50ms per match
- [ ] Handles Roman numerals
- [ ] Matches acronyms to full titles
- [ ] Handles "Edition" variations
- [ ] Confidence scores accurate
- [ ] Manual mappings override

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Critical Resources
- url: https://github.com/aceakash/string-similarity
  why: JavaScript string similarity algorithms
  sections: Dice coefficient, Levenshtein distance

- url: https://www.npmjs.com/package/fuzzyset.js
  why: Fuzzy string matching library
  sections: API usage, threshold tuning

- file: C:\steamhltb\HLTB_Steam_Extension_Design.md
  lines: 123-133
  why: Game title matching requirements

- url: https://en.wikipedia.org/wiki/Levenshtein_distance
  why: Understanding edit distance algorithm
  sections: Algorithm, applications

- url: https://github.com/Glench/fuzzyset.js
  why: Fuzzy matching implementation
  sections: N-gram based matching
```

### Common Title Variations
```javascript
// Steam Title -> HLTB Title
{
  "Counter-Strike 2" -> "Counter-Strike 2",
  "Counter-Strike: Global Offensive" -> "Counter-Strike: Global Offensive",
  "CS:GO" -> "Counter-Strike: Global Offensive",
  "DOOM" -> "DOOM (2016)",
  "DOOM Eternal" -> "DOOM Eternal",
  "Sid Meier's Civilization VI" -> "Civilization VI",
  "Tom Clancy's Rainbow Six® Siege" -> "Rainbow Six Siege",
  "HITMAN™ 3" -> "Hitman 3",
  "Wolfenstein: The New Order" -> "Wolfenstein: The New Order",
  "The Witcher 3: Wild Hunt" -> "The Witcher 3: Wild Hunt",
  "The Witcher 3: Wild Hunt - Game of the Year Edition" -> "The Witcher 3: Wild Hunt",
  "FINAL FANTASY VII REMAKE" -> "Final Fantasy VII Remake",
  "DARK SOULS™ III" -> "Dark Souls III",
  "Halo: The Master Chief Collection" -> "Halo: The Master Chief Collection",
  "Call of Duty®: Modern Warfare® II" -> "Call of Duty: Modern Warfare II (2022)"
}
```

### Known Gotchas & Edge Cases
```typescript
// CRITICAL: Year disambiguation
// "DOOM" (2016) vs "DOOM" (1993)

// CRITICAL: Roman numerals
// "GTA V" vs "Grand Theft Auto 5" vs "Grand Theft Auto V"

// CRITICAL: Subtitles and editions
// Base game vs GOTY vs Definitive Edition

// CRITICAL: Series reboots
// "Modern Warfare" (2007) vs "Modern Warfare" (2019)

// CRITICAL: Acronyms
// "CS:GO", "PUBG", "GTA", "CoD"

// CRITICAL: Special characters
// ®™©:;'-–— and unicode

// CRITICAL: Articles
// "The" prefix inconsistency

// CRITICAL: Ampersands
// "&" vs "and"

// CRITICAL: Numbers
// "2" vs "II" vs "Two"
```

## Implementation Blueprint

### Task 1: Title Normalizer
```typescript
// src/background/services/title-normalizer.ts
export class TitleNormalizer {
  private readonly SPECIAL_CHARS = /[®™©]/g;
  private readonly PUNCTUATION = /[:'"\-–—]/g;
  private readonly WHITESPACE = /\s+/g;
  private readonly ARTICLES = /^(the|a|an)\s+/i;
  
  normalize(title: string, level: NormalizationLevel = 'standard'): string {
    let normalized = title;

    switch (level) {
      case 'minimal':
        // Just basic cleanup
        normalized = this.removeSpecialChars(normalized);
        normalized = this.normalizeWhitespace(normalized);
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

  private removeSpecialChars(title: string): string {
    return title.replace(this.SPECIAL_CHARS, '');
  }

  private removePunctuation(title: string): string {
    return title.replace(this.PUNCTUATION, ' ');
  }

  private normalizeWhitespace(title: string): string {
    return title.replace(this.WHITESPACE, ' ');
  }

  private toLowerCase(title: string): string {
    return title.toLowerCase();
  }

  private removeArticles(title: string): string {
    return title.replace(this.ARTICLES, '');
  }

  private removeSubtitles(title: string): string {
    // Remove everything after colon or dash
    const match = title.match(/^([^:–-]+)/);
    return match ? match[1].trim() : title;
  }

  private removeEditions(title: string): string {
    const editions = [
      'game of the year edition',
      'goty edition',
      'definitive edition',
      'enhanced edition',
      'special edition',
      'deluxe edition',
      'ultimate edition',
      'complete edition',
      'gold edition',
      'remastered',
      'remake'
    ];

    let result = title;
    editions.forEach(edition => {
      const regex = new RegExp(`\\s*-?\\s*${edition}`, 'gi');
      result = result.replace(regex, '');
    });
    return result;
  }

  private expandAcronyms(title: string): string {
    const acronyms: Record<string, string> = {
      'cs:go': 'counter-strike global offensive',
      'csgo': 'counter-strike global offensive',
      'pubg': 'playerunknowns battlegrounds',
      'gta': 'grand theft auto',
      'cod': 'call of duty',
      'bf': 'battlefield',
      'r6': 'rainbow six',
      'dota': 'defense of the ancients',
      'tf2': 'team fortress 2'
    };

    const lower = title.toLowerCase();
    return acronyms[lower] || title;
  }

  private normalizeNumbers(title: string): string {
    // Convert Roman numerals to Arabic
    const romanNumerals: Record<string, string> = {
      ' ii': ' 2', ' iii': ' 3', ' iv': ' 4', ' v': ' 5',
      ' vi': ' 6', ' vii': ' 7', ' viii': ' 8', ' ix': ' 9', ' x': ' 10'
    };

    let result = title;
    Object.entries(romanNumerals).forEach(([roman, arabic]) => {
      result = result.replace(new RegExp(roman + '\\b', 'gi'), arabic);
    });

    return result;
  }
}
```

### Task 2: Similarity Calculator
```typescript
// src/background/services/similarity-calculator.ts
export class SimilarityCalculator {
  // Levenshtein distance
  levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Dice coefficient
  diceCoefficient(str1: string, str2: string): number {
    const bigrams1 = this.getBigrams(str1);
    const bigrams2 = this.getBigrams(str2);

    const intersection = bigrams1.filter(bigram => bigrams2.includes(bigram));

    return (2.0 * intersection.length) / (bigrams1.length + bigrams2.length);
  }

  private getBigrams(str: string): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
  }

  // Jaro-Winkler similarity
  jaroWinkler(str1: string, str2: string): number {
    const jaro = this.jaro(str1, str2);
    const prefixLength = this.commonPrefix(str1, str2, 4);
    return jaro + (prefixLength * 0.1 * (1.0 - jaro));
  }

  private jaro(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1.length || !str2.length) return 0.0;

    const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
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

    // Find transpositions
    let k = 0;
    for (let i = 0; i < str1.length; i++) {
      if (!matches1[i]) continue;
      while (!matches2[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    return (matches / str1.length + matches / str2.length +
      (matches - transpositions / 2) / matches) / 3.0;
  }

  private commonPrefix(str1: string, str2: string, maxLength: number): number {
    const n = Math.min(str1.length, str2.length, maxLength);
    for (let i = 0; i < n; i++) {
      if (str1[i] !== str2[i]) return i;
    }
    return n;
  }

  // Combined similarity score
  combinedSimilarity(str1: string, str2: string): number {
    const dice = this.diceCoefficient(str1, str2);
    const jaro = this.jaroWinkler(str1, str2);
    const lev = 1 - (this.levenshteinDistance(str1, str2) / Math.max(str1.length, str2.length));

    // Weighted average
    return (dice * 0.3 + jaro * 0.4 + lev * 0.3);
  }
}
```

### Task 3: Manual Mapping Database
```typescript
// src/background/data/manual-mappings.ts
export const MANUAL_MAPPINGS: Record<string, string> = {
  // Steam Title -> HLTB Title
  'counter-strike: global offensive': 'counter-strike: global offensive',
  'cs:go': 'counter-strike: global offensive',
  'doom': 'doom (2016)',
  'doom 3': 'doom 3',
  'doom eternal': 'doom eternal',
  'prey': 'prey (2017)',
  'hitman 3': 'hitman 3 (2021)',
  'modern warfare 2': 'call of duty: modern warfare ii (2022)',
  'god of war': 'god of war (2018)',
  'black mesa': 'black mesa',
  'half-life: alyx': 'half-life: alyx',
  'resident evil 2': 'resident evil 2 (2019)',
  'resident evil 3': 'resident evil 3 (2020)',
  'final fantasy vii remake': 'final fantasy vii remake intergrade',
  'persona 4 golden': 'persona 4 golden',
  'the elder scrolls v: skyrim special edition': 'the elder scrolls v: skyrim',
  'dark souls: remastered': 'dark souls',
  'bioshock remastered': 'bioshock',
  'bioshock 2 remastered': 'bioshock 2',
  'mafia: definitive edition': 'mafia: definitive edition',
  'cyberpunk 2077': 'cyberpunk 2077',
  'it takes two': 'it takes two',
  'a way out': 'a way out',
  'fall guys': 'fall guys: ultimate knockout',
  'among us': 'among us',
  'phasmophobia': 'phasmophobia',
  'valheim': 'valheim'
};

// Games that should NOT be matched (multiplayer only, etc.)
export const SKIP_GAMES = new Set([
  'team fortress 2',
  'dota 2',
  'counter-strike 2',
  'apex legends',
  'valorant',
  'league of legends',
  'warframe',
  'path of exile',
  'lost ark',
  'destiny 2'
]);
```

### Task 4: Title Matcher
```typescript
// src/background/services/title-matcher.ts
export class TitleMatcher {
  private normalizer: TitleNormalizer;
  private calculator: SimilarityCalculator;

  constructor() {
    this.normalizer = new TitleNormalizer();
    this.calculator = new SimilarityCalculator();
  }

  async findBestMatch(
    steamTitle: string,
    hltbResults: HLTBSearchResult[]
  ): Promise<MatchResult | null> {
    if (!hltbResults.length) return null;

    // Check manual mappings first
    const normalizedSteam = this.normalizer.normalize(steamTitle, 'standard');

    if (SKIP_GAMES.has(normalizedSteam)) {
      return { skip: true, reason: 'Multiplayer only game' };
    }

    if (MANUAL_MAPPINGS[normalizedSteam]) {
      const mappedTitle = MANUAL_MAPPINGS[normalizedSteam];
      const exactMatch = hltbResults.find(r =>
        this.normalizer.normalize(r.gameName, 'standard') === mappedTitle
      );
      if (exactMatch) {
        return {
          match: exactMatch,
          confidence: 1.0,
          method: 'manual_mapping'
        };
      }
    }

    // Try exact match
    const exactMatch = this.findExactMatch(steamTitle, hltbResults);
    if (exactMatch) {
      return {
        match: exactMatch,
        confidence: 1.0,
        method: 'exact'
      };
    }

    // Try fuzzy matching with different normalization levels
    const fuzzyMatch = this.findFuzzyMatch(steamTitle, hltbResults);
    if (fuzzyMatch && fuzzyMatch.confidence >= 0.8) {
      return fuzzyMatch;
    }

    // Try aggressive matching as last resort
    const aggressiveMatch = this.findAggressiveMatch(steamTitle, hltbResults);
    if (aggressiveMatch && aggressiveMatch.confidence >= 0.7) {
      return aggressiveMatch;
    }

    return null;
  }

  private findExactMatch(
    steamTitle: string,
    hltbResults: HLTBSearchResult[]
  ): HLTBSearchResult | null {
    const normalized = this.normalizer.normalize(steamTitle, 'minimal');

    return hltbResults.find(result => {
      const resultNormalized = this.normalizer.normalize(result.gameName, 'minimal');
      return normalized === resultNormalized;
    }) || null;
  }

  private findFuzzyMatch(
    steamTitle: string,
    hltbResults: HLTBSearchResult[]
  ): MatchResult | null {
    const normalized = this.normalizer.normalize(steamTitle, 'standard');
    let bestMatch: HLTBSearchResult | null = null;
    let bestScore = 0;

    for (const result of hltbResults) {
      const resultNormalized = this.normalizer.normalize(result.gameName, 'standard');
      const score = this.calculator.combinedSimilarity(normalized, resultNormalized);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }

    if (bestMatch && bestScore >= 0.8) {
      return {
        match: bestMatch,
        confidence: bestScore,
        method: 'fuzzy'
      };
    }

    return null;
  }

  private findAggressiveMatch(
    steamTitle: string,
    hltbResults: HLTBSearchResult[]
  ): MatchResult | null {
    const normalized = this.normalizer.normalize(steamTitle, 'aggressive');
    let bestMatch: HLTBSearchResult | null = null;
    let bestScore = 0;

    for (const result of hltbResults) {
      const resultNormalized = this.normalizer.normalize(result.gameName, 'aggressive');

      // Check if core words match
      if (this.coreWordsMatch(normalized, resultNormalized)) {
        const score = this.calculator.combinedSimilarity(normalized, resultNormalized);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = result;
        }
      }
    }

    if (bestMatch && bestScore >= 0.7) {
      return {
        match: bestMatch,
        confidence: bestScore * 0.9, // Reduce confidence for aggressive matching
        method: 'aggressive'
      };
    }

    return null;
  }

  private coreWordsMatch(title1: string, title2: string): boolean {
    const words1 = title1.split(' ').filter(w => w.length > 3);
    const words2 = title2.split(' ').filter(w => w.length > 3);

    if (words1.length === 0 || words2.length === 0) return false;

    // Check if at least 60% of core words match
    const matchCount = words1.filter(w1 =>
      words2.some(w2 => w1 === w2 || this.calculator.levenshteinDistance(w1, w2) <= 1)
    ).length;

    return matchCount / words1.length >= 0.6;
  }
}

interface MatchResult {
  match?: HLTBSearchResult;
  confidence?: number;
  method?: string;
  skip?: boolean;
  reason?: string;
}
```

## Validation Loop

### Level 1: Unit Tests
```typescript
// tests/title-matching.test.ts
describe('Title Matching', () => {
  const matcher = new TitleMatcher();

  it('should match exact titles', async () => {
    const result = await matcher.findBestMatch('Portal 2', [
      { gameName: 'Portal 2', gameId: '123' }
    ]);
    expect(result.confidence).toBe(1.0);
    expect(result.method).toBe('exact');
  });

  it('should handle special characters', async () => {
    const result = await matcher.findBestMatch(
      'Tom Clancy\'s Rainbow Six® Siege',
      [{ gameName: 'Rainbow Six Siege', gameId: '456' }]
    );
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should match despite edition differences', async () => {
    const result = await matcher.findBestMatch(
      'The Witcher 3: Wild Hunt - Game of the Year Edition',
      [{ gameName: 'The Witcher 3: Wild Hunt', gameId: '789' }]
    );
    expect(result.match.gameId).toBe('789');
  });

  it('should skip multiplayer-only games', async () => {
    const result = await matcher.findBestMatch('Team Fortress 2', []);
    expect(result.skip).toBe(true);
  });

  it('should handle Roman numerals', async () => {
    const result = await matcher.findBestMatch('Grand Theft Auto V', [
      { gameName: 'Grand Theft Auto 5', gameId: '101' }
    ]);
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});
```

## Final Validation Checklist
- [ ] Exact matching works
- [ ] Fuzzy matching accurate
- [ ] Manual mappings applied
- [ ] Skip list functioning
- [ ] Special characters handled
- [ ] Editions normalized
- [ ] Roman numerals converted
- [ ] Acronyms expanded
- [ ] Performance < 50ms
- [ ] Confidence scores meaningful
- [ ] Tests passing
- [ ] No false positives

---

## Confidence Score: 8/10
High confidence due to:
- Multiple matching strategies
- Proven algorithms
- Manual override capability
- Comprehensive normalization

Risk factors:
- Title variation complexity
- New game naming patterns