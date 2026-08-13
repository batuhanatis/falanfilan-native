import React, { useState } from "react";
import { Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Wand2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { YEAR_OPTIONS } from "../utils/filterYears";
import { useCommonPlatforms } from "../hooks/useCommonPlatforms";
import IslandModal from "./IslandModal";
import FilterFields from "./FilterFields";
import LoadingLines from "./LoadingLines";

// AI2 — "Bana Bir Şey Öner" tıklanınca ne olduğunu hissettiren, dönen mikro-metin — sıradan bir
// spinnerden farklı olsun diye (bkz. G2).
const TASTE_LOADING_LINES = ["Zevkini analiz ediyorum…", "Kataloğu tarıyorum…", "Uygun olanları eliyorum…"];

// Hem başlık şeridinde hem alttaki CTA'da kullanılan AYNI gradyan — buton artık başlıktan
// kopuk, düz altın bir renk değil, aynı "Zevkine Göre Öner" kimliğini taşıyor.
const BRAND_GRADIENT = ["#8e2de2", "#4a00e0", "#00c9ff"];

// ÖNEMLİ: Eskiden bu kendi bottom-sheet'i olan, Ana Sayfa'nın filtre paneli ve MatchParty
// davetiyle hiç ilgisi olmayan üçüncü bir filtre implementasyonuydu. Artık ikisiyle AYNI
// paylaşılan FilterFields + IslandModal ("adacık" — ortada beliren, ne alttan ne üstten kayan
// modal) çiftini kullanıyor — sadece kendi API çağrısı/yükleniyor durumu farklı.
export default function TasteRecommendModal({ onClose, onResults, navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const commonPlatforms = useCommonPlatforms();
  const [genre, setGenre] = useState(null);
  const [type, setType] = useState(null);
  const [yearLabels, setYearLabels] = useState(new Set());
  const [platforms, setPlatforms] = useState(new Set());
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

  function togglePlatform(name) {
    setPlatforms((prev) => {
      const n = new Set(prev);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  }

  async function getRecommendation() {
    setLoading(true);
    setError("");
    try {
      const years = YEAR_OPTIONS.filter(([label]) => yearLabels.has(label)).map(([, key]) => key);
      const data = await api.aiTaste(auth.token, { genre, type, years, platforms: [...platforms] });
      if ((data.results || []).length === 0) {
        setError("Bu kritere uyan bir şey bulamadım, farklı bir seçim deneyebilir misin?");
      } else {
        onResults(data.results);
        onClose();
      }
    } catch (e) {
      setError(e.message || "Öneri alınamadı, tekrar dener misin?");
      if (e.limitReached && navigation) {
        Alert.alert("Günlük hakkın doldu", e.message, [
          { text: "Tamam", style: "cancel" },
          { text: "Premium'a Geç", onPress: () => { onClose(); navigation.navigate("Premium", { reason: "ai_limit" }); } },
        ]);
      }
    }
    setLoading(false);
  }

  return (
    <IslandModal
      visible
      onClose={onClose}
      title="Zevkine Göre Öner"
      icon={Wand2}
      gradientColors={BRAND_GRADIENT}
      subtitle="Geçmişte beğendiklerine bakıp sana özel bir liste buluruz"
    >
      <FilterFields
        typeValue={type || "Hepsi"}
        onTypeChange={(v) => setType(v === "Hepsi" ? null : v)}
        genreValue={genre}
        onGenreChange={setGenre}
        yearSet={yearLabels}
        onToggleYear={toggleYear}
        platformSet={platforms}
        onTogglePlatform={togglePlatform}
        platforms={commonPlatforms}
      />

      {/* AI2 — filtrelerin hepsi boşken sonucun nereden geleceği belirsizdi ("kara kutu"
          hissi); artık ne olacağını açıkça söylüyoruz. */}
      {!genre && !type && yearLabels.size === 0 && platforms.size === 0 && (
        <Text style={styles.helperText}>Boş bırakırsan geçmiş beğenilerine göre öneririz.</Text>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity activeOpacity={0.88} onPress={getRecommendation} disabled={loading}>
        <LinearGradient colors={BRAND_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.goBtn}>
          {loading ? (
            <LoadingLines lines={TASTE_LOADING_LINES} style={styles.goBtnText} />
          ) : (
            <Text style={styles.goBtnText}>Bana Bir Şey Öner</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </IslandModal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    helperText: { color: c.dim, fontSize: 11, marginTop: 16, fontStyle: "italic" },
    errorText: { color: c.danger, fontSize: 11, marginTop: 12 },
    goBtn: { marginTop: 20, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    goBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  });
}
