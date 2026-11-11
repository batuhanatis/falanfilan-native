import { t as translateUI } from "../../i18n/core";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FONTS } from "../../theme/fonts";

// "Anlat, Bulalım" — Makinist. Kullanıcı isteğini bir istek fişine yazar, ruh hâli ve kiminle
// izleyeceği fişin altına damga olarak basılır; fiş makinist dairesine girer, ışık perdeye vurur,
// sonuçlar perdede gösterilir. Fiş, damga ve makinist dairesi fiziksel nesneler: iki temada da
// kendi renklerinde kalırlar (bkz. Pellix Salon: paper, velvet, brass, board).
export const OBJ = {
  paper: "#efe4cc",
  paperInk: "#2a2118",
  paperDim: "rgba(42,33,24,0.62)",
  paperLine: "rgba(42,33,24,0.32)",
  velvet: "#7a2428",
  brass: "#d4a94a",
  onAccent: "#1a140b",
  board: "#0d0b0a",
  boardBorder: "#3a332b",
  boardDim: "#a39684",
  flapTop: "#2e2924",
  flapBottom: "#26221d",
  seam: "#070606",
  window: "#1e1d1b",
  windowLine: "#34312c",
  band: "#0c0b0a",
  hole: "#2f2a24",
  glow: "#ffe3a3",
};

// Damgalar fişe metin olarak eklenmez; fişin altına basılır. API'ye giden istek, kullanıcının
// cümlesi + damgaların cümleleri (bkz. composeQuery).
export const MOODS = [
  { key: "moral", label: "MORAL VER", phrase: "içimi ısıtacak, moral veren bir şey" },
  { key: "dagit", label: "KAFA DAĞIT", phrase: "kafamı dağıtacak, hafif bir şey" },
  { key: "heyecan", label: "HEYECAN", phrase: "koltuğun ucunda izleyeceğim bir gerilim" },
  { key: "guldur", label: "GÜLDÜR", phrase: "kesin güldüren bir komedi" },
  { key: "aglat", label: "AĞLAT", phrase: "ağlatan, duygusal bir dram" },
];

export const WITHS = [
  { key: "tek", label: "TEK BAŞIMA", phrase: "tek başıma izleyeceğim" },
  { key: "sevgili", label: "SEVGİLİYLE", phrase: "sevgilimle izleyeceğim" },
  { key: "aile", label: "AİLECEK", phrase: "ailecek izleyeceğim" },
  { key: "arkadas", label: "ARKADAŞLARLA", phrase: "arkadaşlarla izleyeceğim" },
];

export const TRY_INSTEAD = [
  "Kafa dağıtacak, hafif bir komedi",
  "Sonu şaşırtan bir gerilim",
  "Kısa bölümlü, sıcak bir dizi",
];

export function stampLabels(mood, withKey) {
  const out = [];
  const w = WITHS.find((x) => x.key === withKey);
  if (w) out.push(w.label);
  const m = MOODS.find((x) => x.key === mood);
  if (m) out.push(m.label);
  return out;
}

export function composeQuery(text, mood, withKey) {
  const parts = [String(text || "").trim()];
  const w = WITHS.find((x) => x.key === withKey);
  if (w) parts.push(translateUI(w.phrase));
  const m = MOODS.find((x) => x.key === mood);
  if (m) parts.push(translateUI(m.phrase));
  return parts.filter(Boolean).join("; ");
}

// API'nin "usage" alanını ya da /api/premium/status yanıtını tek biçime çevirir.
export function normalizeAllowance(u, bonus) {
  if (!u) return null;
  if (u.unlimited) return { unlimited: true };
  return { unlimited: false, remaining: Number(u.remaining || 0), bonus: Number(u.bonus ?? bonus ?? 0) };
}

export function ticketsLeft(allowance) {
  if (!allowance || allowance.unlimited) return null;
  return Math.max(0, allowance.remaining) + Math.max(0, allowance.bonus || 0);
}

// Fişin üst kenarındaki zımba delikleri: sayfa renginde küçük daireler.
export function Perforation({ color }) {
  return (
    <View style={kit.perf} pointerEvents="none">
      {Array.from({ length: 30 }, (_, i) => <View key={i} style={[kit.perfHole, { backgroundColor: color }]} />)}
    </View>
  );
}

// Fişe basılmış lastik damga (kadife mürekkebi).
export function StampMark({ label, rotate = "-5deg", size = 17, style }) {
  return (
    <View style={[kit.mark, { transform: [{ rotate }] }, style]}>
      <Text style={[kit.markText, { fontSize: size }]}>{translateUI(label)}</Text>
    </View>
  );
}

// Günlük AI hakkı: bilet koçanları. Dolu koçan = kullanılabilir fiş, kesik çizgili = kullanıldı.
export function TicketStubs({ allowance, c }) {
  if (!allowance) return <View style={kit.stubRow} />;
  if (allowance.unlimited) {
    return (
      <View style={kit.stubRow}>
        <View style={kit.stubs}>{[0, 1].map((i) => <View key={i} style={kit.stubOn} />)}</View>
        <Text style={kit.stubText}>{translateUI("SINIRSIZ FİŞ")}</Text>
        <Text style={[kit.stubNote, { color: c.dim }]}>Premium</Text>
      </View>
    );
  }
  const left = ticketsLeft(allowance);
  const slots = Math.min(5, Math.max(2, left));
  return (
    <View style={kit.stubRow} accessible accessibilityLabel={translateUI("Bugün {0} fiş hakkın var", { 0: left })}>
      <View style={kit.stubs}>
        {Array.from({ length: slots }, (_, i) => <View key={i} style={i < left ? kit.stubOn : kit.stubOff} />)}
      </View>
      <Text style={[kit.stubText, left === 0 && { color: c.dim }]}>
        {left > 0 ? translateUI("BUGÜN {0} FİŞ HAKKIN VAR", { 0: left }) : translateUI("BUGÜNKÜ FİŞLER KULLANILDI")}
      </Text>
      {left > 0 && <Text style={[kit.stubNote, { color: c.dim }]}>{translateUI("· Premium’da sınırsız")}</Text>}
    </View>
  );
}

const kit = StyleSheet.create({
  perf: { height: 8, flexDirection: "row", justifyContent: "space-between", overflow: "hidden", marginBottom: -4, zIndex: 2, paddingHorizontal: 3 },
  perfHole: { width: 8, height: 8, borderRadius: 4 },
  mark: { borderWidth: 2.5, borderColor: OBJ.velvet, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 1, opacity: 0.9 },
  markText: { fontFamily: FONTS.marquee, color: OBJ.velvet, letterSpacing: 1 },
  stubRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 20, flexWrap: "wrap" },
  stubs: { flexDirection: "row", gap: 5 },
  stubOn: { width: 24, height: 15, borderRadius: 3, backgroundColor: OBJ.brass },
  stubOff: { width: 24, height: 15, borderRadius: 3, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#5a5466" },
  stubText: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 0.6, color: OBJ.brass },
  stubNote: { fontSize: 11.5 },
});
