import { t as translateUI, getLocale } from "../../i18n/core";
import React, { memo, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, AccessibilityInfo } from "react-native";
import { Share2 } from "lucide-react-native";
import RetryImage from "../RetryImage";
import { SALON } from "../salon/SalonKit";
import { FONTS } from "../../theme/fonts";
import { avatarOr } from "../../utils/avatar";
import { dayLabel } from "../../utils/chatTimeLabels";

// Düello geçmişinin dili sinema salonundan:
//  - Koçan: bitmiş her düello, yırtılıp saklanmış bir bilet koçanı. Sol şeritte sonuç damgası,
//    delik çizgisinin sağında rakip, skor ve oynanan yapımlar.
//  - Tabela: iki oyuncu arasındaki genel durum, gar/seans panosu gibi kepenkleri dönerek gelen
//    bir skor tabelası. Rakamlar birkaç rakamdan geçip yerine oturuyor; hareketi azalt açıksa
//    doğrudan yazılıyor. Pano fiziksel bir nesne olduğu için açık temada da koyu kalıyor.

const BOARD = { bg: "#0d0b0a", border: "#3a332b", top: "#2e2924", bottom: "#26221d", seam: "#070606", ink: "#f2ede2", gold: "#d4a94a", dim: "#a39684" };

export const OUTCOME_LABEL = { win: "KAZANDIN", loss: "KAYBETTİN", draw: "BERABERE" };

export const fmt = (n) => Number(n || 0).toLocaleString(getLocale());

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((r) => { if (alive) setReduce(!!r); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return reduce;
}

// Bitişin nasıl olduğu: rakip çıktıysa ya da altın soruyla bittiyse kısa bir not.
export function reasonNote(duel) {
  if (duel.reason === "sudden_death") return translateUI("Ani ölüm sorusuyla bitti");
  if (["left", "disconnect", "backed_out"].includes(duel.reason)) {
    return duel.outcome === "win" ? translateUI("Rakibin oyundan çıktı") : translateUI("Oyundan çıktın");
  }
  return null;
}

// "Aranızda 3 – 2" satırı (lobideki arkadaş listesi için).
export function rivalLine(record) {
  if (!record || !record.played) return translateUI("Henüz düello yok");
  return translateUI("Aranızda {0} – {1}", { 0: record.wins, 1: record.losses });
}

// Seri cümlesi: en yeni düellodan geriye aynı sonuç.
export function streakLine(record, oppName) {
  if (!record || !record.played) return null;
  const s = record.streak;
  if (!s) return translateUI("Son düello berabere bitti");
  if (s.outcome === "win") {
    return s.count > 1 ? translateUI("{0} düellodur kazanıyorsun", { 0: s.count }) : translateUI("Son düelloyu sen kazandın");
  }
  return s.count > 1
    ? translateUI("{0} düellodur kaybediyorsun, rövanş zamanı", { 0: s.count })
    : translateUI("Son düelloyu {0} kazandı", { 0: oppName || translateUI("rakibin") });
}

// ---------- Tabela ----------

const DIGITS = "0123456789";

const FlapDigit = memo(function FlapDigit({ digit, delay, steps, size, reduce }) {
  const [shown, setShown] = useState(reduce ? digit : "0");
  const flip = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { setShown(digit); flip.setValue(1); return undefined; }
    const timers = [];
    let k = 0;
    const tick = () => {
      k += 1;
      setShown(k >= steps ? digit : DIGITS[Math.floor(Math.random() * 10)]);
      flip.setValue(0.1);
      Animated.timing(flip, { toValue: 1, duration: 80, useNativeDriver: true }).start();
      if (k < steps) timers.push(setTimeout(tick, 60));
    };
    timers.push(setTimeout(tick, delay));
    return () => { timers.forEach(clearTimeout); flip.stopAnimation(); };
  }, [digit, reduce]);
  return (
    <View style={[boardStyles.cell, { width: size.w, height: size.h }]}>
      <View style={[boardStyles.half, { height: size.h / 2, backgroundColor: BOARD.top }]} />
      <View style={[boardStyles.half, { top: size.h / 2, height: size.h / 2, backgroundColor: BOARD.bottom }]} />
      <Animated.Text allowFontScaling={false} style={[boardStyles.digit, { fontSize: size.font, lineHeight: size.h, color: size.color, transform: [{ scaleY: flip }] }]}>
        {shown}
      </Animated.Text>
      <View style={[boardStyles.seam, { top: size.h / 2 - 0.5 }]} />
    </View>
  );
});

function FlapNumber({ value, size, delay = 0, reduce }) {
  const text = String(Math.max(0, Math.min(999, Number(value) || 0)));
  return (
    <View style={{ flexDirection: "row", gap: 3 }} accessible accessibilityLabel={text}>
      {text.split("").map((d, i) => (
        <FlapDigit key={`${text.length}-${i}`} digit={d} delay={delay + i * 90} steps={5 + i * 2} size={size} reduce={reduce} />
      ))}
    </View>
  );
}

