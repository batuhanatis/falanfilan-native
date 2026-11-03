import React, { useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { C } from "../theme";

// Kumandayla odaklanınca altın dolgu alan düğme. primary: odak dışında da altın kenarlı.
export default function FocusButton({ label, onPress, primary, hasTVPreferredFocus, style, disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.btn,
        primary && styles.primary,
        focused && styles.focused,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[styles.label, focused && { color: C.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44, paddingHorizontal: 22, borderRadius: 999, borderWidth: 2, borderColor: C.border,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
  },
  primary: { borderColor: C.accent },
  focused: { backgroundColor: C.accent, borderColor: C.accent, transform: [{ scale: 1.06 }] },
  label: { color: C.text, fontSize: 16, fontWeight: "700" },
});
