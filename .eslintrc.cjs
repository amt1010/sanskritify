module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  overrides: [
    // Registers .ts as a lint target for every package. Without a files
    // pattern that mentions .ts, `eslint src` (no --ext) only looks for .js
    // files, finds none in a TS-only src/, and errors with "no files
    // matching the pattern src" instead of linting anything.
    {
      files: ['**/*.ts'],
    },
    {
      files: ['packages/core/**/*.ts', 'packages/sanskrit/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: ['react', 'react-native', 'react-native/*', 'expo', 'expo-*'],
        }],
      },
    },
  ],
};