// İki oyuncunun galibiyetleri, ortada beraberlik; altında seri ve toplamlar.
export function Tabela({ me, opp, record }) {
  const reduce = useReduceMotion();
  const r = record || { played: 0, wins: 0, losses: 0, draws: 0, myPoints: 0, oppPoints: 0, bestScore: 0 };
  const ahead = r.wins > r.losses ? "me" : r.losses > r.wins ? "opp" : null;
  const big = (lead) => ({ w: 40, h: 58, font: 44, color: lead ? BOARD.gold : BOARD.ink });
  const streak = streakLine(r, opp?.name);
  return (
    <View style={boardStyles.board} accessibilityLabel={translateUI("Aranızdaki skor: sen {0}, {1} {2}", { 0: r.wins, 1: opp?.name || "", 2: r.losses })}>
      <Text style={boardStyles.boardEyebrow}>{translateUI("ARANIZDAKİ SKOR")}</Text>
      <View style={boardStyles.row}>
        <View style={boardStyles.side}>
          <RetryImage source={{ uri: avatarOr(me?.avatarUrl, me?.id) }} style={boardStyles.avatar} />
          <Text style={boardStyles.name} numberOfLines={1}>{translateUI("SEN")}</Text>
        </View>
        <FlapNumber value={r.wins} size={big(ahead === "me")} reduce={reduce} />
        <View style={boardStyles.mid}>
          <Text style={boardStyles.dash}>–</Text>
        </View>
        <FlapNumber value={r.losses} size={big(ahead === "opp")} delay={120} reduce={reduce} />
        <View style={boardStyles.side}>
          <RetryImage source={{ uri: avatarOr(opp?.avatarUrl, opp?.id) }} style={boardStyles.avatar} />
          <Text style={boardStyles.name} numberOfLines={1}>{String(opp?.name || "").toLocaleUpperCase(getLocale())}</Text>
        </View>
      </View>
      {!!streak && <Text style={[boardStyles.streak, r.streak?.outcome === "loss" && { color: BOARD.dim }]}>{streak}</Text>}
      <View style={boardStyles.stats}>
        <Stat label={translateUI("OYNANAN")} value={fmt(r.played)} />
        <Stat label={translateUI("BERABERE")} value={fmt(r.draws)} />
        <Stat label={translateUI("EN YÜKSEK SKORUN")} value={fmt(r.bestScore)} />
      </View>
      <PointsRope mine={r.myPoints} theirs={r.oppPoints} oppName={opp?.name} reduce={reduce} />
    </View>
  );
}

// Toplam puan halat çekmesi: altın taraf senin payın. Açılışta ortadan kendi yerine kayar.
function PointsRope({ mine, theirs, oppName, reduce }) {
  const total = (mine || 0) + (theirs || 0);
  const share = total ? mine / total : 0; // hiç puan yoksa çubuk boş kalır
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(reduce ? share : 0.5)).current;
  useEffect(() => {
    if (reduce) { x.setValue(share); return; }
    Animated.timing(x, { toValue: share, duration: 700, delay: 350, useNativeDriver: false }).start();
  }, [share, reduce]);
  const width = x.interpolate({ inputRange: [0, 1], outputRange: [0, w] });
  return (
    <View style={boardStyles.rope}>
      <View style={boardStyles.ropeHead}>
        <Text style={boardStyles.ropeLabel}>{translateUI("TOPLAM PUAN")}</Text>
        <Text style={boardStyles.ropeValue} numberOfLines={1}>
          <Text style={{ color: mine >= theirs && total ? BOARD.gold : BOARD.ink }}>{fmt(mine)}</Text>
          <Text style={{ color: BOARD.dim }}>{"  –  "}</Text>
          <Text style={{ color: theirs > mine ? BOARD.gold : BOARD.ink }}>{fmt(theirs)}</Text>
        </Text>
      </View>
      <View style={boardStyles.ropeTrack} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityLabel={translateUI("Toplam puan: sen {0}, {1} {2}", { 0: mine, 1: oppName || "", 2: theirs })}>
        <Animated.View style={[boardStyles.ropeMine, { width }]} />
      </View>
    </View>
  );
}

