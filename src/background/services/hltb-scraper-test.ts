/**
 * HLTB Scraper Test and Demo
 * Simple test file to validate scraper functionality
 */

import { hltbScraper } from './hltb-scraper';

// Test the scraper with a few popular games
async function testScraper() {
  console.log('Testing HLTB Web Scraper...\n');

  const testGames = [
    'Portal',
    'Portal 2',
    'Half-Life 2',
    'Hades',
    'The Witcher 3'
  ];

  for (const game of testGames) {
    console.log(`\n--- Testing: ${game} ---`);

    try {
      const startTime = Date.now();
      const result = await hltbScraper.scrapeGameData(game);
      const duration = Date.now() - startTime;

      if (result && result.games.length > 0) {
        const bestMatch = hltbScraper.findBestMatch(game, result.games);

        if (bestMatch) {
          console.log(`✅ Found match: "${bestMatch.name}"`);
          console.log(`   Main Story: ${bestMatch.mainStory || 'N/A'} hours`);
          console.log(`   Main + Extra: ${bestMatch.mainExtra || 'N/A'} hours`);
          console.log(`   Completionist: ${bestMatch.completionist || 'N/A'} hours`);
          console.log(`   All Styles: ${bestMatch.allStyles || 'N/A'} hours`);
          console.log(`   Time taken: ${duration}ms`);
        } else {
          console.log(`❌ No good match found for "${game}"`);
        }
      } else {
        console.log(`❌ No results found for "${game}"`);
      }
    } catch (error) {
      console.error(`❌ Error testing "${game}":`, error);
    }
  }

  // Test scraper health
  console.log('\n--- Scraper Health Check ---');
  try {
    const health = await hltbScraper.getScraperStatus();
    console.log('Health Status:', health);
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

// Utility function to parse time strings (for manual testing)
function testTimeStringParsing() {
  console.log('\n--- Testing Time String Parsing ---');

  const testTimeStrings = [
    '12 Hours',
    '12½ Hours',
    '20 - 25 Hours',
    '3h 30m',
    '--',
    'N/A',
    '100+ Hours'
  ];

  // Access the private method through the class instance
  // Note: This is for testing only - in real usage the parsing is internal
  const scraper = hltbScraper as any;

  testTimeStrings.forEach(timeStr => {
    try {
      const parsed = scraper.parseTimeString ? scraper.parseTimeString(timeStr) : 'Method not accessible';
      console.log(`"${timeStr}" -> ${parsed} hours`);
    } catch (error) {
      console.log(`"${timeStr}" -> Error: ${error}`);
    }
  });
}

// Export for use in service worker context
export { testScraper, testTimeStringParsing };

// Uncomment to run tests immediately when imported
// testScraper().then(() => console.log('Scraper tests completed'));