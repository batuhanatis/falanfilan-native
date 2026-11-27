import { t as translateUI, getLanguage } from "../i18n/core";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, X } from "lucide-react-native";
import { FONTS, upperTR } from "../theme/fonts";

// Günün Düellosu skor kartı (9:16, Story). Düello kartıyla aynı aile: koyu zemin, üstte altın spot,
// Big Shoulders puan, DM Mono künye. Ortada 8 kutuluk şerit: doğru bilinen sorular altın, son kutu
// altın soru. Soru ve yapım adı yok, kart kimsenin oyununu bozmasın. Paylaşılan görsel olduğu için
// renkler temadan bağımsız ve yazılar sistem yazı boyutuyla büyümüyor (kart sabit ölçüde yakalanıyor).
// 360x640 çiziliyor, 3x yakalanınca 1080x1920. Instagram story'de üstte profil çubuğu, altta yanıt alanı
// duruyor; yazılar üstten ve alttan yaklaşık 85 nokta içeride.
export const DAILY_CARD_WIDTH = 360;
export const DAILY_CARD_HEIGHT = 640;

const CREAM = "#f3ead8";
const DIM = "#8c8579";
const GOLD = "#c9a44c";
const INK = "#1a140b";

function seconds(ms) {
  const s = (ms / 1000).toFixed(1);
  return getLanguage() === "en" ? `${s}s` : `${s.replace(".", ",")} sn`;
}

// Sıralama kutusu: az kişi oynadıysa ya da ilk üçteyse sıra ("2. / BUGÜN 14 KİŞİ ARASINDA"; 2 kişide
// "İLK %1" yanıltıcı). Kalabalıkta üst yarıdaysa yüzdelik dilim ("İLK %12 / BUGÜN OYNAYANLAR").
export function dailyStanding(percentile, standing) {
  if (percentile == null) return null;
  const top = Math.max(1, 100 - percentile);
  if (standing && (standing.players < 20 || standing.rank <= 3)) return { kind: "rank", rank: standing.rank, players: standing.players };
  if (top <= 50) return { kind: "top", top };
  if (standing) return { kind: "rank", rank: standing.rank, players: standing.players };
  return null;
}
function standingStat(percentile, standing) {
  const s = dailyStanding(percentile, standing);
  if (!s) return null;
  if (s.kind === "top") return { value: translateUI("İLK %{0}", { 0: s.top }), label: translateUI("BUGÜN OYNAYANLAR") };
  return { value: translateUI("{0}.", { 0: s.rank }), label: translateUI("BUGÜN {0} KİŞİ ARASINDA", { 0: s.players }) };
}

export default function DailyDuelShareCard({ dayLabel, score = 0, correct = 0, total = 8, marks = [], percentile = null, standing = null, friendRank = null, friendCount = 0 }) {
  const fastest = marks.filter((m) => m.correct && Number.isFinite(m.ms)).reduce((min, m) => (min == null || m.ms < min ? m.ms : min), null);
  const golden = marks.find((m) => m.golden && m.correct && m.points > 0);
  const stats = [
    fastest != null && { value: seconds(fastest), label: translateUI("EN HIZLI CEVAP") },
    standingStat(percentile, standing),
    // Bugün oynayanların hepsi arkadaşsa iki kutu aynı şeyi söylüyor; o zaman yalnızca genel sıra.
    friendRank && friendCount > 1 && !(standing && standing.players === friendCount) && { value: translateUI("{0}.", { 0: friendRank }), label: translateUI("ARKADAŞLAR ARASINDA") },
    golden && { value: `+${golden.points}`, label: translateUI("ALTIN SORU") },
  ].filter(Boolean).slice(0, 3);
  const tiles = marks.length ? marks : [];

  return (
    <View style={styles.card}>
      <LinearGradient colors={["rgba(201,164,76,0.28)", "rgba(201,164,76,0)"]} style={styles.spot} />
      <Text allowFontScaling={false} style={styles.kicker}>{translateUI("PELLIX · GÜNÜN DÜELLOSU")}</Text>
      {!!dayLabel && <Text allowFontScaling={false} style={styles.day}>{upperTR(dayLabel)}{translateUI(" · HERKESE AYNI 8 SORU")}</Text>}

      <Text allowFontScaling={false} style={styles.score}>{score}</Text>
      <Text allowFontScaling={false} style={styles.scoreLabel}>{translateUI("PUAN")}</Text>

      {tiles.length > 0 && (
        <View style={styles.strip}>
          {tiles.map((m, i) => (
            <View key={i} style={styles.tileWrap}>
              <Text allowFontScaling={false} style={[styles.tileTop, !m.golden && { opacity: 0 }]}>{translateUI("2X")}</Text>
              <View style={[styles.tile, m.correct ? styles.tileRight : styles.tileWrong, m.golden && styles.tileGolden]}>
                {m.correct ? <Check size={16} color={INK} strokeWidth={3} /> : <X size={14} color={DIM} strokeWidth={2.5} />}
              </View>
            </View>
          ))}
        </View>
      )}
      <Text allowFontScaling={false} style={styles.correct}>{translateUI("{0} SORUDAN {1} DOĞRU", { 0: total, 1: correct })}</Text>

      {stats.length > 0 && (
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text allowFontScaling={false} style={styles.statValue} numberOfLines={1}>{s.value}</Text>
              <Text allowFontScaling={false} style={styles.statLabel} numberOfLines={2}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.foot}>
        <Text allowFontScaling={false} style={styles.footBig}>{translateUI("Sen kaç yaparsın?")}</Text>
        <Text allowFontScaling={false} style={styles.footSmall}>{translateUI("pellix · Pellix Play")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: DAILY_CARD_WIDTH, height: DAILY_CARD_HEIGHT, backgroundColor: "#100e10", paddingHorizontal: 26, paddingTop: 84, overflow: "hidden", alignItems: "center" },
  spot: { position: "absolute", left: 0, right: 0, top: 0, height: 340 },
  kicker: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 2.2, textAlign: "center" },
  day: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.4, textAlign: "center", marginTop: 8 },
  score: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 100, lineHeight: 104, textAlign: "center", marginTop: 20 },
  scoreLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2.4, marginTop: -4 },
  strip: { flexDirection: "row", gap: 6, marginTop: 24 },
  tileWrap: { alignItems: "center" },
  tileTop: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 8, letterSpacing: 0.6, marginBottom: 4 },
  tile: { width: 30, height: 38, borderRadius: 7, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  tileRight: { backgroundColor: GOLD, borderColor: GOLD },
  tileWrong: { backgroundColor: "rgba(243,234,216,0.05)", borderColor: "rgba(243,234,216,0.16)" },
  tileGolden: { borderColor: "#ffe3a3", shadowColor: GOLD, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  correct: { color: CREAM, fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1.6, marginTop: 14 },
  stats: { flexDirection: "row", gap: 8, marginTop: 24, alignSelf: "stretch", justifyContent: "center" },
  stat: { flex: 1, maxWidth: 104, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center", backgroundColor: "rgba(243,234,216,0.05)", borderWidth: 1, borderColor: "rgba(243,234,216,0.10)" },
  statValue: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 24, lineHeight: 28 },
  statLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 7.5, letterSpacing: 0.9, marginTop: 3, textAlign: "center" },
  foot: { position: "absolute", left: 0, right: 0, bottom: 86, alignItems: "center" },
  footBig: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 30 },
  footSmall: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.6, marginTop: 4 },
});
