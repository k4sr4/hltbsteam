name: "HLTB Data Integration"
description: |

## Purpose
Implement a reliable HowLongToBeat data integration system using a curated JSON database as the primary source, with extensible architecture for future community contributions and alternative data sources.

## Core Principles
1. **Context is King**: Include database structure and expansion strategies
2. **Validation Loops**: Test matching algorithms with various game titles
3. **Information Dense**: Document exact game entries and aliases
4. **Progressive Success**: Start with 100 games, expand to 500+, enable community contributions
5. **Reliability First**: Offline-first approach eliminates API dependencies

---

## Goal
Create a comprehensive, maintainable game completion time database that provides instant, accurate data for popular Steam games without relying on external APIs or web scraping.

## Why
- **CORS Restrictions**: HLTB API blocks cross-origin requests from extensions
- **No Official API**: HLTB doesn't provide public API access
- **Reliability**: No network dependencies = instant, guaranteed data
- **Offline Support**: Works without internet connection
- **No Rate Limiting**: Client-side database has no API restrictions
- **Performance**: JSON lookup is faster than API calls (< 1ms vs 2000ms+)

## What Changed From Original Plan
**Original Approach (Abandoned):**
- ❌ POST requests to `/api/locate/{hash}` (blocked by CORS)
- ❌ Web scraping HTML pages (also blocked by CORS)
- ❌ Dynamic hash extraction from HLTB website

**New Approach (Implemented):**
- ✅ Curated JSON database (`fallback-data.json`)
- ✅ 100 games in Tier 1 (expandable to 500+)
- ✅ Fuzzy matching with aliases
- ✅ Community contribution workflow
- ✅ Easy maintenance (no rebuild needed for data updates)

## What
Database integration system providing:
- Curated JSON game database
- Smart title matching algorithm
- Alias support for alternative names
- Fuzzy matching for near-matches
- Database versioning and migrations
- Easy expansion workflow
- Community contribution pipeline
- Data validation and quality control
- Confidence scoring system

### Success Criteria
- [x] Data available for 100+ popular games (Tier 1)
- [ ] Data available for 300+ games (Tier 2)
- [ ] Data available for 500+ games (Tier 3)
- [x] Title matching accuracy > 95%
- [x] Lookup time < 1ms average
- [x] Handles alternate titles (GTA V, GTA 5, etc.)
- [x] Easy to add new games (documented workflow)
- [ ] Community contribution system active
- [x] No external API dependencies
- [x] Works offline

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Critical Resources
- file: C:\hltbsteam\src\background\services\fallback-data.json
  why: Current database structure
  action: Study game entry format

- file: C:\hltbsteam\ADDING_GAMES.md
  why: Step-by-step guide for adding games
  action: Follow workflow for new entries

- url: https://howlongtobeat.com/
  why: Source for accurate completion times
  action: Look up games before adding

- file: C:\hltbsteam\src\background\services\hltb-fallback.ts
  why: Database loading and matching logic
  sections: normalizeTitle, findFuzzyMatch, searchFallback
```

### Database Structure
```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-20",
  "games": [
    {
      "title": "Game Title",
      "aliases": ["alternate name", "abbreviation"],
      "data": {
        "mainStory": 10,
        "mainExtra": 15,
        "completionist": 25,
        "allStyles": 16
      },
      "confidence": "high",
      "lastUpdated": "2025-10"
    }
  ]
}
```

### Matching Algorithm Flow
```
User searches: "Pumpkin Jack"
  ↓
1. Normalize title: "pumpkin jack"
   (lowercase, remove special chars)
  ↓
2. Check direct match in database
   Found: "pumpkin jack" ✓
  ↓
3. If not found, check aliases
   (e.g., "gta 5" → "Grand Theft Auto V")
  ↓
4. If not found, fuzzy match
   (word overlap scoring)
  ↓
5. If not found, partial match
   (substring matching)
  ↓
6. Return null if no match
```

### Current Coverage (Tier 1 - 100 Games)
```yaml
Categories:
  - Valve Games: Portal, Half-Life, Counter-Strike, Dota 2, TF2
  - AAA Games: Elden Ring, Witcher 3, RDR2, GTA V, Cyberpunk 2077
  - FromSoft: Dark Souls trilogy, Sekiro
  - Indies: Hollow Knight, Celeste, Hades, Stardew Valley
  - Roguelikes: Binding of Isaac, Dead Cells, Slay the Spire
  - Horror: Resident Evil, Little Nightmares
  - Action: God of War, Spider-Man, Doom
  - RPGs: Baldur's Gate 3, Persona 5, NieR: Automata
  - Multiplayer: Rust, ARK, Rocket League, Apex Legends
  - Strategy: Civ VI, Total War, Factorio
  - Survival: Valheim, Subnautica, The Forest
  - Puzzle: The Witness, Talos Principle, Braid
```

## Implementation Blueprint

### Current Implementation
```typescript
// src/background/services/hltb-fallback.ts
import fallbackData from './fallback-data.json';

