const base = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      collectCoverageFrom: ['src/**/*.ts', '!src/generated/**', '!src/main.ts'],
    },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.e2e-spec.ts'],
    },
    {
      ...base,
      displayName: 'concurrency',
      testMatch: ['<rootDir>/test/concurrency/**/*.e2e-spec.ts'],
    },
  ],
};
