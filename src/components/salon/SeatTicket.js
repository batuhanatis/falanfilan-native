import { t as translateUI, getLanguage } from "../../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Easing, AccessibilityInfo, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import RetryImage from "../RetryImage";
import { avatarOr } from "../../utils/avatar";
import { FONTS, upperTR } from "../../theme/fonts";

// Yan Koltuk: TasteMate'teki her kişi, sinemada yanındaki koltuğun bileti. Üstte fotoğraf, altta
// koçan; arada iki yanı oyuklu bir zımba çizgisi. Zımba delikleri aynı zamanda uyum ölçeri: kart
// öne gelince yüzde 0'dan sayıyor, delikler soldan sağa uyum kadar yanıyor (hesaplanma anı).
// %85 ve üstünde, sayım bitince biletin üstünden bir kez altın bir parlama (yaldız) geçiyor.
// Bilet fiziksel bir nesne olduğu için (seans panosu gibi) iki temada da koyu; oyuklar ise
// biletin durduğu zeminin rengiyle (notchColor) çiziliyor.
// "pending": arkadaki biletler henüz hesaplanmamış gibi görünüyor (delikler sönük, yüzde "··").

const D = { surface: "#1c1a24", surface2: "#242230", text: "#f2ede2", dim: "#8f8a9c", border: "#2d2b38", film: "#0d0b0a", sprocket: "#2e2924" };
const HOLES = 22;
const COUNT_MS = 900;

export function tierColor(pct) {
  if (pct >= 85) return "#e2c171";
  if (pct >= 60) return "#c9a44c";
  if (pct >= 40) return "#5fb3a3";
  return "#6d6879";
}

export function matchSummary(pct) {
  if (pct >= 90) return "Neredeyse ikiz gibisiniz";
  if (pct >= 80) return "Çok güçlü uyum";
  if (pct >= 65) return "Güçlü uyum";
  if (pct >= 50) return "Ortak noktanız bol";
  return "Keşfedilecek ortaklıklar var";
}

function Sprockets({ style }) {
  return (
    <View style={[s.sprockets, style]} pointerEvents="none">
      {Array.from({ length: 16 }, (_, i) => <View key={i} style={s.sprocket} />)}
    </View>
  );
}

