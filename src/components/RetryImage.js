import React, { useState, useRef } from "react";
import { Image, View, StyleSheet } from "react-native";
import { User } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";

// Normal <Image>, bir URL'yi yüklerken başarısız olursa (soğuk başlangıçta aynı anda çok
// fazla ağ isteği varken sıkça oluyor) SESSİZCE boş kalır, bir daha denemez. Bu bileşen
// aynı görevi görüyor ama yükleme başarısız olursa kısa bir gecikmeyle 2 kez daha deniyor —
// avatar/story kartı gibi "asla boş görünmemeli" yerlerde kullanılıyor.
//
// ÖNEMLİ: source.uri hiç yoksa (bkz. utils/avatar.js — artık fotoğrafı olmayan kullanıcılar
// için sahte bir fotoğraf ÜRETMİYOR, bilerek null dönüyor) burada bir Image DEĞİL, nötr, boş
// bir "fotoğraf yok" göstergesi render ediyoruz — geçirilen style'ın (genelde bir avatar
// dairesinin width/height/borderRadius'u) AYNISINI kullanıyor, sadece içi Image yerine ikon.
export default function RetryImage({ source, style, onError, ...rest }) {
  const { c } = useAppTheme();
  const [attempt, setAttempt] = useState(0);
  const maxRetries = 2;
  const timerRef = useRef(null);

  function handleError(e) {
    if (attempt < maxRetries) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setAttempt((a) => a + 1), 600 * (attempt + 1));
    }
    onError?.(e);
  }

  if (!source?.uri) {
    const flat = StyleSheet.flatten(style) || {};
    const size = typeof flat.width === "number" ? flat.width : 40;
    return (
      <View style={[style, { backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", overflow: "hidden" }]}>
        <User size={Math.max(12, Math.round(size * 0.5))} color={c.dim} />
      </View>
    );
  }

  // "attempt" değiştikçe key de değişiyor — React'ı Image'ı gerçekten yeniden mount etmeye
  // (yani yüklemeyi baştan denemeye) zorluyor, sadece prop güncellemesiyle yetinmiyor.
  return <Image key={attempt} source={source} style={style} onError={handleError} {...rest} />;
}
