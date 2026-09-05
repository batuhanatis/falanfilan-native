import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, LayoutAnimation, Platform, UIManager } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, ChevronDown, MessageSquareText, Wand2, Image as ImageIcon } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import DescribeModal from "./DescribeModal";
import TasteRecommendModal from "./TasteRecommendModal";
import PhotoIdentifyModal from "./PhotoIdentifyModal";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AI_GRADIENT = ["#6D28D9", "#4F46E5", "#2563EB"];

export default function AIZone({ navigation, hasResults, onResults, onClear, defaultOpen = false }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);

  const [aiOpen, setAiOpen] = useState(defaultOpen);
  const [describeModalOpen, setDescribeModalOpen] = useState(false);
  const [tasteModalOpen, setTasteModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  const sparkleOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleOpacity, { toValue: 0.45, duration: 1000, useNativeDriver: true }),
        Animated.timing(sparkleOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
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
          colors={AI_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiZone}
        >
          <View style={styles.aiGlowOne} />
          <View style={styles.aiGlowTwo} />
          <View style={styles.aiZoneHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <View style={styles.headerIconWrap}>
                <Animated.View style={{ opacity: sparkleOpacity }}>
                  <Sparkles size={17} color="#fff" />
                </Animated.View>
              </View>
              <View>
                <Text style={styles.aiEyebrow}>PELLIX AI</Text>
                <Text style={styles.aiZoneTitle}>Yapay Zeka Köşesi</Text>
              </View>
            </View>
            <View style={styles.chevronWrap}>
              <ChevronDown size={17} color="#fff" style={{ transform: [{ rotate: aiOpen ? "180deg" : "0deg" }] }} />
            </View>
          </View>
          <Text style={styles.aiZoneSubtitle}>Ne izleyeceğini birkaç saniyede daralt</Text>
        </LinearGradient>
      </TouchableOpacity>

      {aiOpen && (
        <View style={styles.aiPanel}>
          <TouchableOpacity style={styles.aiRow} onPress={() => setDescribeModalOpen(true)} activeOpacity={0.78}>
            <View style={[styles.aiRowIcon, { backgroundColor: "rgba(109,40,217,0.15)" }]}>
              <MessageSquareText size={16} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Anlat, Bulalım</Text>
              <Text style={styles.aiRowSubtitle}>Modunu ve ne istediğini kendi cümlelerinle anlat</Text>
            </View>
            <ChevronDown size={16} color={c.dim} style={{ transform: [{ rotate: "-90deg" }] }} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.aiRow} onPress={() => setTasteModalOpen(true)} activeOpacity={0.78}>
            <View style={[styles.aiRowIcon, { backgroundColor: "rgba(79,70,229,0.15)" }]}>
              <Wand2 size={16} color="#6366F1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Zevkime Göre Öner</Text>
              <Text style={styles.aiRowSubtitle}>Beğenilerini okuyup sana özel bir seçim yapar</Text>
            </View>
            <ChevronDown size={16} color={c.dim} style={{ transform: [{ rotate: "-90deg" }] }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.aiRow, { borderBottomWidth: 0 }]} onPress={() => setPhotoModalOpen(true)} activeOpacity={0.78}>
            <View style={[styles.aiRowIcon, { backgroundColor: "rgba(37,99,235,0.15)" }]}>
              <ImageIcon size={16} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Fotoğraftan Bul</Text>
              <Text style={styles.aiRowSubtitle}>Bir sahne yükle, hangi film veya diziden olduğunu bul</Text>
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
    aiZone: { marginTop: 14, borderRadius: 18, padding: 15, overflow: "hidden" },
    aiGlowOne: { position: "absolute", width: 140, height: 140, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)", top: -92, right: 26 },
    aiGlowTwo: { position: "absolute", width: 90, height: 90, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", bottom: -52, left: 46 },
    aiZoneHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
    aiEyebrow: { color: "rgba(255,255,255,0.66)", fontWeight: "900", fontSize: 8.5, letterSpacing: 0.8 },
    aiZoneTitle: { color: "#fff", fontWeight: "900", fontSize: 14.5, marginTop: 1 },
    aiZoneSubtitle: { color: "rgba(255,255,255,0.80)", fontSize: 10.8, marginTop: 8, marginLeft: 43 },
    chevronWrap: { width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },

    aiPanel: { marginTop: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 15, paddingHorizontal: 13 },
    aiRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.border },
    aiRowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    aiRowTitle: { fontSize: 12.8, fontWeight: "800", color: c.text },
    aiRowSubtitle: { fontSize: 10.5, color: c.dim, marginTop: 2, lineHeight: 14 },
  });
}
