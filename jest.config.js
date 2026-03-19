module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  testTimeout: 30000,
  testEnvironmentOptions: {},
  globals: {
    'ts-jest': {
      tsconfig: { strict: false },
    },
  },
  setupFiles: ['<rootDir>/src/tests/helpers/jestSetup.ts'],
};
