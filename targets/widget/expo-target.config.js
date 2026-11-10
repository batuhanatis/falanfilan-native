// Ana ekran widget'ları (Bu akşamın seansı + Blend). Uygulama veriyi App Group'a yazıyor
// (src/widgets/homeWidgets.js), widget eklentisi oradan okuyor.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "PellixWidget",
  displayName: "Pellix",
  bundleIdentifier: ".widget",
  // Etkileşimli düğme (Sıradaki) ve containerBackground iOS 17 istiyor.
  deploymentTarget: "17.0",
  colors: {
    $accent: "#d4a94a",
    $widgetBackground: "#0d0b0a",
  },
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
