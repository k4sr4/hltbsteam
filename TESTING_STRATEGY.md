# Title Matching System - Comprehensive Testing Strategy

## Executive Summary

This document provides a complete testing strategy for the game title matching system in the HLTB Steam Extension. The system orchestrates multiple components (TitleNormalizer, SimilarityCalculator, Manual Mappings, TitleMatcher) to accurately match Steam game titles with HowLongToBeat database entries.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     TitleMatcher                        │
│                  (Orchestration Layer)                  │
│                                                         │
│  Priority Order:                                        │
│  1. Year-Specific Mappings                             │
│  2. Manual Mappings                                     │
│  3. Exact Match (minimal normalization)                │
│  4. Fuzzy Match (standard normalization)               │
│  5. Word Match (Jaccard similarity)                    │
│  6. Aggressive Match (maximum normalization)           │
│  7. Skip List Check                                     │
└─────────────────────────────────────────────────────────┘
                          ↓
      ┌───────────────────┬───────────────────┐
      ↓                   ↓                   ↓
┌──────────────┐  ┌──────────────────┐  ┌────────────────┐
│ Title        │  │ Similarity       │  │ Manual         │
│ Normalizer   │  │ Calculator       │  │ Mappings       │
│              │  │                  │  │                │
│ 3 Levels:    │  │ Algorithms:      │  │ Data:          │
│ - Minimal    │  │ - Levenshtein    │  │ - Mappings     │
│ - Standard   │  │ - Dice           │  │ - Skip List    │
│ - Aggressive │  │ - Jaro-Winkler   │  │ - Year Maps    │
└──────────────┘  └──────────────────┘  └────────────────┘
```

## Test Pyramid Strategy

### Unit Tests (70% - 63 tests)

#### TitleNormalizer (20 tests)
```
Minimal Normalization (4 tests):
✓ Special character removal (®, ™, ©)
✓ Whitespace normalization
✓ Lowercase conversion
✓ Punctuation preservation

Standard Normalization (3 tests):
✓ Punctuation removal
✓ Hyphen/dash handling
✗ Special character combinations (failing)

Aggressive Normalization (6 tests):
✓ Article removal (the, a, an)
✗ Subtitle removal (failing)
✓ Edition suffix removal (5 variants tested)
✓ Acronym expansion (5 examples)
✓ Roman numeral conversion (5 examples)
✗ Complex combination (failing)

Utility Methods (7 tests):
✓ Year extraction (4 cases)
✓ Year removal
✓ Core words extraction
✓ Minimum length filtering
✓ Empty string handling (2 tests)
```

**Coverage**: File manipulation, text processing, regex patterns
**Isolation**: No external dependencies
**Performance Target**: <1ms per operation

#### SimilarityCalculator (16 tests)
```
Levenshtein Distance (3 tests):
✓ Correct edit distance calculation
✓ Empty string handling
✓ Similarity score (0-1 scale)

Dice Coefficient (3 tests):
✓ Bigram similarity
✗ Short string edge cases (failing)
✓ Case sensitivity

Jaro-Winkler (3 tests):
✓ Jaro calculation
✓ Prefix bonus application
✓ Identical strings

Combined Similarity (3 tests):
✓ Weighted average
✓ High similarity detection
✓ Low similarity detection

Word Similarity - Jaccard (3 tests):
✗ Word overlap calculation (failing)
✓ Case insensitivity
✓ Single word titles

Performance (1 test):
✓ <5ms per 100 calculations
```

**Coverage**: Algorithm correctness, edge cases, performance
**Isolation**: Pure functions, no state
**Performance Target**: <5ms per calculation

#### Manual Mappings (9 tests)
```
Database Structure (2 tests):
✓ Key normalization (lowercase, no special chars)
✓ Expected mappings present (5 key games)

Mapping Functions (2 tests):
✓ getManualMapping() returns correct values
✓ Returns null for unknown titles

Year-Specific Mappings (3 tests):
✓ Year disambiguation (DOOM, Prey, Resident Evil)
✓ Invalid year handling
✓ Null year handling

Skip List (3 tests):
✓ Multiplayer-only game identification
✓ Single-player game preservation
✓ Skip list normalization
```

**Coverage**: Data integrity, lookup functions
**Isolation**: No external dependencies
**Performance Target**: <1ms per lookup

### Integration Tests (20% - 18 tests)

#### TitleMatcher Core (18 tests)
```
Exact Matching (3 tests):
✗ Basic exact match (attribution issue)
✓ Case insensitivity
✗ Special character handling (failing)

Manual Mapping Priority (2 tests):
✓ Manual over fuzzy (CS:GO example)
✓ GTA variants (3 tested)

