// EAS CLI'nin --non-interactive modunda yeni bir uygulama hedefine (ör. PellixWidget,
// com.batuhanatis.pellix.widget) dağıtım sertifikası atanmamışsa derleme
// "Credentials are not set up. Run this command again in interactive mode." diye duruyor.
// Etkileşimli modda EAS, hesaptaki geçerli dağıtım sertifikasını yeniden kullanmayı öneriyor;
// bu ön yükleme betiği CI'da aynı seçimi otomatik yapar. Hedefin sertifikası zaten varsa
// hiçbir şeyi değiştirmez. Sertifika atanınca provizyon profili EAS'ın kendi akışıyla
// (EAS'ta kayıtlı App Store Connect API anahtarıyla) oluşturulur ve EAS'a kaydedilir.
//
// Kullanım: NODE_OPTIONS="--require <bu dosya>". eas-cli nereye kurulmuş olursa olsun
// (npm/yarn global, araç önbelleği) ilgili modül yüklendiği anda yamalanır.
const Module = require("module");
const path = require("path");

const SUFFIX = path.join("credentials", "ios", "actions", "SetUpDistributionCertificate.js");
const TAG = "[eas-reuse-dist-cert]";

function patch(exportsObj) {
  const Cls = exportsObj && exportsObj.SetUpDistributionCertificate;
  if (!Cls || Cls.prototype.__pellixPatched) return;
  Cls.prototype.__pellixPatched = true;
  const original = Cls.prototype.runNonInteractiveAsync;
  Cls.prototype.runNonInteractiveAsync = async function (ctx, current) {
    if (current) return original.call(this, ctx, current);
    const id = this.app && this.app.bundleIdentifier;
    if (!ctx.appStore || !ctx.appStore.authCtx) {
      console.log(`${TAG} ${id}: Apple oturumu yok, sertifika seçilemedi.`);
      return original.call(this, ctx, current);
    }
    let cert = null;
    try {
      const valid = await this.getValidDistCertsAsync(ctx);
      cert = valid[0] || null;
      console.log(`${TAG} ${id}: Apple'da geçerli ${valid.length} sertifika bulundu.`);
    } catch (e) {
      console.log(`${TAG} ${id}: sertifika listesi alınamadı: ${e && e.message}`);
    }
    if (!cert) {
      // Yedek: hesaptaki, süresi dolmamış en yeni sertifika (ana uygulamanın kullandığı).
      const all = await ctx.ios.getDistributionCertificatesForAccountAsync(ctx.graphqlClient, this.app.account);
      const now = Date.now();
      const teamId = ctx.appStore.authCtx.team && ctx.appStore.authCtx.team.id;
      cert =
        all
          .filter((c) => (!c.appleTeam || c.appleTeam.appleTeamIdentifier === teamId) && new Date(c.validityNotAfter).getTime() > now)
          .sort((a, b) => new Date(b.validityNotAfter) - new Date(a.validityNotAfter))[0] || null;
      console.log(`${TAG} ${id}: hesapta ${all.length} sertifika, uygun: ${cert ? "var" : "yok"}.`);
    }
    if (!cert) return original.call(this, ctx, current);
    console.log(`${TAG} ${id}: dağıtım sertifikası atanmamıştı; hesaptaki sertifika yeniden kullanılıyor (seri no ${cert.serialNumber}).`);
    return cert;
  };
  console.log(`${TAG} eas-cli dağıtım sertifikası adımı yamalandı.`);
}

const origJs = Module._extensions[".js"];
Module._extensions[".js"] = function (mod, filename) {
  origJs(mod, filename);
  if (filename.endsWith(SUFFIX)) {
    try {
      patch(mod.exports);
    } catch (e) {
      console.log(`${TAG} yama uygulanamadı: ${e && e.message}`);
    }
  }
};
