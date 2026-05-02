const { rules: utilsDriftRules } = require('../../shared/eslint-rules/no-redeclare-utils-exports.cjs');
const { rules: schemasDriftRules } = require('../../shared/eslint-rules/no-redeclare-schemas-exports.cjs');
const { rules: componentsDriftRules } = require('../../shared/eslint-rules/no-redeclare-components-exports.cjs');
const { rules: sessionStateDriftRules } = require('../../shared/eslint-rules/no-redeclare-session-state-exports.cjs');
const { rules: dataDriftRules } = require('../../shared/eslint-rules/no-redeclare-data-exports.cjs');

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-assertions': [
      'warn',
      {
        assertionStyle: 'as',
        objectLiteralTypeAssertions: 'never',
      },
    ],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-restricted-syntax': [
      'error',
      ...utilsDriftRules,
      ...schemasDriftRules,
      ...componentsDriftRules,
      ...sessionStateDriftRules,
      ...dataDriftRules,
    ],
  },
};