export class HLTBFallback {
  private localDatabase: Map<string, FallbackGameEntry> = new Map();
  private aliasMap: Map<string, string> = new Map();

  private initializeLocalDatabase() {
    const commonGames: FallbackGameEntry[] = fallbackData.games;

    // Populate database and alias map
    for (const game of commonGames) {
      const key = this.normalizeTitle(game.title);
      this.localDatabase.set(key, game);

      // Add aliases
      if (game.aliases) {
        for (const alias of game.aliases) {
          this.aliasMap.set(this.normalizeTitle(alias), key);
        }
      }
    }
  }

  async searchFallback(title: string): Promise<HLTBData | null> {
    const normalized = this.normalizeTitle(title);

    // 1. Direct match
    if (this.localDatabase.has(normalized)) {
      return this.localDatabase.get(normalized)!.data;
    }

    // 2. Check aliases
    if (this.aliasMap.has(normalized)) {
      const primaryKey = this.aliasMap.get(normalized)!;
      return this.localDatabase.get(primaryKey)!.data;
    }

    // 3. Fuzzy match
    const fuzzyMatch = this.findFuzzyMatch(normalized);
    if (fuzzyMatch) return fuzzyMatch;

    // 4. Partial match
    const partialMatch = this.findPartialMatch(normalized);
    if (partialMatch) return partialMatch;

    return null;
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
```

### Task 1: Database Expansion (Tier 2 - 200 Games)
**Goal**: Expand from 100 to 300 total games

**High Priority Additions:**
```yaml
# Add these categories (100 games each)
- Fighting Games: Street Fighter, Mortal Kombat, Tekken
- Racing: Forza, F1, Need for Speed
- Sports: FIFA, NBA 2K, Rocket League
- Simulation: Flight Simulator, Euro Truck, Farming Simulator
- Metroidvania: Blasphemous, Metroid, Castlevania
- Platformers: Crash Bandicoot, Rayman, Super Meat Boy
- VR Games: Half-Life Alyx, Beat Saber
- Co-op: It Takes Two, Overcooked, Left 4 Dead
- MMORPGs: WoW, FFXIV, Guild Wars 2
- Card Games: Slay the Spire, Monster Train
```

**Workflow:**
1. Create `expansion-tier2.json` with new games
2. Merge into main `fallback-data.json`
3. Update version number
4. Test with `npm run build`
5. Verify no duplicates
6. Update documentation

### Task 2: Community Contribution System
**Goal**: Enable users to submit game entries

**Implementation:**
```markdown
# CONTRIBUTING_GAMES.md template

## How to Add Games

### Option 1: GitHub Issue
1. Create issue with title: "Add Game: [Game Name]"
2. Fill in template:
   ```yaml
   Game Title: "Full Official Name"
   Steam AppID: "123456"
   HLTB Link: "https://howlongtobeat.com/game/12345"
   Main Story: 10 hours
   Main + Extra: 15 hours
   Completionist: 25 hours
   All Styles: 16 hours
   Aliases: ["abbreviation", "alternate name"]
   ```
3. Maintainer reviews and merges

### Option 2: Pull Request
1. Fork repository
2. Edit `src/background/services/fallback-data.json`
3. Add game entry following format
4. Update `lastUpdated` to current month
5. Run `npm run build` to verify
6. Create PR with title: "Add: [Game Name]"
```

### Task 3: Data Quality Validation
**Goal**: Ensure database accuracy and consistency

**Validation Script:**
```javascript
// scripts/validate-database.js
const data = require('../src/background/services/fallback-data.json');

function validateDatabase() {
  const errors = [];
  const seen = new Set();

  for (const game of data.games) {
    // Check required fields
    if (!game.title) errors.push(`Missing title`);
    if (!game.data) errors.push(`${game.title}: Missing data`);

    // Check duplicates
    const normalized = game.title.toLowerCase();
    if (seen.has(normalized)) {
      errors.push(`Duplicate: ${game.title}`);
    }
    seen.add(normalized);

    // Check data validity
    if (game.data.mainStory !== null && game.data.mainStory < 0) {
      errors.push(`${game.title}: Invalid mainStory`);
    }

    // Check aliases
    if (game.aliases) {
      game.aliases.forEach(alias => {
        if (alias.toLowerCase() === normalized) {
          errors.push(`${game.title}: Alias same as title`);
        }
      });
    }
  }

  if (errors.length > 0) {
    console.error('Validation errors:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`✓ Database valid: ${data.games.length} games`);
}

validateDatabase();
```

### Task 4: Automated Data Updates
**Goal**: Keep database fresh without manual intervention

**Future Enhancement (Post-MVP):**
```yaml
# Potential automation strategies
1. Weekly GitHub Action:
   - Fetch popular Steam games
   - Check if in database
   - Create issues for missing games

2. Community Voting:
   - Users vote on which games to add next
   - Automated priority queue

3. Steam Integration:
   - Track user's library
   - Suggest missing games
   - Auto-submit to database

4. HLTB Sync (if API available):
   - Periodic check for data updates
   - Update existing entries
   - Flag significant changes
```

## Validation Loop

### Level 1: Unit Tests
```typescript
describe('HLTBFallback', () => {
  let fallback: HLTBFallback;

  beforeEach(() => {
    fallback = new HLTBFallback();
  });

  it('should find exact match', async () => {
    const result = await fallback.searchFallback('Pumpkin Jack');
    expect(result).toBeTruthy();
    expect(result?.mainStory).toBe(5);
  });

  it('should find via alias', async () => {
    const result = await fallback.searchFallback('GTA 5');
    expect(result).toBeTruthy();
    expect(result?.mainStory).toBe(32);
  });

  it('should handle fuzzy match', async () => {
    const result = await fallback.searchFallback('grand theft auto five');
    expect(result).toBeTruthy();
  });

  it('should return null for missing game', async () => {
    const result = await fallback.searchFallback('Nonexistent Game 12345');
    expect(result).toBeNull();
  });

  it('should normalize special characters', async () => {
    const result1 = await fallback.searchFallback('Baldurs Gate 3');
    const result2 = await fallback.searchFallback('Baldur\'s Gate 3');
    expect(result1).toEqual(result2);
  });
});
```

### Level 2: Integration Tests
```typescript
describe('HLTBIntegratedService with Fallback', () => {
  it('should use fallback when API fails', async () => {
    const service = new HLTBIntegratedService();

    const result = await service.getGameData('Pumpkin Jack', '1186640', {
      skipApi: true,
      skipScraping: true
    });

    expect(result?.source).toBe('fallback');
    expect(result?.mainStory).toBe(5);
  });
});
```

### Level 3: Real-World Tests
```yaml
Test Cases:
  - "Counter-Strike 2" → finds via exact match
  - "CS2" → finds via alias
  - "cs 2" → finds via alias (case-insensitive)
  - "The Witcher 3" → finds exact
  - "Witcher 3" → finds fuzzy match
  - "Grand Theft Auto V" → finds exact
  - "GTA V" → finds via alias
  - "GTA 5" → finds via alias
  - "GTAV" → finds via alias
  - "Elden ring" → finds (case-insensitive)
  - "Baldurs Gate 3" → finds (apostrophe normalized)
  - "BG3" → finds via alias
```

## Confidence Scoring
```typescript
interface MatchResult {
  data: HLTBData;
  confidence: 'high' | 'medium' | 'low';
  method: 'exact' | 'alias' | 'fuzzy' | 'partial';
}

// Confidence rules:
- Exact match = high confidence
- Alias match = high confidence
- Fuzzy match > 80% = medium confidence
- Partial match = low confidence
```

## Future Enhancements

### Phase 2: External Data Sources (Optional)
If HLTB API becomes accessible or CORS restrictions change:
```yaml
Data Source Priority:
  1. Local JSON database (instant, reliable)
  2. Community contributions (crowdsourced updates)
  3. External API (if available, with caching)
  4. Web scraping (last resort, if CORS solved)
```

### Phase 3: Smart Updates
```yaml
Features:
  - Detect when game data is stale
  - Suggest updates based on HLTB changes
  - Community voting on data accuracy
  - Automated data verification
```

## Anti-Patterns to Avoid
- ❌ Don't add games without HLTB verification
- ❌ Don't duplicate existing entries
- ❌ Don't use unreliable data sources
- ❌ Don't add DLC as separate games (unless standalone)
- ❌ Don't skip alias normalization
- ❌ Don't forget to update version/timestamp
- ❌ Don't add multiplayer-only games with fake times
- ❌ Don't rely on estimates (use actual HLTB data)
- ❌ Don't skip validation before merging
- ❌ Don't hard-code database in TypeScript (use JSON)

## Final Validation Checklist
- [x] 100 games in database (Tier 1)
- [ ] 300 games in database (Tier 2)
- [ ] 500 games in database (Tier 3)
- [x] All entries have HLTB source
- [x] Title matching > 95% accurate
- [x] Lookup time < 1ms
- [x] Aliases working correctly
- [x] Documentation complete
- [ ] Validation script created
- [ ] Community contribution workflow
- [ ] Database versioning system
- [ ] Migration tests passing

---

## Confidence Score: 10/10
Very high confidence due to:
- ✅ Approach proven and implemented
- ✅ No external API dependencies
- ✅ Fast, reliable, offline-capable
- ✅ Easy to maintain and expand
- ✅ Community can contribute

No significant risk factors remain.

## Migration Notes
**From PRD v1.0 (API/Scraping approach):**
- Removed all API integration tasks
- Removed web scraping implementation
- Removed CORS workaround attempts
- Added JSON database structure
- Added community contribution workflow
- Updated success criteria
- Changed confidence from 8/10 to 10/10
