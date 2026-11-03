// app.json temel ayar; CI'da TV_VERSION_CODE verilirse Android versionCode o oluyor (Google Play
// her yüklemede öncekinden büyük bir sayı istiyor; iş akışı 1000000 + çalıştırma numarası veriyor).
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.TV_VERSION_CODE) || config.android?.versionCode || 1,
  },
});
