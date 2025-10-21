# Adding Games to the Fallback Database

This guide explains how to add new games to the HLTB fallback database.

## Quick Start

1. **Edit the JSON file**: `src/background/services/fallback-data.json`
2. **Add your game entry** to the `games` array
3. **Rebuild**: `npm run build`
4. **Test**: Reload extension and visit the game's Steam page

## Game Entry Format

```json
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
```

### Field Explanations

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ Yes | Official game name (must match Steam) |
| `aliases` | string[] | ❌ No | Alternative names, abbreviations |
| `data.mainStory` | number/null | ✅ Yes | Hours to beat main story |
| `data.mainExtra` | number/null | ✅ Yes | Hours for main + extras |
| `data.completionist` | number/null | ✅ Yes | Hours to 100% the game |
| `data.allStyles` | number/null | ✅ Yes | Average across all playstyles |
| `confidence` | string | ❌ No | "high", "medium", or "low" |
| `lastUpdated` | string | ❌ No | YYYY-MM format |

## Finding HLTB Data

1. Go to https://howlongtobeat.com
2. Search for the game
3. Copy the times from the first result
4. **Note**: HLTB shows times in hours, use whole numbers

### Example: Pumpkin Jack

HLTB page shows:
- Main Story: 4½ Hours
- Main + Extra: 5½ Hours
- Completionist: 6½ Hours
- All Styles: 5 Hours

JSON entry:
```json
{
  "title": "Pumpkin Jack",
  "aliases": [],
  "data": {
    "mainStory": 5,
    "mainExtra": 6,
    "completionist": 7,
    "allStyles": 5
  },
  "confidence": "high",
  "lastUpdated": "2025-10"
}
```

## Multiplayer/Live Service Games

For games without completion times (Dota 2, CS2, etc.):

```json
{
  "title": "Counter-Strike 2",
  "aliases": ["cs2", "cs 2"],
  "data": {
    "mainStory": null,
    "mainExtra": null,
    "completionist": null,
    "allStyles": null
  },
  "confidence": "high"
}
```

## Confidence Levels

- **high**: Official HLTB data with 50+ player submissions
- **medium**: HLTB data with 10-49 submissions or estimates
- **low**: Rough estimates or very few submissions

## Common Aliases

Add common variations players might search for:

```json
{
  "title": "The Elder Scrolls V: Skyrim",
  "aliases": ["skyrim", "skyrim special edition", "skyrim se"],
  ...
}
```

```json
{
  "title": "Grand Theft Auto V",
  "aliases": ["gta 5", "gta v", "gtav"],
  ...
}
```

## Testing Your Changes

1. **Build**: `npm run build`
2. **Reload extension** in Chrome (chrome://extensions/)
3. **Visit Steam page** for the game
4. **Check service worker console** for logs:
   ```
   [HLTB Fallback] Direct match found for: Pumpkin Jack
   ```

## Tips

- ✅ Round to whole numbers (5.5 → 6 hours)
- ✅ Match Steam's official game title exactly
- ✅ Add popular abbreviations as aliases
- ✅ Use `null` for multiplayer-only games
- ✅ Update `lastUpdated` to current YYYY-MM
- ❌ Don't add DLC as separate entries (unless they have standalone times)
- ❌ Don't duplicate existing games

## Current Database Stats

- **Version**: 1.0.0
- **Total Games**: 100
- **Last Updated**: 2025-10-20

## Contributing

Want to add many games? Consider:
1. Create a batch of 10-20 games
2. Test them thoroughly
3. Submit via GitHub issue or PR
4. Include HLTB source links

## Future Plans

- **Phase 2**: Expand to 200-300 games
- **Phase 3**: Community contributions
- **Phase 4**: Auto-sync with HLTB (if API becomes available)

---

**Need help?** Check existing entries in `fallback-data.json` for examples!
