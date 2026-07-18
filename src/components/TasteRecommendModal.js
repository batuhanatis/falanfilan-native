import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { X, Wand2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { GENRE_FILTERS } from "../theme/theme";
import ChipRow from "./ChipRow";

// Görünen etiket -> backend'in beklediği anahtar eşlemesi.
const YEAR_OPTIONS = [
  ["1990 öncesi", "before1990"],
  ["1990'lar", "1990s"],
  ["2000'ler", "2000s"],
  ["2010'lar", "2010s"],
  ["2020 ve sonrası", "2020s"],
];

export default function TasteRecommendModal({ onClose, onResults }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const [genre, setGenre] = useState(null);
  const [type, setType] = useState(null);
  const [yearLabels, setYearLabels] = useState(new Set()); // görünen etiketler tutuluyor
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const styles = makeStyles(c);

  function toggleYear(label) {
    setYearLabels((prev) => {
      const n = new Set(prev);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });
  }

  async function getRecommendation() {
    setLoading(true);
    setError("");
    try {
      const years = YEAR_OPTIONS.filter(([label]) => yearLabels.has(label)).map(([, key]) => key);
      const data = await api.aiTaste(auth.token, { genre, type, years });
      if ((data.results || []).length === 0) {
        setError("Bu kritere uyan bir şey bulamadım, farklı bir seçim deneyebilir misin?");
      } else {
        onResults(data.results);
        onClose();
      }
    } catch (e) {
      setError(e.message || "Öneri alınamadı, tekrar dener misin?");
    }
    setLoading(false);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient colors={["#8e2de2", "#4a00e0", "#00c9ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
            <View style={styles.header}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Wand2 size={18} color="#fff" />
                <Text style={styles.headerTitle}>Zevkine Göre Öner</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#fff" /></TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>Geçmişte beğendiklerine bakıp sana özel bir liste buluruz</Text>
          </LinearGradient>

          <View style={{ padding: 20 }}>
            <Text style={styles.label}>TÜR (opsiyonel)</Text>
            <ChipRow items={GENRE_FILTERS} active={genre} onSelect={(v) => setGenre(v === genre ? null : v)} />

            <Text style={styles.label}>İÇERİK TİPİ (opsiyonel)</Text>
            <ChipRow items={["Film", "Dizi"]} active={type} onSelect={(v) => setType(v === type ? null : v)} />

            <Text style={styles.label}>YAPIM YILI (opsiyonel, birden fazla seçilebilir)</Text>
            <ChipRow
              items={YEAR_OPTIONS.map(([label]) => label)}
              isActive={(label) => yearLabels.has(label)}
              onSelect={toggleYear}
            />

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity style={styles.goBtn} onPress={getRecommendation} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.goBtnText}>Bana Bir Şey Öner</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
    headerGradient: { padding: 20 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    headerTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
    headerSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 6 },
    closeBtn: { width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    label: { fontSize: 10, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8, marginTop: 14 },
    errorText: { color: c.danger, fontSize: 11, marginTop: 12 },
    goBtn: { marginTop: 20, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    goBtnText: { color: "#14121a", fontWeight: "800", fontSize: 13 },
  });
}
