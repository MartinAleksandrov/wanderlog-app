// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'expo-env.d.ts',
      'src/uniwind-types.d.ts',
      // Written by Convex (`pnpm db`) and committed as written. Linting them on commit stripped
      // their `/* eslint-disable */` header, so they showed as changed after every `pnpm db`.
      'convex/_generated/*',
    ],
  },
]);
