// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
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
]);
