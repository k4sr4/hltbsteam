/**
 * Decide which explanatory notice (if any) to show in place of completion
 * times, using HLTB's own signals instead of guessing from null times.
 *
 * Returning null means the caller should render the normal time boxes.
 *
 * Rationale: "all completion times are null" is ambiguous — it is equally true
 * for a multiplayer-only game, an unreleased game, and a game HLTB simply has
 * no data for. Blanket-labeling all three "Multiplayer Game" (the old behavior)
 * mislabels unreleased single-player titles. HLTB distinguishes them via
 * comp_lvl_sp/mp (surfaced as isMultiplayerOnly) and release_world (releaseYear).
 */

import { HLTBData } from './types/HLTB';

export function getHLTBNoticeMessage(data: HLTBData, currentYear: number): string | null {
  // Multiplayer-only games have no single-player completion times, even when
  // HLTB records co-op/versus playtime — show the notice regardless of times.
  if (data.isMultiplayerOnly) {
    return 'Multiplayer Game - No completion times';
  }

  // Single-player (or unknown) game that has any completion time: show times.
  const hasCompletionTimes =
    !!data.mainStory || !!data.mainExtra || !!data.completionist;
  if (hasCompletionTimes) {
    return null;
  }

  // No times and not multiplayer: distinguish "not out yet" from "no data".
  // release_world === 0 means announced/TBA; a future year means upcoming.
  const releaseYear = data.releaseYear;
  const isUnreleased =
    releaseYear === 0 || (typeof releaseYear === 'number' && releaseYear > currentYear);

  return isUnreleased
    ? 'Not released yet - no completion times'
    : 'No completion data yet';
}