export default function SeatTicket({ mate, pending = false, notchColor, onOpenProfile, interactive = false, stamps = null }) {
  const pct = Math.max(0, Math.min(99, Number(mate.matchPercent) || 0));
  const tier = tierColor(pct);
  const { width: W } = useWindowDimensions();
  const [shown, setShown] = useState(pending ? 0 : pct);
  const count = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const [sheenOn, setSheenOn] = useState(false);

  useEffect(() => {
    if (pending) return undefined;
    let alive = true;
    const id = count.addListener(({ value }) => { if (alive) setShown(Math.round(value)); });
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (!alive) return;
      if (reduce) { setShown(pct); return; }
      setShown(0);
      count.setValue(0);
      Animated.timing(count, { toValue: pct, duration: COUNT_MS, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
        if (!finished || !alive || pct < 85) return;
        setSheenOn(true);
        sheen.setValue(0);
        Animated.timing(sheen, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => alive && setSheenOn(false));
      });
    });
    return () => { alive = false; count.removeListener(id); count.stopAnimation(); sheen.stopAnimation(); };
  }, [pending, pct]);

  const lit = pending ? 0 : Math.round((shown / 100) * HOLES);
  const common = Array.isArray(mate.common) ? mate.common.slice(0, 3) : [];
  const sharedCount = Math.max(Number(mate.sharedCount) || 0, common.length);
  const extra = sharedCount - common.length;
  const genres = Array.isArray(mate.sharedGenres) ? mate.sharedGenres.slice(0, 2) : [];
  const fav = mate.favorite || null;
  const bio = (mate.bio || "").trim();
  const notch = notchColor || "#14121a";
  const Photo = interactive ? TouchableOpacity : View;

  return (
    <View
      style={s.ticket}
      accessible
      accessibilityLabel={translateUI("{0}, %{1} uyum, {2} ortak beğeni", { 0: mate.name, 1: pct, 2: sharedCount })}
    >
      <Photo style={s.photo} {...(interactive ? { onPress: onOpenProfile, activeOpacity: 0.92 } : {})}>
        <RetryImage source={{ uri: avatarOr(mate.avatarUrl, mate.id) }} style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={["rgba(28,26,36,1)", "rgba(28,26,36,0.82)", "rgba(28,26,36,0)"]}
          locations={[0, 0.18, 0.55]}
          start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={s.pill} pointerEvents="none">
          <View style={[s.pillDot, { backgroundColor: tier, shadowColor: tier }]} />
          <Text style={[s.pillText, { color: pct >= 60 ? "#e2c171" : D.text }]} numberOfLines={1}>{upperTR(translateUI(matchSummary(pct)))}</Text>
        </View>
        <View style={s.who} pointerEvents="none">
          <Text style={s.name} numberOfLines={1}>{mate.name}</Text>
          {!!mate.username && <Text style={s.user} numberOfLines={1}>{translateUI("@")}{mate.username}</Text>}
        </View>
      </Photo>

      {/* zımba çizgisi = uyum ölçeri */}
      <View style={s.perfRow} pointerEvents="none">
        <View style={[s.notch, s.notchL, { backgroundColor: notch }]} />
        <View style={s.holes}>
          {Array.from({ length: HOLES }, (_, i) => (
            <View key={i} style={[s.hole, i < lit && { backgroundColor: tier, shadowColor: tier, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }]} />
          ))}
        </View>
        <View style={[s.notch, s.notchR, { backgroundColor: notch }]} />
      </View>

      <View style={s.stub}>
        <View style={s.rowA}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {sharedCount > 0 ? (
              <>
                <Text style={s.label}>{translateUI("ORTAK BEĞENİLER")}{" · "}<Text style={s.labelGold}>{sharedCount}</Text></Text>
                <View style={s.strip}>
                  <Sprockets style={{ top: 3 }} />
                  <Sprockets style={{ bottom: 3 }} />
                  {common.map((m) => (
                    m.poster ? <Image key={m.id} source={{ uri: m.poster }} style={s.frame} /> : <View key={m.id} style={[s.frame, { backgroundColor: D.surface2 }]} />
                  ))}
                  {extra > 0 && <View style={[s.frame, s.more]}><Text style={s.moreText}>+{extra}</Text></View>}
                </View>
              </>
            ) : (
              <>
                <Text style={s.label}>{translateUI("ORTAK BEĞENİLER")}</Text>
                <Text style={s.empty} numberOfLines={2}>{translateUI("Henüz ortak beğeniniz yok; uyum sevdiğiniz türlerden ve puanlarınızdan geliyor.")}</Text>
              </>
            )}
          </View>
          <View style={s.score}>
            <Text style={[s.scoreNum, { color: tier }]}>{getLanguage() === "en" ? (pending ? "··%" : `${shown}%`) : (pending ? "%··" : `%${shown}`)}</Text>
            <Text style={s.scoreLabel}>{translateUI("UYUM")}</Text>
          </View>
        </View>

        {genres.length > 0 && (
          <View style={s.rowB}>
            <Text style={[s.label, { marginBottom: 0, marginRight: 2 }]}>{translateUI("ORTAK TÜRLER")}</Text>
            {genres.map((g) => <View key={g} style={s.chip}><Text style={s.chipText}>{translateUI(g)}</Text></View>)}
          </View>
        )}
        {!!fav && (
          <View style={s.rowC}>
            <Text style={[s.label, { marginBottom: 0 }]}>{translateUI("FAVORİSİ")}</Text>
            {fav.poster ? <Image source={{ uri: fav.poster }} style={s.favPoster} /> : <View style={[s.favPoster, { backgroundColor: D.surface2 }]} />}
            <Text style={s.favTitle} numberOfLines={1}>{fav.title}</Text>
          </View>
        )}
        {!!bio && <Text style={s.bio} numberOfLines={1}>{`“${bio}”`}</Text>}
      </View>

      {sheenOn && (
        <Animated.View
          pointerEvents="none"
          style={[s.sheen, { transform: [{ translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-160, W + 40] }) }, { rotate: "18deg" }] }]}
        >
          <LinearGradient colors={["rgba(226,193,113,0)", "rgba(255,236,190,0.22)", "rgba(226,193,113,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFillObject} />
        </Animated.View>
      )}
      {stamps}
    </View>
  );
}

