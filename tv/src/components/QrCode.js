import React, { useMemo } from "react";
import { View } from "react-native";
import QRCodeCore from "qrcode/lib/core/qrcode";

// QR'ı satır satır, art arda gelen koyu kareleri tek kutuya birleştirerek çiziyor (az görünüm).
export default function QrCode({ value, size = 200, color = "#14121a", background = "#f2ede2" }) {
  const { count, rows } = useMemo(() => {
    const qr = QRCodeCore.create(value, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const data = qr.modules.data;
    const out = [];
    for (let y = 0; y < n; y++) {
      const runs = [];
      let x = 0;
      while (x < n) {
        if (data[y * n + x]) {
          const start = x;
          while (x < n && data[y * n + x]) x++;
          runs.push([start, x - start]);
        } else {
          x++;
        }
      }
      out.push(runs);
    }
    return { count: n, rows: out };
  }, [value]);
  const quiet = 2;
  const cell = size / (count + quiet * 2);
  return (
    <View style={{ width: size, height: size, backgroundColor: background, borderRadius: 10 }} accessibilityLabel="Eşleştirme QR kodu">
      {rows.map((runs, y) => runs.map(([x, len]) => (
        <View
          key={`${y}-${x}`}
          style={{ position: "absolute", left: (x + quiet) * cell, top: (y + quiet) * cell, width: len * cell + 0.5, height: cell + 0.5, backgroundColor: color }}
        />
      )))}
    </View>
  );
}
