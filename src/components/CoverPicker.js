import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hapticLight } from "../utils/haptics";
import { COVER_EMOJI_OPTIONS, COVER_COLOR_OPTIONS } from "../utils/listCover";

// WL1 — liste oluştururken/düzenlerken bir emoji + renk seçilebiliyor. İkisi de opsiyonel;
// hiçbiri seçilmezse WatchlistCover zaten posterden ya da id'den türetilmiş bir renkten kapak kuruyor.
export default function CoverPicker({ emoji, color, onChangeEmoji, onChangeColor }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  return (
    <View>
      <Text style={styles.label}>KAPAK (opsiyonel)</Text>
      <View style={styles.row}>
        {COVER_EMOJI_OPTIONS.map((e) => (
          <TouchableOpacity
            key={e}
            style={[styles.emojiChip, emoji === e && { borderColor: color || c.accent, borderWidth: 2 }]}
            onPress={() => { hapticLight(); onChangeEmoji(emoji === e ? null : e); }}
          >
            <Text style={{ fontSize: 17 }}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.row, { marginTop: 8 }]}>
        {COVER_COLOR_OPTIONS.map((col) => (
          <TouchableOpacity
            key={col}
            style={[styles.colorSwatch, { backgroundColor: col }, color === col && { borderColor: c.text }]}
            onPress={() => { hapticLight(); onChangeColor(color === col ? null : col); }}
          />
        ))}
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    label: { fontSize: 10, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    emojiChip: {
      width: 34, height: 34, borderRadius: 10, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      alignItems: "center", justifyContent: "center",
    },
    colorSwatch: { width: 26, height: 26, borderRadius: 999, borderWidth: 2, borderColor: "transparent" },
  });
}
