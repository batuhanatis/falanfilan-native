import { t as translateUI } from "../../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, AccessibilityInfo } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Polygon, Circle, Path } from "react-native-svg";
import { FONTS } from "../../theme/fonts";
import { OBJ } from "./describeKit";

// Makinist dairesi: istek gider gitmez fiş kabin penceresine girer, mercekten çıkan ışık perdeye
// vurur, perdede film şeridi akar. İlerleme nesnenin kendisinde: ışık perdeye ulaştıkça sonuç
// yaklaşıyor. Hareket azaltılmışsa ışık sabit yanar, şerit ve makara durur.
const FRAME_TONES = ["#2a2620", "#3a2f26", "#2f2a33", "#2a3030", "#3a2a2a"];
const FRAME_W = 20;
const FRAME_GAP = 10;
const LOOP = (FRAME_W + FRAME_GAP) * FRAME_TONES.length * 2; // 300 px: tonlar tekrar ettiği için dikişsiz

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setReduce(!!v); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return reduce;
}

function Sprockets() {
  return (
    <View style={st.holes}>
      {Array.from({ length: 28 }, (_, i) => <View key={i} style={st.hole} />)}
    </View>
  );
}

export default function MakinistBooth({ stage, ticketNo, stampText, c }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const beam = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(1)).current;
  const feed = useRef(new Animated.Value(0)).current;
  const roll = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      beam.setValue(1);
      return undefined;
    }
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 0.82, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(feed, { toValue: 1, duration: 960, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(640),
        Animated.timing(feed, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.timing(roll, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })),
    ];
    Animated.timing(beam, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => loops[0].start());
    loops.slice(1).forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce]);

  const beamH = 214;
  const steps = [
    { key: "read", label: translateUI("Fişin okundu"), state: "done" },
    { key: "scan", label: translateUI("Katalog taranıyor"), state: stage >= 3 ? "done" : "active" },
    { key: "line", label: translateUI("Perdeye diziliyor"), state: stage >= 3 ? "active" : "pending" },
  ];

  return (
    <View>
      <View style={st.booth} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible={false} importantForAccessibility="no-hide-descendants">
        <Text style={st.boothLabel}>{translateUI("MAKİNİST DAİRESİ")}</Text>
        <Text style={st.boothNo}>{translateUI("FİŞ {0}", { 0: ticketNo })}</Text>

        <Animated.View style={[st.feedSlip, { transform: [{ translateY: feed.interpolate({ inputRange: [0, 1], outputRange: [-6, 12] }) }] }]}>
          <View style={st.feedLine} />
          <View style={[st.feedLine, { width: "70%" }]} />
        </Animated.View>
        <View style={st.window}>
          <View style={st.windowSlot} />
          <View style={st.lens} />
        </View>

        {w > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[st.beam, { width: w, height: beamH, opacity: Animated.multiply(beam, breath), transform: [{ scaleY: beam.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }) }] }]}
          >
            <Svg width={w} height={beamH}>
              <Defs>
                <SvgGradient id="mkBeam" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={OBJ.glow} stopOpacity={0.46} />
                  <Stop offset="1" stopColor={OBJ.glow} stopOpacity={0.1} />
                </SvgGradient>
              </Defs>
              <Polygon points={`${w * 0.47},0 ${w * 0.53},0 ${w * 0.97},${beamH} ${w * 0.03},${beamH}`} fill="url(#mkBeam)" />
            </Svg>
          </Animated.View>
        )}

        <View style={st.screen}>
          <View style={st.band}>
            <Sprockets />
            <View style={{ overflow: "hidden" }}>
              <Animated.View style={[st.strip, { transform: [{ translateX: roll.interpolate({ inputRange: [0, 1], outputRange: [0, -LOOP] }) }] }]}>
                {Array.from({ length: 30 }, (_, i) => <View key={i} style={[st.frame, { backgroundColor: FRAME_TONES[i % FRAME_TONES.length] }]} />)}
              </Animated.View>
            </View>
            <Sprockets />
          </View>
        </View>
      </View>

      <View style={st.steps} accessibilityLiveRegion="polite">
        {steps.map((s) => (
          <View key={s.key} style={st.step} accessible accessibilityLabel={s.label}>
            {s.state === "done" ? (
              <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M5 12.5l4.2 4.2L19 7" stroke={OBJ.brass} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
            ) : s.state === "active" ? (
              <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Circle cx={12} cy={12} r={9} stroke={OBJ.brass} strokeWidth={1.8} fill="none" />
                  <Circle cx={12} cy={12} r={1.6} stroke={OBJ.brass} strokeWidth={1.8} fill="none" />
                  <Circle cx={12} cy={6.6} r={2} stroke={OBJ.brass} strokeWidth={1.8} fill="none" />
                  <Circle cx={17} cy={14.6} r={2} stroke={OBJ.brass} strokeWidth={1.8} fill="none" />
                  <Circle cx={7} cy={14.6} r={2} stroke={OBJ.brass} strokeWidth={1.8} fill="none" />
                </Svg>
              </Animated.View>
            ) : (
              <View style={st.pendingDotWrap}><View style={st.pendingDot} /></View>
            )}
            <Text style={[st.stepText, { color: s.state === "active" ? OBJ.brass : s.state === "done" ? c.text : c.dim }, s.state === "active" && { fontWeight: "600" }]}>{s.label}</Text>
            {s.key === "read" && !!stampText && <Text style={st.stepMeta} numberOfLines={1}>{stampText}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  booth: { height: 400, borderRadius: 18, backgroundColor: OBJ.board, borderWidth: 1, borderColor: OBJ.boardBorder, overflow: "hidden" },
  boothLabel: { position: "absolute", left: 16, top: 14, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.4, color: OBJ.brass },
  boothNo: { position: "absolute", right: 16, top: 14, fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1, color: OBJ.boardDim },
  feedSlip: { position: "absolute", top: 30, left: "50%", marginLeft: -23, width: 46, height: 30, borderRadius: 2, backgroundColor: OBJ.paper, paddingHorizontal: 6, paddingTop: 6, gap: 4 },
  feedLine: { height: 2, backgroundColor: "rgba(42,33,24,0.45)" },
  window: { position: "absolute", top: 46, left: "50%", marginLeft: -66, width: 132, height: 52, borderRadius: 6, backgroundColor: OBJ.window, borderWidth: 1, borderColor: OBJ.windowLine, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8 },
  windowSlot: { position: "absolute", left: 18, right: 18, top: 0, height: 4, backgroundColor: OBJ.seam, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  lens: { width: 16, height: 16, borderRadius: 8, backgroundColor: OBJ.glow, shadowColor: OBJ.glow, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  beam: { position: "absolute", left: 0, top: 90, transformOrigin: "top" },
  screen: { position: "absolute", left: 14, right: 14, top: 290, height: 96, borderRadius: 4, backgroundColor: "rgba(255,227,163,0.10)", borderWidth: 1, borderColor: "rgba(255,227,163,0.28)", overflow: "hidden", justifyContent: "center" },
  band: { height: 74, backgroundColor: OBJ.band, paddingVertical: 4, justifyContent: "space-between" },
  holes: { height: 6, flexDirection: "row", gap: 6, paddingHorizontal: 3, overflow: "hidden" },
  hole: { width: 6, height: 6, borderRadius: 1, backgroundColor: OBJ.hole },
  strip: { flexDirection: "row", gap: FRAME_GAP, width: (FRAME_W + FRAME_GAP) * 30 },
  frame: { width: FRAME_W, height: 42, borderRadius: 2 },
  steps: { marginTop: 16, gap: 6 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 30 },
  stepText: { fontSize: 14.5 },
  stepMeta: { marginLeft: "auto", fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1, color: OBJ.boardDim, flexShrink: 1 },
  pendingDotWrap: { width: 20, alignItems: "center" },
  pendingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#5a5466" },
});
