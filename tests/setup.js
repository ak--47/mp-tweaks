// Jest setup file for MP Tweaks tests

// Set longer timeout for e2e tests
jest.setTimeout(30000);

// Suppress Chrome extension warnings in test output
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  // Skip Chrome extension related warnings during tests
  if (message.includes('extension') || message.includes('chrome://')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Global test environment setup
global.expect = expect;