import React, { useEffect, useState } from "react";
import { Text } from "react-native";

// AI/fotoğraf-tanıma gibi "bekleme süresi olan ama sıradan bir ağ isteğinden farklı hissettirmesi
// gereken" akışlarda kullanılan, birkaç saniyede bir değişen mikro-metin. Düz bir spinner yerine
// akışın kendine has bir şeyler yaptığını hissettirir (bkz. AIZone/TasteRecommendModal/PhotoIdentifyModal).
export default function LoadingLines({ lines, interval = 1400, style }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!lines || lines.length <= 1) return;
    setI(0);
    const id = setInterval(() => setI((v) => (v + 1) % lines.length), interval);
    return () => clearInterval(id);
  }, [lines, interval]);

  if (!lines || lines.length === 0) return null;
  return <Text style={style}>{lines[i]}</Text>;
}
