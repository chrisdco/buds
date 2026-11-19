// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const oxlint = require("eslint-plugin-oxlint");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "supabase/functions/*", ".claude/**"],
  },
  {
    // Disable comments for rules oxlint now runs (react-hooks/exhaustive-deps
    // etc.) look unused to ESLint; oxlint reports truly unused ones instead.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    // A top-level `function Symbol` shadows the global constructor and broke
    // compiler-generated Symbol.for references at runtime (SDK 57 incident).
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "Symbol",
          message: "Name it AppSymbol (or similar) — shadowing global Symbol breaks compiled output.",
        },
      ],
    },
  },
  // Everything .oxlintrc.json covers runs in oxlint first (`npm run lint`);
  // this turns those rules off here so each finding is reported once.
  ...oxlint.buildFromOxlintConfigFile("./.oxlintrc.json"),
]);
