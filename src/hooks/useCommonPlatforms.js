import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { COMMON_PLATFORMS } from "../theme/theme";

// COMMON_PLATFORMS sadece İSİM taşıyan sabit bir liste — Ana Sayfa'nın gösterdiği filmlerin
// verisinden türettiği platform nesnelerinin (gerçek logo içeren) aksine. Bu yüzden MatchParty/
// GroupParty/"Zevkine Göre Öner" gibi belirli bir film listesine bağlı olmayan filtre ekranları
// logo yerine baş harf rozetine düşüyordu. Bu hook GET /api/platforms'tan (TMDB'nin gerçek
// sağlayıcı listesi) aynı isimlerle eşleşen logoları çekip Ana Sayfa'yla BİREBİR aynı görseli
// sağlıyor — bulunamayan bir isim varsa (name, logo:null) olarak kalır, FilterFields zaten bunun
// için baş harf rozetine düşüyor.
export function useCommonPlatforms() {
  const { auth } = useAuth();
  const [platforms, setPlatforms] = useState(COMMON_PLATFORMS.map((name) => ({ name, logo: null })));

  useEffect(() => {
    let cancelled = false;
    api.platforms(auth.token).then((data) => {
      if (cancelled) return;
      const byName = new Map((data.results || []).map((p) => [p.name, p.logo]));
      setPlatforms(COMMON_PLATFORMS.map((name) => ({ name, logo: byName.get(name) || null })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [auth.token]);

  return platforms;
}
