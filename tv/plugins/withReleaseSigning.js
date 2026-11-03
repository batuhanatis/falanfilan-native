// Mağaza (Google Play) için imza. Derlemeye yükleme anahtarı Gradle özellikleriyle verilirse
// (PELLIX_UPLOAD_STORE_FILE, PELLIX_UPLOAD_STORE_PASSWORD, PELLIX_UPLOAD_KEY_ALIAS,
// PELLIX_UPLOAD_KEY_PASSWORD; CI'da ORG_GRADLE_PROJECT_ ortam değişkenleri olarak) release APK/AAB
// o anahtarla imzalanıyor. Verilmezse eskisi gibi hata ayıklama anahtarıyla (elle kurulum testi).
// Anahtar ve şifreler hiçbir dosyaya yazılmıyor.
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_SIGNING = `
        release {
            if (findProperty('PELLIX_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('PELLIX_UPLOAD_STORE_FILE'))
                storePassword findProperty('PELLIX_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('PELLIX_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('PELLIX_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes("PELLIX_UPLOAD_STORE_FILE")) return cfg;

    const signingStart = gradle.indexOf("signingConfigs {");
    if (signingStart < 0) throw new Error("withReleaseSigning: signingConfigs bloğu bulunamadı");
    const afterBrace = signingStart + "signingConfigs {".length;
    gradle = gradle.slice(0, afterBrace) + RELEASE_SIGNING + gradle.slice(afterBrace);

    // buildTypes > release içindeki ilk "signingConfig signingConfigs.debug" satırı.
    const buildTypes = gradle.indexOf("buildTypes {");
    const release = gradle.indexOf("release {", buildTypes);
    const line = "signingConfig signingConfigs.debug";
    const at = gradle.indexOf(line, release);
    if (buildTypes < 0 || release < 0 || at < 0) throw new Error("withReleaseSigning: release imza satırı bulunamadı");
    gradle = gradle.slice(0, at)
      + "signingConfig findProperty('PELLIX_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug"
      + gradle.slice(at + line.length);

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
