# HowLongToBeat Steam Integration - Chrome Extension Design Document

## 1. Executive Summary

### 1.1 Purpose
Design and implement a Chrome Extension that automatically displays game completion time data from HowLongToBeat.com (HLTB) directly on Steam store pages, enhancing the user's ability to make informed purchasing decisions.

### 1.2 Key Features
- Automatic detection of Steam game pages
- Real-time fetching of HLTB data
- Seamless UI integration with Steam's existing design
- Caching mechanism for performance optimization
- Support for both Steam store and community pages

## 2. Technical Architecture

### 2.1 Extension Components

#### 2.1.1 Manifest File (manifest.json)
```json
{
  "manifest_version": 3,
  "name": "HLTB for Steam",
  "version": "1.0.0",
  "description": "Display HowLongToBeat completion times on Steam pages",
  "permissions": [
    "storage",
    "activeTab"
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
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    }
  }
}
```

#### 2.1.2 Content Script (content.js)
- **Purpose**: Inject HLTB data into Steam pages
- **Responsibilities**:
  - Detect game title from Steam page
  - Extract Steam App ID
  - Request HLTB data from background script
  - Inject UI component into Steam page
  - Handle dynamic page updates (SPA navigation)

#### 2.1.3 Background Service Worker (background.js)
- **Purpose**: Handle API requests and data management
- **Responsibilities**:
  - Manage HLTB API requests
  - Implement caching strategy
  - Handle CORS issues via proxy or scraping
  - Rate limiting and request queuing
  - Data persistence using Chrome Storage API

#### 2.1.4 Popup Interface (popup.html/popup.js)
- **Purpose**: Extension settings and status
- **Features**:
  - Enable/disable extension
  - Clear cache
  - View statistics
  - Configure display preferences

### 2.2 Data Flow Architecture

```
1. User navigates to Steam game page
2. Content script detects page load
3. Extract game information (title, app ID)
4. Content script messages background worker
5. Background worker checks cache
6. If not cached or expired:
   - Query HLTB API/scrape data
   - Parse and normalize data
   - Store in cache
7. Return data to content script
8. Content script injects UI component
9. Display HLTB data on Steam page
```

## 3. Data Integration Strategy

### 3.1 HLTB Data Acquisition

#### Option 1: Web Scraping (Recommended)
Since HLTB doesn't provide an official API:
- Use fetch() to retrieve HLTB search results
- Parse HTML using DOMParser
- Extract completion times from result cards
- Handle multiple search results with fuzzy matching

#### Option 2: Unofficial API
- Use community-maintained HLTB API endpoints
- Implement fallback to scraping if API fails
- Monitor API stability and update endpoints as needed

### 3.2 Game Title Matching Algorithm
```javascript
function matchGameTitle(steamTitle, hltbResults) {
  // 1. Exact match
  // 2. Remove special characters and compare
  // 3. Remove subtitle after colon/dash
  // 4. Levenshtein distance for fuzzy matching
  // 5. Manual mapping for known mismatches
}
```

### 3.3 Caching Strategy
- **Storage**: Chrome Storage API (local)
- **Cache Duration**: 7 days per game
- **Cache Structure**:
```javascript
{
  "appId_440": {
    "steamTitle": "Team Fortress 2",
    "hltbData": {
      "mainStory": "N/A",
      "mainExtra": "N/A",
      "completionist": "N/A",
      "allStyles": "139 Hours"
    },
    "timestamp": 1677649200000,
    "version": "1.0.0"
  }
}
```

## 4. User Interface Design

### 4.1 Display Location Options

#### Option 1: Above Purchase Area (Recommended)
- Insert before "Add to Cart" section
- Maintains visibility during scroll
- Doesn't interfere with Steam's layout

#### Option 2: In Game Details Sidebar
- Add to right sidebar with other game info
- Consistent with Steam's information hierarchy

### 4.2 UI Component Design

```html
<div class="hltb-container">
  <div class="hltb-header">
    <img src="hltb-logo.svg" alt="HLTB">
    <span>HowLongToBeat</span>
  </div>
  <div class="hltb-times">
    <div class="hltb-time-box">
      <div class="hltb-label">Main Story</div>
      <div class="hltb-hours">12 Hours</div>
    </div>
    <div class="hltb-time-box">
      <div class="hltb-label">Main + Extras</div>
      <div class="hltb-hours">24 Hours</div>
    </div>
    <div class="hltb-time-box">
      <div class="hltb-label">Completionist</div>
      <div class="hltb-hours">48 Hours</div>
    </div>
  </div>
  <div class="hltb-footer">
    <a href="#" class="hltb-link">View on HowLongToBeat →</a>
  </div>
</div>
```

### 4.3 Visual Styling
- Match Steam's dark theme
- Use Steam's color palette (#1b2838, #2a475e, #66c0f4)
- Responsive design for different screen sizes
- Smooth animations for loading states
- Error states for missing data

## 5. Implementation Roadmap

### Phase 1: MVP (Week 1-2)
- [x] Basic extension structure
- [x] Steam page detection
- [x] Game title extraction
- [x] HLTB data fetching (scraping)
- [x] Simple UI injection
- [x] Basic caching

### Phase 2: Enhancement (Week 3-4)
- [ ] Improved matching algorithm
- [ ] Better error handling
- [ ] Loading animations
- [ ] Popup settings interface
- [ ] Multiple language support

### Phase 3: Optimization (Week 5-6)
- [ ] Performance optimization
- [ ] Advanced caching strategies
- [ ] Batch processing for wishlists
- [ ] User preferences persistence
- [ ] Analytics integration

### Phase 4: Polish (Week 7-8)
- [ ] Cross-browser compatibility
- [ ] Comprehensive testing
- [ ] User documentation
- [ ] Chrome Web Store preparation
- [ ] Marketing materials

