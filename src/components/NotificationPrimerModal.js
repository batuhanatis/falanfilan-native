import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Bell, MessageCircle, Sparkles, Clock } from "lucide-react-native";
import { hapticSuccess } from "../utils/haptics";

// Sistemin gerçek izin diyaloğunu göstermeden ÖNCE, KENDİ ekranımızda "neden" soruyoruz —
// iOS'ta bir kullanıcı sistem diyaloğunda bir kez "İzin Verme" derse, kod içinden bir daha asla
// tekrar sorulamıyor (kullanıcı Ayarlar'a gidip kendisi açmalı). Bağlamsız/erken bir soru bu tek
// şansı büyük ihtimalle "Hayır"a harcıyor. Burada "Şimdi Değil" denirse sistem diyaloğu hiç
// açılmıyor, hakkımız yanmıyor — Gate() daha sonra tekrar deneyebilir.
export default function NotificationPrimerModal({ onEnable, onDismiss }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    hapticSuccess();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 8 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.backdrop, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <LinearGradient colors={["#6366F1", "#8B5CF6", "#DB2777"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconRing}>
          <Bell size={30} color="#fff" />
        </LinearGradient>
        <Text style={styles.title}>Hiçbir şeyi kaçırma</Text>
        <Text style={styles.subtitle}>
          Bildirimleri açarsan, önemli anları anında haber veririz:
        </Text>

        <View style={styles.reasonList}>
          <View style={styles.reasonRow}>
            <View style={styles.reasonIconWrap}><MessageCircle size={15} color="#8B5CF6" /></View>
            <Text style={styles.reasonText}>Bir arkadaşın sana mesaj attığında</Text>
          </View>
          <View style={styles.reasonRow}>
            <View style={styles.reasonIconWrap}><Sparkles size={15} color="#DB2777" /></View>
            <Text style={styles.reasonText}>Zevkiniz eşleştiğinde ya da MatchParty'de kazandığında</Text>
          </View>
          <View style={styles.reasonRow}>
            <View style={styles.reasonIconWrap}><Clock size={15} color="#6366F1" /></View>
            <Text style={styles.reasonText}>Beklediğin film/dizi çıktığında</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.enableBtn} onPress={onEnable} activeOpacity={0.85}>
          <LinearGradient colors={["#6366F1", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.enableBtnGradient}>
            <Text style={styles.enableBtnText}>Bildirimleri Aç</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={styles.dismissText}>Şimdi Değil</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
    backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 30,
  },
  card: {
    width: "100%", maxWidth: 320, backgroundColor: "#1A1625", borderRadius: 26, padding: 26,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#8B5CF6", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 14,
  },
  iconRing: {
    width: 76, height: 76, borderRadius: 999, alignItems: "center", justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 19, fontWeight: "800", textAlign: "center", marginTop: 16 },
  subtitle: { color: "rgba(255,255,255,0.65)", fontSize: 12.5, marginTop: 6, textAlign: "center", lineHeight: 18 },
  reasonList: { alignSelf: "stretch", marginTop: 18, gap: 12 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reasonIconWrap: {
    width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  reasonText: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 12.5, lineHeight: 17 },
  enableBtn: { marginTop: 22, borderRadius: 14, overflow: "hidden", alignSelf: "stretch" },
  enableBtnGradient: { paddingVertical: 14, alignItems: "center" },
  enableBtnText: { color: "#fff", fontWeight: "800", fontSize: 14.5 },
  dismissBtn: { marginTop: 12, paddingVertical: 4 },
  dismissText: { color: "rgba(255,255,255,0.5)", fontSize: 12.5, fontWeight: "600" },
});
