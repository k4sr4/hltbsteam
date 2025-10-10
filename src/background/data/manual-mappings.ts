/**
 * Manual Game Title Mappings
 *
 * Hard-coded mappings for games with known title variations that are
 * difficult to match algorithmically. These override fuzzy matching.
 */

/**
 * Steam Title (normalized) -> HLTB Title (normalized)
 *
 * Both keys and values should be normalized (lowercase, no special chars)
 * The matcher will normalize both before lookup
 */
export const MANUAL_MAPPINGS: Record<string, string> = {
  // Counter-Strike variants
  'counter strike global offensive': 'counter strike global offensive',
  'cs go': 'counter strike global offensive',
  'csgo': 'counter strike global offensive',
  'counter strike 2': 'counter strike 2',
  'cs2': 'counter strike 2',

  // DOOM series (year disambiguation)
  'doom': 'doom 2016',
  'doom 2016': 'doom 2016',
  'doom 3': 'doom 3',
  'doom eternal': 'doom eternal',
  'doom 64': 'doom 64',
  'doom 1993': 'doom',
  'doom ii': 'doom ii hell on earth',

  // Prey (year disambiguation)
  'prey': 'prey 2017',
  'prey 2017': 'prey 2017',
  'prey 2006': 'prey',

  // Hitman series
  'hitman 3': 'hitman 3 2021',
  'hitman 2': 'hitman 2 2018',
  'hitman': 'hitman 2016',

  // Call of Duty (year disambiguation)
  'call of duty modern warfare 2': 'call of duty modern warfare ii 2022',
  'modern warfare 2': 'call of duty modern warfare ii 2022',
  'modern warfare ii': 'call of duty modern warfare ii 2022',
  'mw2': 'call of duty modern warfare ii 2022',
  'call of duty modern warfare': 'call of duty modern warfare 2019',
  'modern warfare': 'call of duty modern warfare 2019',
  'call of duty black ops': 'call of duty black ops',
  'black ops': 'call of duty black ops',

  // God of War
  'god of war': 'god of war 2018',
  'god of war 2018': 'god of war 2018',

  // Black Mesa
  'black mesa': 'black mesa',

  // Half-Life series
  'half life alyx': 'half life alyx',
  'half life 2': 'half life 2',

  // Resident Evil remakes
  'resident evil 2': 'resident evil 2 2019',
  'resident evil 3': 'resident evil 3 2020',
  'resident evil 4': 'resident evil 4 2023',

  // Final Fantasy
  'final fantasy vii remake': 'final fantasy vii remake intergrade',
  'final fantasy 7 remake': 'final fantasy vii remake intergrade',
  'ff7 remake': 'final fantasy vii remake intergrade',

  // Persona
  'persona 4 golden': 'persona 4 golden',
  'persona 5 royal': 'persona 5 royal',

  // Elder Scrolls (editions)
  'the elder scrolls v skyrim special edition': 'the elder scrolls v skyrim',
  'skyrim special edition': 'the elder scrolls v skyrim',
  'skyrim': 'the elder scrolls v skyrim',

  // Dark Souls remasters
  'dark souls remastered': 'dark souls',
  'dark souls prepare to die edition': 'dark souls',

  // BioShock remasters
  'bioshock remastered': 'bioshock',
  'bioshock 2 remastered': 'bioshock 2',
  'bioshock infinite complete edition': 'bioshock infinite',

  // Mafia
  'mafia definitive edition': 'mafia definitive edition',

  // Modern indies
  'cyberpunk 2077': 'cyberpunk 2077',
  'it takes two': 'it takes two',
  'a way out': 'a way out',

  // Multiplayer/Battle Royale
  'fall guys': 'fall guys ultimate knockout',
  'among us': 'among us',
  'phasmophobia': 'phasmophobia',
  'valheim': 'valheim',

  // GTA series
  'grand theft auto v': 'grand theft auto 5',
  'grand theft auto 5': 'grand theft auto 5',
  'gta v': 'grand theft auto 5',
  'gta 5': 'grand theft auto 5',
  'gta iv': 'grand theft auto 4',
  'gta 4': 'grand theft auto 4',
  'gta san andreas': 'grand theft auto san andreas',

  // Rainbow Six
  'tom clancys rainbow six siege': 'rainbow six siege',
  'rainbow six siege': 'rainbow six siege',
  'r6 siege': 'rainbow six siege',

  // The Witcher
  'the witcher 3 wild hunt': 'the witcher 3 wild hunt',
  'the witcher 3 wild hunt game of the year edition': 'the witcher 3 wild hunt',
  'the witcher 3 goty': 'the witcher 3 wild hunt',
  'witcher 3': 'the witcher 3 wild hunt',

  // Sid Meier's games (remove creator name)
  'sid meiers civilization vi': 'civilization vi',
  'civilization vi': 'civilization vi',
  'civilization 6': 'civilization vi',
  'civ 6': 'civilization vi',

  // Halo
  'halo the master chief collection': 'halo the master chief collection',
  'halo mcc': 'halo the master chief collection',

  // Baldur's Gate
  'baldurs gate 3': 'baldurs gate 3',
  'baldurs gate iii': 'baldurs gate 3',

  // Elden Ring
  'elden ring': 'elden ring',

  // FromSoftware titles
  'dark souls iii': 'dark souls 3',
  'dark souls 3': 'dark souls 3',
  'sekiro shadows die twice': 'sekiro shadows die twice',

  // Rockstar titles
  'red dead redemption 2': 'red dead redemption 2',
  'rdr2': 'red dead redemption 2',

  // Hades
  'hades': 'hades',
  'hades ii': 'hades ii',
  'hades 2': 'hades ii',

  // Portal
  'portal': 'portal',
  'portal 2': 'portal 2',

  // Dishonored
  'dishonored': 'dishonored',
  'dishonored 2': 'dishonored 2',
  'dishonored death of the outsider': 'dishonored death of the outsider',

  // Metro
  'metro 2033': 'metro 2033',
  'metro last light': 'metro last light',
  'metro exodus': 'metro exodus',

  // Assassin's Creed
  'assassins creed valhalla': 'assassins creed valhalla',
  'assassins creed odyssey': 'assassins creed odyssey',
  'ac valhalla': 'assassins creed valhalla',
  'ac odyssey': 'assassins creed odyssey'
};