## 6. Technical Challenges & Solutions

### 6.1 CORS Restrictions
**Challenge**: Direct API calls to HLTB blocked by CORS
**Solutions**:
- Implement proxy server (increases complexity)
- Use background service worker for requests
- Web scraping with proper headers

### 6.2 Dynamic Content Loading
**Challenge**: Steam uses dynamic content loading
**Solutions**:
- MutationObserver for DOM changes
- Event delegation for dynamically added elements
- Periodic checks for page navigation

### 6.3 Rate Limiting
**Challenge**: Too many requests to HLTB
**Solutions**:
- Implement request queue with delays
- Aggressive caching strategy
- Batch requests where possible

### 6.4 Game Title Mismatches
**Challenge**: Steam and HLTB use different game titles
**Solutions**:
- Fuzzy string matching algorithms
- Manual mapping database
- User-submitted corrections

## 7. Security Considerations

### 7.1 Permissions Minimization
- Only request necessary permissions
- Use activeTab instead of tabs permission
- Limit host permissions to required domains

### 7.2 Data Privacy
- No user data collection without consent
- Local storage only (no external servers)
- Clear privacy policy in extension description

### 7.3 Content Security Policy
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

## 8. Testing Strategy

### 8.1 Unit Tests
- Game title matching algorithm
- Cache management functions
- Data parsing utilities

### 8.2 Integration Tests
- Steam page detection
- HLTB data fetching
- UI injection on various Steam pages

### 8.3 Manual Testing Checklist
- [ ] Different game types (AAA, indie, unreleased)
- [ ] Various Steam page layouts
- [ ] Different languages
- [ ] Network conditions (slow, offline)
- [ ] Cache scenarios (empty, expired, corrupted)

## 9. Performance Metrics

### 9.1 Target Metrics
- Page load impact: < 100ms
- Data fetch time: < 2 seconds
- Memory usage: < 10MB
- Cache hit rate: > 80%

### 9.2 Monitoring
- Performance.now() for timing
- Chrome DevTools for memory profiling
- User feedback for real-world performance

## 10. Monetization Strategy (Optional)

### 10.1 Freemium Model
- Basic features free
- Premium: wishlist batch processing, advanced filters
- No ads to maintain user trust

### 10.2 Donation Model
- GitHub Sponsors
- Buy Me a Coffee integration
- Patreon for ongoing support

## 11. Legal Considerations

### 11.1 Terms of Service Compliance
- Review Steam's ToS for automation policies
- Respect HLTB's robots.txt and usage guidelines
- Include appropriate disclaimers

### 11.2 Intellectual Property
- No use of Steam or HLTB logos without permission
- Clear attribution to data sources
- Open-source license (MIT recommended)

## 12. Deployment & Distribution

### 12.1 Chrome Web Store
- Prepare store listing assets
- Write compelling description
- Create promotional screenshots
- Set up developer account

### 12.2 Version Management
- Semantic versioning (major.minor.patch)
- Automated build pipeline
- GitHub releases for source code

### 12.3 Update Strategy
- Auto-update through Chrome Web Store
- Migration scripts for breaking changes
- User notification for major updates

## 13. Support & Documentation

### 13.1 User Documentation
- README with installation instructions
- FAQ section
- Troubleshooting guide
- Video tutorial

### 13.2 Developer Documentation
- Code comments and JSDoc
- Architecture diagrams
- Contribution guidelines
- API documentation

### 13.3 Support Channels
- GitHub Issues for bug reports
- Discord/Reddit community
- Email support for premium users

## 14. Success Metrics

### 14.1 User Metrics
- Active users: 10,000+ in first year
- User retention: 60% after 30 days
- Store rating: 4.5+ stars

### 14.2 Technical Metrics
- Crash rate: < 0.1%
- API success rate: > 95%
- Page load regression: < 5%

## 15. Future Enhancements

### 15.1 Additional Features
- PlayStation/Xbox store integration
- Epic Games Store support
- GOG.com compatibility
- Mobile companion app
- Social features (share completion times)

### 15.2 Data Enhancements
- User-submitted completion times
- Difficulty-adjusted estimates
- Platform-specific times
- DLC completion times

### 15.3 Integration Possibilities
- Steam Deck compatibility
- Augmented Steam cooperation
- IsThereAnyDeal price tracking
- Metacritic scores

## Appendix A: Code Examples

### A.1 Game Title Extraction
```javascript
function extractGameTitle() {
  // Primary: og:title meta tag
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) return ogTitle.content;

  // Fallback: app name div
  const appName = document.querySelector('.apphub_AppName');
  if (appName) return appName.textContent.trim();

  // Last resort: page title
  return document.title.split(' on Steam')[0];
}
```

### A.2 HLTB Search Function
```javascript
async function searchHLTB(gameTitle) {
  const searchUrl = 'https://howlongtobeat.com/search';
  const formData = new FormData();
  formData.append('queryString', gameTitle);
  formData.append('t', 'games');
  formData.append('sorthead', 'popular');

  const response = await fetch(searchUrl, {
    method: 'POST',
    body: formData
  });

  const html = await response.text();
  return parseHLTBResults(html);
}
```

## Appendix B: Resources

### B.1 Development Tools
- Chrome Extension Developer Dashboard
- Chrome DevTools for extension debugging
- Webpack for bundling
- Jest for testing

### B.2 References
- Chrome Extension API Documentation
- Steam Web API Documentation
- HowLongToBeat.com
- MutationObserver API

### B.3 Similar Projects
- Augmented Steam
- Steam Database
- Enhanced Steam

---

*Document Version: 1.0.0*
*Last Updated: September 2024*
*Author: Chrome Extension Development Team*