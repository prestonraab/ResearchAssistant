import baseConfig from '../../jest.config.base.js';

export default {
  ...baseConfig,
  displayName: 'vscode-extension',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts', '<rootDir>/src/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts'
  ],
  // VS Code extension specific settings
  testEnvironment: 'node',
  roots: ['<rootDir>/src']
};
