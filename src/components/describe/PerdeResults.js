import { t as translateUI } from "../../i18n/core";
import React, { useState } from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { FONTS, upperTR } from "../../theme/fonts";
import { platformName } from "../../utils/platform";
import { hapticSelection } from "../../utils/haptics";
import { OBJ, StampMark, TicketStubs } from "./describeKit";

// Perde: en uygun sonuç büyük kartta gerekçesiyle ("Neden bu?"), geri kalanı numaralı film
// şeridinde. Şeritteki bir afişe dokununca üstteki kart o içeriğe geçer.
function metaLine(m) {
  return upperTR([m.type ? translateUI(m.type) : null, m.year, m.runtime, m.genre ? translateUI(m.genre) : null].filter(Boolean).join(" · "));
}

function Sprockets() {
  return (
    <View style={pr.holes} pointerEvents="none">
      {Array.from({ length: 30 }, (_, i) => <View key={i} style={pr.hole} />)}
    </View>
  );
}

export default function PerdeResults({ results, slipText, stamps, matchedPerson, allowance, c, onEdit, onNew, onShowHome, onOpen, onAddToList }) {
  const [sel, setSel] = useState(0);
  const cur = results[Math.min(sel, results.length - 1)] || results[0];
  const reason = cur.reason || (matchedPerson?.name ? translateUI("{0} filmografisinden", { 0: matchedPerson.name }) : null);
  const platform = platformName(cur.platforms?.[0]);
  const rankLabel = sel === 0 ? translateUI("1. SIRADA · EN UYGUNU") : translateUI("{0}. SIRADA", { 0: sel + 1 });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <View style={pr.slip}>
          <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
            <Text style={pr.slipText} numberOfLines={2}>“{slipText}”</Text>
            {stamps.length > 0 && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                {stamps.map((s, i) => <StampMark key={s} label={s} size={13} rotate={i % 2 ? "3deg" : "-4deg"} style={pr.smallMark} />)}
              </View>
            )}
          </View>
          <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" style={pr.slipEdit}>
            <Text style={pr.slipEditText}>{translateUI("Düzelt")}</Text>
          </Pressable>
        </View>

        <View style={[pr.hero, { backgroundColor: c.surface2, borderColor: c.border }]}>
          <View style={{ flexDirection: "row", gap: 14 }}>
            {cur.poster ? (
              <Image source={{ uri: cur.poster }} style={pr.poster} accessibilityLabel={translateUI("{0} afişi", { 0: cur.title })} />
            ) : (
              <View style={[pr.poster, { backgroundColor: c.surface }]} />
            )}
            <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
              <Text style={pr.rank}>{rankLabel}</Text>
              <Text style={[pr.title, { color: c.text }]} numberOfLines={3}>{cur.title}</Text>
              <Text style={[pr.meta, { color: c.dim }]} numberOfLines={2}>{metaLine(cur)}</Text>
              <View style={pr.pills}>
                {Number(cur.imdb) > 0 && (
                  <View style={[pr.pill, { backgroundColor: c.surface }]}><Text style={[pr.pillMono, { color: c.text }]}>IMDB {Number(cur.imdb).toFixed(1)}</Text></View>
                )}
                {!!platform && (
                  <View style={[pr.pill, { backgroundColor: c.surface }]}><Text style={[pr.pillText, { color: c.text }]} numberOfLines={1}>{platform}</Text></View>
                )}
              </View>
            </View>
          </View>
          {!!reason && (
            <View style={{ gap: 4 }}>
              <Text style={pr.whyLabel}>{translateUI("NEDEN BU?")}</Text>
              <Text style={[pr.why, { color: c.text }]}>{reason}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable style={[pr.ghost, { borderColor: c.border }]} onPress={() => onAddToList(cur)} accessibilityRole="button">
              <Text style={[pr.ghostText, { color: c.text }]}>{translateUI("Listeye ekle")}</Text>
            </Pressable>
            <Pressable style={[pr.gold, { backgroundColor: c.accent }]} onPress={() => onOpen(cur)} accessibilityRole="button">
              <Text style={pr.goldText}>{translateUI("Detaya git")}</Text>
            </Pressable>
          </View>
        </View>

        {results.length > 1 && (
          <>
            <View style={pr.stripHead}>
              <Text style={[pr.label, { color: c.dim }]}>{translateUI("PERDEDEKİ SIRA · {0} EŞLEŞME", { 0: results.length })}</Text>
              <Text style={[pr.stripHint, { color: c.dim }]}>{translateUI("Dokun, üstte aç")}</Text>
            </View>
            <View style={pr.band}>
              <Sprockets />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pr.stripRow}>
                {results.map((m, i) => (
                  <Pressable
                    key={`${m.id}-${i}`}
                    onPress={() => { hapticSelection(); setSel(i); }}
                    style={[pr.frame, i === sel && pr.frameOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: i === sel }}
                    accessibilityLabel={`${i + 1}. ${m.title}`}
                  >
                    <Text style={pr.frameNo}>{String(i + 1).padStart(2, "0")}</Text>
                    {m.poster ? <Image source={{ uri: m.poster }} style={pr.framePoster} /> : <View style={[pr.framePoster, { backgroundColor: "#2a2620" }]} />}
                  </Pressable>
                ))}
              </ScrollView>
              <Sprockets />
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ gap: 10, paddingTop: 8 }}>
        <TicketStubs allowance={allowance} c={c} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable style={[pr.ghost, { borderColor: c.border }]} onPress={onNew} accessibilityRole="button">
            <Text style={[pr.ghostText, { color: c.text }]}>{translateUI("Yeni fiş")}</Text>
          </Pressable>
          <Pressable style={[pr.ghost, { borderColor: c.border }]} onPress={onShowHome} accessibilityRole="button">
            <Text style={[pr.ghostText, { color: c.text }]}>{translateUI("Ana sayfada göster")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const pr = StyleSheet.create({
  slip: { marginTop: 4, backgroundColor: OBJ.paper, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  slipText: { fontFamily: FONTS.mono, fontSize: 12, lineHeight: 17, color: OBJ.paperInk },
  slipEdit: { minHeight: 32, justifyContent: "center" },
  slipEditText: { fontSize: 12, fontWeight: "700", color: OBJ.paperInk, textDecorationLine: "underline" },
  smallMark: { borderWidth: 2, paddingHorizontal: 6, paddingVertical: 0 },
  hero: { marginTop: 14, borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  poster: { width: 108, height: 162, borderRadius: 6, borderWidth: 1, borderColor: "rgba(212,169,74,0.45)" },
  rank: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.4, color: OBJ.brass },
  title: { fontFamily: FONTS.marquee, fontSize: 27, lineHeight: 28 },
  meta: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 15, letterSpacing: 0.3 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillMono: { fontFamily: FONTS.mono, fontSize: 11 },
  pillText: { fontSize: 11.5 },
  whyLabel: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1, color: OBJ.brass },
  why: { fontSize: 14, lineHeight: 20 },
  ghost: { flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  ghostText: { fontSize: 13.5, fontWeight: "700" },
  gold: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  goldText: { fontSize: 13.5, fontWeight: "800", color: OBJ.onAccent },
  stripHead: { marginTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  label: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1 },
  stripHint: { fontSize: 11.5 },
  band: { marginTop: 8, backgroundColor: OBJ.band, borderRadius: 4, paddingVertical: 5, gap: 4 },
  holes: { height: 6, flexDirection: "row", gap: 6, paddingHorizontal: 6, overflow: "hidden" },
  hole: { width: 6, height: 6, borderRadius: 1, backgroundColor: OBJ.hole },
  stripRow: { paddingHorizontal: 8, gap: 6 },
  frame: { alignItems: "center", gap: 4, padding: 4, borderRadius: 5, borderWidth: 2, borderColor: "transparent" },
  frameOn: { borderColor: OBJ.brass },
  frameNo: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1, color: OBJ.brass },
  framePoster: { width: 64, height: 96, borderRadius: 3 },
});
