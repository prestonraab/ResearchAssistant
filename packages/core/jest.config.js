import baseConfig from '../../jest.config.base.js';

export default {
  ...baseConfig,
  displayName: 'core',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
};
