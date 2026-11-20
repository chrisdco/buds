// Expo defaults plus Sentry debug IDs, so uploaded source maps match each
// build and OTA update once uploads are switched on.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
