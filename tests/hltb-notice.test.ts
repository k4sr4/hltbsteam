/**
 * HLTB Notice Tests
 * The classification that replaced the old "all times null => Multiplayer" bug:
 * distinguishes multiplayer-only, unreleased, and no-data games.
 */

import { getHLTBNoticeMessage } from '../src/content/hltb-notice';
import { HLTBData } from '../src/content/types/HLTB';

const NOW = 2026;

function data(overrides: Partial<HLTBData> = {}): HLTBData {
  return {
    mainStory: null,
    mainExtra: null,
    completionist: null,
    ...overrides
  };
}

describe('getHLTBNoticeMessage', () => {
  test('shows time boxes (null) when the game has any completion time', () => {
    expect(getHLTBNoticeMessage(data({ mainStory: 22 }), NOW)).toBeNull();
    expect(getHLTBNoticeMessage(data({ completionist: 95 }), NOW)).toBeNull();
  });

  test('labels a genuine multiplayer-only game', () => {
    expect(getHLTBNoticeMessage(data({ isMultiplayerOnly: true }), NOW))
      .toBe('Multiplayer Game - No completion times');
  });

  test('labels a multiplayer-only game even when HLTB reports co-op playtime', () => {
    // Dota 2 style: multiplayer-only but with non-null "main" playtime
    expect(getHLTBNoticeMessage(data({ isMultiplayerOnly: true, mainStory: 747 }), NOW))
      .toBe('Multiplayer Game - No completion times');
  });

  test('does NOT label an unreleased single-player game as multiplayer', () => {
    // GTA VI / TES VI style: no times, single-player, future or TBA release
    const future = getHLTBNoticeMessage(data({ releaseYear: 2027 }), NOW);
    expect(future).toBe('Not released yet - no completion times');
    expect(future).not.toContain('Multiplayer');
  });

  test('treats release year 0 (announced/TBA) as unreleased', () => {
    expect(getHLTBNoticeMessage(data({ releaseYear: 0 }), NOW))
      .toBe('Not released yet - no completion times');
  });

  test('shows generic no-data for a released game with no times', () => {
    expect(getHLTBNoticeMessage(data({ releaseYear: 2015 }), NOW))
      .toBe('No completion data yet');
  });

  test('shows generic no-data when release year is unknown (fallback/scraper path)', () => {
    // No releaseYear / isMultiplayerOnly (undefined) — e.g. bundled JSON fallback
    expect(getHLTBNoticeMessage(data(), NOW)).toBe('No completion data yet');
  });

  test('a same-year game with no data is treated as no-data, not unreleased', () => {
    expect(getHLTBNoticeMessage(data({ releaseYear: NOW }), NOW)).toBe('No completion data yet');
  });
});