Year-Specific Matching (2 tests):
✗ DOOM version disambiguation (failing)
✓ Resident Evil remakes

Edition Normalization (2 tests):
✗ GOTY editions (confidence 0.759 < 0.8)
✓ Remastered editions

Roman Numeral Conversion (2 tests):
✓ Roman to Arabic matching
✓ Various numerals (III, VI, VII)

Acronym Expansion (2 tests):
✓ Single word acronyms
✗ Multi-word acronyms (failing)

Skip List (2 tests):
✓ Skip multiplayer games
✓ Skip all listed games

Publisher Prefix (2 tests):
✗ Sid Meier's games (failing)
✗ Tom Clancy's games (failing)

Fuzzy Matching (3 tests):
✗ Typo tolerance (failing)
✓ >80% accuracy for close matches
✗ Appropriate matching level (failing)
```

**Coverage**: Component interaction, strategy priority, real scenarios
**Dependencies**: All components integrated
**Performance Target**: <50ms per match

### End-to-End Tests (10% - 9 tests)

#### Complete Workflows (9 tests)
```
False Positive Prevention (3 tests):
✓ Reject completely different games
✓ Minimum confidence threshold enforcement
✓ Partial word matching

Confidence Scoring (4 tests):
✓ 1.0 for exact matches
✓ 1.0 for manual mappings
✓ Meaningful scores for fuzzy matches
✓ Lower confidence for aggressive matching

