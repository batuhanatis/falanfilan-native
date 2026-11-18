// EAS CLI'nin --non-interactive modunda yeni bir uygulama hedefine (ör. PellixWidget,
// com.batuhanatis.pellix.widget) dağıtım sertifikası atanmamışsa derleme
// "Credentials are not set up. Run this command again in interactive mode." diye duruyor.
// Etkileşimli modda EAS, hesaptaki geçerli dağıtım sertifikasını yeniden kullanmayı öneriyor;
// bu ön yükleme betiği CI'da aynı seçimi otomatik yapar. Hedefin sertifikası zaten varsa
// hiçbir şeyi değiştirmez. Sertifika atanınca provizyon profili EAS'ın kendi akışıyla
// (EAS'ta kayıtlı App Store Connect API anahtarıyla) oluşturulur ve EAS'a kaydedilir.
//
// Kullanım: NODE_OPTIONS="--require <bu dosya>" ve EAS_CLI_DIR=<global eas-cli klasörü>
const path = require("path");
const fs = require("fs");

const dir = process.env.EAS_CLI_DIR;
const target = dir && path.join(dir, "build/credentials/ios/actions/SetUpDistributionCertificate.js");
const isEas = (process.argv[1] || "").includes("eas");

if (target && isEas && fs.existsSync(target)) {
  const { SetUpDistributionCertificate } = require(target);
  const original = SetUpDistributionCertificate.prototype.runNonInteractiveAsync;
  SetUpDistributionCertificate.prototype.runNonInteractiveAsync = async function (ctx, current) {
    if (current || !ctx.appStore.authCtx) return original.call(this, ctx, current);
    const valid = await this.getValidDistCertsAsync(ctx);
    if (!valid.length) return original.call(this, ctx, current);
    const cert = valid[0];
    console.log(
      `[eas-reuse-dist-cert] ${this.app.bundleIdentifier} için dağıtım sertifikası yok; ` +
        `hesaptaki geçerli sertifika yeniden kullanılıyor (seri no ${cert.serialNumber}).`
    );
    return cert;
  };
}
