import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Animated, Easing, StyleSheet, AccessibilityInfo, useWindowDimensions } from "react-native";
import Svg, { Line } from "react-native-svg";
import RetryImage from "../RetryImage";

// Düğüm: iki kişinin avatarından çıkan noktalar ortada buluşup birbirine bağlanıyor ve bir kalp
// örüyor; kalp iki kez atıyor. Noktalar geldikleri kişinin renginde kalıyor (sen altın, o mavi),
// yani kalp ikinizin noktalarından örülü. "center" verilirse (MatchParty'de eşleşen filmin afişi)
// kalbin ortası ona ayrılıyor ve afiş kalp örüldükten sonra yerine oturuyor.

const GOLD = "#e2c171";
const BLUE = "#6f9fb0";
const LINE = "201,164,76";
const OUTLINE = 40;
const TOTAL = 64;
const FLIGHT = 1100; // ms, bir noktanın yolculuğu
const SAMPLES = 8;

const heartXY = (t) => [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

// Kalbin içi: sınır eğrisinin biraz küçültülmüş hâlinin içinde kalan rastgele noktalar.
function insideHeart(x, y) {
  const poly = HEART_POLY;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const HEART_POLY = Array.from({ length: 72 }, (_, i) => heartXY((i / 72) * Math.PI * 2).map((v) => v * 0.84));

function buildPoints({ k, cx, cy, hole, from }) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts = [];
  for (let i = 0; i < OUTLINE; i++) {
    const [x, y] = heartXY((i / OUTLINE) * Math.PI * 2);
    pts.push({ tx: cx + x * k, ty: cy + y * k });
  }
  for (let tries = 0; pts.length < TOTAL && tries < 4000; tries++) {
    const x = rnd() * 32 - 16, y = rnd() * 29 - 12;
    if (!insideHeart(x, y)) continue;
    if (hole && Math.abs(x) * k < hole.w / 2 + 8 && Math.abs(y * k - hole.dy) < hole.h / 2 + 8) continue;
    pts.push({ tx: cx + x * k, ty: cy + y * k });
  }
  pts.forEach((p, i) => {
    p.fromA = i % 2 === 0;
    p.sx = p.fromA ? from.ax : from.bx;
    p.sy = from.y;
    p.delay = ((i % 20) * 0.03 + rnd() * 0.15) * 1000;
  });
  return pts;
}

function linesFor(pts, reach) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].tx - pts[j].tx, pts[i].ty - pts[j].ty);
      if (d < reach) out.push({ x1: pts[i].tx, y1: pts[i].ty, x2: pts[j].tx, y2: pts[j].ty, o: (1 - d / reach) * 0.55 });
    }
  }
  return out;
}

