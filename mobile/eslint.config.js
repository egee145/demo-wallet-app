import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'android/**', 'ios/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  react.configs.flat.recommended,
  reactHooks.configs.flat.recommended,
  eslintConfigPrettier,
  {
    settings: { react: { version: 'detect' } },
    languageOptions: {
      globals: { ...globals.browser, ...globals.jest, __DEV__: 'readonly' },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
);
