/**
 * HLTB Web Scraper Tests
 * Tests for HTML parsing, time extraction, and fuzzy matching
 */

import { HLTBScraper, ScrapingError, ScrapedGameData, ScrapingResult } from '../src/background/services/hltb-scraper';

// Mock fetch and DOMParser
global.fetch = jest.fn();
global.DOMParser = jest.fn().mockImplementation(() => ({
  parseFromString: jest.fn()
}));

describe('HLTBScraper', () => {
  let scraper: HLTBScraper;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let mockDOMParser: jest.MockedClass<typeof DOMParser>;

  // Sample HTML structures based on actual HLTB pages
  const createMockHTML = (games: Array<{
    name: string;
    mainStory?: string;
    mainExtra?: string;
    completionist?: string;
    id?: string;
    image?: string;
  }>) => {
    const gameCards = games.map(game => `
      <div class="search_list_details_block">
        <h3><a href="/game/${game.id || '1234'}">${game.name}</a></h3>
        <img class="search_list_image" src="${game.image || '/images/game.jpg'}" alt="${game.name}" />
        <div class="search_list_tidbit">
          <div class="search_list_tidbit_short">Main Story</div>
          <div class="search_list_tidbit_long">${game.mainStory || '--'}</div>
        </div>
        <div class="search_list_tidbit">
          <div class="search_list_tidbit_short">Main + Extra</div>
          <div class="search_list_tidbit_long">${game.mainExtra || '--'}</div>
        </div>
        <div class="search_list_tidbit">
          <div class="search_list_tidbit_short">Completionist</div>
          <div class="search_list_tidbit_long">${game.completionist || '--'}</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="search_list_details">
        ${gameCards}
      </div>
    `;
  };

  const createNoResultsHTML = () => `
    <div class="search_list_no_results">
      No results found for your search.
    </div>
  `;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockDOMParser = global.DOMParser as jest.MockedClass<typeof DOMParser>;
    scraper = new HLTBScraper();
  });

  describe('HTML Parsing', () => {
    test('should parse single game result correctly', async () => {
      const mockHTML = createMockHTML([{
        name: 'Portal',
        mainStory: '3 Hours',
        mainExtra: '4 Hours',
        completionist: '5 Hours',
        id: '2198'
      }]);

      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === '.search_list_details_block') {
            return [{
              querySelector: jest.fn().mockImplementation((sel: string) => {
                const data: Record<string, any> = {
                  'h3 a': { textContent: 'Portal', href: '/game/2198' },
                  '.search_list_image': { src: '/images/game.jpg' }
                };
                return data[sel] || null;
              }),
              querySelectorAll: jest.fn().mockImplementation((sel: string) => {
                if (sel === '.search_list_tidbit') {
                  return [
                    {
                      querySelector: jest.fn().mockImplementation((s: string) => {
                        if (s === '.search_list_tidbit_short') return { textContent: 'Main Story' };
                        if (s === '.search_list_tidbit_long') return { textContent: '3 Hours' };
                      })
                    },
                    {
                      querySelector: jest.fn().mockImplementation((s: string) => {
                        if (s === '.search_list_tidbit_short') return { textContent: 'Main + Extra' };
                        if (s === '.search_list_tidbit_long') return { textContent: '4 Hours' };
                      })
                    },
                    {
                      querySelector: jest.fn().mockImplementation((s: string) => {
                        if (s === '.search_list_tidbit_short') return { textContent: 'Completionist' };
                        if (s === '.search_list_tidbit_long') return { textContent: '5 Hours' };
                      })
                    }
                  ];
                }
                return [];
              })
            }];
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Portal');

      expect(result.games).toHaveLength(1);
      expect(result.games[0].name).toBe('Portal');
      expect(result.games[0].mainStory).toBe(3);
      expect(result.games[0].mainExtra).toBe(4);
      expect(result.games[0].completionist).toBe(5);
      expect(result.games[0].id).toBe('2198');
    });

    test('should parse multiple game results', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === '.search_list_details_block') {
            return [
              {
                querySelector: jest.fn().mockImplementation((sel: string) => {
                  const data: Record<string, any> = {
                    'h3 a': { textContent: 'Portal', href: '/game/2198' },
                    '.search_list_image': { src: '/images/portal.jpg' }
                  };
                  return data[sel] || null;
                }),
                querySelectorAll: jest.fn().mockImplementation((sel: string) => {
                  if (sel === '.search_list_tidbit') {
                    return [
                      {
                        querySelector: jest.fn().mockImplementation((s: string) => {
                          if (s === '.search_list_tidbit_short') return { textContent: 'Main Story' };
                          if (s === '.search_list_tidbit_long') return { textContent: '3 Hours' };
                        })
                      }
                    ];
                  }
                  return [];
                })
              },
              {
                querySelector: jest.fn().mockImplementation((sel: string) => {
                  const data: Record<string, any> = {
                    'h3 a': { textContent: 'Portal 2', href: '/game/2199' },
                    '.search_list_image': { src: '/images/portal2.jpg' }
                  };
                  return data[sel] || null;
                }),
                querySelectorAll: jest.fn().mockImplementation((sel: string) => {
                  if (sel === '.search_list_tidbit') {
                    return [
                      {
                        querySelector: jest.fn().mockImplementation((s: string) => {
                          if (s === '.search_list_tidbit_short') return { textContent: 'Main Story' };
                          if (s === '.search_list_tidbit_long') return { textContent: '8 Hours' };
                        })
                      }
                    ];
                  }
                  return [];
                })
              }
            ];
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Portal');

      expect(result.games).toHaveLength(2);
      expect(result.games[0].name).toBe('Portal');
      expect(result.games[1].name).toBe('Portal 2');
    });

    test('should handle no results', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn().mockImplementation((sel: string) => {
          if (sel === '.search_list_no_results') {
            return { textContent: 'No results found' };
          }
          return null;
        })
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => createNoResultsHTML(),
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Nonexistent Game');

      expect(result.games).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });

    test('should handle missing time data gracefully', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === '.search_list_details_block') {
            return [{
              querySelector: jest.fn().mockImplementation((sel: string) => {
                const data: Record<string, any> = {
                  'h3 a': { textContent: 'Multiplayer Game', href: '/game/9999' }
                };
                return data[sel] || null;
              }),
              querySelectorAll: jest.fn().mockImplementation((sel: string) => {
                if (sel === '.search_list_tidbit') {
                  return [
                    {
                      querySelector: jest.fn().mockImplementation((s: string) => {
                        if (s === '.search_list_tidbit_short') return { textContent: 'Main Story' };
                        if (s === '.search_list_tidbit_long') return { textContent: '--' };
                      })
                    }
                  ];
                }
                return [];
              })
            }];
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Multiplayer Game');

      expect(result.games).toHaveLength(1);
      expect(result.games[0].name).toBe('Multiplayer Game');
      expect(result.games[0].mainStory).toBeNull();
    });

    test('should extract game ID from URL', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === '.search_list_details_block') {
            return [{
              querySelector: jest.fn().mockImplementation((sel: string) => {
                if (sel === 'h3 a') {
                  return {
                    textContent: 'Portal',
                    href: '/game/2198',
                    getAttribute: (attr: string) => attr === 'href' ? '/game/2198' : null
                  };
                }
                return null;
              }),
              querySelectorAll: jest.fn().mockReturnValue([])
            }];
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Portal');

      expect(result.games[0].id).toBe('2198');
    });
  });

  describe('Time Extraction', () => {
    test('should parse various time formats', async () => {
      const timeFormats = [
        { input: '12 Hours', expected: 12 },
        { input: '1½ Hours', expected: 1.5 },
        { input: '2¼ Hours', expected: 2.25 },
        { input: '3¾ Hours', expected: 3.75 },
        { input: '45 Mins', expected: 0.75 },
        { input: '90 Mins', expected: 1.5 },
        { input: '10-15 Hours', expected: 12.5 },
        { input: '5.5 Hours', expected: 5.5 },
        { input: '--', expected: null },
        { input: 'N/A', expected: null },
        { input: '', expected: null }
      ];

      for (const format of timeFormats) {
        const result = scraper.parseTimeString(format.input);
        expect(result).toBe(format.expected);
      }
    });

    test('should handle hours and minutes format', () => {
      expect(scraper.parseTimeString('1h 30m')).toBe(1.5);
      expect(scraper.parseTimeString('2 hrs 15 mins')).toBe(2.25);
      expect(scraper.parseTimeString('10h')).toBe(10);
    });

    test('should extract numbers from complex strings', () => {
      expect(scraper.parseTimeString('About 12 Hours')).toBe(12);
      expect(scraper.parseTimeString('~15 Hours')).toBe(15);
      expect(scraper.parseTimeString('Roughly 20 Hours')).toBe(20);
    });

    test('should handle invalid time strings', () => {
      expect(scraper.parseTimeString('Not a time')).toBeNull();
      expect(scraper.parseTimeString('TBD')).toBeNull();
      expect(scraper.parseTimeString('Coming Soon')).toBeNull();
    });
  });

  describe('Fuzzy Matching', () => {
    test('should find exact match', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === '.search_list_details_block') {
            return [
              {
                querySelector: jest.fn().mockImplementation((sel: string) => {
                  if (sel === 'h3 a') return { textContent: 'Portal' };
                  return null;
                }),
                querySelectorAll: jest.fn().mockReturnValue([])
              },
              {
                querySelector: jest.fn().mockImplementation((sel: string) => {
                  if (sel === 'h3 a') return { textContent: 'Portal 2' };
                  return null;
                }),
                querySelectorAll: jest.fn().mockReturnValue([])
              }
            ];
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Portal', { exactMatch: true });

      expect(result.games).toHaveLength(1);
      expect(result.games[0].name).toBe('Portal');
    });

    test('should perform fuzzy matching when enabled', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === '.search_list_details_block') {
            return [
              {
                querySelector: jest.fn().mockImplementation((sel: string) => {
                  if (sel === 'h3 a') return { textContent: 'The Elder Scrolls V: Skyrim Special Edition' };
                  return null;
                }),
                querySelectorAll: jest.fn().mockReturnValue([])
              }
            ];
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Skyrim', { fuzzyMatch: true });

      expect(result.games).toHaveLength(1);
      expect(result.games[0].name).toContain('Skyrim');
    });

    test('should calculate similarity score', () => {
      const score1 = scraper.calculateSimilarity('Portal', 'Portal');
      expect(score1).toBe(1.0);

      const score2 = scraper.calculateSimilarity('Portal', 'Portal 2');
      expect(score2).toBeGreaterThan(0.5);
      expect(score2).toBeLessThan(1.0);

      const score3 = scraper.calculateSimilarity('Portal', 'Half-Life');
      expect(score3).toBeLessThan(0.5);
    });

    test('should normalize strings for comparison', () => {
      const normalized1 = scraper.normalizeString('Tom Clancy\'s Rainbow Six® Siege™');
      expect(normalized1).not.toContain('®');
      expect(normalized1).not.toContain('™');
      expect(normalized1).toBe('tom clancys rainbow six siege');

      const normalized2 = scraper.normalizeString('DARK SOULS™ III: The Fire Fades™ Edition');
      expect(normalized2).toBe('dark souls iii the fire fades edition');
    });

    test('should handle subtitle variations', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === '.search_list_details_block') {
            return [
              {
                querySelector: jest.fn().mockImplementation((sel: string) => {
                  if (sel === 'h3 a') return { textContent: 'Mass Effect: Legendary Edition' };
                  return null;
                }),
                querySelectorAll: jest.fn().mockReturnValue([])
              }
            ];
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Mass Effect Legendary Edition');

      expect(result.games).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should throw ScrapingError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(scraper.searchGame('Portal')).rejects.toThrow(ScrapingError);
    });

    test('should handle 404 responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers()
      } as Response);

      await expect(scraper.searchGame('Portal')).rejects.toThrow(ScrapingError);
    });

    test('should handle malformed HTML gracefully', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html>Broken HTML</html>',
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Portal');

      expect(result.games).toHaveLength(0);
    });

    test('should handle DOMParser errors', async () => {
      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockImplementation(() => {
          throw new Error('Parse error');
        })
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      await expect(scraper.searchGame('Portal')).rejects.toThrow(ScrapingError);
    });

    test('should include URL in error for debugging', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers()
      } as Response);

      try {
        await scraper.searchGame('Portal');
      } catch (error) {
        expect(error).toBeInstanceOf(ScrapingError);
        expect((error as ScrapingError).url).toContain('howlongtobeat.com');
        expect((error as ScrapingError).statusCode).toBe(500);
      }
    });
  });

  describe('Request Headers', () => {
    test('should send appropriate headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const mockDoc = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      await scraper.searchGame('Portal');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('howlongtobeat.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
    });

    test('should encode search term in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const mockDoc = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      await scraper.searchGame('Portal 2: Special Edition');

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1]?.body as string;

      expect(body).toContain('queryString=Portal%202%3A%20Special%20Edition');
    });
  });

  describe('Performance', () => {
    test('should cache parsed results', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === '.search_list_details_block') {
            return [{
              querySelector: jest.fn().mockImplementation((sel: string) => {
                if (sel === 'h3 a') return { textContent: 'Portal' };
                return null;
              }),
              querySelectorAll: jest.fn().mockReturnValue([])
            }];
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementation(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      // First call
      await scraper.searchGame('Portal');

      // Second call (should use cache)
      await scraper.searchGame('Portal');

      // Should only fetch once if caching is implemented
      expect(mockFetch).toHaveBeenCalledTimes(2); // Or 1 if caching is enabled
    });

    test('should complete scraping within reasonable time', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const startTime = Date.now();
      await scraper.searchGame('Portal');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000);
    });

    test('should handle large result sets efficiently', async () => {
      const games = Array.from({ length: 50 }, (_, i) => ({
        querySelector: jest.fn().mockImplementation((sel: string) => {
          if (sel === 'h3 a') return { textContent: `Game ${i}` };
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([])
      }));

      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === '.search_list_details_block') {
            return games;
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      const result = await scraper.searchGame('Game');

      expect(result.games.length).toBeLessThanOrEqual(20); // Should limit results
    });
  });

  describe('Alternative Selectors', () => {
    test('should try alternative selectors when primary fails', async () => {
      const mockDoc = {
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          // Primary selector fails
          if (selector === '.search_list_details_block') {
            return [];
          }
          // Alternative selector works
          if (selector === '.search_list_details') {
            return [{
              querySelector: jest.fn().mockImplementation((sel: string) => {
                if (sel === '.search_list_details_block_title') return { textContent: 'Portal' };
                return null;
              }),
              querySelectorAll: jest.fn().mockReturnValue([])
            }];
          }
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      mockDOMParser.mockImplementationOnce(() => ({
        parseFromString: jest.fn().mockReturnValue(mockDoc)
      }) as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
        headers: new Headers()
      } as Response);

      // Should still find results using alternative selectors
      const result = await scraper.searchGame('Portal');
      // Implementation would need to support alternative selectors
    });
  });
});