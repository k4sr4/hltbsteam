# Privacy Policy for HowLongToBeat for Steam Extension

**Last Updated**: [DATE]

## Overview

HowLongToBeat for Steam ("the Extension") is committed to protecting your privacy. This extension does not collect, store, or transmit any personal information.

## Data Collection

**We do NOT collect any personal data.**

The Extension:
- ❌ Does NOT track your browsing history
- ❌ Does NOT collect personal information
- ❌ Does NOT use analytics or tracking services
- ❌ Does NOT share data with third parties
- ❌ Does NOT use cookies for tracking

## Data Storage

The Extension stores the following data **locally on your device only**:

### Chrome Local Storage
- **Game completion time cache**: Stores HLTB data for games you've viewed (cached for 7 days)
- **User settings**: Your preference settings (cache duration, display options)
- **Error logs**: Technical error logs for debugging (optional, can be disabled)

**All data is stored locally in Chrome's storage and never leaves your device.**

## Permissions Explanation

The Extension requests the following permissions:

### `storage`
**Why**: To cache game completion times locally and save your settings
**Data**: Game titles and completion times, user preferences
**Scope**: Local only, never transmitted

### `alarms`
**Why**: To schedule automatic cache cleanup (every 24 hours)
**Data**: No data collected
**Scope**: Timer management only

### Host Permissions
**`*://store.steampowered.com/*`**
**Why**: To detect Steam game pages and inject completion time data
**Data**: Game title from page (not stored)
**Scope**: Read-only access to detect game information

**`*://steamcommunity.com/*`**
**Why**: To support Steam Community game pages
**Data**: Game title from page (not stored)
**Scope**: Read-only access to detect game information

**`*://howlongtobeat.com/*`**
**Why**: Fallback data source when game is not in local database
**Data**: Game title sent as search query
**Scope**: Read-only access to fetch completion time data

## Third-Party Services

The Extension may fetch game completion time data from:
- **HowLongToBeat.com**: Game completion time data (only when game is not in local database)

When fetching data from HowLongToBeat.com:
- Only the game title is sent as a search query
- No personal information is transmitted
- Subject to [HowLongToBeat.com's privacy policy](https://howlongtobeat.com/privacy)

## Data Security

- All cached data is stored using Chrome's secure storage API
- No data is transmitted to external servers (except game title to HowLongToBeat.com as described above)
- No authentication or user accounts required

## Data Retention

- **Cache data**: Automatically deleted after 7 days (configurable in settings)
- **User settings**: Retained until extension is uninstalled
- **Error logs**: Automatically cleared after 50 entries

## User Rights

You have full control over your data:

### View Your Data
Open Chrome DevTools → Application → Storage → Local Storage → Extension

### Delete Your Data
1. **Clear cache**: Click extension icon → Settings → "Clear Cache"
2. **Reset settings**: Click extension icon → Settings → "Reset Settings"
3. **Complete removal**: Uninstall the extension from Chrome

### Disable Data Collection
Error logging can be disabled in Settings (if implemented in future versions).

## Children's Privacy

This Extension does not knowingly collect data from children under 13. The Extension is designed for general Steam users and requires no registration or personal information.

## Changes to This Policy

We may update this Privacy Policy occasionally. Changes will be posted with an updated "Last Updated" date. Continued use of the Extension after changes constitutes acceptance of the updated policy.

## Open Source

This Extension is open source. You can review the complete source code at:
**[YOUR GITHUB REPOSITORY URL]**

## Contact

For privacy concerns or questions:
- **Email**: [YOUR EMAIL]
- **GitHub Issues**: [YOUR GITHUB REPOSITORY URL]/issues

## Compliance

This Extension complies with:
- Chrome Web Store Developer Program Policies
- GDPR (no personal data collected)
- CCPA (no personal data sold)

---

**Summary**: This extension does not collect personal information. It only caches game completion times locally on your device to improve performance. Your privacy is fully protected.
