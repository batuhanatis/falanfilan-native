import { t as translateUI } from "../i18n/core";
import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { GoldWash, SALON } from "./salon/SalonKit";
import { FONTS } from "../theme/fonts";
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
        <GoldWash height={150} strength={0.18} />
        <View style={styles.iconRing}>
          <Bell size={28} color={SALON.gold} />
        </View>
        <Text style={styles.eyebrow}>{translateUI("PERDE ARALANIRKEN")}</Text>
        <Text style={styles.title}>{translateUI("Hiçbir şeyi kaçırma")}</Text>
        <Text style={styles.subtitle}>{translateUI(" Bildirimleri açarsan, önemli anları anında haber veririz: ")}</Text>

        <View style={styles.reasonList}>
          <View style={styles.reasonRow}>
            <View style={styles.reasonIconWrap}><MessageCircle size={15} color={SALON.gold} /></View>
            <Text style={styles.reasonText}>{translateUI("Bir arkadaşın sana mesaj attığında")}</Text>
          </View>
          <View style={styles.reasonRow}>
            <View style={styles.reasonIconWrap}><Sparkles size={15} color={SALON.gold} /></View>
            <Text style={styles.reasonText}>{translateUI("Biriyle uyumun yüksek çıktığında ya da MatchParty'de kazandığında")}</Text>
          </View>
          <View style={styles.reasonRow}>
            <View style={styles.reasonIconWrap}><Clock size={15} color={SALON.gold} /></View>
            <Text style={styles.reasonText}>{translateUI("Beklediğin film/dizi çıktığında")}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.enableBtn} onPress={onEnable} activeOpacity={0.85}>
          <View style={styles.enableBtnGradient}>
            <Text style={styles.enableBtnText}>{translateUI("Bildirimleri Aç")}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={styles.dismissText}>{translateUI("Şimdi Değil")}</Text>
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
    width: "100%", maxWidth: 320, backgroundColor: "#1c1a24", borderRadius: 22, padding: 26,
    alignItems: "center", borderWidth: 1, borderColor: SALON.goldLine, overflow: "hidden",
  },
  iconRing: {
    width: 72, height: 72, borderRadius: 999, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: SALON.gold, backgroundColor: SALON.ink,
  },
  eyebrow: { color: SALON.gold, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.4, marginTop: 16 },
  title: { color: SALON.cream, fontFamily: FONTS.marquee, fontSize: 30, lineHeight: 32, textAlign: "center", marginTop: 4 },
  subtitle: { color: SALON.dim, fontSize: 12.5, marginTop: 6, textAlign: "center", lineHeight: 18 },
  reasonList: { alignSelf: "stretch", marginTop: 18, gap: 12 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reasonIconWrap: {
    width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: SALON.goldTint, borderWidth: 1, borderColor: SALON.goldLine,
  },
  reasonText: { flex: 1, color: SALON.cream, fontSize: 12.5, lineHeight: 17 },
  enableBtn: { marginTop: 22, borderRadius: 14, overflow: "hidden", alignSelf: "stretch" },
  enableBtnGradient: { paddingVertical: 14, alignItems: "center", backgroundColor: SALON.gold },
  enableBtnText: { color: SALON.onGold, fontWeight: "800", fontSize: 14.5 },
  dismissBtn: { marginTop: 12, paddingVertical: 4 },
  dismissText: { color: SALON.dim, fontSize: 12.5, fontWeight: "600" },
});
