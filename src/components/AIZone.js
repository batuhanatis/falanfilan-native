import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, LayoutAnimation, Platform, UIManager } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, ChevronDown, MessageSquareText, Wand2, Image as ImageIcon } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import DescribeModal from "./DescribeModal";
import TasteRecommendModal from "./TasteRecommendModal";
import PhotoIdentifyModal from "./PhotoIdentifyModal";

// Android'de LayoutAnimation varsayılan olarak kapalı — panel açılış/kapanışını (aiOpen)
// yumuşak bir unfurl yapabilmek için bir kerelik açıyoruz.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ÖNEMLİ (performans düzeltmesi): Bu bileşen eskiden HomeScreen'in İÇİNDE, aynı fonksiyonun
// state'iyle yaşıyordu — panel her açılıp kapandığında (aiOpen değiştiğinde) HomeScreen'in
// TAMAMI (uzun film listesi dahil) yeniden render ediliyordu, bu da "butona basınca hafif
// gecikmeli açılıyor" hissine yol açıyordu. Artık kendi izole state'ine (aiOpen, hangi modal
// açık) sahip AYRI bir bileşen — açıp kapatmak artık SADECE bunu, film listesini değil,
// yeniden render ediyor.
//
// PR8 — üç alt özellik (Anlat/Zevkine Göre Öner/Fotoğraftan Bul) eskiden karışık bir örüntüydü:
// biri panelin İÇİNDE alttan açılan bir akordeon, ikisi ise ayrı ayrı alttan kayan sheet
// modallardı. Premium'un asıl vitrini olan bu üç özellik artık HEPSİ aynı, ortada beliren
// "adacık" (IslandModal) modelini paylaşıyor — her biri kendi renk kimliğiyle.
//
// Ana sayfanın besleme akışını GERÇEKTEN etkileyen tek şey (arama/AI sonuçlarının listede
// gösterilmesi) hâlâ HomeScreen'de kalıyor — bu bileşen sonuç bulunca sadece `onResults`
// callback'iyle yukarı bildiriyor, kendi state'ine yazmıyor.
export default function AIZone({ navigation, hasResults, onResults, onClear }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);

  const [aiOpen, setAiOpen] = useState(false);
  const [describeModalOpen, setDescribeModalOpen] = useState(false);
  const [tasteModalOpen, setTasteModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  // HM3 — Sparkles ikonuna sürekli, hafif bir parıltı (opacity nabzı) veriyoruz; ikonun ima
  // ettiği "hareket" artık gerçekten var, banner'ın altındaki her şey düz kalsa bile bu köşe
  // canlı duruyor.
  const sparkleOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleOpacity, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(sparkleOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sparkleOpacity]);

  function toggleAiOpen() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAiOpen((v) => !v);
  }

  return (
    <View>
      <TouchableOpacity activeOpacity={0.9} onPress={toggleAiOpen}>
        <LinearGradient
          colors={["#ff6b6b", "#f7b733", "#48dbfb", "#7367f0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiZone}
        >
          <View style={styles.aiZoneHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Animated.View style={{ opacity: sparkleOpacity }}>
                <Sparkles size={18} color="#fff" />
              </Animated.View>
              <Text style={styles.aiZoneTitle}>Yapay Zeka Köşesi</Text>
            </View>
            <ChevronDown size={18} color="#fff" style={{ transform: [{ rotate: aiOpen ? "180deg" : "0deg" }] }} />
          </View>
          <Text style={styles.aiZoneSubtitle}>Ne izleyeceğine karar veremiyorsan bize bırak</Text>
        </LinearGradient>
      </TouchableOpacity>

      {aiOpen && (
        <View style={styles.aiPanel}>
          <TouchableOpacity style={styles.aiRow} onPress={() => setDescribeModalOpen(true)}>
            <LinearGradient colors={["#ff6b6b", "#f7b733"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiRowIcon}>
              <MessageSquareText size={16} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Anlat, Bulalım</Text>
              <Text style={styles.aiRowSubtitle}>Ne tür bir şey istediğini kendi cümlelerinle anlat</Text>
            </View>
            <ChevronDown size={16} color={c.dim} style={{ transform: [{ rotate: "-90deg" }] }} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.aiRow} onPress={() => setTasteModalOpen(true)}>
            <LinearGradient colors={["#7367f0", "#48dbfb"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiRowIcon}>
              <Wand2 size={16} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Zevkime Göre Öner</Text>
              <Text style={styles.aiRowSubtitle}>Beğendiklerine bakıp sana özel bir şey bulur</Text>
            </View>
            <ChevronDown size={16} color={c.dim} style={{ transform: [{ rotate: "-90deg" }] }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.aiRow, { borderBottomWidth: 0 }]} onPress={() => setPhotoModalOpen(true)}>
            <LinearGradient colors={["#f7b733", "#fa709a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiRowIcon}>
              <ImageIcon size={16} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Fotoğraftan Bul</Text>
              <Text style={styles.aiRowSubtitle}>Bir sahne yükle, hangi film/diziden olduğunu bulalım</Text>
            </View>
            <ChevronDown size={16} color={c.dim} style={{ transform: [{ rotate: "-90deg" }] }} />
          </TouchableOpacity>
        </View>
      )}

      {describeModalOpen && (
        <DescribeModal
          onClose={() => setDescribeModalOpen(false)}
          onResults={onResults}
          onClear={onClear}
          hasResults={hasResults}
          navigation={navigation}
        />
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
  });
}
