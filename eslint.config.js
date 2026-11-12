// ESLint flat config: recommended rules plus a few that catch real bugs in this codebase.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'], // no == coercion bugs
      'no-var': 'error',
      'prefer-const': 'error',
      'no-implicit-globals': 'error',
      'no-eval': 'error',
      'no-new-func': 'error', // no dynamic code execution
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
];