export default function KnotHeart({ leftAvatar, rightAvatar, center, onFormed }) {
  const { width: W } = useWindowDimensions();
  // Kalp birimi: eğri x'te ±16, y'de -12…17 birim. Ortadaki afiş, kalbin üst çentiğinin (y = -5)
  // altından başlayıp kalbin daraldığı yere kadar sığacak boyutta.
  const k = Math.min(8.4, (W - 72) / 32);
  const cx = W / 2;
  const avatarY = 40;
  const cy = Math.round(avatarY + 32 + 24 + 11.9 * k);
  const height = Math.ceil(cy + 17 * k + 14);
  const centerSize = { w: Math.round(8.6 * k), h: Math.round(8.6 * k * 1.5) };
  const hole = center ? { w: centerSize.w, h: centerSize.h, dy: 2.4 * k } : null;

  const pts = useMemo(
    () => buildPoints({ k, cx, cy, hole, from: { ax: 72, bx: W - 72, y: avatarY } }),
    [W, !!center],
  );
  const lines = useMemo(() => linesFor(pts, 34 * (k / 8.4)), [pts, k]);

  const clock = useRef(new Animated.Value(0)).current;
  const net = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(1)).current;
  const centerIn = useRef(new Animated.Value(0)).current;
  const avatarsIn = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);

  const end = FLIGHT + Math.max(...pts.map((p) => p.delay));

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => r).catch(() => false).then((r) => {
      if (cancelled) return;
      if (r) {
        setReduce(true);
        clock.setValue(end);
        [net, centerIn, avatarsIn].forEach((v) => v.setValue(1));
        onFormed?.();
        return;
      }
      Animated.timing(avatarsIn, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      Animated.sequence([
        Animated.timing(clock, { toValue: end, duration: end, easing: Easing.linear, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(net, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.spring(centerIn, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(beat, { toValue: 1.06, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(beat, { toValue: 1, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(beat, { toValue: 1.04, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(beat, { toValue: 1, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
      ]).start(({ finished }) => { if (finished) onFormed?.(); });
    });
    return () => { cancelled = true; clock.stopAnimation(); };
  }, []);

  // Her nokta için yol, ana saat üzerinden örnekleniyor: yatayda yumuşak varış, dikeyde
  // yukarı doğru bir kavis. Örnekleme sayesinde hepsi native sürücüde tek saatle oynuyor.
  const dotStyle = (p) => {
    const input = [], xs = [], ys = [];
    for (let s = 0; s <= SAMPLES; s++) {
      const f = s / SAMPLES;
      const q = easeOut(f);
      input.push(p.delay + f * FLIGHT);
      xs.push((p.tx - p.sx) * q);
      ys.push((p.ty - p.sy) * q - Math.sin(q * Math.PI) * 40);
    }
    return {
      left: p.sx - 3, top: p.sy - 3,
      backgroundColor: p.fromA ? GOLD : BLUE,
      opacity: clock.interpolate({ inputRange: [p.delay, p.delay + 120], outputRange: [0, 1], extrapolate: "clamp" }),
      transform: [
        { translateX: clock.interpolate({ inputRange: input, outputRange: xs, extrapolate: "clamp" }) },
        { translateY: clock.interpolate({ inputRange: input, outputRange: ys, extrapolate: "clamp" }) },
      ],
    };
  };

  // Kalp, kalbin ortası etrafında atıyor (görünümün kendi ortası değil).
  const beatTransform = [{ translateY: cy - height / 2 }, { scale: beat }, { translateY: height / 2 - cy }];

  return (
    <View style={{ width: W, height }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, { transform: beatTransform }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: net }]}>
          <Svg width={W} height={height}>
            {lines.map((l, i) => (
              <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={`rgba(${LINE},${l.o.toFixed(3)})`} strokeWidth={1} />
            ))}
          </Svg>
        </Animated.View>
        {pts.map((p, i) => (
          <Animated.View key={i} style={[styles.dot, reduce ? { left: p.tx - 3, top: p.ty - 3, backgroundColor: p.fromA ? GOLD : BLUE } : dotStyle(p)]} />
        ))}
        {!!center && (
          <Animated.View
            style={[styles.center, {
              left: cx - centerSize.w / 2, top: cy + hole.dy - centerSize.h / 2, width: centerSize.w, height: centerSize.h,
              opacity: centerIn,
              transform: [{ scale: centerIn.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            }]}
          >
            {center}
          </Animated.View>
        )}
      </Animated.View>

      {[{ src: leftAvatar, x: 72, from: -40 }, { src: rightAvatar, x: W - 72, from: 40 }].map((a, i) => (
        <Animated.View
          key={i}
          style={[styles.avatarWrap, {
            left: a.x - 32, top: avatarY - 32,
            opacity: avatarsIn,
            transform: [{ translateX: avatarsIn.interpolate({ inputRange: [0, 1], outputRange: [a.from, 0] }) }],
          }]}
        >
          <RetryImage source={a.src} style={[styles.avatar, { borderColor: i === 0 ? GOLD : BLUE }]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: "absolute", width: 6, height: 6, borderRadius: 3 },
  center: { position: "absolute", borderRadius: 6, overflow: "hidden", backgroundColor: "#211d27", shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  avatarWrap: { position: "absolute", width: 64, height: 64 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 3 },
});