// Gişe mührü: çift çerçeveli, eğik damga. Opaklığı kaydırma miktarından (pan.x) geliyor.
export function TicketStamp({ label, color, side, opacity }) {
  return (
    <Animated.View pointerEvents="none" style={[s.stamp, side === "left" ? s.stampL : s.stampR, { borderColor: color, opacity }]}>
      <View style={[s.stampInner, { borderColor: color }]}>
        <Text style={[s.stampText, { color }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  ticket: { flex: 1, borderRadius: 22, overflow: "hidden", backgroundColor: D.surface, borderWidth: 1, borderColor: D.border },
  photo: { height: "55%", backgroundColor: D.surface2, overflow: "hidden" },
  pill: {
    position: "absolute", top: 14, left: 14, maxWidth: "80%", flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(10,9,14,0.58)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  pillText: { fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.3 },
  who: { position: "absolute", left: 18, right: 18, bottom: 6 },
  name: { fontFamily: FONTS.marquee, fontSize: 38, lineHeight: 40, color: D.text },
  user: { fontFamily: FONTS.mono, fontSize: 11, color: "rgba(242,237,226,0.62)", marginTop: 1 },
  perfRow: { height: 16, justifyContent: "center" },
  holes: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 22 },
  hole: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0f0d14" },
  notch: { position: "absolute", top: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: D.border },
  notchL: { left: -11 },
  notchR: { right: -11 },
  stub: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, overflow: "hidden" },
  label: { fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.2, color: D.dim, marginBottom: 6 },
  labelGold: { color: "#e2c171" },
  rowA: { flexDirection: "row", gap: 12 },
  strip: { height: 68, backgroundColor: D.film, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8, flexDirection: "row", gap: 6, alignItems: "center", overflow: "hidden" },
  sprockets: { position: "absolute", left: 6, right: 6, height: 3, flexDirection: "row", justifyContent: "space-between" },
  sprocket: { width: 5, height: 3, borderRadius: 1, backgroundColor: D.sprocket },
  frame: { width: 34, height: 50, borderRadius: 3 },
  more: { backgroundColor: D.surface2, alignItems: "center", justifyContent: "center" },
  moreText: { fontFamily: FONTS.monoMedium, fontSize: 11, color: D.text },
  empty: { fontSize: 11.5, lineHeight: 16, color: D.dim },
  score: { width: 88, borderLeftWidth: 1.5, borderStyle: "dashed", borderColor: D.border, alignItems: "center", justifyContent: "center", paddingLeft: 10 },
  scoreNum: { fontFamily: FONTS.marquee, fontSize: 46, lineHeight: 48 },
  scoreLabel: { fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 2.5, color: D.dim, marginTop: 1 },
  rowB: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  chip: { borderWidth: 1, borderColor: D.border, backgroundColor: D.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11.5, color: D.text },
  rowC: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  favPoster: { width: 20, height: 30, borderRadius: 3 },
  favTitle: { flex: 1, fontSize: 12.5, fontWeight: "600", color: D.text },
  bio: { marginTop: 8, fontSize: 12.5, fontStyle: "italic", color: "rgba(242,237,226,0.62)" },
  sheen: { position: "absolute", top: "-40%", bottom: "-40%", width: 70 },
  stamp: { position: "absolute", top: 60, borderWidth: 3, borderRadius: 10, padding: 3 },
  stampL: { left: 18, transform: [{ rotate: "-12deg" }] },
  stampR: { right: 18, transform: [{ rotate: "12deg" }] },
  stampInner: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 12, paddingTop: 2 },
  stampText: { fontFamily: FONTS.marquee, fontSize: 34, lineHeight: 38, letterSpacing: 3 },
});
