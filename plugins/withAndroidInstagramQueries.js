const { withAndroidManifest } = require("expo/config-plugins");

// ÖNEMLİ: Android 11+ (API 30+), "paket görünürlüğü" kısıtlaması getirdi — bir uygulama,
// AndroidManifest.xml'de AÇIKÇA belirtmediği başka bir uygulamanın (ör. Instagram) yüklü olup
// olmadığını SORGULAYAMIYOR bile; Linking.canOpenURL() sessizce hep false dönüyor, uygulama
// gerçekten yüklü olsa bile. Bu, iOS'taki LSApplicationQueriesSchemes'in Android karşılığı —
// ama o app.json'a düz JSON olarak yazılabiliyordu, bu ise AndroidManifest.xml'e native bir
// <queries> bloğu eklemeyi gerektiriyor, bu yüzden bir config plugin şart.
const withAndroidInstagramQueries = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.queries) manifest.queries = [{}];

    const queries = manifest.queries[0];
    if (!queries.package) queries.package = [];
    if (!queries.intent) queries.intent = [];

    // Instagram'ın kendisini (uygulama paketi olarak) sorgulayabilelim — "yüklü mü" kontrolü için.
    const hasInstagramPackage = queries.package.some(
      (p) => p.$ && p.$["android:name"] === "com.instagram.android"
    );
    if (!hasInstagramPackage) {
      queries.package.push({ $: { "android:name": "com.instagram.android" } });
    }

    // SEND intent'i de ekliyoruz — Instagram Stories'e paylaşım akışının bir parçası.
    const hasSendIntent = queries.intent.some((i) =>
      i.action?.some((a) => a.$ && a.$["android:name"] === "android.intent.action.SEND")
    );
    if (!hasSendIntent) {
      queries.intent.push({
        action: [{ $: { "android:name": "android.intent.action.SEND" } }],
      });
    }

    return config;
  });
};

module.exports = withAndroidInstagramQueries;