function Stat({ label, value, wide }) {
  return (
    <View style={[boardStyles.stat, wide && { flexGrow: 1.6 }]}>
      <Text style={boardStyles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={boardStyles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ---------- Koçan ----------

export function Kocan({ duel, c, onPress, onShare, showOpponent = true }) {
  const s = kocanStyles(c);
  const tone = duel.outcome === "win" ? c.accent : duel.outcome === "loss" ? c.danger : c.dim;
  const note = reasonNote(duel);
  const titles = (duel.titles || []).join(" × ");
  const when = duel.finishedAt ? translateUI(dayLabel(duel.finishedAt)) : "";
  return (
    <TouchableOpacity
      style={s.stub}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      accessibilityLabel={translateUI("{0}: {1} ile {2} – {3}", { 0: translateUI(OUTCOME_LABEL[duel.outcome]), 1: duel.opponent?.name || "", 2: duel.myScore, 3: duel.oppScore })}
    >
      <View style={[s.strip, { backgroundColor: `${tone}1f`, borderColor: `${tone}55` }]}>
        <Text style={[s.stripText, { color: tone }]}>{translateUI(OUTCOME_LABEL[duel.outcome])}</Text>
      </View>
      <View style={s.perf}>{Array.from({ length: 7 }, (_, i) => <View key={i} style={s.hole} />)}</View>
      <View style={s.body}>
        <View style={s.topRow}>
          {showOpponent && <RetryImage source={{ uri: avatarOr(duel.opponent?.avatarUrl, duel.opponent?.id) }} style={s.avatar} />}
          <Text style={s.name} numberOfLines={1}>{showOpponent ? duel.opponent?.name : when}</Text>
          <Text style={[s.score, duel.outcome === "win" && { color: c.accent }]}>{`${duel.myScore} – ${duel.oppScore}`}</Text>
        </View>
        {!!titles && <Text style={s.titles} numberOfLines={1}>{titles}</Text>}
        <Text style={s.meta} numberOfLines={1}>
          {[showOpponent ? when : null, duel.rematch ? translateUI("Rövanş") : null, note].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {!!onShare && (
        <TouchableOpacity style={s.share} onPress={onShare} hitSlop={10} accessibilityLabel={translateUI("Sonucu paylaş")}>
          <Share2 size={15} color={c.dim} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const kocanCache = new Map();
function kocanStyles(c) {
  const key = `${c.bg}|${c.surface}|${c.text}`;
  if (kocanCache.has(key)) return kocanCache.get(key);
  const s = StyleSheet.create({
    stub: { flexDirection: "row", alignItems: "stretch", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, marginBottom: 8, overflow: "hidden", minHeight: 74 },
    strip: { width: 30, borderRightWidth: 1, overflow: "hidden" },
    // Dönen yazı şeridin genişliğine sıkışmasın diye mutlak konumda, şeridin ortasında döndürülüyor.
    stripText: { position: "absolute", width: 110, left: -40, top: "50%", marginTop: -7, height: 14, lineHeight: 14, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1.2, textAlign: "center", transform: [{ rotate: "-90deg" }] },
    perf: { width: 10, alignItems: "center", justifyContent: "space-evenly", paddingVertical: 4 },
    hole: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.bg },
    body: { flex: 1, minWidth: 0, paddingVertical: 10, paddingRight: 12, justifyContent: "center", gap: 3 },
    topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.surface2 },
    name: { flex: 1, color: c.text, fontSize: 13, fontWeight: "800" },
    score: { color: c.text, fontFamily: FONTS.marquee, fontSize: 20 },
    titles: { color: c.dim, fontSize: 11.5 },
    meta: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 0.8 },
    share: { width: 40, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: c.border },
  });
  kocanCache.set(key, s);
  return s;
}

const boardStyles = StyleSheet.create({
  board: { borderRadius: 18, padding: 16, paddingTop: 14, backgroundColor: BOARD.bg, borderWidth: 1, borderColor: BOARD.border },
  boardEyebrow: { color: BOARD.gold, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.4, textAlign: "center", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  side: { width: 58, alignItems: "center", gap: 5 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: SALON.goldLine, backgroundColor: BOARD.top },
  name: { color: BOARD.dim, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1, maxWidth: 58 },
  mid: { width: 16, alignItems: "center" },
  dash: { color: BOARD.dim, fontFamily: FONTS.marquee, fontSize: 26 },
  cell: { borderRadius: 4, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  half: { position: "absolute", left: 0, right: 0, top: 0 },
  digit: { fontFamily: FONTS.marqueeBold, textAlign: "center", includeFontPadding: false },
  seam: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: BOARD.seam },
  streak: { color: BOARD.gold, fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 14 },
  stats: { flexDirection: "row", gap: 6, marginTop: 14 },
  stat: { flex: 1, minWidth: 0, backgroundColor: BOARD.top, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 6, alignItems: "center" },
  statValue: { color: BOARD.ink, fontFamily: FONTS.marquee, fontSize: 17 },
  statLabel: { color: BOARD.dim, fontFamily: FONTS.monoMedium, fontSize: 7.5, letterSpacing: 0.8, marginTop: 2 },
  rope: { marginTop: 8, backgroundColor: BOARD.top, borderRadius: 10, padding: 10, paddingTop: 8 },
  ropeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  ropeLabel: { color: BOARD.dim, fontFamily: FONTS.monoMedium, fontSize: 7.5, letterSpacing: 0.8 },
  ropeValue: { fontFamily: FONTS.marquee, fontSize: 17 },
  ropeTrack: { height: 6, borderRadius: 3, backgroundColor: "#4a4038", overflow: "hidden" },
  ropeMine: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: BOARD.gold },
});
