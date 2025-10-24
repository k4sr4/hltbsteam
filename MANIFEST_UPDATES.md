# Manifest.json Updates Needed for Publishing

## Current Status
Your `manifest.json` is mostly ready! Just a few updates needed before publishing.

## Required Updates

### 1. Update Homepage URL (Line 58)
```json
"homepage_url": "https://github.com/yourusername/hltb-steam"
```

**Action**: Replace with your actual GitHub URL or remove if you don't want to make it open source.

**Options**:
- Open source: `"homepage_url": "https://github.com/YOUR_USERNAME/hltb-steam"`
- No homepage: Remove this line entirely

### 2. Update Author (Line 57)
```json
"author": "HLTB Steam Extension"
```

**Action**: Replace with your name or organization:
```json
"author": "Your Name"
```

### 3. Consider Name Change (Line 3)
```json
"name": "HLTB for Steam"
```

**Consideration**: "HLTB" might not be clear to all users. Consider:
- "HowLongToBeat for Steam" (more descriptive)
- "HLTB for Steam" (current, shorter)

**Recommendation**: Keep current name for toolbar, use full name in store listing.

### 4. Enhance Description (Line 5)
```json
"description": "Display HowLongToBeat completion times on Steam pages"
```

**This is good!** Clear and concise. No change needed.

## Optional Enhancements

### Add Version Name (Optional)
```json
"version": "1.0.0",
"version_name": "1.0.0 - Initial Release"
```

This shows users a friendly version name.

### Add Short Name (Optional)
```json
"short_name": "HLTB Steam"
```

Used when space is limited (like mobile).

### Add Minimum Chrome Version (Recommended)
```json
"minimum_chrome_version": "88"
```

Manifest V3 requires Chrome 88+. This prevents installation on older versions.

## Permission Justifications

When submitting, you'll need to explain each permission. Here's what to say:

### `storage`
**Justification**: "Required to cache game completion time data locally for faster loading and offline access. Also stores user settings like cache duration preferences."

### `alarms`
**Justification**: "Required to schedule automatic cache cleanup every 24 hours to maintain optimal performance and storage usage."

### Host Permissions

#### `https://store.steampowered.com/*`
**Justification**: "Required to detect Steam game pages and inject completion time data. Read-only access to extract game title from the page."

#### `https://steamcommunity.com/*`
**Justification**: "Required to support Steam Community game pages. Read-only access to extract game title from the page."

#### `https://howlongtobeat.com/*`
**Justification**: "Required as fallback data source for games not in local database. Fetches completion time data directly from HowLongToBeat.com when needed."

## Updated Manifest.json Template

Here's your manifest with recommended updates:

```json
{
  "manifest_version": 3,
  "name": "HLTB for Steam",
  "short_name": "HLTB Steam",
  "version": "1.0.0",
  "version_name": "1.0.0 - Initial Release",
  "description": "Display HowLongToBeat completion times on Steam pages",
  "minimum_chrome_version": "88",

  "permissions": [
    "storage",
    "alarms"
  ],

  "host_permissions": [
    "https://store.steampowered.com/*",
    "https://steamcommunity.com/*",
    "https://howlongtobeat.com/*"
  ],

  "content_scripts": [
    {
      "matches": [
        "https://store.steampowered.com/app/*",
        "https://steamcommunity.com/app/*"
      ],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_end"
    }
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "action": {
    "default_popup": "popup.html",
    "default_title": "HLTB for Steam",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  },

  "author": "Your Name Here",
  "homepage_url": "https://github.com/yourusername/hltb-steam"
}
```

## Single Purpose Statement

Chrome requires a "Single Purpose" description. Use this:

**Single Purpose**: "This extension displays game completion time data from HowLongToBeat.com on Steam store pages to help users make informed purchasing decisions."

## Before Submitting

1. Update `author` and `homepage_url` in manifest.json
2. Copy updated manifest.json to `dist/manifest.json` (or rebuild)
3. Create icons (currently missing - this is critical!)
4. Test extension one more time
5. Create ZIP file

Next step: Create the icons!
