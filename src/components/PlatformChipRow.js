import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Check } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { platformName, platformLogo } from "../utils/platform";

// Web'deki PlatformChipRow ile aynı: yazı yerine logo, çoklu seçim, seçiliyse köşede onay rozeti.
export default function PlatformChipRow({ items, activeSet, onToggle }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);

  if (items.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((p, i) => {
        const name = platformName(p);
        const logo = platformLogo(p);
        const on = activeSet.has(name);
        return (
          <TouchableOpacity key={i} onPress={() => onToggle(name)} style={styles.chipWrap}>
            <View style={[styles.chip, on && { borderColor: c.accent }, !logo && { backgroundColor: on ? c.accent : c.surface2 }]}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.logo} />
              ) : (
                <Text style={[styles.fallbackText, on && { color: c.bg }]} numberOfLines={1}>{name?.slice(0, 2)?.toUpperCase()}</Text>
              )}
            </View>
            {on && (
              <View style={styles.checkBadge}>
                <Check size={9} color={c.bg} strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    row: { gap: 10, paddingVertical: 2 },
    chipWrap: { position: "relative" },
    chip: {
      width: 42, height: 42, borderRadius: 13, backgroundColor: "#fff",
      borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    logo: { width: "100%", height: "100%" },
    fallbackText: { fontSize: 10, fontWeight: "800", color: c.text },
    checkBadge: {
      position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 999,
      backgroundColor: c.accent, borderWidth: 2, borderColor: c.surface, alignItems: "center", justifyContent: "center",
    },
  });
}
