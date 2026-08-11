import React, { useState, useRef } from "react";
import { Image } from "react-native";

// Normal <Image>, bir URL'yi yüklerken başarısız olursa (soğuk başlangıçta aynı anda çok
// fazla ağ isteği varken sıkça oluyor) SESSİZCE boş kalır, bir daha denemez. Bu bileşen
// aynı görevi görüyor ama yükleme başarısız olursa kısa bir gecikmeyle 2 kez daha deniyor —
// avatar/story kartı gibi "asla boş görünmemeli" yerlerde kullanılıyor.
export default function RetryImage({ source, style, onError, ...rest }) {
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

  // "attempt" değiştikçe key de değişiyor — React'ı Image'ı gerçekten yeniden mount etmeye
  // (yani yüklemeyi baştan denemeye) zorluyor, sadece prop güncellemesiyle yetinmiyor.
  return <Image key={attempt} source={source} style={style} onError={handleError} {...rest} />;
}
