const { withGradleProperties } = require("expo/config-plugins");

// ÖNEMLİ: Android production build'i (özellikle "Kataloğu Büyüt" gibi ağır bağımlılıklar
// eklendikten sonra — react-native-purchases, google-signin) GitHub Actions'ın ubuntu runner'ında
// Gradle'ın VARSAYILAN JVM Metaspace limitiyle (512 MiB) artık sığmıyor: lintVitalAnalyzeRelease
// adımında "> Metaspace" hatasıyla çöküyordu (bkz. react-native-purchases ve google-signin
// modüllerinin lint analizi). Metaspace, bir OOM türü — çözüm daha fazla deneme değil, Gradle
// daemon'a baştan daha fazla heap/metaspace ayırmak. android/gradle.properties prebuild'de
// ÜRETİLDİĞİ (commit edilmiyor) için bunu bir config plugin'le enjekte ediyoruz.
const withAndroidGradleMemory = (config) => {
  return withGradleProperties(config, (config) => {
    const key = "org.gradle.jvmargs";
    const value = "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError";
    const existing = config.modResults.find((item) => item.type === "property" && item.key === key);
    if (existing) {
      existing.value = value;
    } else {
      config.modResults.push({ type: "property", key, value });
    }
    return config;
  });
};

module.exports = withAndroidGradleMemory;
