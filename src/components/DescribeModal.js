import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MessageSquareText } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import IslandModal from "./IslandModal";
import LoadingLines from "./LoadingLines";

const DESCRIBE_GRADIENT = ["#ff6b6b", "#f7b733"];
const DESCRIBE_LOADING_LINES = ["Anlattığını çözümlüyorum…", "Kataloğu tarıyorum…", "Uygun olanları eliyorum…"];

const MOODS = [
  ["😔", "Moral", "Moralim bozuk, içimi ısıtacak bir şey istiyorum"],
  ["🤯", "Dağıt", "Kafamı dağıtmam lazım, hafif ve eğlenceli bir şey"],
  ["🔥", "Heyecan", "Heyecan istiyorum, gerilim dolu bir şey"],
  ["😂", "Güldür", "Güldürsün, kesin bir komedi"],
  ["😢", "Duygusal", "Ağlamak istiyorum, duygusal bir dram"],
];

export default function DescribeModal({ onClose, onResults, onClear, hasResults, navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runDescribe(overrideText) {
    const text = (typeof overrideText === "string" ? overrideText : prompt).trim();
    if (!text || loading) return;
    if (typeof overrideText === "string") setPrompt(overrideText);
    setLoading(true);
    setError("");
    try {
      const data = await api.describe(auth.token, text);
      const matched = data.results || [];
      if (matched.length === 0) {
        setError("Bu tanıma uyan bir şey bulamadım, farklı bir şekilde anlatmayı dener misin?");
      } else {
        onResults(matched, `"${text}" için önerilerin`);
        onClose();
      }
    } catch (e) {
      setError(e.message || "Öneri alınamadı, tekrar dener misin?");
      if (e.limitReached) {
        Alert.alert("Günlük hakkın doldu", e.message, [
          { text: "Tamam", style: "cancel" },
          { text: "Premium'a Geç", onPress: () => { onClose(); navigation.navigate("Premium", { reason: "ai_limit" }); } },
        ]);
      }
    }
    setLoading(false);
  }

  function clearAndClose() {
    onClear();
    onClose();
  }

  return (
    <IslandModal
      visible
      onClose={onClose}
      title="Anlat, Bulalım"
      icon={MessageSquareText}
      gradientColors={DESCRIBE_GRADIENT}
      subtitle="Ne tür bir şey istediğini kendi cümlelerinle anlat"
    >
      <Text style={styles.moodLabel}>HIZLI SEÇİM</Text>
      <View style={styles.moodRow}>
        {MOODS.map(([emoji, label, text]) => (
          <TouchableOpacity key={text} style={styles.moodChip} onPress={() => runDescribe(text)} disabled={loading}>
            <Text style={styles.moodChipEmoji}>{emoji}</Text>
            <Text style={styles.moodChipLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.describeInput}
        placeholder="Örn: kapalı havada geçen klostrofobik atmosferli hayatta kalma filmleri"
        placeholderTextColor={c.dim}
        value={prompt}
        onChangeText={setPrompt}
        multiline
        numberOfLines={3}
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity activeOpacity={0.88} onPress={() => runDescribe()} disabled={loading}>
        <LinearGradient colors={DESCRIBE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.goBtn}>
          {loading ? (
            <LoadingLines lines={DESCRIBE_LOADING_LINES} style={styles.goBtnText} />
          ) : (
            <Text style={styles.goBtnText}>Öneri Al</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {hasResults && (
        <TouchableOpacity onPress={clearAndClose} style={{ alignSelf: "center", marginTop: 14 }}>
          <Text style={styles.clearText}>Aramayı temizle</Text>
        </TouchableOpacity>
      )}
    </IslandModal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    moodLabel: { fontSize: 9, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8 },
    moodRow: { flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" },
    moodChip: {
      alignItems: "center", gap: 2, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7,
    },
    moodChipEmoji: { fontSize: 16 },
    moodChipLabel: { fontSize: 9, fontWeight: "700", color: c.text },
    describeInput: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 10, color: c.text, fontSize: 13, minHeight: 60, textAlignVertical: "top",
    },
    errorText: { color: c.danger, fontSize: 11, marginTop: 10 },
    goBtn: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    goBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    clearText: { color: c.dim, fontSize: 11, textDecorationLine: "underline" },
  });
}
