import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '**/tests/**/*.test.{js,ts}',
    '**/src/**/*.test.{js,ts}'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    'background.js',
    'content.js',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}',
    '!tests/**/*.{js,ts}',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/content/(.*)$': '<rootDir>/src/content/$1',
    '^@/background/(.*)$': '<rootDir>/src/background/$1',
    '^@/popup/(.*)$': '<rootDir>/src/popup/$1',
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      isolatedModules: true,
      tsconfig: {
        outDir: './dist/tests',
        rootDir: '.',
        noImplicitAny: false,
        strictNullChecks: false,
        strictPropertyInitialization: false,
        types: ['jest', 'node', 'chrome'],
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        target: 'ES2020',
        module: 'commonjs',
        moduleResolution: 'node',
        skipLibCheck: true
      }
    }],
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testTimeout: 10000,
  verbose: true
};

export default config;