import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Star } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hapticSelection } from "../utils/haptics";

// 10 üzerinden puan — TEK SATIRDA, kaydırma yok. Eskiden 1–10 çipleri yatay kaydırılan bir
// satırdaydı; 8, 9, 10 ekranın dışında kalıyordu ve kullanıcı daha yüksek puan olduğunu
// fark etmeyebiliyordu. Artık IMDb'deki gibi satırı dolduran 10 yıldız var: dokunarak ya da
// parmağı yıldızların üstünde kaydırarak (Letterboxd'daki gibi) seçiliyor. Trakt'taki gibi
// her puanın kısa bir karşılığı da gösteriliyor ki "7 ne demek" belirsiz kalmasın.
export const RATING_LABELS = {
  1: "Berbat",
  2: "Çok kötü",
  3: "Kötü",
  4: "Vasatın altı",
  5: "Vasat",
  6: "İdare eder",
  7: "İyi",
  8: "Çok iyi",
  9: "Harika",
  10: "Başyapıt",
};

export default function RatingStars({ value, onChange, disabled = false, compact = false, allowClear = false }) {
  const { c } = useAppTheme();
  const styles = useMemo(() => makeStyles(c, compact), [c, compact]);
  const [rowWidth, setRowWidth] = useState(0);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const movedRef = useRef(false);
  const current = Number(value) || 0;
  const shown = preview ?? current;

  function valueAt(x) {
    if (!rowWidth) return null;
    return Math.min(10, Math.max(1, Math.ceil((x / rowWidth) * 10)));
  }

  function track(x) {
    const next = valueAt(x);
    if (next == null || next === previewRef.current) return;
    if (previewRef.current != null) movedRef.current = true;
    previewRef.current = next;
    setPreview(next);
    hapticSelection();
  }

  function finish(commit) {
    const next = previewRef.current;
    const moved = movedRef.current;
    previewRef.current = null;
    movedRef.current = false;
    setPreview(null);
    if (!commit || next == null) return;
    // Seçili yıldıza tek dokunuş puanı kaldırır (kaydırarak aynı yere gelmek kaldırmaz).
    onChange?.(allowClear && !moved && next === current ? null : next);
  }

  // Yıldızlar pointerEvents="none": dokunuşun hedefi hep satırın kendisi, locationX de satıra göre.
  // Dikey kaydırmaya izin veriyoruz (TerminationRequest → true): liste kaydırılırken parmak
  // yıldızlara değse bile puan VERİLMİYOR — kaydırma başlayınca dokunuş iptal oluyor.
  const responder = disabled ? {} : {
    // Yalnızca dokunuş YILDIZLARDA başladıysa: başka yerden başlayan bir kaydırma parmağı
    // yıldızların üstünden geçirse bile puan vermesin (onMoveShouldSetResponder bilerek yok).
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => true,
    onResponderGrant: (e) => track(e.nativeEvent.locationX),
    onResponderMove: (e) => track(e.nativeEvent.locationX),
    onResponderRelease: () => finish(true),
    onResponderTerminate: () => finish(false),
  };

  const starSize = rowWidth ? Math.max(16, Math.min(compact ? 24 : 30, Math.floor(rowWidth / 10) - 6)) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.readout}>
        {shown ? (
          <>
            <Text style={styles.number}>{shown}</Text>
            <Text style={styles.outOf}>/10</Text>
            <Text style={styles.label} numberOfLines={1}>{RATING_LABELS[shown]}</Text>
          </>
        ) : (
          <Text style={styles.hint}>Yıldızlara dokun ya da parmağını kaydır</Text>
        )}
        {allowClear && !!current && !preview && (
          <TouchableOpacity onPress={() => onChange?.(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.clearBtn}>
            <Text style={styles.clearText}>Temizle</Text>
          </TouchableOpacity>
        )}
      </View>
      <View
        style={[styles.row, disabled && { opacity: 0.5 }]}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Puan"
        accessibilityValue={{ min: 1, max: 10, now: current || undefined, text: current ? `${current}/10 ${RATING_LABELS[current]}` : "Puan yok" }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          if (disabled) return;
          if (e.nativeEvent.actionName === "increment") onChange?.(Math.min(10, (current || 0) + 1));
          if (e.nativeEvent.actionName === "decrement" && current > 1) onChange?.(current - 1);
        }}
        {...responder}
      >
        {!!rowWidth && Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const on = n <= shown;
          return (
            <View key={n} style={styles.cell} pointerEvents="none">
              <Star size={starSize} color={on ? c.accent : c.dim} fill={on ? c.accent : "none"} strokeWidth={on ? 1.6 : 1.4} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(c, compact) {
  return StyleSheet.create({
    wrap: { marginTop: compact ? 8 : 10 },
    readout: { flexDirection: "row", alignItems: "baseline", gap: 3, minHeight: compact ? 20 : 34 },
    number: { color: c.accent, fontSize: compact ? 16 : 28, fontWeight: "900" },
    outOf: { color: c.dim, fontSize: compact ? 10.5 : 12, fontWeight: "800" },
    label: { flex: 1, color: c.text, fontSize: compact ? 11.5 : 13, fontWeight: "800", marginLeft: 8 },
    hint: { flex: 1, color: c.dim, fontSize: compact ? 10.5 : 11.5, fontWeight: "700", alignSelf: "center" },
    clearBtn: { alignSelf: "center" },
    clearText: { color: c.dim, fontSize: 11, fontWeight: "800", textDecorationLine: "underline" },
    row: { flexDirection: "row", alignItems: "center", height: compact ? 36 : 44, marginTop: compact ? 2 : 4 },
    cell: { flex: 1, alignItems: "center", justifyContent: "center", height: "100%" },
  });
}
