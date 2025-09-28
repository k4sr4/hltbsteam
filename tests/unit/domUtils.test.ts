/**
 * Unit tests for DOM utilities
 * Tests async element waiting, XSS prevention, safe DOM access,
 * content stability, and utility functions
 */

import {
  sanitizeString,
  normalizeTitle,
  waitForElement,
  waitForElements,
  waitForDOMReady,
  getElementText,
  getElementAttribute,
  getFirstElementBySelectors,
  getTextFromSelectors,
  debounce,
  throttle,
  isElementVisible,
  getComputedStyleProperty,
  createSafeElement,
  removeAllEventListeners,
  measurePerformance
} from '../../src/content/utils/dom';
import { mockPerformanceAPI } from '../mocks/steamPageMocks';

describe('DOM Utilities', () => {
  beforeAll(() => {
    mockPerformanceAPI();
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('XSS Prevention and Sanitization', () => {
    describe('sanitizeString', () => {
      test('should sanitize dangerous HTML characters', () => {
        const testCases = [
          ['<script>alert("xss")</script>', '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'],
          ['Hello & "world"', 'Hello &amp; &quot;world&quot;'],
          ["It's a <test>", 'It&#x27;s a &lt;test&gt;'],
          ['Normal text', 'Normal text'],
          ['', ''],
          ['><&"\'', '&gt;&lt;&amp;&quot;&#x27;']
        ];

        testCases.forEach(([input, expected]) => {
          expect(sanitizeString(input)).toBe(expected);
        });
      });

      test('should handle non-string inputs', () => {
        expect(sanitizeString(null)).toBe('');
        expect(sanitizeString(undefined)).toBe('');
        expect(sanitizeString(123)).toBe('');
        expect(sanitizeString({})).toBe('');
        expect(sanitizeString([])).toBe('');
      });

      test('should prevent XSS injection attempts', () => {
        const xssAttempts = [
          '<img src="x" onerror="alert(1)">',
          'javascript:alert("xss")',
          '<svg onload="alert(1)">',
          '<iframe src="javascript:alert(1)"></iframe>',
          '<object data="javascript:alert(1)"></object>'
        ];

        xssAttempts.forEach(xss => {
          const sanitized = sanitizeString(xss);
          expect(sanitized).not.toContain('<');
          expect(sanitized).not.toContain('>');
          expect(sanitized).not.toContain('"');
          expect(sanitized).not.toContain("'");
        });
      });
    });

    describe('createSafeElement', () => {
      test('should create elements with sanitized content', () => {
        const element = createSafeElement('div', 'test-class', '<script>alert("xss")</script>');

        expect(element.tagName).toBe('DIV');
        expect(element.className).toBe('test-class');
        expect(element.textContent).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        expect(element.innerHTML).not.toContain('<script>');
      });

      test('should create elements without optional parameters', () => {
        const element = createSafeElement('span');

        expect(element.tagName).toBe('SPAN');
        expect(element.className).toBe('');
        expect(element.textContent).toBe('');
      });

      test('should handle various HTML tag types', () => {
        const tags = ['div', 'span', 'p', 'h1', 'section', 'article'];

        tags.forEach(tag => {
          const element = createSafeElement(tag);
          expect(element.tagName).toBe(tag.toUpperCase());
        });
      });
    });
  });

  describe('Title Normalization', () => {
    test('should remove Steam-specific suffixes', () => {
      const testCases = [
        ['Counter-Strike 2 on Steam', 'Counter-Strike 2'],
        ['Amazing Game - Steam', 'Amazing Game'],
        ['Best Game on Steam', 'Best Game'],
        ['Game Title - Steam', 'Game Title'],
        ['Normal Title', 'Normal Title']
      ];

      testCases.forEach(([input, expected]) => {
        expect(normalizeTitle(input)).toBe(expected);
      });
    });

    test('should remove trademark symbols', () => {
      const testCases = [
        ['Game™', 'Game'],
        ['Company®', 'Company'],
        ['Product©', 'Product'],
        ['Mixed™ symbols® and© text', 'Mixed symbols and text'],
        ['No symbols here', 'No symbols here']
      ];

      testCases.forEach(([input, expected]) => {
        expect(normalizeTitle(input)).toBe(expected);
      });
    });

    test('should remove sale and promotional text', () => {
      const testCases = [
        ['Amazing Game - 50% off', 'Amazing Game'],
        ['Best Game (Sale)', 'Best Game'],
        ['Great Game [SALE]', 'Great Game'],
        ['Normal Game - 75% off', 'Normal Game'],
        ['Game without sale', 'Game without sale']
      ];

      testCases.forEach(([input, expected]) => {
        expect(normalizeTitle(input)).toBe(expected);
      });
    });

    test('should normalize whitespace', () => {
      const testCases = [
        ['Multiple   spaces   game', 'Multiple spaces game'],
        ['  Leading and trailing  ', 'Leading and trailing'],
        ['Tab\t\tcharacters', 'Tab characters'],
        ['Mixed\n\r\nlinebreaks', 'Mixed linebreaks'],
        ['Normal spacing', 'Normal spacing']
      ];

      testCases.forEach(([input, expected]) => {
        expect(normalizeTitle(input)).toBe(expected);
      });
    });

    test('should handle edge cases', () => {
      expect(normalizeTitle('')).toBe('');
      expect(normalizeTitle('   ')).toBe('');
      expect(normalizeTitle('™®©')).toBe('');
      expect(normalizeTitle('   ™®©   ')).toBe('');
    });

    test('should handle complex combinations', () => {
      const complexTitle = '  Amazing Game™ - 50% off on Steam  ';
      expect(normalizeTitle(complexTitle)).toBe('Amazing Game');
    });
  });

  describe('Async Element Waiting', () => {
    describe('waitForElement', () => {
      test('should resolve immediately if element exists', async () => {
        const testDiv = document.createElement('div');
        testDiv.id = 'test-element';
        document.body.appendChild(testDiv);

        const startTime = Date.now();
        const element = await waitForElement('#test-element', 1000);
        const elapsed = Date.now() - startTime;

        expect(element).toBe(testDiv);
        expect(elapsed).toBeLessThan(100); // Should be immediate
      });

      test('should wait for element to appear', async () => {
        let element: Element | null = null;

        // Create element after delay
        setTimeout(() => {
          const testDiv = document.createElement('div');
          testDiv.className = 'delayed-element';
          document.body.appendChild(testDiv);
        }, 100);

        element = await waitForElement('.delayed-element', 500);

        expect(element).not.toBeNull();
        expect(element!.className).toBe('delayed-element');
      });

      test('should timeout if element never appears', async () => {
        const element = await waitForElement('.nonexistent-element', 100);
        expect(element).toBeNull();
      });

      test('should work with custom root element', async () => {
        const container = document.createElement('div');
        const testElement = document.createElement('span');
        testElement.className = 'nested-element';
        container.appendChild(testElement);
        document.body.appendChild(container);

        const element = await waitForElement('.nested-element', 100, container);
        expect(element).toBe(testElement);
      });

      test('should handle invalid selectors gracefully', async () => {
        const element = await waitForElement('::invalid::selector', 100);
        expect(element).toBeNull();
      });

      test('should clean up observers and timeouts', async () => {
        const mockObserver = {
          observe: jest.fn(),
          disconnect: jest.fn()
        };

        const originalMutationObserver = global.MutationObserver;
        global.MutationObserver = jest.fn().mockImplementation(() => mockObserver);

        await waitForElement('.nonexistent', 50);

        expect(mockObserver.disconnect).toHaveBeenCalled();

        global.MutationObserver = originalMutationObserver;
      });
    });

    describe('waitForElements', () => {
      test('should wait for multiple elements', async () => {
        // Create elements after delay
        setTimeout(() => {
          ['element1', 'element2', 'element3'].forEach(id => {
            const div = document.createElement('div');
            div.id = id;
            document.body.appendChild(div);
          });
        }, 50);

        const elements = await waitForElements(['#element1', '#element2', '#element3'], 200);

        expect(elements).toHaveLength(3);
        expect(elements.every(el => el !== null)).toBe(true);
      });

      test('should handle mixed results (some found, some not)', async () => {
        const existingDiv = document.createElement('div');
        existingDiv.id = 'existing';
        document.body.appendChild(existingDiv);

        const elements = await waitForElements(['#existing', '#nonexistent'], 100);

        expect(elements).toHaveLength(2);
        expect(elements[0]).not.toBeNull();
        expect(elements[1]).toBeNull();
      });
    });

    describe('waitForDOMReady', () => {
      test('should resolve immediately if DOM is ready', async () => {
        // Mock DOM as ready
        Object.defineProperty(document, 'readyState', {
          value: 'complete',
          configurable: true
        });

        const startTime = Date.now();
        const isReady = await waitForDOMReady(1000);
        const elapsed = Date.now() - startTime;

        expect(isReady).toBe(true);
        expect(elapsed).toBeLessThan(100);
      });

      test('should resolve immediately if DOM is interactive', async () => {
        Object.defineProperty(document, 'readyState', {
          value: 'interactive',
          configurable: true
        });

        const isReady = await waitForDOMReady(100);
        expect(isReady).toBe(true);
      });

      test('should wait for DOMContentLoaded event', async () => {
        Object.defineProperty(document, 'readyState', {
          value: 'loading',
          configurable: true
        });

        // Simulate DOMContentLoaded after delay
        setTimeout(() => {
          const event = new Event('DOMContentLoaded');
          document.dispatchEvent(event);
        }, 50);

        const isReady = await waitForDOMReady(200);
        expect(isReady).toBe(true);
      });

      test('should timeout if DOM never becomes ready', async () => {
        Object.defineProperty(document, 'readyState', {
          value: 'loading',
          configurable: true
        });

        const isReady = await waitForDOMReady(50);
        expect(isReady).toBe(false);
      });
    });
  });

  describe('Safe DOM Access', () => {
    describe('getElementText', () => {
      test('should get text content safely', () => {
        const div = document.createElement('div');
        div.textContent = 'Hello <world>';

        expect(getElementText(div)).toBe('Hello &lt;world&gt;');
      });

      test('should handle null elements', () => {
        expect(getElementText(null)).toBe('');
      });

      test('should sanitize and trim text', () => {
        const div = document.createElement('div');
        div.textContent = '  <script>alert("xss")</script>  ';

        expect(getElementText(div)).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      });

      test('should handle empty text content', () => {
        const div = document.createElement('div');
        expect(getElementText(div)).toBe('');
      });
    });

    describe('getElementAttribute', () => {
      test('should get attribute safely', () => {
        const div = document.createElement('div');
        div.setAttribute('data-value', 'test <value>');

        expect(getElementAttribute(div, 'data-value')).toBe('test &lt;value&gt;');
      });

      test('should handle null elements', () => {
        expect(getElementAttribute(null, 'data-value')).toBe('');
      });

      test('should handle missing attributes', () => {
        const div = document.createElement('div');
        expect(getElementAttribute(div, 'nonexistent')).toBe('');
      });

      test('should sanitize attribute values', () => {
        const div = document.createElement('div');
        div.setAttribute('data-xss', '<script>alert("xss")</script>');

        expect(getElementAttribute(div, 'data-xss')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      });
    });

    describe('getFirstElementBySelectors', () => {
      test('should return first matching element', () => {
        const div1 = document.createElement('div');
        div1.className = 'first';
        const div2 = document.createElement('div');
        div2.className = 'second';

        document.body.appendChild(div1);
        document.body.appendChild(div2);

        const element = getFirstElementBySelectors(['.nonexistent', '.first', '.second']);
        expect(element).toBe(div1);
      });

      test('should return null if no elements found', () => {
        const element = getFirstElementBySelectors(['.nonexistent1', '.nonexistent2']);
        expect(element).toBeNull();
      });

      test('should handle invalid selectors gracefully', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const element = getFirstElementBySelectors(['::invalid::selector']);
        expect(element).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith('[HLTB] Invalid selector: ::invalid::selector', expect.any(Error));

        consoleSpy.mockRestore();
      });

      test('should work with custom root element', () => {
        const container = document.createElement('div');
        const target = document.createElement('span');
        target.className = 'target';
        container.appendChild(target);

        const element = getFirstElementBySelectors(['.target'], container);
        expect(element).toBe(target);
      });
    });

    describe('getTextFromSelectors', () => {
      test('should return text from first matching element', () => {
        const div1 = document.createElement('div');
        div1.className = 'first';
        div1.textContent = 'First text';

        const div2 = document.createElement('div');
        div2.className = 'second';
        div2.textContent = 'Second text';

        document.body.appendChild(div1);
        document.body.appendChild(div2);

        const text = getTextFromSelectors(['.nonexistent', '.first', '.second']);
        expect(text).toBe('First text');
      });

      test('should return empty string if no text found', () => {
        const text = getTextFromSelectors(['.nonexistent']);
        expect(text).toBe('');
      });

      test('should skip empty text elements', () => {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty';

        const textDiv = document.createElement('div');
        textDiv.className = 'text';
        textDiv.textContent = 'Found text';

        document.body.appendChild(emptyDiv);
        document.body.appendChild(textDiv);

        const text = getTextFromSelectors(['.empty', '.text']);
        expect(text).toBe('Found text');
      });
    });
  });

  describe('Performance and Utility Functions', () => {
    describe('debounce', () => {
      test('should debounce function calls', (done) => {
        let callCount = 0;
        const debouncedFn = debounce(() => callCount++, 100);

        // Call multiple times rapidly
        debouncedFn();
        debouncedFn();
        debouncedFn();

        // Should not have been called yet
        expect(callCount).toBe(0);

        setTimeout(() => {
          expect(callCount).toBe(1); // Should only be called once
          done();
        }, 150);
      });

      test('should pass arguments correctly', (done) => {
        let receivedArgs: any[] = [];
        const debouncedFn = debounce((...args: any[]) => {
          receivedArgs = args;
        }, 50);

        debouncedFn('arg1', 'arg2', 123);

        setTimeout(() => {
          expect(receivedArgs).toEqual(['arg1', 'arg2', 123]);
          done();
        }, 100);
      });

      test('should reset timer on subsequent calls', (done) => {
        let callCount = 0;
        const debouncedFn = debounce(() => callCount++, 100);

        debouncedFn();
        setTimeout(() => debouncedFn(), 50); // Reset timer
        setTimeout(() => debouncedFn(), 100); // Reset timer again

        setTimeout(() => {
          expect(callCount).toBe(0); // Should not have been called yet
        }, 150);

        setTimeout(() => {
          expect(callCount).toBe(1); // Should finally be called
          done();
        }, 250);
      });
    });

    describe('throttle', () => {
      test('should throttle function calls', (done) => {
        let callCount = 0;
        const throttledFn = throttle(() => callCount++, 100);

        // Call multiple times rapidly
        throttledFn(); // Should execute immediately
        throttledFn(); // Should be throttled
        throttledFn(); // Should be throttled

        expect(callCount).toBe(1);

        setTimeout(() => {
          throttledFn(); // Should execute after delay
          expect(callCount).toBe(2);
          done();
        }, 150);
      });

      test('should pass arguments correctly', () => {
        let receivedArgs: any[] = [];
        const throttledFn = throttle((...args: any[]) => {
          receivedArgs = args;
        }, 50);

        throttledFn('test', 123);
        expect(receivedArgs).toEqual(['test', 123]);
      });
    });

    describe('isElementVisible', () => {
      test('should detect visible elements', () => {
        const div = document.createElement('div');
        div.style.width = '100px';
        div.style.height = '100px';
        div.style.position = 'absolute';
        div.style.top = '0px';
        div.style.left = '0px';

        document.body.appendChild(div);

        // Mock getBoundingClientRect
        div.getBoundingClientRect = jest.fn().mockReturnValue({
          width: 100,
          height: 100,
          top: 0,
          left: 0,
          bottom: 100,
          right: 100
        });

        expect(isElementVisible(div)).toBe(true);
      });

      test('should detect invisible elements', () => {
        const div = document.createElement('div');

        // Mock as invisible (zero size)
        div.getBoundingClientRect = jest.fn().mockReturnValue({
          width: 0,
          height: 0,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0
        });

        expect(isElementVisible(div)).toBe(false);
      });

      test('should detect off-screen elements', () => {
        const div = document.createElement('div');

        // Mock as off-screen
        div.getBoundingClientRect = jest.fn().mockReturnValue({
          width: 100,
          height: 100,
          top: -200,
          left: -200,
          bottom: -100,
          right: -100
        });

        expect(isElementVisible(div)).toBe(false);
      });
    });

    describe('getComputedStyleProperty', () => {
      test('should get computed style property', () => {
        const div = document.createElement('div');
        document.body.appendChild(div);

        // Mock getComputedStyle
        const mockComputedStyle = {
          getPropertyValue: jest.fn().mockReturnValue('red')
        };
        window.getComputedStyle = jest.fn().mockReturnValue(mockComputedStyle);

        const color = getComputedStyleProperty(div, 'color');
        expect(color).toBe('red');
        expect(mockComputedStyle.getPropertyValue).toHaveBeenCalledWith('color');
      });

      test('should handle errors gracefully', () => {
        const div = document.createElement('div');
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Mock getComputedStyle to throw
        window.getComputedStyle = jest.fn().mockImplementation(() => {
          throw new Error('Style error');
        });

        const color = getComputedStyleProperty(div, 'color');
        expect(color).toBe('');
        expect(consoleSpy).toHaveBeenCalledWith('[HLTB] Error getting computed style:', expect.any(Error));

        consoleSpy.mockRestore();
      });
    });

    describe('removeAllEventListeners', () => {
      test('should remove all event listeners by cloning', () => {
        const div = document.createElement('div');
        div.addEventListener('click', () => {});
        document.body.appendChild(div);

        const newElement = removeAllEventListeners(div);

        expect(newElement).not.toBe(div); // Should be a different element
        expect(newElement.tagName).toBe(div.tagName);
        expect(document.body.contains(newElement)).toBe(true);
        expect(document.body.contains(div)).toBe(false);
      });

      test('should handle elements without parent', () => {
        const div = document.createElement('div');

        expect(() => removeAllEventListeners(div)).not.toThrow();
      });
    });

    describe('measurePerformance', () => {
      test('should measure synchronous function performance', async () => {
        const testFn = () => {
          return 'test result';
        };

        const result = await measurePerformance(testFn);

        expect(result.result).toBe('test result');
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(typeof result.memoryUsed).toBe('number');
      });

      test('should measure asynchronous function performance', async () => {
        const testFn = async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'async result';
        };

        const result = await measurePerformance(testFn);

        expect(result.result).toBe('async result');
        expect(result.duration).toBeGreaterThan(5); // Should take at least 10ms
      });

      test('should log performance with label', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await measurePerformance(() => 'test', 'Test Operation');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[HLTB\] Test Operation: \d+\.\d+ms/)
        );

        consoleSpy.mockRestore();
      });

      test('should handle memory measurement when unavailable', async () => {
        const originalMemory = (performance as any).memory;
        delete (performance as any).memory;

        const result = await measurePerformance(() => 'test');

        expect(result.memoryUsed).toBe(0);

        (performance as any).memory = originalMemory;
      });
    });
  });
});