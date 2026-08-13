// Kullanıcının Ayarlar'daki slider'la seçtiği "belirginlik" (0-100) değerini, profil temasının
// arka planında kullanılan blurRadius + karartma opaklığına çeviriyor. Tek bir sayı ile ters
// orantılı iki değeri birlikte kontrol ediyoruz — ayrı ayrı iki slider gereksiz karmaşıklık
// katardı. Uçlar (0 ve 100) BİLEREK sınırlı: 100'de bile hafif bir blur/karartma kalıyor ki
// üzerindeki isim/rozet gibi metinler hiçbir zaman tamamen okunaksız hale gelmesin.
const MIN_BLUR = 6;
const MAX_BLUR = 22;
const MIN_DIM = 0.4;
const MAX_DIM = 0.78;

export function backgroundBlurAndDim(intensity) {
  const t = Math.max(0, Math.min(100, intensity ?? 50)) / 100;
  const blurRadius = Math.round(MAX_BLUR - (MAX_BLUR - MIN_BLUR) * t);
  const dim = MAX_DIM - (MAX_DIM - MIN_DIM) * t;
  return { blurRadius, dim };
}
