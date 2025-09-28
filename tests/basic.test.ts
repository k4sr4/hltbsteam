/**
 * Basic test to verify test setup is working
 */

describe('Test Setup Verification', () => {
  test('should have working Jest environment', () => {
    expect(true).toBe(true);
  });

  test('should have DOM environment', () => {
    expect(document).toBeDefined();
    expect(window).toBeDefined();
  });

  test('should have mocked Chrome APIs', () => {
    expect(global.chrome).toBeDefined();
    expect(global.chrome.runtime).toBeDefined();
    expect(global.chrome.storage).toBeDefined();
  });

  test('should have mocked Performance API', () => {
    expect(performance).toBeDefined();
    expect(performance.now).toBeDefined();
    expect((performance as any).memory).toBeDefined();
  });

  test('should have mocked MutationObserver', () => {
    expect(MutationObserver).toBeDefined();
    const observer = new MutationObserver(() => {});
    expect(observer.observe).toBeDefined();
    expect(observer.disconnect).toBeDefined();
  });

  test('should support custom matchers', () => {
    expect('test').toBeOneOf(['test', 'other']);
    expect('value').not.toBeOneOf(['not', 'matching']);
  });
});