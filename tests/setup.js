// Jest setup file for MP Tweaks tests

// Set longer timeout for e2e tests
jest.setTimeout(30000);

// Check if we're in debug mode
const isDebugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'debug';

// Suppress Chrome extension warnings in test output (unless in debug mode)
if (!isDebugMode) {
  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    const message = args.join(' ');
    // Skip Chrome extension related warnings during tests
    if (message.includes('extension') || message.includes('chrome://')) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
}

// Log test mode
if (isDebugMode) {
  console.log('🐛 Running tests in DEBUG mode - browser will be visible');
} else {
  console.log('🚀 Running tests in headless mode');
}

// Global test environment setup
// @ts-ignore
global.expect = expect;