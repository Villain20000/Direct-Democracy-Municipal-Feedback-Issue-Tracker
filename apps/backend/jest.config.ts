// `jest` isn't resolvable from this workspace; ts-jest falls back to
// @types/jest's ambient namespace, which fails both as an import (TS2306)
// and as a global-namespace lookup (TS2694). Infer the type instead.
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  // `dist/` is the tsc build output. We don't want jest to load the compiled
  // .js / .d.ts artefacts from there (they get discovered via the
  // tsconfig.json's `include: ['src']` resolution chain and produce
  // "SyntaxError: Unexpected token 'export'" failures).
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\.ts$': ['ts-jest', { isolatedModules: true }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/db/seed.ts',
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};

export default config;
