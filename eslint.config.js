// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge functions are Deno, not React Native — the Expo rules do not apply.
    ignores: ["dist/*", "supabase/functions/*"],
  }
]);
