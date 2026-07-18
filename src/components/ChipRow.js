import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useAppTheme } from "../context/ThemeContext";

// Web'deki ChipRow'un native karşılığı — tek/çoklu seçilebilir yatay çip listesi.
export default function ChipRow({ items, active, onSelect, isActive }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const checkActive = isActive || ((item) => item === active);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => {
        const on = checkActive(item);
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onSelect(item)}
            style={[styles.chip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
          >
            <Text style={[styles.chipText, on && { color: c.bg, fontWeight: "800" }]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    row: { gap: 8, paddingVertical: 2 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2,
    },
    chipText: { fontSize: 12, fontWeight: "600", color: c.text },
  });
}