/**
 * Games that should be skipped (multiplayer-only, no completion times)
 *
 * These are normalized titles (lowercase, no special chars)
 */
export const SKIP_GAMES = new Set([
  'team fortress 2',
  'tf2',
  'dota 2',
  'counter strike 2',
  'cs2',
  'apex legends',
  'valorant',
  'league of legends',
  'lol',
  'warframe',
  'path of exile',
  'poe',
  'lost ark',
  'destiny 2',
  'rocket league',
  'overwatch',
  'overwatch 2',
  'rainbow six extraction',
  'the finals',
  'battlefield 2042',
  'call of duty warzone',
  'warzone',
  'fortnite',
  'pubg',
  'playerunknowns battlegrounds'
]);

/**
 * Common publisher/developer prefixes to remove for matching
 */
export const PUBLISHER_PREFIXES = [
  'sid meiers',
  'tom clancys',
  'tom clancy',
  'sid meier',
  'the',
  'a ',
  'an '
];

/**
 * Year-specific mappings for games with remakes/reboots
 * Format: { title: { year: hltbTitle } }
 */
export const YEAR_SPECIFIC_MAPPINGS: Record<
  string,
  Record<number, string>
> = {
  doom: {
    1993: 'doom',
    2016: 'doom 2016'
  },
  'modern warfare': {
    2007: 'call of duty 4 modern warfare',
    2019: 'call of duty modern warfare 2019'
  },
  'modern warfare 2': {
    2009: 'call of duty modern warfare 2',
    2022: 'call of duty modern warfare ii 2022'
  },
  'god of war': {
    2005: 'god of war',
    2018: 'god of war 2018'
  },
  prey: {
    2006: 'prey',
    2017: 'prey 2017'
  },
  'resident evil 2': {
    1998: 'resident evil 2',
    2019: 'resident evil 2 2019'
  },
  'resident evil 3': {
    1999: 'resident evil 3 nemesis',
    2020: 'resident evil 3 2020'
  },
  'resident evil 4': {
    2005: 'resident evil 4',
    2023: 'resident evil 4 2023'
  }
};

/**
 * Check if a title should be skipped
 */
export function shouldSkipGame(normalizedTitle: string): boolean {
  return SKIP_GAMES.has(normalizedTitle);
}

/**
 * Get manual mapping for a title
 */
export function getManualMapping(normalizedTitle: string): string | null {
  return MANUAL_MAPPINGS[normalizedTitle] || null;
}

/**
 * Get year-specific mapping
 */
export function getYearSpecificMapping(
  normalizedTitle: string,
  year: number | null
): string | null {
  if (!year || !YEAR_SPECIFIC_MAPPINGS[normalizedTitle]) {
    return null;
  }

  return YEAR_SPECIFIC_MAPPINGS[normalizedTitle][year] || null;
}