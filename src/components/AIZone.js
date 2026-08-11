import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, ChevronDown, MessageSquareText, Wand2, Image as ImageIcon } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import TasteRecommendModal from "./TasteRecommendModal";
import PhotoIdentifyModal from "./PhotoIdentifyModal";

// ÖNEMLİ (performans düzeltmesi): Bu bileşen eskiden HomeScreen'in İÇİNDE, aynı fonksiyonun
// state'iyle yaşıyordu — panel her açılıp kapandığında (aiOpen değiştiğinde) HomeScreen'in
// TAMAMI (uzun film listesi dahil) yeniden render ediliyordu, bu da "butona basınca hafif
// gecikmeli açılıyor" hissine yol açıyordu. Artık kendi izole state'ine (aiOpen, describeOpen,
// prompt, describeLoading, describeError, modal aç/kapa) sahip AYRI bir bileşen — açıp
// kapatmak artık SADECE bunu, film listesini değil, yeniden render ediyor.
//
// Ana sayfanın besleme akışını GERÇEKTEN etkileyen tek şey (arama/AI sonuçlarının listede
// gösterilmesi) hâlâ HomeScreen'de kalıyor — bu bileşen sonuç bulunca sadece `onResults`
// callback'iyle yukarı bildiriyor, kendi state'ine yazmıyor.
export default function AIZone({ navigation, hasResults, onResults, onClear }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [aiOpen, setAiOpen] = useState(false);
  const [describeOpen, setDescribeOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [describeLoading, setDescribeLoading] = useState(false);
  const [describeError, setDescribeError] = useState("");
  const [tasteModalOpen, setTasteModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  async function runDescribe(overrideText) {
    const text = (typeof overrideText === "string" ? overrideText : prompt).trim();
    if (!text || describeLoading) return;
    if (typeof overrideText === "string") setPrompt(overrideText);
    setDescribeLoading(true);
    setDescribeError("");
    try {
      const data = await api.describe(auth.token, text);
      const matched = data.results || [];
      if (matched.length === 0) {
        setDescribeError("Bu tanıma uyan bir şey bulamadım, farklı bir şekilde anlatmayı dener misin?");
      } else {
        onResults(matched, `"${text}" için önerilerin`);
      }
    } catch (e) {
      setDescribeError(e.message || "Öneri alınamadı, tekrar dener misin?");
      if (e.limitReached) {
        Alert.alert("Günlük hakkın doldu", e.message, [
          { text: "Tamam", style: "cancel" },
          { text: "Premium'a Geç", onPress: () => navigation.navigate("Premium") },
        ]);
      }
    }
    setDescribeLoading(false);
  }

  function clearDescribe() {
    setPrompt("");
    setDescribeOpen(false);
    setDescribeError("");
    onClear();
  }

  return (
    <View>
      <TouchableOpacity activeOpacity={0.9} onPress={() => setAiOpen((v) => !v)}>
        <LinearGradient
          colors={["#ff6b6b", "#f7b733", "#48dbfb", "#7367f0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiZone}
        >
          <View style={styles.aiZoneHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} color="#fff" />
              <Text style={styles.aiZoneTitle}>Yapay Zeka Köşesi</Text>
            </View>
            <ChevronDown size={18} color="#fff" style={{ transform: [{ rotate: aiOpen ? "180deg" : "0deg" }] }} />
          </View>
          <Text style={styles.aiZoneSubtitle}>Ne izleyeceğine karar veremiyorsan bize bırak</Text>
        </LinearGradient>
      </TouchableOpacity>

      {aiOpen && (
        <View style={styles.aiPanel}>
          <TouchableOpacity style={styles.aiRow} onPress={() => setDescribeOpen((v) => !v)}>
            <View style={[styles.aiRowIcon, { backgroundColor: "#ff6b6b" }]}>
              <MessageSquareText size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Anlat, Bulalım</Text>
              <Text style={styles.aiRowSubtitle}>Ne tür bir şey istediğini kendi cümlelerinle anlat</Text>
            </View>
            <ChevronDown size={16} color={c.dim} style={{ transform: [{ rotate: describeOpen ? "180deg" : "0deg" }] }} />
          </TouchableOpacity>

          {describeOpen && (
            <View style={styles.describePanel}>
              <Text style={styles.moodLabel}>HIZLI SEÇİM</Text>
              <View style={styles.moodRow}>
                {[
                  ["😔", "Moral", "Moralim bozuk, içimi ısıtacak bir şey istiyorum"],
                  ["🤯", "Dağıt", "Kafamı dağıtmam lazım, hafif ve eğlenceli bir şey"],
                  ["🔥", "Heyecan", "Heyecan istiyorum, gerilim dolu bir şey"],
                  ["😂", "Güldür", "Güldürsün, kesin bir komedi"],
                  ["😢", "Duygusal", "Ağlamak istiyorum, duygusal bir dram"],
                ].map(([emoji, label, text]) => (
                  <TouchableOpacity key={text} style={styles.moodChip} onPress={() => runDescribe(text)} disabled={describeLoading}>
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
                numberOfLines={2}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.describeGoBtn, describeLoading && { opacity: 0.6 }]} onPress={() => runDescribe()} disabled={describeLoading}>
                  {describeLoading ? <ActivityIndicator size="small" color="#14121a" /> : <Text style={styles.describeGoText}>Öneri al</Text>}
                </TouchableOpacity>
                {hasResults && (
                  <TouchableOpacity onPress={clearDescribe} style={{ justifyContent: "center" }}>
                    <Text style={styles.clearDescribeText}>Aramayı temizle</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!!describeError && <Text style={styles.describeErrorText}>{describeError}</Text>}
            </View>
          )}

          <TouchableOpacity style={styles.aiRow} onPress={() => setTasteModalOpen(true)}>
            <View style={[styles.aiRowIcon, { backgroundColor: "#7367f0" }]}>
              <Wand2 size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Zevkime Göre Öner</Text>
              <Text style={styles.aiRowSubtitle}>Beğendiklerine bakıp sana özel bir şey bulur</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.aiRow, { borderBottomWidth: 0 }]} onPress={() => setPhotoModalOpen(true)}>
            <View style={[styles.aiRowIcon, { backgroundColor: "#f7b733" }]}>
              <ImageIcon size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Fotoğraftan Bul</Text>
              <Text style={styles.aiRowSubtitle}>Bir sahne yükle, hangi film/diziden olduğunu bulalım</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {tasteModalOpen && (
        <TasteRecommendModal
          onClose={() => setTasteModalOpen(false)}
          onResults={(results) => onResults(results, "Zevkine göre önerilerin")}
          navigation={navigation}
        />
      )}
      {photoModalOpen && <PhotoIdentifyModal onClose={() => setPhotoModalOpen(false)} navigation={navigation} />}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    aiZone: { marginTop: 14, borderRadius: 18, padding: 16 },
    aiZoneHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    aiZoneTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
    aiZoneSubtitle: { color: "rgba(255,255,255,0.9)", fontSize: 11, marginTop: 6 },

    aiPanel: { marginTop: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14 },
    aiRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    aiRowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    aiRowTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    aiRowSubtitle: { fontSize: 11, color: c.dim, marginTop: 2 },

    describePanel: { paddingBottom: 14 },
    moodLabel: { fontSize: 9, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8 },
    moodRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
    moodChip: {
      alignItems: "center", gap: 2, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7,
    },
    moodChipEmoji: { fontSize: 16 },
    moodChipLabel: { fontSize: 9, fontWeight: "700", color: c.text },
    describeInput: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 10, color: c.text, fontSize: 13, minHeight: 50, textAlignVertical: "top",
    },
    describeGoBtn: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
    describeGoText: { color: "#14121a", fontWeight: "700", fontSize: 12 },
    clearDescribeText: { color: c.dim, fontSize: 11, textDecorationLine: "underline" },
    describeErrorText: { color: c.danger, fontSize: 11, marginTop: 8 },
  });
}
