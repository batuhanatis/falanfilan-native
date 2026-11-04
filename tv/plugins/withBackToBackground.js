// Geri tuşu düzeltmesi (Android 12+). React Native 0.81'in ReactActivity'si, JS geri tuşunu
// işlemeyince (ana ekranda geri → uygulamadan çık) varsayılan davranış için kendi geri tuşu
// çağrısını kalıcı olarak kapatıyor ve bir daha açmıyor. Android 12+'da uygulama kapanmayıp
// arka plana gittiği için, kullanıcı geri döndüğünde artık hiçbir geri basışı JS'e ulaşmıyor:
// detay ekranındayken bile geri tuşu uygulamadan çıkarıyordu. Burada "çık" her sürümde
// uygulamayı arka plana almak (moveTaskToBack) oluyor; o çağrı kapanmadığı için dönüşte geri
// tuşu yine uygulamanın içinde çalışıyor. Kök olmayan aktivitelerde eski davranış sürüyor.
const { withMainActivity } = require("expo/config-plugins");

const MARKER = "Pellix TV: geri tuşu";
const METHOD = `
  // ${MARKER} — bkz. plugins/withBackToBackground.js
  override fun invokeDefaultOnBackPressed() {
      if (!moveTaskToBack(false)) {
          super.invokeDefaultOnBackPressed()
      }
  }
`;

module.exports = function withBackToBackground(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== "kt") throw new Error("withBackToBackground: MainActivity Kotlin değil");
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;

    // Şablondaki invokeDefaultOnBackPressed'i (açıklamasıyla birlikte) çıkar.
    const start = src.indexOf("override fun invokeDefaultOnBackPressed()");
    if (start >= 0) {
      const docStart = src.lastIndexOf("/**", start);
      const from = docStart >= 0 && src.slice(docStart, start).trim().endsWith("*/") ? docStart : start;
      let depth = 0;
      let end = -1;
      for (let i = src.indexOf("{", start); i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      if (end < 0) throw new Error("withBackToBackground: invokeDefaultOnBackPressed sonu bulunamadı");
      src = src.slice(0, from) + src.slice(end);
    }

    // Sınıfın kapanış parantezinden önce ekle.
    const classEnd = src.lastIndexOf("}");
    src = src.slice(0, classEnd).replace(/\s*$/, "\n") + METHOD + "}\n";
    cfg.modResults.contents = src;
    return cfg;
  });
};