Real-World Scenarios (2 tests):
✓ Complete workflow (Witcher 3 GOTY)
✗ Complex scenario (Tom Clancy's Rainbow Six Siege Year 7) - failing

Strategy Priority (2 tests):
✓ Ambiguous search results
✗ Priority order verification (failing)
```

**Coverage**: Full system behavior, user scenarios
**Dependencies**: All components + mock data
**Performance Target**: <50ms per operation

### Performance Tests (Embedded in other tests)

```
Similarity Calculator:
✓ 100 calculations in <500ms (<5ms each)

TitleMatcher:
✓ Single match in <50ms
✓ 100 candidates in <100ms
✓ Batch of 3 in <150ms

Overall:
✓ All operations within acceptable limits
```

## Test Categories by Risk Level

### Critical Path Tests (Must Pass) - 40 tests

1. **Exact matching** - Core functionality
2. **Manual mappings** - Known problem cases
3. **Skip list** - Prevent bad matches
4. **Performance** - User experience
5. **False positives** - Data quality

**Current Status**: 35/40 passing (87.5%)

### High Priority Tests (Should Pass) - 30 tests

1. **Fuzzy matching** - Most common case
2. **Edition normalization** - Common variants
3. **Year disambiguation** - Remakes/reboots
4. **Publisher prefixes** - Common pattern
5. **Roman numerals** - Game series

**Current Status**: 19/30 passing (63.3%)

### Medium Priority Tests (Nice to Pass) - 20 tests

1. **Acronym expansion** - Power users
2. **Complex combinations** - Edge cases
3. **Typo tolerance** - Robustness
4. **Ampersands** - Rare case
5. **Debug methods** - Development tools

**Current Status**: 17/20 passing (85%)

## Test Data Strategy

### Mock Data Patterns

#### Simple Cases (Portal, Portal 2)
```typescript
{
  gameId: '1',
  gameName: 'Portal 2',
  mainStory: 8,
  mainExtra: 12,
  completionist: 15,
  allStyles: 11,
  platforms: ['PC'],
  releaseDate: '2011-04-19'
}
```
**Purpose**: Basic functionality, exact matching

#### Ambiguous Cases (DOOM 2016 vs DOOM 1993)
```typescript
[
  { gameId: '1', gameName: 'DOOM', releaseDate: '1993-12-10' },
  { gameId: '2', gameName: 'DOOM 2016', releaseDate: '2016-05-13' }
]
```
**Purpose**: Year disambiguation, prioritization

#### Complex Cases (The Witcher 3 GOTY)
```typescript
{
  gameId: '1',
  gameName: 'The Witcher 3: Wild Hunt',
  // Test with: "The Witcher® 3: Wild Hunt - Game of the Year Edition"
}
```
**Purpose**: Special chars, editions, articles, subtitles

#### Negative Cases (Team Fortress 2)
```typescript
// Should be skipped (multiplayer-only)
```
**Purpose**: Skip list functionality

### Test Data Coverage Matrix

| Feature | Simple | Medium | Complex | Edge Case |
|---------|--------|--------|---------|-----------|
| Exact Match | ✓ Portal | | | |
| Special Chars | | ✓ Rainbow Six® | ✓ Tom Clancy's™ | |
| Editions | | ✓ GOTY | ✓ Remastered | ✓ Definitive |
| Roman Numerals | | ✓ GTA V | ✓ Final Fantasy VII | |
| Acronyms | | ✓ CSGO | | ✗ COD MW |
| Years | | ✓ DOOM (2016) | | ✓ (1979) invalid |
| Publisher | | | ✓ Sid Meier's | ✓ Tom Clancy's |
| Typos | | | | ✗ Portla 2 |
| Ampersands | | | | ✗ D & D |

Legend: ✓ Tested & Passing, ✗ Tested & Failing, Blank = Not Tested

## Mock Strategy

### No External Dependencies Required

The title matching system is self-contained:
- ✓ No API calls
- ✓ No database queries
- ✓ No file system access
- ✓ Pure functions + in-memory data

### Mock Data Approach

1. **HLTBSearchResult arrays** - Inline in tests
2. **Manual mappings** - Real data structure imported
3. **Performance.now()** - Mocked in setup.ts
4. **No Chrome APIs needed** - Pure TypeScript logic

## Performance Benchmarking

### Methodology

```typescript
test('should complete matching in <50ms', async () => {
  const startTime = performance.now();
  await matcher.findBestMatch('Portal 2', mockHLTBResults);
  const endTime = performance.now();
  const elapsed = endTime - startTime;
  expect(elapsed).toBeLessThan(50);
});
```

### Performance Targets

| Operation | Target | Current | Status |
|-----------|--------|---------|--------|
| Similarity calculation | <5ms | ~0.05ms | ✅ 100x under |
| Single match | <50ms | ~1-5ms | ✅ 10x under |
| 100 candidates | <100ms | ~5-10ms | ✅ 10x under |
| Batch 3 titles | <150ms | ~3-15ms | ✅ 10x under |

**Performance Buffer**: System is 10-100x faster than required, providing significant headroom for future features.

### Performance Test Coverage

- ✓ Similarity algorithms (individual)
- ✓ Single match operations
- ✓ Large result sets (100 candidates)
- ✓ Batch processing
- ✓ Worst-case scenarios (no matches found)

## Edge Case Coverage

### Currently Tested

1. ✓ Empty strings
2. ✓ Null/undefined inputs
3. ✓ Single character titles
4. ✓ Very long titles (>100 chars)
5. ✓ Titles with numbers (2064: Read Only Memories)
6. ✗ Ampersands (D & D)
7. ✓ Invalid years (1979, 2030)
8. ✓ Identical titles (Portal in multiple results)
9. ✓ No matches found
10. ✓ Completely different games

### Additional Edge Cases to Consider

1. **Unicode characters** - Japanese/Chinese/Korean titles
2. **Multiple colons** - "Game: Subtitle: Edition: Year"
3. **Numbers in titles** - "2064", "7 Days to Die"
4. **All caps** - "DOOM", "RAGE"
5. **Special formatting** - "half-life", "Half-Life", "HALF-LIFE"
6. **Parentheticals** - "Game (Beta)", "Game (Early Access)"
7. **Trademark variations** - "®", "™", "©" in different positions
8. **Multiple editions** - "Deluxe GOTY Ultimate Edition"

## Test Maintenance Strategy

### Test Organization

```
tests/title-matching.test.ts
├── TitleNormalizer (20 tests)
│   ├── Minimal Normalization
│   ├── Standard Normalization
│   ├── Aggressive Normalization
│   └── Utility Methods
├── SimilarityCalculator (16 tests)
│   ├── Levenshtein
│   ├── Dice Coefficient
│   ├── Jaro-Winkler
│   ├── Combined
│   └── Word Similarity
├── Manual Mappings (9 tests)
│   ├── Database Structure
│   ├── Mapping Functions
│   └── Skip List
├── TitleMatcher (36 tests)
│   ├── Exact Matching
│   ├── Manual Mapping Priority
│   ├── Year-Specific Matching
│   ├── Edition Normalization
│   ├── Roman Numeral Conversion
│   ├── Acronym Expansion
│   ├── Skip List
│   ├── Publisher Prefix
│   ├── Fuzzy Matching
│   ├── False Positive Prevention
│   ├── Confidence Scores
│   ├── Performance Requirements
│   ├── Edge Cases
│   └── Match Details
└── End-to-End Integration (9 tests)
    ├── Real-World Scenarios
    └── Strategy Priority
```

### Adding New Tests

1. **Identify category** - Unit, Integration, or E2E
2. **Create descriptive test name** - "should handle X when Y"
3. **Arrange** - Set up mock data
4. **Act** - Call the function
5. **Assert** - Verify expected behavior
6. **Document** - Add comments for complex logic

Example template:
```typescript
test('should handle new edge case', async () => {
  // Arrange
  const input = 'test case';
  const expected = 'expected result';
  const mockResults: HLTBSearchResult[] = [/* ... */];

  // Act
  const result = await matcher.findBestMatch(input, mockResults);

  // Assert
  expect(result).not.toBeNull();
  expect(result?.match?.gameName).toBe(expected);
  expect(result?.confidence).toBeGreaterThan(0.8);
});
```

### Regression Prevention

1. **Never delete passing tests** without documentation
2. **Add test before fixing bug** (TDD approach)
3. **Run full suite before commits**
4. **Monitor test execution time** (<2s target)
5. **Review failures immediately** (don't accumulate)

## Confidence Score Validation

### Score Ranges and Meaning

| Range | Method | Meaning | Action |
|-------|--------|---------|--------|
| 1.00 | Exact, Manual, Year-Specific | Perfect match | Use immediately |
| 0.90-0.99 | Fuzzy Standard | Very high confidence | Use with high trust |
| 0.80-0.89 | Fuzzy Standard/Aggressive | Good match | Use with normal trust |
| 0.70-0.79 | Fuzzy Aggressive, Word Match | Acceptable match | Consider review |
| <0.70 | Rejected | Low confidence | Do not use |

### Current Threshold Analysis

- **EXACT_MATCH_THRESHOLD**: 1.0 ✅ Correct
- **FUZZY_MATCH_THRESHOLD**: 0.8 ⚠️ May need tuning to 0.75-0.78
- **AGGRESSIVE_MATCH_THRESHOLD**: 0.7 ✅ Appropriate
- **WORD_MATCH_THRESHOLD**: 0.75 ✅ Appropriate

### Test Coverage for Confidence

✓ 1.0 scores verified (exact, manual mappings)
✓ High confidence fuzzy matches (>0.8)
✓ Lower confidence aggressive matches (0.7-0.8)
✓ Threshold enforcement (reject <0.7)
⚠️ Edge case at 0.759 (GOTY edition) suggests threshold tuning needed

## Continuous Integration Strategy

### Pre-Commit Checks

```bash
# Run before every commit
npm test -- title-matching.test.ts --coverage

# Coverage targets
Statements: 80%
Branches: 75%
Functions: 80%
Lines: 80%
```

### CI Pipeline

```yaml
Test Stages:
1. Unit Tests (fast, must pass)
2. Integration Tests (medium, must pass)
3. Performance Tests (fast, must pass)
4. E2E Tests (slower, must pass)

Failure Actions:
- Block merge if any critical tests fail
- Generate failure report
- Notify team
- Track failure trends
```

### Test Execution Frequency

- **On file save**: Fast unit tests only
- **Before commit**: Full test suite
- **On PR**: Full suite + coverage report
- **Nightly**: Full suite + performance benchmarks
- **Before release**: Full suite + manual validation

## Success Metrics

### Current Status

- ✅ **Test Count**: 90 tests (comprehensive)
- ⚠️ **Pass Rate**: 78.9% (target: >90%)
- ✅ **Performance**: All within targets
- ✅ **Coverage**: Core paths well-covered
- ⚠️ **Integration**: Some real-world cases failing

### Target Metrics

- **Pass Rate**: >90% (81/90 tests)
- **Performance**: <50ms per match (currently <10ms)
- **False Positive Rate**: <1% (currently 0% - very strict)
- **False Negative Rate**: <5% (currently ~21% - too strict)
- **Coverage**: >80% all metrics

### Improvement Roadmap

**Phase 1**: Fix Critical Issues (Current -> 85% pass rate)
- Fix TitleNormalizer.removeSubtitles()
- Fix TitleMatcher.getMatchDetails() bug
- Implement publisher prefix removal
- Estimated: 2-3 hours

**Phase 2**: Enhance Matching (85% -> 92% pass rate)
- Tune confidence thresholds
- Add ampersand normalization
- Fix apostrophe handling
- Implement multi-word acronym expansion
- Estimated: 2-3 hours

**Phase 3**: Polish (92% -> 95%+ pass rate)
- Optimize word similarity
- Improve edge case handling
- Add more real-world test cases
- Performance optimizations
- Estimated: 2-3 hours

## Conclusion

The title matching test suite provides **comprehensive coverage** with 90 well-structured tests spanning unit, integration, and end-to-end scenarios. With a 79% pass rate, the system has a **solid foundation** but requires targeted fixes in normalization, integration, and threshold tuning.

**Key Strengths**:
- Excellent performance (10-100x under targets)
- Good unit test coverage
- No false positives
- Well-organized test structure

**Key Improvements Needed**:
- Title normalization edge cases
- Publisher prefix removal
- Confidence threshold tuning
- Multi-word acronym support

**Estimated Time to 90%+ Pass Rate**: 6-9 hours of focused development.
