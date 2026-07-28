module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.spec.tsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
};
