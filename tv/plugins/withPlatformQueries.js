// Android 11 ve sonrasında bir uygulama, başka bir uygulamayı ana ekranından açabilmek için
// (getLaunchIntentForPackage) o paketi manifest'teki <queries> altında bildirmek zorunda.
// Paket adları src/platforms.js ile aynı tutulmalı.
const { withAndroidManifest } = require("expo/config-plugins");
const { PLATFORM_PACKAGES } = require("../src/platformPackages.json");

module.exports = function withPlatformQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const packages = [...new Set(Object.values(PLATFORM_PACKAGES).flat())];
    manifest.queries = [{
      package: packages.map((name) => ({ $: { "android:name": name } })),
      intent: [{
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": "https" } }],
      }],
    }];
    return cfg;
  });
};
