module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  overrides: [
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
