# HLTB Steam Extension - Claude Context

## Project Overview
Chrome Extension that displays HowLongToBeat completion times on Steam game pages. Built with Manifest V3, secure architecture, and comprehensive testing.

## Key Implementation Details

### Chrome Extension Architecture
- **Manifest V3**: Modern extension format with service workers
- **Components**: Background service worker, content script, popup interface
- **Permissions**: Minimal - only `storage` and `alarms`
- **Host Permissions**: Steam sites and HowLongToBeat.com only

### Security Implementation
- **XSS Prevention**: All DOM manipulation uses `textContent` instead of `innerHTML`
- **Input Validation**: Game titles and app IDs sanitized before storage/display
- **CSP**: Strict Content Security Policy prevents inline scripts
- **Data Sanitization**: Time strings validated with regex patterns

### Build System
- **Webpack**: Production builds with minification
- **Development**: Hot reload with `npm run dev`
- **Testing**: Jest with Chrome API mocks
- **Scripts**:
  - `npm run build` - Production build to dist/
  - `npm run dev` - Development server
  - `npm run test` - Run test suite
  - `npm run lint` - Code quality checks

### Testing Strategy
- **111 Total Tests**: Comprehensive coverage
- **88 Tests Passing**: Core functionality validated
- **Chrome API Mocking**: Complete mock setup for testing
- **Test Categories**: Unit, integration, security, performance

### Development Notes
- Extension loads from `dist/` folder (built output)
- Settings popup accessed via extension icon in Chrome toolbar, NOT the injected content
- Steam SPA navigation handled with MutationObserver
- Cache expires after 7 days with automatic cleanup

### File Structure
```
hltbsteam/
├── dist/                   # Built extension (load this in Chrome)
├── src/                    # Source organization
├── tests/                  # Jest test suite
├── manifest.json           # Extension manifest
├── background.js           # Service worker
├── content.js              # Steam page injection
├── popup.html/js/css       # Settings interface
├── styles.css              # Content styling
└── webpack.config.js       # Build configuration
```

### Known Issues
- Icons are placeholder PNGs (need actual design)
- HLTB API integration pending (placeholder data currently)
- Some JSDOM test limitations (navigation tests)
- TypeScript compilation issues with enhanced detection system (non-blocking)

### Steam Page Detection (Updated)
- **Current Implementation**: JavaScript with basic 2-strategy title extraction
- **Enhanced System Ready**: TypeScript implementation with 6-strategy detection
- **Page Support**: Both Store and Community pages
- **Injection Points**: Multiple fallback selectors for different page layouts
- **Performance**: Basic version ~15ms, Enhanced version targets <10ms

### Critical Lessons Learned
1. **MutationObserver Setup**: Must pass options to `observe()` method, not constructor
2. **Community vs Store Pages**: Different DOM structures require multiple injection strategies
3. **TypeScript Integration**: Webpack entry points must match actual file locations
4. **Build Process**: Can fallback to JavaScript when TypeScript compilation fails

### Next Implementation Steps
1. Real HLTB API integration
2. Proper icon design
3. ~~Enhanced Steam page detection~~ ✅ Architecture complete, needs TypeScript fixes
4. User preferences and themes
5. Chrome Web Store preparation