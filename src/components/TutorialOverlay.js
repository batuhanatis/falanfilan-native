import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Compass, Users, MessageCircle, User, ChevronRight, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const TAB_COUNT = 5;
// ÖNEMLİ: MainTabs.js standart React Navigation alt sekme çubuğunu kullanıyor (özel/elle
// konumlandırılmış bir bileşen değil) — bu yüzden her sekmenin ekran konumunu ref ile ÖLÇMEK
// yerine, 5 sekmenin eşit genişlikte, ekranın en altında olduğunu bildiğimiz için HESAPLIYORUZ.
// Bu, React Navigation'ın kendi iç render yapısına bağımlı, kırılgan bir ref zincirinden çok
// daha güvenilir.
const TAB_BAR_HEIGHT_BASE = Platform.OS === "ios" ? 49 : 56;

const STEPS = [
  { icon: Home, title: "Ana Sayfa", desc: "Senin için seçilmiş öneriler ve arkadaşlarının neler izlediğini burada görürsün." },
  { icon: Compass, title: "Discover", desc: "Film ve dizileri kaydırarak keşfet — sağa kaydır beğen, sola kaydır geç." },
  { icon: Users, title: "TasteMate", desc: "Zevkine yakın kullanıcıları kaydırarak keşfet, yeni arkadaşlıklar kur." },
  { icon: MessageCircle, title: "Sohbet", desc: "Arkadaşlarınla sohbet et, film önerileri paylaş, MatchParty başlatıp birlikte karar verin." },
  { icon: User, title: "Profil", desc: "Profilini düzenle, Blend ile arkadaşlarınla zevk uyumunu gör, Premium'a geç." },
];

export default function TutorialOverlay({ onFinish }) {
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const styles = makeStyles(c);

  const tabBarHeight = TAB_BAR_HEIGHT_BASE + insets.bottom;
  const tabWidth = SCREEN_W / TAB_COUNT;
  const current = STEPS[step];
  const Icon = current.icon;

  // Vurgulanacak (karartılmayacak) dairesel alanın merkezi ve yarıçapı.
  const holeCx = (step + 0.5) * tabWidth;
  const holeCy = SCREEN_H - tabBarHeight / 2;
  const holeR = 30;
  const holeLeft = holeCx - holeR;
  const holeTop = holeCy - holeR;
  const holeSize = holeR * 2;

  // Tooltip'in, delikle EKRANIN dışına taşmadan üstte mi altta mı duracağına karar veriyoruz —
  // tab bar en altta olduğu için pratikte hep "üstte" çıkacak ama ileride farklı bir hedef
  // eklenirse (ör. bir ekran içi buton) genel kalsın diye kontrol ediyoruz.
  const tooltipBelow = holeTop < SCREEN_H / 2;

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else onFinish();
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* ÖNEMLİ: Gerçek bir "delik" efekti için tek bir yarı saydam katman yerine, deliğin dört
          kenarını çevreleyen ayrı dört karartma kutusu kullanıyoruz — bu sayede vurgulanan alan
          TAMAMEN parlak/tıklanabilir kalıyor, ekstra bir maskeleme kütüphanesi gerekmiyor. */}
      <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, holeTop) }]} />
      <View style={[styles.dim, { top: holeTop + holeSize, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.dim, { top: holeTop, left: 0, width: Math.max(0, holeLeft), height: holeSize }]} />
      <View style={[styles.dim, { top: holeTop, left: holeLeft + holeSize, right: 0, height: holeSize }]} />

      {/* ÖNEMLİ: "Atla" yazısı tooltip'in içinde, küçük bir metin linkiydi — turu hiç istemeyen
          birinin gözünden kaçabilirdi. Bu, her adımda AYNI sabit yerde duran, göze çarpan bir
          "✕" butonu — tooltip'i aramadan anında ve net bir şekilde çıkış sağlıyor. */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={onFinish}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={16} color="#fff" />
      </TouchableOpacity>

      {/* Vurgulanan alanın çevresine ince, parlak bir halka — "işte burası" hissi versin diye. */}
      <View style={[styles.ring, { left: holeLeft - 4, top: holeTop - 4, width: holeSize + 8, height: holeSize + 8, borderColor: c.accent }]} pointerEvents="none" />

      {/* Tooltip kartı — dairenin hemen üstünde (tab bar en altta olduğu için pratikte hep bu). */}
      <View
        style={[
          styles.tooltip,
          {
            left: Math.max(16, Math.min(SCREEN_W - 260 - 16, holeCx - 130)),
            ...(tooltipBelow ? { top: holeTop + holeSize + 16 } : { bottom: SCREEN_H - holeTop + 16 }),
          },
        ]}
      >
        <View style={styles.tooltipIconRow}>
          <View style={styles.tooltipIconWrap}><Icon size={16} color={c.bg} /></View>
          <Text style={styles.tooltipTitle}>{current.title}</Text>
        </View>
        <Text style={styles.tooltipDesc}>{current.desc}</Text>
        <View style={styles.tooltipFooter}>
          <TouchableOpacity onPress={onFinish} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.skipText}>Atla</Text>
          </TouchableOpacity>
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && { backgroundColor: c.accent, width: 16 }]} />
            ))}
          </View>
          <TouchableOpacity style={styles.nextBtn} onPress={next}>
            <Text style={styles.nextBtnText}>{step === STEPS.length - 1 ? "Başla" : "İleri"}</Text>
            <ChevronRight size={14} color={c.bg} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    dim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.78)" },
    closeBtn: {
      position: "absolute", right: 16, width: 32, height: 32, borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
    },
    ring: { position: "absolute", borderRadius: 999, borderWidth: 2.5, opacity: 0.9 },
    tooltip: {
      position: "absolute", width: 260, backgroundColor: c.surface, borderRadius: 16,
      padding: 16, borderWidth: 1, borderColor: c.border,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
    },
    tooltipIconRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    tooltipIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    tooltipTitle: { fontSize: 14, fontWeight: "800", color: c.text },
    tooltipDesc: { fontSize: 12, color: c.dim, lineHeight: 17, marginBottom: 14 },
    tooltipFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    skipText: { fontSize: 12, color: c.dim, fontWeight: "600" },
    dotsRow: { flexDirection: "row", gap: 4 },
    dot: { width: 5, height: 5, borderRadius: 999, backgroundColor: c.border },
    nextBtn: {
      flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.accent,
      borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    },
    nextBtnText: { fontSize: 12, fontWeight: "800", color: c.bg },
  });
}
